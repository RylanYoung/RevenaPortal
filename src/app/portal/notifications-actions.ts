"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Marks a message as read for the person dismissing it.
 *
 * Read state is per user, so one colleague clearing a notice doesn't hide it
 * from the other. RLS restricts the insert to the caller's own user id.
 */
export async function dismissNotification(id: string) {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return;

  await db
    .from("notification_reads")
    .upsert({ notification_id: id, user_id: user.id });

  revalidatePath("/portal");
}
