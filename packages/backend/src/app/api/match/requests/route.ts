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