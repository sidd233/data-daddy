import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * POST /api/lease/status
 * Body: { onChainId, action: "revoke" | "settle", userAddress }
 */
export async function POST(request: NextRequest) {
  let body: { onChainId: number; action: "revoke" | "settle"; userAddress: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { onChainId, action, userAddress } = body;

  if (!onChainId || !action || !userAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (action !== "revoke" && action !== "settle") {
    return NextResponse.json({ error: "action must be revoke or settle" }, { status: 400 });
  }

  try {
    // Verify ownership
    const { rows } = await pool.query(
      `SELECT id, status, expires_at FROM leases
       WHERE on_chain_id = $1 AND LOWER(user_address) = LOWER($2)
       AND status = 'Active'`,
      [onChainId, userAddress]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const lease = rows[0];

    if (action === "settle" && new Date(lease.expires_at) > new Date()) {
      return NextResponse.json({ error: "Lease has not expired yet" }, { status: 409 });
    }

    const newStatus = action === "revoke" ? "Revoked" : "Settled";
    const timestampField = action === "revoke" ? "revoked_at" : "settled_at";

    await pool.query(
      `UPDATE leases SET status = $1, ${timestampField} = NOW() WHERE id = $2`,
      [newStatus, lease.id]
    );

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (error) {
    console.error("Lease status error:", error);
    return NextResponse.json({ error: "Failed to update lease status" }, { status: 500 });
  }
}
