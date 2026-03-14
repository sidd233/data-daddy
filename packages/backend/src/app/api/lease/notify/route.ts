import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const since = searchParams.get("since"); // ISO timestamp from last poll

  if (!address) {
    return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
  }

  try {
    // Get verified attributes for this wallet
    const attrs = await pool.query(
      `SELECT attribute_key, method, confidence
       FROM verification_verdicts
       WHERE wallet_address = $1 AND verified = TRUE`,
      [address]
    );

    if (attrs.rows.length === 0) {
      return NextResponse.json({ requests: [], timestamp: new Date().toISOString() });
    }

    const sinceClause = since ? `AND r.created_at > $2` : "";
    const params: unknown[] = [address];
    if (since) params.push(since);

    // Return matching requests that are new since last poll
    const result = await pool.query(
      `SELECT DISTINCT r.*
       FROM lease_requests r
       JOIN verification_verdicts v
         ON r.attribute_key = v.attribute_key
       WHERE v.wallet_address = $1
         AND v.verified = TRUE
         AND (v.method != 'ai_document' OR r.ai_allowed = TRUE)
         AND v.confidence * 100 >= r.min_confidence
         AND r.active = TRUE
         AND r.expires_at > NOW()
         AND r.filled_count < r.max_users
         AND NOT EXISTS (
           SELECT 1 FROM leases l
           WHERE l.request_id = r.on_chain_id AND l.user_address = $1
         )
         ${sinceClause}
       ORDER BY r.id DESC`,
      params
    );

    return NextResponse.json({
      requests: result.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Notify error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
