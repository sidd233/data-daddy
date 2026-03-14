import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import pool from "@/lib/db";

// ── ABI (minimal — only what the backend calls) ──────────────────────────────

const CERTIFICATE_REGISTRY_ABI = [
  {
    name: "mintCertificate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "attributeKey", type: "bytes32" },
      { name: "confidenceLevel", type: "uint8" },
      { name: "expiresAt", type: "uint40" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "CertificateMinted",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "attributeKey", type: "bytes32", indexed: true },
      { name: "confidence", type: "uint8", indexed: false },
      { name: "issuedAt", type: "uint40", indexed: false },
    ],
  },
] as const;

// ── Clients (lazy-initialised once) ──────────────────────────────────────────

function getClients() {
  const privateKey = process.env.ISSUER_PRIVATE_KEY;
  if (!privateKey) throw new Error("ISSUER_PRIVATE_KEY not set");

  const rpcUrl = process.env.ALCHEMY_RPC;
  if (!rpcUrl) throw new Error("ALCHEMY_RPC not set");

  const registryAddress = process.env.CERTIFICATE_REGISTRY_ADDRESS as
    | `0x${string}`
    | undefined;
  if (!registryAddress) throw new Error("CERTIFICATE_REGISTRY_ADDRESS not set");

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  return { walletClient, publicClient, account, registryAddress };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Mints a certificate on-chain and stores the tokenId back in verification_verdicts.
 * Returns the minted tokenId.
 */
export async function mintCertificate(
  walletAddress: string,
  attributeKey: string,
  confidenceLevel: number, // 0–100 integer
  verdictId: number
): Promise<bigint> {
  const { walletClient, publicClient, registryAddress } = getClients();

  const attrKeyBytes32 = keccak256(toHex(attributeKey));
  const confidenceUint8 = Math.min(100, Math.max(0, Math.round(confidenceLevel)));

  // Write tx
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: CERTIFICATE_REGISTRY_ABI,
    functionName: "mintCertificate",
    args: [
      walletAddress as `0x${string}`,
      attrKeyBytes32,
      confidenceUint8,
      0, // no expiry (uint40 = 0)
    ],
  });

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Extract tokenId from CertificateMinted event
  const mintedLog = receipt.logs.find((log) => {
    try {
      // topic[0] is the event signature hash
      return log.topics[0] ===
        keccak256(toHex("CertificateMinted(uint256,address,bytes32,uint8,uint40)"));
    } catch {
      return false;
    }
  });

  // tokenId is the first indexed param — topics[1]
  const tokenId = mintedLog?.topics[1]
    ? BigInt(mintedLog.topics[1])
    : 0n;

  // Store tokenId back in the verdict row
  if (tokenId > 0n) {
    await pool.query(
      `UPDATE verification_verdicts SET certificate_token_id = $1 WHERE id = $2`,
      [Number(tokenId), verdictId]
    );
  }

  return tokenId;
}
