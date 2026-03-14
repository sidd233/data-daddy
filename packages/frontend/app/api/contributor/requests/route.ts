import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Returns all active data_requests visible to contributors.
// Optionally filters to requests whose attribute_keys overlap contributor's verified keys.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keysParam = searchParams.get("attribute_keys"); // comma-separated

  try {
    let query: string;
    let params: unknown[];

    if (keysParam) {
      const keys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);
      // Return requests whose attribute_keys overlap with contributor's verified keys
      query = `
        SELECT id, attribute_keys, min_confidence, max_records, price_per_record,
               request_type, label_task_spec, stake_required, voting_period_sec,
               on_chain_task_id, status, created_at, attribute_filters, questionnaire
        FROM data_requests
        WHERE status IN ('active', 'pending')
          AND attribute_keys && $1::text[]
        ORDER BY created_at DESC
        LIMIT 50
      `;
      params = [keys];
    } else {
      query = `
        SELECT id, attribute_keys, min_confidence, max_records, price_per_record,
               request_type, label_task_spec, stake_required, voting_period_sec,
               on_chain_task_id, status, created_at, attribute_filters, questionnaire
        FROM data_requests
        WHERE status IN ('active', 'pending')
        ORDER BY created_at DESC
        LIMIT 50
      `;
      params = [];
    }

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
