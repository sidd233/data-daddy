# API Routes Context

This document contains all API route handlers extracted from the project.

--------------------------------------------------
## Route: /content/deliver
File: src/app/api/content/deliver/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing wallet address" },
      { status: 400 }
    );
  }

  try {

    // 1️⃣ Get verified attributes
    const attrs = await pool.query(
      `
      SELECT attribute_key
      FROM verification_verdicts
      WHERE wallet_address = $1
      AND verified = TRUE
      `,
      [address]
    );

    const keys = attrs.rows.map(r => r.attribute_key);

    if (keys.length === 0) {
      return NextResponse.json([]);
    }

    // 2️⃣ Find matching requests
    const requests = await pool.query(
      `
      SELECT id
      FROM lease_requests
      WHERE attribute_key = ANY($1)
      AND active = TRUE
      `,
      [keys]
    );

    const requestIds = requests.rows.map(r => r.id);

    if (requestIds.length === 0) {
      return NextResponse.json([]);
    }

    // 3️⃣ Fetch buyer content
    const content = await pool.query(
      `
      SELECT *
      FROM buyer_content
      WHERE request_id = ANY($1)
      `,
      [requestIds]
    );

    return NextResponse.json(content.rows);

  } catch (error) {

    console.error("Content delivery error:", error);

    return NextResponse.json(
      { error: "Failed to deliver content" },
      { status: 500 }
    );

  }

}
```

--------------------------------------------------
## Route: /lease/stats
File: src/app/api/lease/stats/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing wallet address" },
      { status: 400 }
    );
  }

  try {

    // 1️⃣ get verified attributes
    const attrs = await pool.query(
      `
      SELECT attribute_key
      FROM verification_verdicts
      WHERE wallet_address = $1
      AND verified = TRUE
      `,
      [address]
    );

    const keys = attrs.rows.map(r => r.attribute_key);

    if (keys.length === 0) {
      return NextResponse.json({
        active_requests: 0,
        pending_matches: 0,
        potential_earnings: 0
      });
    }

    // 2️⃣ count matching requests
    const matches = await pool.query(
      `
      SELECT *
      FROM lease_requests
      WHERE attribute_key = ANY($1)
      AND active = TRUE
      `,
      [keys]
    );

    const pendingMatches = matches.rows.length;

    const potentialEarnings = matches.rows.reduce(
      (sum, r) => sum + Number(r.price_per_user),
      0
    );

    return NextResponse.json({
      active_requests: matches.rows.length,
      pending_matches: pendingMatches,
      potential_earnings: potentialEarnings
    });

  } catch (error) {

    console.error("Stats error:", error);

    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }

}
```

--------------------------------------------------
## Route: /match/requests
File: src/app/api/match/requests/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing wallet address" },
      { status: 400 }
    );
  }

  try {

    const result = await pool.query(
      `
      SELECT r.*
      FROM lease_requests r
      JOIN verification_verdicts v
      ON r.attribute_key = v.attribute_key
      WHERE v.wallet_address = $1
      AND v.verified = TRUE
      AND v.confidence >= r.min_confidence
      AND r.active = TRUE
      AND r.filled_count < r.max_users
      `,
      [address]
    );

    return NextResponse.json(result.rows);

  } catch (error) {

    console.error("Match error:", error);

    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
```

--------------------------------------------------
## Route: /testdb
File: src/app/api/testdb/route.ts

```ts
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query("SELECT NOW()");

    return NextResponse.json({
      success: true,
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("DB error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Database connection failed",
      },
      { status: 500 }
    );
  }
}
```

--------------------------------------------------
## Route: /verify/onchain
File: src/app/api/verify/onchain/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import pool from "@/lib/db";

const DEFI_CONTRACTS: Record<string, string> = {
  "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9": "Aave V2",
  "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD": "Uniswap Universal Router",
};

const NOW_MS = Date.now();
const DAYS_180_MS = 180 * 24 * 60 * 60 * 1000;
const DAYS_365_MS = 365 * 24 * 60 * 60 * 1000;

interface AlchemyTransfer {
  to: string;
  from: string;
  metadata?: { blockTimestamp?: string };
}

interface Attribute {
  attribute: string;
  verified: boolean;
  confidence: number;
  evidence: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

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
    const [defiRes, sentRes, receivedRes, nftRes, tokenRes] =
      await Promise.all([
        axios.post(rpcUrl, {
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              fromAddress: address,
              toAddress: Object.keys(DEFI_CONTRACTS),
              category: ["external", "internal", "erc20"],
              withMetadata: true,
              maxCount: "0x64",
            },
          ],
        }),

        axios.post(rpcUrl, {
          jsonrpc: "2.0",
          id: 2,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              fromAddress: address,
              category: [
                "external",
                "internal",
                "erc20",
                "erc721",
                "erc1155",
              ],
              withMetadata: true,
              maxCount: "0x64",
            },
          ],
        }),

        axios.post(rpcUrl, {
          jsonrpc: "2.0",
          id: 3,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              toAddress: address,
              category: [
                "external",
                "internal",
                "erc20",
                "erc721",
                "erc1155",
              ],
              withMetadata: true,
              maxCount: "0x64",
            },
          ],
        }),

        axios.post(rpcUrl, {
          jsonrpc: "2.0",
          id: 4,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              toAddress: address,
              category: ["erc721"],
              maxCount: "0x1",
            },
          ],
        }),

        axios.post(rpcUrl, {
          jsonrpc: "2.0",
          id: 5,
          method: "alchemy_getTokenBalances",
          params: [address, "erc20"],
        }),
      ]);

    // -------------------------
    // defi_user
    // -------------------------
    const defiTransfers: AlchemyTransfer[] =
      defiRes.data?.result?.transfers ?? [];
    const totalDefi = defiTransfers.length;
    const defiVerified = totalDefi >= 3;

    // -------------------------
    // active_wallet + long_term_holder
    // -------------------------
    const sentTransfers: AlchemyTransfer[] =
      sentRes.data?.result?.transfers ?? [];

    const receivedTransfers: AlchemyTransfer[] =
      receivedRes.data?.result?.transfers ?? [];

    const allTransfers = [...sentTransfers, ...receivedTransfers];

    const timestamps = allTransfers
      .map((tx) => tx.metadata?.blockTimestamp)
      .filter(Boolean)
      .map((ts) => new Date(ts!).getTime());

    const recentTx = timestamps.filter(
      (t) => NOW_MS - t <= DAYS_180_MS
    );

    const oldTx = timestamps.filter(
      (t) => NOW_MS - t >= DAYS_365_MS
    );

    const activeVerified = recentTx.length >= 1;
    const longTermVerified = oldTx.length >= 1;

    // -------------------------
    // nft_holder
    // -------------------------
    const nftTransfers = nftRes.data?.result?.transfers ?? [];
    const nftVerified = nftTransfers.length > 0;

    // -------------------------
    // asset_holder
    // -------------------------
    const tokenBalances =
      tokenRes.data?.result?.tokenBalances ?? [];

    const nonZeroTokens = tokenBalances.filter(
      (t: { tokenBalance: string }) =>
        t.tokenBalance &&
        t.tokenBalance !==
          "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    const assetVerified = nonZeroTokens.length > 0;

    const attributes: Attribute[] = [
      {
        attribute: "defi_user",
        verified: defiVerified,
        confidence: defiVerified ? 1.0 : 0,
        evidence: `DeFi interactions found: ${totalDefi}`,
      },
      {
        attribute: "asset_holder",
        verified: assetVerified,
        confidence: assetVerified ? 1.0 : 0,
        evidence: assetVerified
          ? `Holds ${nonZeroTokens.length} ERC20 token type(s)`
          : "No ERC20 token balances found",
      },
      {
        attribute: "active_wallet",
        verified: activeVerified,
        confidence: activeVerified ? 1.0 : 0,
        evidence: activeVerified
          ? `${recentTx.length} transaction(s) in last 180 days`
          : "No transactions in last 180 days",
      },
      {
        attribute: "long_term_holder",
        verified: longTermVerified,
        confidence: longTermVerified ? 1.0 : 0,
        evidence: longTermVerified
          ? `${oldTx.length} transaction(s) older than 365 days`
          : "No transactions older than 365 days",
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

    // -------------------------
    // INSERT INTO DATABASE
    // -------------------------

    await Promise.all(
      attributes.map((attr) =>
        pool.query(
          `
          INSERT INTO verification_verdicts
          (wallet_address, attribute_key, verified, confidence, method, reasoning)
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            address,
            attr.attribute,
            attr.verified,
            attr.confidence,
            "onchain",
            attr.evidence,
          ]
        )
      )
    );

    return NextResponse.json(attributes);

  } catch (error: unknown) {

    console.error("Verification error:", error);

    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message ?? error.message
      : error instanceof Error
      ? error.message
      : "Unknown error";

    return NextResponse.json(
      { error: `RPC call failed: ${message}` },
      { status: 502 }
    );
  }
}
```

