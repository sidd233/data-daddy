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

    // 1️⃣ Get verified attributes
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
      return NextResponse.json([]);
    }

    // 2️⃣ Find matching requests
    const requests = await pool.query(
      `
      SELECT id
      FROM lease_requests
      WHERE attribute_key = ANY($1)
      AND active = TRUE
      `,
      [keys]
    );

    const requestIds = requests.rows.map(r => r.id);

    if (requestIds.length === 0) {
      return NextResponse.json([]);
    }

    // 3️⃣ Fetch buyer content
    const content = await pool.query(
      `
      SELECT *
      FROM buyer_content
      WHERE request_id = ANY($1)
      `,
      [requestIds]
    );

    return NextResponse.json(content.rows);

  } catch (error) {

    console.error("Content delivery error:", error);

    return NextResponse.json(
      { error: "Failed to deliver content" },
      { status: 500 }
    );

  }

}