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
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const expenseSchema = z.object({
  category_id: z.string().uuid("Оберіть категорію витрати"),
  amount: z.coerce.number().min(1, "Сума витрати має бути більше 0"),
  paid_from_safe_id: z.string().uuid("Оберіть сейф для оплати"),
  description: z.string().optional(),
});

export async function createExpenseAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      category_id: formData.get("category_id"),
      amount: formData.get("amount"),
      paid_from_safe_id: formData.get("paid_from_safe_id"),
      description: formData.get("description") || "",
    };

    const parsed = expenseSchema.parse(data);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }

    const { error: rpcError } = await supabase.rpc("create_expense", {
      category_id: parsed.category_id,
      amount: parsed.amount,
      paid_from_safe_id: parsed.paid_from_safe_id,
      description: parsed.description || "",
      user_id: user.id,
    });

    if (rpcError) throw rpcError;

    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const distributionSchema = z.object({
  cash_register_id: z.string().uuid("Оберіть касу для розподілу"),
  amount: z.coerce.number().min(1, "Сума розподілу має бути більше 0"),
  opex_amount: z.coerce.number().min(0),
  growth_amount: z.coerce.number().min(0),
  net_profit_amount: z.coerce.number().min(0),
  description: z.string().optional(),
});

export async function distributeFundsAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      cash_register_id: formData.get("cash_register_id"),
      amount: formData.get("amount"),
      opex_amount: formData.get("opex_amount"),
      growth_amount: formData.get("growth_amount"),
      net_profit_amount: formData.get("net_profit_amount"),
      description: formData.get("description") || "",
    };

    const parsed = distributionSchema.parse(data);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }

    const { error: rpcError } = await supabase.rpc("distribute_register_funds", {
      cash_register_id: parsed.cash_register_id,
      amount: parsed.amount,
      opex_amount: parsed.opex_amount,
      growth_amount: parsed.growth_amount,
      net_profit_amount: parsed.net_profit_amount,
      desc_text: parsed.description || "",
      user_id: user.id,
    });

    if (rpcError) throw rpcError;

    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteTransactionAction(transactionId: string): Promise<ActionState> {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized: " + (authError?.message || "User not found"));
    }

    // 2. Fetch user role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Не вдалося перевірити права доступу користувача.");
    }

    // 3. Restrict access to owner or manager
    if (profile.role !== "owner" && profile.role !== "manager") {
      throw new Error("Недостатньо прав для видалення транзакцій. Ця дія дозволена тільки власникам та менеджерам.");
    }

    // 4. Invoke the atomic stored procedure to revert and delete transaction
    const { error: rpcError } = await supabase.rpc("delete_transaction", {
      transaction_id_to_delete: transactionId
    });

    if (rpcError) throw rpcError;

    // 5. Revalidate cache
    revalidatePath("/admin/finance");
    revalidatePath("/admin");

    return { success: true };
  } catch (err) {
    console.error("deleteTransactionAction Error:", err);
    return { success: false, error: parseError(err) };
  }
}

