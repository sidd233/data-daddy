import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const EPSILON = 1.0;

function laplaceSample(scale: number): number {
  // Inverse CDF method for Laplace distribution
  const u = Math.random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

function applyLaplaceNoise(value: number, sensitivity: number, epsilon: number): number {
  const scale = sensitivity / epsilon;
  return Math.max(0, Math.round(value + laplaceSample(scale)));
}

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
        potential_earnings: 0,
        privacy_budget_used: EPSILON,
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
      active_requests: applyLaplaceNoise(matches.rows.length, 1, EPSILON),
      pending_matches: applyLaplaceNoise(pendingMatches, 1, EPSILON),
      potential_earnings: applyLaplaceNoise(potentialEarnings, 1, EPSILON),
      privacy_budget_used: EPSILON,
    });

  } catch (error) {

    console.error("Stats error:", error);

    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }

}