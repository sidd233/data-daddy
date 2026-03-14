import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  // Count label_submissions where the label matches the winning label in label_results
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total_wins
     FROM label_submissions ls
     JOIN label_results lr ON lr.task_id = ls.task_id AND lr.data_id = ls.data_id
     WHERE LOWER(ls.labeller_address) = LOWER($1)
       AND ls.label = lr.winning_label`,
    [address]
  );

  return NextResponse.json({ total_wins: Number(rows[0].total_wins) });
}
