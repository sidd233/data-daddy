import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * POST /api/lease/record
 * Called by the frontend after approveLease tx confirms.
 * Writes the lease to the DB so lease/history can return it.
 *
 * Body: { leaseId, requestOnChainId, userAddress, certificateTokenId }
 */
export async function POST(request: NextRequest) {
  let body: {
    leaseId: number;
    requestOnChainId: number;
    userAddress: string;
    certificateTokenId: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leaseId, requestOnChainId, userAddress, certificateTokenId } = body;

  if (!leaseId || !requestOnChainId || !userAddress || certificateTokenId == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Look up the request to get price + duration
    const { rows: reqRows } = await pool.query(
      `SELECT id, price_per_user, lease_duration_sec FROM lease_requests WHERE on_chain_id = $1`,
      [requestOnChainId]
    );

    if (reqRows.length === 0) {
      return NextResponse.json({ error: "Lease request not found" }, { status: 404 });
    }

    const req = reqRows[0];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + req.lease_duration_sec * 1000);

    // Upsert — idempotent if frontend retries
    const { rows } = await pool.query(
      `INSERT INTO leases
         (on_chain_id, request_id, user_address, certificate_token_id,
          status, started_at, expires_at, paid_amount)
       VALUES ($1, $2, $3, $4, 'Active', $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        leaseId,
        requestOnChainId,
        userAddress.toLowerCase(),
        certificateTokenId,
        now,
        expiresAt,
        req.price_per_user,
      ]
    );

    // Also update filled_count on the request
    await pool.query(
      `UPDATE lease_requests SET filled_count = filled_count + 1 WHERE on_chain_id = $1`,
      [requestOnChainId]
    );

    return NextResponse.json(rows[0] ?? { ok: true });
  } catch (error) {
    console.error("Lease record error:", error);
    return NextResponse.json({ error: "Failed to record lease" }, { status: 500 });
  }
}
