import { NextRequest, NextResponse } from "next/server";
import { keccak256, toHex, createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import pool from "@/lib/db";
import { LABELLING_POOL_ABI } from "@/lib/contracts";

export async function POST(request: NextRequest) {
  let body: { taskId: number; dataId: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskId, dataId } = body;

  if (!taskId || !dataId) {
    return NextResponse.json({ error: "Missing taskId or dataId" }, { status: 400 });
  }

  // Get the on-chain task ID
  const { rows: taskRows } = await pool.query(
    `SELECT on_chain_task_id FROM data_requests WHERE id = $1 AND status = 'active'`,
    [taskId]
  );

  if (taskRows.length === 0 || !taskRows[0].on_chain_task_id) {
    return NextResponse.json({ error: "Task not found or not active" }, { status: 404 });
  }

  const onChainTaskId = taskRows[0].on_chain_task_id as `0x${string}`;

  // dataId encoding: keccak256(toHex(dataId.toString()))
  const onChainDataId = keccak256(toHex(dataId.toString())) as `0x${string}`;

  // Call settle on-chain using issuer wallet
  const privateKey = process.env.ISSUER_PRIVATE_KEY;
  const rpcUrl = process.env.ALCHEMY_RPC;
  const poolAddress = process.env.NEXT_PUBLIC_LABELLING_POOL_ADDRESS as `0x${string}` | undefined;

  if (!privateKey || !rpcUrl || !poolAddress) {
    return NextResponse.json({ error: "Labelling pool env vars not configured" }, { status: 500 });
  }

  try {
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

    const hash = await walletClient.writeContract({
      address: poolAddress,
      abi: LABELLING_POOL_ABI,
      functionName: "settle",
      args: [onChainTaskId, onChainDataId],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Parse TaskSettled event to get winning label
    let winningLabel: string | null = null;
    let totalLabellers = 0;
    let majorityCount = 0;

    for (const log of receipt.logs) {
      try {
        if (
          log.topics[0] ===
          keccak256(toHex("TaskSettled(bytes32,bytes32,string,uint256,uint256)"))
        ) {
          // Event data parsing — simplified: read from DB label_submissions
          break;
        }
      } catch { /* not this log */ }
    }

    // Get winning label from DB label_submissions (tally votes)
    const { rows: labelRows } = await pool.query(
      `SELECT label, COUNT(*) AS cnt
       FROM label_submissions
       WHERE task_id = $1 AND data_id = $2
       GROUP BY label
       ORDER BY cnt DESC
       LIMIT 1`,
      [taskId, dataId]
    );

    if (labelRows.length > 0) {
      winningLabel = labelRows[0].label;
      majorityCount = Number(labelRows[0].cnt);
    }

    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM label_submissions WHERE task_id = $1 AND data_id = $2`,
      [taskId, dataId]
    );
    totalLabellers = Number(totalRows[0].cnt);

    // Write result to label_results
    if (winningLabel) {
      await pool.query(
        `INSERT INTO label_results (task_id, data_id, winning_label, total_labellers, majority_count)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (task_id, data_id) DO NOTHING`,
        [taskId, dataId, winningLabel, totalLabellers, majorityCount]
      );
    }

    return NextResponse.json({ success: true, winningLabel, totalLabellers, majorityCount, txHash: hash });
  } catch (err) {
    console.error("Settle error:", err);
    return NextResponse.json({ error: "Settlement failed" }, { status: 500 });
  }
}
