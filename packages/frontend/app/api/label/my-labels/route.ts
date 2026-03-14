import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Returns all label submissions by this address, with settlement status.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         ls.id,
         ls.task_id,
         ls.data_id,
         ls.label        AS submitted_label,
         ls.on_chain_tx,
         ls.created_at,
         dr.attribute_keys,
         dr.label_task_spec,
         dr.stake_required,
         dr.voting_period_sec,
         dr.created_at   AS task_created_at,
         lr.winning_label,
         lr.total_labellers,
         lr.majority_count,
         lr.settled_at,
         CASE
           WHEN lr.winning_label IS NULL THEN 'pending'
           WHEN lr.winning_label = ls.label THEN 'won'
           ELSE 'lost'
         END AS result
       FROM label_submissions ls
       JOIN data_requests dr ON dr.id = ls.task_id
       LEFT JOIN label_results lr ON lr.task_id = ls.task_id AND lr.data_id = ls.data_id
       WHERE LOWER(ls.labeller_address) = LOWER($1)
       ORDER BY ls.created_at DESC
       LIMIT 100`,
      [address]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("label/my-labels error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
