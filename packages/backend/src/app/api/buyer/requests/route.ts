import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/buyer/requests?address=0x...
export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT r.*,
            COUNT(l.id)::int AS approved_count
     FROM lease_requests r
     LEFT JOIN leases l ON l.request_id = r.on_chain_id AND l.status = 'Active'
     WHERE LOWER(r.buyer_address) = LOWER($1)
     GROUP BY r.id
     ORDER BY r.id DESC`,
    [address]
  );

  return NextResponse.json(rows);
}

// POST /api/buyer/requests — called after on-chain postRequest confirms
export async function POST(request: NextRequest) {
  let body: {
    onChainId: number;
    buyerAddress: string;
    attributeKey: string;
    minConfidence: number;
    aiAllowed: boolean;
    pricePerUserEth: string;
    leaseDurationSec: number;
    expiryDays: number;
    maxUsers: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    onChainId, buyerAddress, attributeKey, minConfidence, aiAllowed,
    pricePerUserEth, leaseDurationSec, expiryDays, maxUsers,
  } = body;

  if (!onChainId || !buyerAddress || !attributeKey || minConfidence == null || !pricePerUserEth || !leaseDurationSec || !expiryDays || !maxUsers) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const priceWei = BigInt(Math.round(parseFloat(pricePerUserEth) * 1e18)).toString();

  try {
    const { rows } = await pool.query(
      `INSERT INTO lease_requests
         (on_chain_id, buyer_address, attribute_key, min_confidence, ai_allowed,
          price_per_user, lease_duration_sec, expires_at, max_users)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + ($8 * INTERVAL '1 day'), $9)
       ON CONFLICT (on_chain_id) DO UPDATE SET
         filled_count = lease_requests.filled_count
       RETURNING id, on_chain_id`,
      [
        onChainId, buyerAddress.toLowerCase(), attributeKey, minConfidence, aiAllowed,
        priceWei, leaseDurationSec, expiryDays, maxUsers,
      ]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("Post request error:", err);
    return NextResponse.json({ error: "Failed to record request" }, { status: 500 });
  }
}
