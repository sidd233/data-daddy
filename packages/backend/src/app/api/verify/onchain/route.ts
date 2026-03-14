import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import pool from "@/lib/db";
import { mintCertificate } from "@/lib/blockchain/issuer";

// Base Sepolia DEX/DeFi contracts
const DEFI_CONTRACTS: string[] = [
  "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", // Uniswap v3 SwapRouter (Base Sepolia)
  "0x050E797f3625EC8785265e1d9BDd4799b97528A1", // Uniswap Universal Router (Base Sepolia)
  "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951", // Aave v3 Pool (Base Sepolia)
];

interface AlchemyTransfer {
  to: string | null;
  from: string;
  metadata?: { blockTimestamp?: string };
  category: string;
}

interface Attribute {
  attribute: string;
  verified: boolean;
  confidence: number;
  evidence: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid or missing address" },
      { status: 400 }
    );
  }

  const rpcUrl = process.env.ALCHEMY_RPC;
  if (!rpcUrl) {
    return NextResponse.json(
      { error: "ALCHEMY_RPC not configured" },
      { status: 500 }
    );
  }

  try {
    const [sentRes, receivedRes, nftRes, tokenRes, balanceRes] =
      await Promise.all([
        // All outgoing transfers
        axios.post(rpcUrl, {
          jsonrpc: "2.0", id: 1,
          method: "alchemy_getAssetTransfers",
          params: [{
            fromBlock: "0x0", toBlock: "latest",
            fromAddress: address,
            category: ["external", "internal", "erc20", "erc721", "erc1155"],
            withMetadata: true,
            maxCount: "0x64",
          }],
        }),
        // All incoming transfers
        axios.post(rpcUrl, {
          jsonrpc: "2.0", id: 2,
          method: "alchemy_getAssetTransfers",
          params: [{
            fromBlock: "0x0", toBlock: "latest",
            toAddress: address,
            category: ["external", "internal", "erc20", "erc721", "erc1155"],
            withMetadata: true,
            maxCount: "0x64",
          }],
        }),
        // Incoming ERC721
        axios.post(rpcUrl, {
          jsonrpc: "2.0", id: 3,
          method: "alchemy_getAssetTransfers",
          params: [{
            fromBlock: "0x0", toBlock: "latest",
            toAddress: address,
            category: ["erc721"],
            maxCount: "0x1",
          }],
        }),
        // ERC20 balances
        axios.post(rpcUrl, {
          jsonrpc: "2.0", id: 4,
          method: "alchemy_getTokenBalances",
          params: [address, "erc20"],
        }),
        // Native ETH balance
        axios.post(rpcUrl, {
          jsonrpc: "2.0", id: 5,
          method: "eth_getBalance",
          params: [address, "latest"],
        }),
      ]);

    const sentTransfers: AlchemyTransfer[] = sentRes.data?.result?.transfers ?? [];
    const receivedTransfers: AlchemyTransfer[] = receivedRes.data?.result?.transfers ?? [];
    const allTransfers = [...sentTransfers, ...receivedTransfers];

    // Timestamps from any transfer that has metadata
    const NOW_MS = Date.now();
    const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000;
    const timestamps = allTransfers
      .map((tx) => tx.metadata?.blockTimestamp)
      .filter(Boolean)
      .map((ts) => new Date(ts!).getTime());

    // ── active_wallet: has sent at least 1 tx ever ────────────────────────────
    const activeVerified = sentTransfers.length >= 1;

    // ── long_term_holder: any tx older than 90 days ───────────────────────────
    const oldTx = timestamps.filter((t) => NOW_MS - t >= DAYS_90_MS);
    const longTermVerified = oldTx.length >= 1 || (sentTransfers.length >= 1 && timestamps.length === 0);
    // fallback: if metadata not returned but has sent txs, assume long-term

    // ── nft_holder ────────────────────────────────────────────────────────────
    const nftTransfers = nftRes.data?.result?.transfers ?? [];
    const nftVerified = nftTransfers.length > 0;

    // ── asset_holder: non-zero ERC20 OR native ETH > 0 ───────────────────────
    const tokenBalances = tokenRes.data?.result?.tokenBalances ?? [];
    const nonZeroTokens = tokenBalances.filter(
      (t: { tokenBalance: string }) =>
        t.tokenBalance &&
        t.tokenBalance !== "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    const ethBalance = BigInt(balanceRes.data?.result ?? "0x0");
    const assetVerified = nonZeroTokens.length > 0 || ethBalance > 0n;

    // ── defi_user: sent tx to a known DeFi contract OR ≥5 total sent txs ─────
    const defiContractSet = new Set(DEFI_CONTRACTS.map((a) => a.toLowerCase()));
    const defiInteractions = sentTransfers.filter(
      (tx) => tx.to && defiContractSet.has(tx.to.toLowerCase())
    );
    const defiVerified = defiInteractions.length >= 1 || sentTransfers.length >= 5;

    const attributes: Attribute[] = [
      {
        attribute: "defi_user",
        verified: defiVerified,
        confidence: defiVerified ? 1.0 : 0,
        evidence: defiInteractions.length >= 1
          ? `${defiInteractions.length} DeFi contract interaction(s)`
          : defiVerified
          ? `${sentTransfers.length} outgoing transactions (active user)`
          : `${sentTransfers.length} outgoing transactions (need 5 for DeFi tier)`,
      },
      {
        attribute: "asset_holder",
        verified: assetVerified,
        confidence: assetVerified ? 1.0 : 0,
        evidence: assetVerified
          ? ethBalance > 0n
            ? `Holds ETH + ${nonZeroTokens.length} ERC20 token type(s)`
            : `Holds ${nonZeroTokens.length} ERC20 token type(s)`
          : "No ETH or token balances found",
      },
      {
        attribute: "active_wallet",
        verified: activeVerified,
        confidence: activeVerified ? 1.0 : 0,
        evidence: activeVerified
          ? `${sentTransfers.length} outgoing + ${receivedTransfers.length} incoming transfers`
          : "No transactions found",
      },
      {
        attribute: "long_term_holder",
        verified: longTermVerified,
        confidence: longTermVerified ? 1.0 : 0,
        evidence: longTermVerified
          ? oldTx.length > 0
            ? `${oldTx.length} transaction(s) older than 90 days`
            : `Wallet has transaction history`
          : "No transactions older than 90 days",
      },
      {
        attribute: "nft_holder",
        verified: nftVerified,
        confidence: nftVerified ? 1.0 : 0,
        evidence: nftVerified
          ? "At least one ERC721 transfer found"
          : "No ERC721 transfers found",
      },
    ];

    // ── UPSERT verdicts ───────────────────────────────────────────────────────
    const upsertResults: { id: number; certificate_token_id: number | null }[] = [];

    for (const attr of attributes) {
      const { rows } = await pool.query<{
        id: number;
        certificate_token_id: number | null;
      }>(
        `INSERT INTO verification_verdicts
           (wallet_address, attribute_key, verified, confidence, method, reasoning, fetched_at)
         VALUES ($1, $2, $3, $4, 'onchain', $5, NOW())
         ON CONFLICT (wallet_address, attribute_key) DO UPDATE SET
           verified   = EXCLUDED.verified,
           confidence = EXCLUDED.confidence,
           reasoning  = EXCLUDED.reasoning,
           fetched_at = NOW()
         RETURNING id, certificate_token_id`,
        [address, attr.attribute, attr.verified, attr.confidence, attr.evidence]
      );
      upsertResults.push(rows[0]);
    }

    // ── Mint certs for verified attributes that don't have one yet ────────────
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      const row = upsertResults[i];
      if (attr.verified && !row.certificate_token_id) {
        try {
          await mintCertificate(
            address,
            attr.attribute,
            Math.round(attr.confidence * 100),
            row.id
          );
        } catch (mintErr) {
          console.error(`Mint failed for ${attr.attribute}:`, mintErr);
        }
      }
    }

    return NextResponse.json(attributes);
  } catch (error: unknown) {
    console.error("Verification error:", error);
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message ?? error.message
      : error instanceof Error
      ? error.message
      : "Unknown error";
    return NextResponse.json(
      { error: `Verification failed: ${message}` },
      { status: 502 }
    );
  }
}
