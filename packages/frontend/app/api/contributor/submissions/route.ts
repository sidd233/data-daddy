import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Returns a contributor's past data submissions.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, fileverse_cid, fileverse_url, attribute_keys, content_preview, created_at
       FROM data_submissions
       WHERE LOWER(wallet_address) = LOWER($1)
       ORDER BY created_at DESC
       LIMIT 100`,
      [address]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("contributor/submissions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
