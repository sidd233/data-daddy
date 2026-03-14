import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { uploadToFileverse } from "@/lib/fileverse";

export async function POST(request: NextRequest) {
  let body: {
    walletAddress: string;
    question: string;
    answer: string;
    attributeKeys: string[];
    requestId?: number; // optional link to originating data_request
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { walletAddress, question, answer, attributeKeys, requestId } = body;

  if (!walletAddress || !question || !answer || !Array.isArray(attributeKeys)) {
    return NextResponse.json(
      { error: "Missing required fields: walletAddress, question, answer, attributeKeys" },
      { status: 400 }
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  if (attributeKeys.length === 0) {
    return NextResponse.json({ error: "At least one attributeKey required" }, { status: 400 });
  }

  // Validate that the wallet has verified attributes
  const { rows: verdicts } = await pool.query(
    `SELECT attribute_key FROM verification_verdicts
     WHERE LOWER(wallet_address) = LOWER($1) AND verified = true`,
    [walletAddress]
  );

  const verifiedKeys = new Set(verdicts.map((r: { attribute_key: string }) => r.attribute_key));
  const hasAtLeastOne = attributeKeys.some((k) => verifiedKeys.has(k));

  if (!hasAtLeastOne) {
    return NextResponse.json(
      { error: "Wallet has no verified attributes matching the provided keys" },
      { status: 403 }
    );
  }

  // Upload to Fileverse
  const content = {
    question,
    answer,
    attributeKeys,
    submittedAt: new Date().toISOString(),
  };

  // uploadToFileverse never throws — falls back to content-hash CID if API unavailable
  const fileverseResult = await uploadToFileverse(content);

  // Store CID + metadata in DB (no raw data stored here)
  const contentPreview = answer.slice(0, 200);

  const { rows } = await pool.query(
    `INSERT INTO data_submissions (wallet_address, fileverse_cid, fileverse_url, attribute_keys, content_preview, request_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, fileverse_cid, created_at`,
    [walletAddress, fileverseResult.cid, fileverseResult.url, attributeKeys, contentPreview, requestId ?? null]
  );

  return NextResponse.json({
    id: rows[0].id,
    cid: rows[0].fileverse_cid,
    createdAt: rows[0].created_at,
  });
}
