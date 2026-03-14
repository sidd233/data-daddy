import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: {
    taskId: number;
    dataId: number;
    labellerAddress: string;
    label: string;
    onChainTx?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskId, dataId, labellerAddress, label, onChainTx } = body;

  if (!taskId || !dataId || !labellerAddress || !label) {
    return NextResponse.json(
      { error: "Missing required fields: taskId, dataId, labellerAddress, label" },
      { status: 400 }
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(labellerAddress)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    await pool.query(
      `INSERT INTO label_submissions (task_id, data_id, labeller_address, label, on_chain_tx)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (task_id, data_id, labeller_address) DO NOTHING`,
      [taskId, dataId, labellerAddress, label, onChainTx ?? null]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Label submit error:", err);
    return NextResponse.json({ error: "Failed to record label" }, { status: 500 });
  }
}
