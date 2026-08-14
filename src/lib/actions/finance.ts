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
  paid_from_safe_id: z.string().uuid().nullable().optional(),
  source_type: z.enum(["safe", "cash_register"]).optional().default("safe"),
  source_id: z.string().uuid("Оберіть, звідки платити"),
  description: z.string().optional(),
  // Сейф тримає дві половини, і витрата мусить сказати, з якої брати.
  // Замовчування — готівка: це найчастіший випадок за прилавком.
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
});

export async function createExpenseAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      category_id: formData.get("category_id"),
      amount: formData.get("amount"),
      paid_from_safe_id: formData.get("paid_from_safe_id") || null,
      source_type: formData.get("source_type") || "safe",
      source_id: formData.get("source_id") || formData.get("paid_from_safe_id"),
      description: formData.get("description") || "",
      payment_method: formData.get("payment_method") || "cash",
    };

    const parsed = expenseSchema.parse(data);
    // Витрата списує з сейфа — та сама межа, що й для переказу.
    const { user } = await requireRole(MONEY_ROLES);
    const supabase = await createClient();

    const { error: rpcError } = await supabase.rpc("create_expense", {
      category_id: parsed.category_id,
      amount: parsed.amount,
      /* Поле лишається в сигнатурі RPC, але веде перед `p_source_id`. Для каси
         сюди мусить їхати NULL: колонка `expenses.paid_from_safe_id` тримає FK
         на `safes`, і id каси в ній був би посиланням у нікуди.

         У згенерованих типах поле не nullable — воно стало таким міграцією
         `20260806080657`, а `database.ts` навмисно не перегенеровується
         (див. AGENTS.md). */
      // @ts-expect-error — див. коментар вище
      paid_from_safe_id: parsed.source_type === "safe" ? parsed.source_id : null,
      description: parsed.description || "",
      user_id: user.id,
      payment_method: parsed.payment_method,
      p_source_type: parsed.source_type,
      p_source_id: parsed.source_id,
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

    // Суми частин тепер вводяться вручну (для сейфа «Безготівка»), а не
    // рахуються з відсоткових налаштувань. Клієнт блокує сабміт, якщо суми
    // не збігаються, але це лише зручність інтерфейсу, а не контроль:
    // підроблений або застарілий POST-запит все одно дійде до сервера.
    // Тому суму частин звіряємо із сумою зняття тут — точним порівнянням,
    // без похибки, бо це цілі гривні.
    const partsSum = parsed.opex_amount + parsed.growth_amount + parsed.net_profit_amount;
    if (partsSum !== parsed.amount) {
      return {
        success: false,
        error: `Сума частин розподілу (${partsSum} грн) не дорівнює сумі зняття з каси (${parsed.amount} грн)`,
      };
    }

    // Розподіл спорожняє касу в сейфи — owner/manager.
    const { user } = await requireRole(MONEY_ROLES);
    const supabase = await createClient();

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
    // `requireRole` уже сходив у `profiles` і звірив роль — ручна перевірка
    // нижче була другим таким самим запитом до тієї ж таблиці.
    await requireRole(MONEY_ROLES);
    const supabase = await createClient();

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

// Джерело — тільки сейф ЧП: частка нараховується з нього, тож зняття повз
// нього розсинхронізувало б залишок власника з реальним балансом сейфа.
// Те, що це саме сейф ЧП, перевіряє RPC — тут відсікаємо лише каси, які
// приймала стара форма.
const withdrawSchema = z.object({
  // Сейф має дві половини — вилучення мусить сказати, якої стосується.
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
  source_type: z.literal("safe", {
    message: "Частку можна зняти лише з сейфа «Чистий прибуток»",
  }),
  source_id: z.string().uuid("Оберіть сейф чистого прибутку"),
  amount: z.coerce.number().min(1, "Сума вилучення має бути більше 0"),
  // Сейф, з якого добирається аванс, коли в ЧП не вистачило. Порожній рядок —
  // це «не потрібен», а не помилка: форма шле поле завжди.
  advance_safe_id: z
    .string()
    .uuid("Оберіть сейф, з якого взяти аванс")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  description: z.string().optional(),
});

export async function withdrawOwnerShareAction(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    // Вилучення частки — строгіше за решту: тільки власник, не менеджер.
    const { user } = await requireRole(["owner"]);
    const data = {
      source_type: formData.get("source_type"),
      source_id: formData.get("source_id"),
      amount: formData.get("amount"),
      advance_safe_id: formData.get("advance_safe_id") || "",
      description: formData.get("description") || "",
      payment_method: formData.get("payment_method") || "cash",
    };

    const parsed = withdrawSchema.parse(data);
    const supabase = await createClient();

    // Ділити суму на частку з сейфа й аванс має база, а не ця дія: обидва
    // записи мусять з'явитись або не з'явитись разом. Половина вилучення —
    // гірше, ніж жодного.
    const { error: rpcError } = await supabase.rpc("withdraw_owner_share_with_advance" as any, {
      p_np_safe_id: parsed.source_id,
      p_advance_safe_id: parsed.advance_safe_id ?? null,
      p_amount: Math.round(parsed.amount),
      p_desc_text: parsed.description || "Вилучення частки прибутку співвласника",
      p_user_id: user.id,
      p_payment_method: parsed.payment_method,
    });

    if (rpcError) throw rpcError;

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
