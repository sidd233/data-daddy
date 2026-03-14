import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Returns all active data_requests visible to contributors.
// Pass ?address= to get a has_submitted flag per request.
// Pass ?attribute_keys= (comma-separated) to filter by contributor's verified keys.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keysParam = searchParams.get("attribute_keys");
  const address = searchParams.get("address");

  try {
    const keys = keysParam
      ? keysParam.split(",").map((k) => k.trim()).filter(Boolean)
      : null;

    // LEFT JOIN data_submissions to detect if this contributor already answered each request
    const submittedJoin = address
      ? `LEFT JOIN (
           SELECT request_id, TRUE AS has_submitted
           FROM data_submissions
           WHERE LOWER(wallet_address) = LOWER($${keys ? 2 : 1})
             AND request_id IS NOT NULL
           GROUP BY request_id
         ) sub ON sub.request_id = dr.id`
      : "";

    const submittedSelect = address ? ", COALESCE(sub.has_submitted, FALSE) AS has_submitted" : "";

    const whereClause = keys
      ? `WHERE dr.status IN ('active', 'pending') AND dr.attribute_keys && $1::text[]`
      : `WHERE dr.status IN ('active', 'pending')`;

    const query = `
      SELECT dr.id, dr.attribute_keys, dr.min_confidence, dr.max_records, dr.price_per_record,
             dr.request_type, dr.label_task_spec, dr.stake_required, dr.voting_period_sec,
             dr.on_chain_task_id, dr.status, dr.created_at, dr.attribute_filters, dr.questionnaire
             ${submittedSelect}
      FROM data_requests dr
      ${submittedJoin}
      ${whereClause}
      ORDER BY dr.created_at DESC
      LIMIT 50
    `;

    const params: unknown[] = [];
    if (keys) params.push(keys);
    if (address) params.push(address);

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("contributor/requests error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
