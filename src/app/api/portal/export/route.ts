import { supabaseServer } from "@/lib/supabase-server";
import type { Lead } from "@/lib/types";
import { leadsToCsv } from "@/lib/reporting";

/**
 * GET /api/portal/export — the logged-in client's leads as CSV.
 *
 * Runs through the anon key, so RLS decides what's in the file. There is no
 * client_id parameter to tamper with: you get your rows or you get none.
 */
export async function GET() {
  const db = await supabaseServer();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error } = await db
    .from("leads")
    .select("*")
    .order("received_at", { ascending: false });

  if (error) {
    return new Response(`Could not export: ${error.message}`, { status: 500 });
  }

  // Leading BOM so Excel reads it as UTF-8 rather than the local codepage,
  // which mangles accented names.
  const csv = "﻿" + leadsToCsv((data ?? []) as Lead[]);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="revena-leads-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
