"use server";
import { requireRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";

const transferSchema = z.object({
  // Сейф має дві половини; каса — ні. Для переказу між касами значення просто
  // не використовується, тож замовчування безпечне.
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
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
      payment_method: formData.get("payment_method") || "cash",
    };

    const parsed = transferSchema.parse(data);

    if (parsed.from_id === parsed.to_id && parsed.from_type === parsed.to_type) {
      throw new Error("Джерело та одержувач не можуть бути однаковими");
    }

    // Гроші рухає лише owner/manager. Сторінка вже під `MONEY_ROLES`, але
    // Server Action — це POST-ендпоінт: гард сторінки його не прикриває.
    const { user } = await requireRole(MONEY_ROLES);
    const supabase = await createClient();
    const userId = user.id;

    // 1. Call RPC function transfer_funds to process atomic updates and write transaction history
    const { error: rpcError } = await supabase.rpc("transfer_funds", {
      from_id: parsed.from_id,
      from_type: parsed.from_type,
      to_id: parsed.to_id,
      to_type: parsed.to_type,
      amount: parsed.amount,
      desc_text: parsed.description || "",
      user_id: userId,
      payment_method: parsed.payment_method,
    });

    if (rpcError) throw rpcError;

    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

/*
 * Тут стояла `export const paymentSourceSchema = z.object({...})` — і саме вона
 * поклала всю сторінку фінансів.
 *
 * Файл має директиву `"use server"`, а такий файл може експортувати ЛИШЕ
 * асинхронні функції. Експортований об'єкт валить модуль при завантаженні:
 * «A "use server" file can only export async functions, found object». Разом із
 * модулем падає весь граф сторінки — і кожна серверна дія на ній, включно з
 * усіма заглибленнями, відхиляється заглушкою про Server Components.
 *
 * `next build` цього не ловить: перевірка рантаймова. Ловить її тест
 * `use-server-exports.test.ts`, доданий разом із цим виправленням.
 *
 * Схема була ще й непотрібна — її поля вбудовані в `expenseSchema` нижче.
 */

const expenseSchema = z.object({
  category_id: z.string().uuid("Оберіть категорію витрати"),
  amount: z.coerce.number().min(1, "Сума витрати має бути більше 0"),
  source_id: z.string().uuid("Оберіть, звідки платити (Готівка або Безготівка)"),
  description: z.string().optional(),
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
});

export async function createExpenseAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      category_id: formData.get("category_id"),
      amount: formData.get("amount"),
      source_id: formData.get("source_id") || formData.get("paid_from_safe_id"),
      description: formData.get("description") || "",
      payment_method: formData.get("payment_method") || "cash",
    };

    const parsed = expenseSchema.parse(data);
    const { user } = await requireRole(MONEY_ROLES);
    const supabase = await createClient();

    // 1. Перевіряємо баланс каси
    const { data: reg, error: regErr } = await supabase
      .from("cash_registers")
      .select("id, name, balance")
      .eq("id", parsed.source_id)
      .single();

    if (regErr || !reg) throw new Error("Касу для списання не знайдено");
    if (reg.balance < parsed.amount) {
      throw new Error(`У касі "${reg.name}" недостатньо коштів (баланс: ${reg.balance} ₴, потрібно: ${parsed.amount} ₴)`);
    }

    // 2. Списуємо кошти з каси
    const newBal = reg.balance - parsed.amount;
    const { error: updErr } = await supabase
      .from("cash_registers")
      .update({ balance: newBal, updated_at: new Date().toISOString() })
      .eq("id", reg.id);
    if (updErr) throw updErr;

    // 3. Записуємо витрату в expenses
    await supabase.from("expenses").insert({
      category_id: parsed.category_id,
      amount: parsed.amount,
      description: parsed.description || null,
      created_by: user.id,
      // @ts-expect-error — column is nullable in DB via migration 20260806080657
      paid_from_safe_id: null,
    });

    // 4. Фіксуємо транзакцію
    await supabase.from("transactions").insert({
      amount: parsed.amount,
      from_type: "cash_register",
      from_id: reg.id,
      to_type: "external",
      to_id: null,
      reference_type: "expense",
      payment_method: parsed.payment_method,
      description: parsed.description || "Операційна витрата",
      created_by: user.id,
      from_balance_before: reg.balance,
      from_balance_after: newBal,
    });

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
  reinvest_amount: z.coerce.number().min(0, "Сума реінвесту має бути >= 0"),
  profit_amount: z.coerce.number().min(0, "Сума прибутку має бути >= 0"),
  description: z.string().optional(),
});

export async function distributeFundsAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      cash_register_id: formData.get("cash_register_id"),
      amount: formData.get("amount"),
      reinvest_amount: formData.get("reinvest_amount") ?? formData.get("growth_amount") ?? 0,
      profit_amount: formData.get("profit_amount") ?? formData.get("net_profit_amount") ?? 0,
      description: formData.get("description") || "",
    };

    const parsed = distributionSchema.parse(data);
    const partsSum = parsed.reinvest_amount + parsed.profit_amount;
    if (partsSum !== parsed.amount) {
      return {
        success: false,
        error: `Сума Реінвесту (${parsed.reinvest_amount} ₴) + Прибутку (${parsed.profit_amount} ₴) = ${partsSum} ₴, що не дорівнює сумі розподілу (${parsed.amount} ₴)`,
      };
    }

    const { user } = await requireRole(MONEY_ROLES);
    const supabase = await createClient();

    // Перевіряємо касу
    const { data: reg, error: regErr } = await supabase
      .from("cash_registers")
      .select("id, name, balance, type")
      .eq("id", parsed.cash_register_id)
      .single();

    if (regErr || !reg) throw new Error("Касу не знайдено");

    // Перевіряємо, що в касі достатньо коштів
    if (reg.balance < parsed.amount) {
      throw new Error(
        `У касі "${reg.name}" недостатньо коштів (баланс: ${reg.balance} ₴, потрібно: ${parsed.amount} ₴)`,
      );
    }

    // Списуємо кошти з каси
    const newRegBal = reg.balance - parsed.amount;
    const { error: regUpdErr } = await supabase
      .from("cash_registers")
      .update({ balance: newRegBal, updated_at: new Date().toISOString() })
      .eq("id", reg.id);
    if (regUpdErr) throw regUpdErr;

    // Оновлюємо віртуальні фонди в settings
    const adminSupabase = (await import("@/lib/supabase/admin")).createAdminClient();
    const [{ data: sReinvest }, { data: sProfit }] = await Promise.all([
      adminSupabase.from("settings").select("value").eq("key", "finance_reinvest_fund").maybeSingle(),
      adminSupabase.from("settings").select("value").eq("key", "finance_profit_fund").maybeSingle(),
    ]);

    const curReinvest = typeof sReinvest?.value === "object" && sReinvest.value !== null && "amount" in sReinvest.value
      ? Number(sReinvest.value.amount) || 0 : 0;
    const curProfit = typeof sProfit?.value === "object" && sProfit.value !== null && "amount" in sProfit.value
      ? Number(sProfit.value.amount) || 0 : 0;

    const newReinvest = curReinvest + parsed.reinvest_amount;
    const newProfit = curProfit + parsed.profit_amount;

    await Promise.all([
      adminSupabase.from("settings").upsert({ key: "finance_reinvest_fund", value: { amount: newReinvest } }, { onConflict: "key" }),
      adminSupabase.from("settings").upsert({ key: "finance_profit_fund", value: { amount: newProfit } }, { onConflict: "key" }),
    ]);

    // Фіксуємо транзакцію розподілу для аудиту
    await supabase.from("transactions").insert({
      amount: parsed.amount,
      from_type: "cash_register",
      from_id: reg.id,
      to_type: "external",
      reference_type: "distribution",
      payment_method: reg.type === "cashless" ? "cashless" : "cash",
      description: parsed.description || `Розподіл виручки: Реінвест +${parsed.reinvest_amount} ₴, Прибуток +${parsed.profit_amount} ₴`,
      created_by: user.id,
      from_balance_before: reg.balance,
      from_balance_after: newRegBal,
    });

    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteTransactionAction(transactionId: string): Promise<ActionState> {
  try {
    // `requireRole` уже сходив у `profiles` і звірив роль — ручна перевірка
    // нижче була другим таким самим запитом до тієї ж таблиці.
    await requireRole(MONEY_ROLES);
    const supabase = await createClient();

    // 1. Отримуємо транзакцію до видалення для перевірки спец-типів
    const { data: tx } = await supabase
      .from("transactions")
      .select("amount, reference_type, description")
      .eq("id", transactionId)
      .maybeSingle();

    // 2. Викликаємо атомарну збережену процедуру для повернення коштів на касу/сейф та видалення
    const { error: rpcError } = await supabase.rpc("delete_transaction", {
      transaction_id_to_delete: transactionId
    });

    if (rpcError) throw rpcError;

    // 3. Синхронізуємо віртуальні фонди в settings
    if (tx && tx.reference_type === "distribution") {
      const adminSupabase = (await import("@/lib/supabase/admin")).createAdminClient();
      if (tx.description?.includes("Вилучення чистого прибутку")) {
        // Повертаємо вилучений прибуток у фонд прибутку
        const { data: sProfit } = await adminSupabase
          .from("settings")
          .select("value")
          .eq("key", "finance_profit_fund")
          .maybeSingle();
        const cur = typeof sProfit?.value === "object" && sProfit.value !== null && "amount" in sProfit.value
          ? Number(sProfit.value.amount) || 0 : 0;
        await adminSupabase
          .from("settings")
          .upsert({ key: "finance_profit_fund", value: { amount: cur + Number(tx.amount) } }, { onConflict: "key" });
      } else {
        // Спробуємо розпарсити розподіл: "Реінвест +X ₴, Прибуток +Y ₴"
        const m = tx.description?.match(/Реінвест \+(\d+(?:\.\d+)?) ₴, Прибуток \+(\d+(?:\.\d+)?) ₴/);
        if (m) {
          const revAmount = Number(m[1]) || 0;
          const profAmount = Number(m[2]) || 0;
          const [{ data: sR }, { data: sP }] = await Promise.all([
            adminSupabase.from("settings").select("value").eq("key", "finance_reinvest_fund").maybeSingle(),
            adminSupabase.from("settings").select("value").eq("key", "finance_profit_fund").maybeSingle(),
          ]);
          const curR = typeof sR?.value === "object" && sR.value !== null && "amount" in sR.value ? Number(sR.value.amount) || 0 : 0;
          const curP = typeof sP?.value === "object" && sP.value !== null && "amount" in sP.value ? Number(sP.value.amount) || 0 : 0;
          await Promise.all([
            adminSupabase.from("settings").upsert({ key: "finance_reinvest_fund", value: { amount: Math.max(0, curR - revAmount) } }, { onConflict: "key" }),
            adminSupabase.from("settings").upsert({ key: "finance_profit_fund", value: { amount: Math.max(0, curP - profAmount) } }, { onConflict: "key" }),
          ]);
        }
      }
    }

    // 4. Revalidate cache
    revalidatePath("/admin/finance");
    revalidatePath("/admin");

    return { success: true };
  } catch (err) {
    console.error("deleteTransactionAction Error:", err);
    return { success: false, error: parseError(err) };
  }
}

const topUpSchema = z.object({
  // Сейф має дві половини — операція мусить сказати, якої стосується.
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
  safe_id: z.string().uuid("Оберіть сейф для поповнення"),
  amount: z.coerce.number().min(1, "Сума поповнення має бути більше 0"),
  description: z.string().optional(),
});

export async function topUpSafeAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      safe_id: formData.get("safe_id"),
      amount: formData.get("amount"),
      description: formData.get("description") || "",
      payment_method: formData.get("payment_method") || "cash",
    };

    const parsed = topUpSchema.parse(data);
    // Поповнення сейфа з особистого гаманця — owner/manager.
    const { user } = await requireRole(MONEY_ROLES);
    const supabase = await createClient();

    // 2. Execute atomic RPC function
    const { error: rpcError } = await supabase.rpc("top_up_safe", {
      p_safe_id: parsed.safe_id,
      p_amount: parsed.amount,
      p_desc_text: parsed.description || "Поповнення з особистого гаманця",
      p_user_id: user.id,
      p_payment_method: parsed.payment_method,
    });

    if (rpcError) throw rpcError;

    // 3. Revalidate paths
    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const withdrawSchema = z.object({
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
  source_id: z.string().uuid("Оберіть рахунок для виплати (Готівка або Безготівка)"),
  amount: z.coerce.number().min(1, "Сума вилучення має бути більше 0"),
  description: z.string().optional(),
});

export async function withdrawOwnerShareAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireRole(["owner"]);
    const data = {
      source_id: formData.get("source_id"),
      amount: formData.get("amount"),
      description: formData.get("description") || "",
      payment_method: formData.get("payment_method") || "cash",
    };

    const parsed = withdrawSchema.parse(data);
    const supabase = await createClient();
    const adminSupabase = (await import("@/lib/supabase/admin")).createAdminClient();

    // 1. Перевіряємо ліміт доступного прибутку у settings
    const { data: sProfit } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", "finance_profit_fund")
      .maybeSingle();

    const availableProfit = typeof sProfit?.value === "object" && sProfit?.value !== null && "amount" in sProfit.value
      ? Number(sProfit.value.amount) || 0 : 0;

    if (parsed.amount > availableProfit) {
      throw new Error(`Сума перевищує нарахований прибуток (доступно: ${availableProfit} ₴, запитано: ${parsed.amount} ₴)`);
    }

    // 2. Перевіряємо баланс фізичної каси
    const { data: reg, error: regErr } = await supabase
      .from("cash_registers")
      .select("id, name, balance")
      .eq("id", parsed.source_id)
      .single();

    if (regErr || !reg) throw new Error("Касу для виплати не знайдено");
    if (reg.balance < parsed.amount) {
      throw new Error(`У касі "${reg.name}" недостатньо коштів (баланс: ${reg.balance} ₴, потрібно: ${parsed.amount} ₴)`);
    }

    // 3. Списуємо кошти з каси
    const newBal = reg.balance - parsed.amount;
    const { error: updErr } = await supabase
      .from("cash_registers")
      .update({ balance: newBal, updated_at: new Date().toISOString() })
      .eq("id", reg.id);
    if (updErr) throw updErr;

    // 4. Зменшуємо віртуальний фонд прибутку
    const newProfitFund = availableProfit - parsed.amount;
    await adminSupabase
      .from("settings")
      .upsert({ key: "finance_profit_fund", value: { amount: newProfitFund } }, { onConflict: "key" });

    // 5. Фіксуємо транзакцію вилучення
    await supabase.from("transactions").insert({
      amount: parsed.amount,
      from_type: "cash_register",
      from_id: reg.id,
      to_type: "external",
      to_id: null,
      reference_type: "distribution",
      payment_method: parsed.payment_method,
      description: parsed.description || "Вилучення чистого прибутку власником",
      created_by: user.id,
      from_balance_before: reg.balance,
      from_balance_after: newBal,
    });

    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const convertSchema = z.object({
  safe_id: z.string().uuid("Оберіть сейф для конвертації"),
  amount: z.coerce.number().min(1, "Сума конвертації має бути більше 0"),
  // Напрямок: готівка → карта або карта → готівка
  direction: z.enum(["cash_to_card", "card_to_cash"], {
    error: "Оберіть напрямок конвертації",
  }),
  description: z.string().optional(),
});

/**
 * Конвертує гроші між готівковою та безготівковою половинами одного сейфу.
 *
 * cash_to_card — «обналічити» в зворотному розумінні: маємо безготівку,
 *   фізично видали готівкою → картка зменшилась, готівка зросла.
 *   (Або «поповнити карту» — узяли готівку, поклали на рахунок.)
 *
 * Загальний balance сейфу НЕ змінюється — це внутрішнє переміщення.
 */
export async function convertSafeHalvesAction(
  prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    const data = {
      safe_id: formData.get("safe_id"),
      amount: formData.get("amount"),
      direction: formData.get("direction"),
      description: formData.get("description") || "",
    };

    const parsed = convertSchema.parse(data);
    const { user } = await requireRole(MONEY_ROLES);
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await supabase.rpc("convert_safe_halves" as any, {
      p_safe_id: parsed.safe_id,
      p_amount: parsed.amount,
      p_direction: parsed.direction,
      p_desc_text: parsed.description || "",
      p_user_id: user.id,
    });

    if (rpcError) throw rpcError;

    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

/**
 * Зменшує віртуальний фонд реінвесту при закупівлях запчастин чи техніки.
 */
export async function deductReinvestFund(amount: number) {
  if (!amount || amount <= 0) return;
  try {
    const adminSupabase = (await import("@/lib/supabase/admin")).createAdminClient();
    const { data: sReinvest } = await adminSupabase
      .from("settings")
      .select("value")
      .eq("key", "finance_reinvest_fund")
      .maybeSingle();

    const cur = typeof sReinvest?.value === "object" && sReinvest?.value !== null && "amount" in sReinvest.value
      ? Number(sReinvest.value.amount) || 0 : 0;
    const newBal = Math.max(0, cur - Math.round(amount));
    await adminSupabase
      .from("settings")
      .upsert({ key: "finance_reinvest_fund", value: { amount: newBal } }, { onConflict: "key" });
  } catch (e) {
    console.error("Помилка списання з фонду реінвесту:", e);
  }
}
