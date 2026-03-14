import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getZKProvider } from "@/lib/zk/registry";
import { mintCertificate } from "@/lib/blockchain/issuer";

export async function POST(request: NextRequest) {
  let body: { proof: string; providerKey: string; walletAddress: string; useTestAadhaar?: boolean };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { proof, providerKey, walletAddress, useTestAadhaar = false } = body;

  if (!proof || !providerKey || !walletAddress) {
    return NextResponse.json(
      { error: "Missing required fields: proof, providerKey, walletAddress" },
      { status: 400 }
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  let provider;
  try {
    provider = getZKProvider(providerKey);
  } catch {
    return NextResponse.json({ error: `Unknown ZK provider: ${providerKey}` }, { status: 400 });
  }

  try {
    const results = await provider.verifyProof(proof);

    const minted: { attributeKey: string; tokenId: string | null }[] = [];

    for (const result of results) {
      // Insert verdict into DB
      const dbResult = await pool.query(
        `INSERT INTO verification_verdicts
           (wallet_address, attribute_key, verified, confidence, reasoning, method, zk_provider_key, fetched_at)
         VALUES ($1, $2, $3, $4, $5, 'zk', $6, NOW())
         ON CONFLICT (wallet_address, attribute_key) DO UPDATE SET
           verified       = EXCLUDED.verified,
           confidence     = EXCLUDED.confidence,
           reasoning      = EXCLUDED.reasoning,
           method         = EXCLUDED.method,
           zk_provider_key= EXCLUDED.zk_provider_key,
           fetched_at     = NOW()
         RETURNING id, certificate_token_id`,
        [
          walletAddress,
          result.attributeKey,
          result.valid,
          result.confidence,
          `ZK proof verified via ${providerKey}. Value: ${result.extractedValue}`,
          providerKey,
        ]
      );

      const verdictId = dbResult.rows[0].id;
      const existingTokenId = dbResult.rows[0].certificate_token_id;

      // Mint certificate on-chain only if not already minted
      let tokenId: string | null = existingTokenId ? String(existingTokenId) : null;
      if (result.valid && !existingTokenId) {
        try {
          const minted = await mintCertificate(
            walletAddress,
            result.attributeKey,
            Math.round(result.confidence * 100),
            verdictId
          );
          tokenId = minted.toString();
        } catch (mintErr) {
          console.error(`Mint failed for ${result.attributeKey}:`, mintErr);
        }
      }

      minted.push({ attributeKey: result.attributeKey, tokenId });
    }

    return NextResponse.json({ results, minted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ZK verification failed";
    console.error("ZK verification error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
