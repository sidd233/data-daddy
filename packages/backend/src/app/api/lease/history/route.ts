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
         l.id,
         l.on_chain_id,
         l.status,
         l.started_at,
         l.expires_at,
         l.paid_amount,
         l.settled_at,
         l.revoked_at,
         r.attribute_key,
         r.buyer_address,
         r.price_per_user
       FROM leases l
       JOIN lease_requests r ON l.request_id = r.on_chain_id
       WHERE LOWER(l.user_address) = LOWER($1)
       ORDER BY l.started_at DESC`,
      [address]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("History error:", error);
    return NextResponse.json({ error: "Failed to fetch lease history" }, { status: 500 });
  }
}
