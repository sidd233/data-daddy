import { NextRequest, NextResponse } from "next/server";
import { keccak256, toHex, createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import pool from "@/lib/db";
import { LABELLING_POOL_ABI } from "@/lib/contracts";

export async function POST(request: NextRequest) {
  let body: {
    companyAddress: string;
    attributeKeys: string[];
    minConfidence: number;
    maxRecords: number;
    pricePerRecord: string; // wei as string
    requestType: "raw" | "labelled";
    labelTaskSpec?: {
      labels: string[];
      instructions: string;
    };
    stakeRequired?: string; // wei as string
    votingPeriodSec?: number;
    // refined attribute filters: { age_range?: {min:number,max:number}, state_of_residence?: string }
    attributeFilters?: Record<string, unknown>;
    // buyer questionnaire: [{id,question,type,options?}]
    questionnaire?: { id: string; question: string; type: "text" | "select"; options?: string[] }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    companyAddress,
    attributeKeys,
    minConfidence = 0,
    maxRecords = 100,
    pricePerRecord,
    requestType,
    labelTaskSpec,
    stakeRequired,
    votingPeriodSec,
    attributeFilters,
    questionnaire,
  } = body;

  if (!companyAddress || !attributeKeys || !pricePerRecord || !requestType) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!["raw", "labelled"].includes(requestType)) {
    return NextResponse.json({ error: "requestType must be raw or labelled" }, { status: 400 });
  }

  if (requestType === "labelled" && (!labelTaskSpec || !stakeRequired || !votingPeriodSec)) {
    return NextResponse.json(
      { error: "Labelled requests require labelTaskSpec, stakeRequired, votingPeriodSec" },
      { status: 400 }
    );
  }

  // Insert into data_requests
  const { rows } = await pool.query(
    `INSERT INTO data_requests
       (company_address, attribute_keys, min_confidence, max_records, price_per_record,
        request_type, label_task_spec, stake_required, voting_period_sec, status,
        attribute_filters, questionnaire)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
     RETURNING id`,
    [
      companyAddress,
      attributeKeys,
      minConfidence,
      maxRecords,
      pricePerRecord,
      requestType,
      labelTaskSpec ? JSON.stringify(labelTaskSpec) : null,
      stakeRequired ?? null,
      votingPeriodSec ?? null,
      attributeFilters ? JSON.stringify(attributeFilters) : "{}",
      questionnaire ? JSON.stringify(questionnaire) : null,
    ]
  );

  const requestId: number = rows[0].id;
  let onChainTaskId: string | null = null;

  // For labelled requests: create on-chain task using issuer wallet
  if (requestType === "labelled" && stakeRequired && votingPeriodSec) {
    try {
      const privateKey = process.env.ISSUER_PRIVATE_KEY;
      const rpcUrl = process.env.ALCHEMY_RPC;
      const poolAddress = process.env.NEXT_PUBLIC_LABELLING_POOL_ADDRESS as `0x${string}` | undefined;

      if (!privateKey || !rpcUrl || !poolAddress) {
        console.warn("Labelling pool env vars not set — skipping on-chain task creation");
        // Still activate so contributors can see the request
        await pool.query(`UPDATE data_requests SET status = 'active' WHERE id = $1`, [requestId]);
      } else {
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const walletClient = createWalletClient({
          account,
          chain: baseSepolia,
          transport: http(rpcUrl),
        });
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(rpcUrl),
        });

        // taskId encoding: keccak256(toHex(requestId.toString()))
        const taskId = keccak256(toHex(requestId.toString())) as `0x${string}`;

        const hash = await walletClient.writeContract({
          address: poolAddress,
          abi: LABELLING_POOL_ABI,
          functionName: "createTask",
          args: [taskId, BigInt(stakeRequired), BigInt(votingPeriodSec)],
        });

        await publicClient.waitForTransactionReceipt({ hash });
        onChainTaskId = taskId;

        await pool.query(
          `UPDATE data_requests SET on_chain_task_id = $1, status = 'active' WHERE id = $2`,
          [onChainTaskId, requestId]
        );
      }
    } catch (err) {
      console.error("On-chain task creation failed:", err);
      // Activate anyway so contributors can still see and answer the request
      await pool.query(`UPDATE data_requests SET status = 'active' WHERE id = $1`, [requestId]);
    }
  } else {
    // Raw requests go active immediately
    await pool.query(`UPDATE data_requests SET status = 'active' WHERE id = $1`, [requestId]);
  }

  return NextResponse.json({ id: requestId, onChainTaskId, status: "active" });
}
