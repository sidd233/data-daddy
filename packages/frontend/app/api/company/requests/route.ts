import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const { rows } = await pool.query(
    `SELECT dr.id, dr.attribute_keys, dr.min_confidence, dr.max_records,
            dr.price_per_record, dr.request_type, dr.label_task_spec,
            dr.stake_required, dr.voting_period_sec, dr.on_chain_task_id,
            dr.status, dr.created_at,
            COUNT(DISTINCT ds.id) AS submission_count
     FROM data_requests dr
     LEFT JOIN data_submissions ds
       ON ds.attribute_keys && dr.attribute_keys
     WHERE LOWER(dr.company_address) = LOWER($1)
     GROUP BY dr.id
     ORDER BY dr.created_at DESC`,
    [address]
  );

  return NextResponse.json(rows);
}
