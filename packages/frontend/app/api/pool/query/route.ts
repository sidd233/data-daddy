import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keysParam = searchParams.get("attribute_keys");

  if (!keysParam) {
    return NextResponse.json({ error: "Missing attribute_keys query param" }, { status: 400 });
  }

  const attributeKeys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);

  if (attributeKeys.length === 0) {
    return NextResponse.json({ error: "No valid attribute keys provided" }, { status: 400 });
  }

  // Use GIN index: attribute_keys && ARRAY[...]
  const { rows } = await pool.query(
    `SELECT id, fileverse_cid, fileverse_url, attribute_keys, content_preview, created_at
     FROM data_submissions
     WHERE attribute_keys && $1::text[]
     ORDER BY created_at DESC
     LIMIT 200`,
    [attributeKeys]
  );

  // Never return wallet addresses
  return NextResponse.json(rows);
}
