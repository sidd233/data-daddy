import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyDocument } from "@/lib/ai/verifier";
import { mintCertificate } from "@/lib/blockchain/issuer";

export async function POST(request: NextRequest) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const attribute = formData.get("attribute") as string | null;
  const claimedValue = formData.get("claimedValue") as string | null;
  const walletAddress = formData.get("walletAddress") as string | null;

  if (!file || !attribute || !claimedValue || !walletAddress) {
    return NextResponse.json(
      { error: "Missing required fields: file, attribute, claimedValue, walletAddress" },
      { status: 400 }
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // Read file into buffer (lives in memory only — never written to disk)
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = file.type || "image/jpeg";

  try {
    const verdict = await verifyDocument(buffer, mimeType, attribute, claimedValue);

    // Insert verdict into DB
    const dbResult = await pool.query(
      `INSERT INTO verification_verdicts
         (wallet_address, attribute_key, verified, confidence, reasoning, method)
       VALUES ($1, $2, $3, $4, $5, 'ai_document')
       RETURNING id`,
      [walletAddress, attribute, verdict.verified, verdict.confidence, verdict.reasoning]
    );

    const verdictId = dbResult.rows[0].id;

    // Mint certificate on-chain if verified
    let tokenId: string | null = null;
    if (verdict.verified) {
      try {
        const minted = await mintCertificate(
          walletAddress,
          attribute,
          Math.round(verdict.confidence * 100),
          verdictId
        );
        tokenId = minted.toString();
      } catch (mintErr) {
        // Don't fail the request if minting fails — verdict is still stored
        console.error("Mint failed:", mintErr);
      }
    }

    return NextResponse.json({ ...verdict, tokenId });
  } catch (error) {
    console.error("Document verification error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
