import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callerAddress = searchParams.get("address");

  // Get open labelling tasks with submission counts.
  // Subqueries avoid row-multiplication from the double LEFT JOIN.
  const { rows } = await pool.query(
    `SELECT dr.id, dr.attribute_keys, dr.label_task_spec,
            dr.stake_required, dr.voting_period_sec, dr.on_chain_task_id,
            dr.created_at,
            (SELECT COUNT(DISTINCT ls.data_id)
               FROM label_submissions ls WHERE ls.task_id = dr.id) AS labelled_count,
            (SELECT COUNT(*) FROM data_submissions ds
               WHERE ds.attribute_keys && dr.attribute_keys) AS total_submissions
     FROM data_requests dr
     WHERE dr.request_type = 'labelled'
       AND dr.status = 'active'
       AND dr.on_chain_task_id IS NOT NULL
     ORDER BY dr.created_at DESC`
  );

  // If caller address provided, exclude tasks they already labelled all data for
  if (!callerAddress) {
    return NextResponse.json(rows);
  }

  const { rows: alreadyLabelled } = await pool.query(
    `SELECT DISTINCT task_id FROM label_submissions
     WHERE LOWER(labeller_address) = LOWER($1)`,
    [callerAddress]
  );

  const labelledTaskIds = new Set(alreadyLabelled.map((r: { task_id: number }) => r.task_id));

  // Filter out tasks where this user has labelled everything available
  const filtered = rows.filter((task: { id: number }) => !labelledTaskIds.has(task.id));

  return NextResponse.json(filtered);
}
