import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (attribute_key)
            attribute_key AS attribute, verified, confidence,
            reasoning AS evidence, method, certificate_token_id
     FROM verification_verdicts
     WHERE LOWER(wallet_address) = LOWER($1)
     ORDER BY attribute_key, fetched_at DESC NULLS LAST`,
    [address]
  );

  return NextResponse.json(rows);
}
