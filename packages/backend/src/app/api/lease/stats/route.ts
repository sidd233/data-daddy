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