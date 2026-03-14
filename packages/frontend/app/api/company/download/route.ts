import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: { requestId: number; companyAddress: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { requestId, companyAddress } = body;

  if (!requestId || !companyAddress) {
    return NextResponse.json({ error: "Missing requestId or companyAddress" }, { status: 400 });
  }

  try {
    // Verify ownership
    const { rows: reqRows } = await pool.query(
      `SELECT request_type, attribute_keys, status FROM data_requests
       WHERE id = $1 AND LOWER(company_address) = LOWER($2)`,
      [requestId, companyAddress]
    );

    if (reqRows.length === 0) {
      return NextResponse.json({ error: "Request not found or not owned by this address" }, { status: 404 });
    }

    const req = reqRows[0];

    if (req.request_type === "raw") {
      const { rows } = await pool.query(
        `SELECT id, fileverse_cid, fileverse_url, attribute_keys, content_preview, created_at
         FROM data_submissions
         WHERE attribute_keys && $1::text[]
         ORDER BY created_at DESC
         LIMIT 1000`,
        [req.attribute_keys]
      );
      return NextResponse.json({ type: "raw", records: rows });
    }

    // Labelled: return label_results JOIN data_submissions
    const { rows } = await pool.query(
      `SELECT lr.winning_label, lr.total_labellers, lr.majority_count, lr.settled_at,
              ds.id AS data_id, ds.fileverse_cid, ds.fileverse_url,
              ds.attribute_keys, ds.content_preview
       FROM label_results lr
       JOIN data_submissions ds ON ds.id = lr.data_id
       WHERE lr.task_id = $1
       ORDER BY lr.settled_at DESC`,
      [requestId]
    );

    return NextResponse.json({ type: "labelled", records: rows });
  } catch (err) {
    console.error("Download route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
