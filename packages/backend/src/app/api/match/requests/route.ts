import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.on_chain_id,
         r.attribute_key,
         r.price_per_user,
         r.lease_duration_sec,
         r.buyer_address,
         r.min_confidence
       FROM lease_requests r
       JOIN verification_verdicts v
         ON r.attribute_key = v.attribute_key
       WHERE LOWER(v.wallet_address) = LOWER($1)
         AND v.verified = TRUE
         AND (v.method != 'ai_document' OR r.ai_allowed = TRUE)
         AND v.confidence * 100 >= r.min_confidence
         AND r.active = TRUE
         AND r.expires_at > NOW()
         AND r.filled_count < r.max_users
         AND NOT EXISTS (
           SELECT 1 FROM leases l
           WHERE l.request_id = r.on_chain_id AND LOWER(l.user_address) = LOWER($1)
         )`,
      [address]
    );

    console.log("Match query result:", result.rows);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Match error:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}
