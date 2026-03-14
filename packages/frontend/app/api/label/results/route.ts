import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskIdParam = searchParams.get("taskId");

  if (!taskIdParam) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
  }

  const taskId = parseInt(taskIdParam, 10);
  if (isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid taskId" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT lr.winning_label, lr.total_labellers, lr.majority_count, lr.settled_at,
            ds.id AS data_id, ds.fileverse_cid, ds.fileverse_url,
            ds.attribute_keys, ds.content_preview
     FROM label_results lr
     JOIN data_submissions ds ON ds.id = lr.data_id
     WHERE lr.task_id = $1
     ORDER BY lr.settled_at DESC`,
    [taskId]
  );

  return NextResponse.json(rows);
}
