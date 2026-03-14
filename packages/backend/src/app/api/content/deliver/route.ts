import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * GET /api/content/deliver?buyer=0x...
 *
 * Returns verified wallet addresses the buyer has paid for access to,
 * grouped by their lease request. Only active leases are included.
 */
export async function GET(request: NextRequest) {
  const buyer = new URL(request.url).searchParams.get("buyer");

  if (!buyer) {
    return NextResponse.json({ error: "Missing buyer address" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         r.on_chain_id   AS request_id,
         r.attribute_key,
         l.user_address  AS wallet,
         l.on_chain_id   AS lease_id,
         l.expires_at,
         l.started_at,
         v.confidence,
         v.certificate_token_id
       FROM leases l
       JOIN lease_requests r ON l.request_id = r.on_chain_id
       LEFT JOIN verification_verdicts v
         ON LOWER(v.wallet_address) = LOWER(l.user_address)
         AND v.attribute_key = r.attribute_key
       WHERE LOWER(r.buyer_address) = LOWER($1)
         AND l.status = 'Active'
       ORDER BY r.on_chain_id, l.started_at DESC`,
      [buyer]
    );

    // Group by request
    const grouped = rows.reduce<
      Record<number, {
        request_id: number;
        attribute_key: string;
        users: typeof rows;
      }>
    >((acc, row) => {
      if (!acc[row.request_id]) {
        acc[row.request_id] = {
          request_id: row.request_id,
          attribute_key: row.attribute_key,
          users: [],
        };
      }
      acc[row.request_id].users.push({
        wallet: row.wallet,
        lease_id: row.lease_id,
        expires_at: row.expires_at,
        started_at: row.started_at,
        confidence: row.confidence,
        certificate_token_id: row.certificate_token_id,
      });
      return acc;
    }, {});

    return NextResponse.json(Object.values(grouped));
  } catch (error) {
    console.error("Content delivery error:", error);
    return NextResponse.json({ error: "Failed to deliver content" }, { status: 500 });
  }
}
