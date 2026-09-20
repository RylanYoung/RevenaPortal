import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Lead } from "@/lib/types";
import { leadsToCsv } from "@/lib/reporting";

/**
 * GET /api/admin/export?client=<uuid|unassigned>&status=<status>
 *
 * Admin-side export across every client. Gated by the admin cookie in
 * proxy.ts — this route is inside the /api/admin matcher for that reason.
 */
export async function GET(request: NextRequest) {
  const db = supabaseAdmin();
  const { searchParams } = request.nextUrl;

  let query = db.from("leads").select("*").order("received_at", { ascending: false });

  const client = searchParams.get("client");
  if (client === "unassigned") query = query.is("client_id", null);
  else if (client) query = query.eq("client_id", client);

  const status = searchParams.get("status");
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return new Response(`Could not export: ${error.message}`, { status: 500 });
  }

  const csv = "﻿" + leadsToCsv((data ?? []) as Lead[]);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="revena-all-leads-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
