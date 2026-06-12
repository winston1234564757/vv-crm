"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

const transferSchema = z.object({
  from_type: z.enum(["cash_register", "safe"]),
  from_id: z.string().uuid("Оберіть джерело відправлення"),
  to_type: z.enum(["cash_register", "safe"]),
  to_id: z.string().uuid("Оберіть одержувача коштів"),
  amount: z.coerce.number().min(1, "Сума переказу має бути більше 0"),
  description: z.string().optional(),
});

export async function createTransfer(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      from_type: formData.get("from_type"),
      from_id: formData.get("from_id"),
      to_type: formData.get("to_type"),
      to_id: formData.get("to_id"),
      amount: formData.get("amount"),
      description: formData.get("description") || "",
    };

    const parsed = transferSchema.parse(data);

    if (parsed.from_id === parsed.to_id && parsed.from_type === parsed.to_type) {
      throw new Error("Джерело та одержувач не можуть бути однаковими");
    }

    const supabase = await createClient();

    // Get current user profile for logging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }
    const userId = user.id;

    // 1. Call RPC function transfer_funds to process atomic updates and write transaction history
    const { error: rpcError } = await supabase.rpc("transfer_funds", {
      from_id: parsed.from_id,
      from_type: parsed.from_type,
      to_id: parsed.to_id,
      to_type: parsed.to_type,
      amount: parsed.amount,
      desc_text: parsed.description || "",
      user_id: userId
    });

    if (rpcError) throw rpcError;

    revalidatePath("/admin/finance");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
