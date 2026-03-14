import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/buyer/leases?address=0x...
export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT
       l.id,
       l.on_chain_id,
       l.user_address,
       l.status,
       l.started_at,
       l.expires_at,
       l.paid_amount,
       r.attribute_key,
       r.on_chain_id AS request_on_chain_id
     FROM leases l
     JOIN lease_requests r ON l.request_id = r.on_chain_id
     WHERE LOWER(r.buyer_address) = LOWER($1)
     ORDER BY l.started_at DESC`,
    [address]
  );

  return NextResponse.json(rows);
}
