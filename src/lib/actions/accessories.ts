"use server";
import { requireRole } from "@/lib/utils/rbac";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseError } from "@/lib/utils/errors";
import type { ActionState } from "./types";
import type { Database } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { uploadMediaFiles } from "@/lib/supabase/storage";
import { ACCESSORY_TYPES } from "@/lib/domain-labels";
import { MONEY_ROLES } from "@/lib/roles";

type DeviceUpdate = Database["public"]["Tables"]["devices"]["Update"];
type AccessoryInsert = Database["public"]["Tables"]["accessories"]["Insert"];
type AccessoryUpdate = Database["public"]["Tables"]["accessories"]["Update"];
type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];


const accessorySchema = z.object({
  // Сейф тримає дві половини, і закупівля мусить сказати, з якої брати.
  payment_method: z.enum(["cash", "cashless"]).optional().default("cash"),
  type: z.enum(ACCESSORY_TYPES),
  name: z.string().min(1, "Назва обов'язкова"),
  price: z.coerce.number().min(0),
  cost_price: z.coerce.number().min(0),
  stock: z.coerce.number().min(0),
  warranty_months: z.coerce.number().min(0).optional().default(6),
  description: z.string().nullable().optional(),
  is_visible: z.coerce.boolean().optional().default(false),
  source: z.string().optional().default("supplier"),
  barcode: z.string().nullable().optional(),
  warehouse_location: z.string().nullable().optional(),
  supplier_sku: z.string().nullable().optional(),
  min_stock: z.coerce.number().min(0).optional().default(3),
  photo_urls: z.array(z.string()).optional().default([]),
});

export async function createAccessory(prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      type: formData.get("type"),
      payment_method: formData.get("payment_method") || "cash",
      name: formData.get("name"),
      price: formData.get("price"),
      cost_price: formData.get("cost_price"),
      stock: formData.get("stock"),
      warranty_months: formData.get("warranty_months") || null,
      description: formData.get("description") || null,
      is_visible: formData.get("is_visible") === "true",
      source: formData.get("source") || "supplier",
      barcode: formData.get("barcode") || null,
      warehouse_location: formData.get("warehouse_location") || null,
      supplier_sku: formData.get("supplier_sku") || null,
      min_stock: formData.get("min_stock") || "3",
      photo_urls: [], // will be handled after parsing
    };

    const parsed = accessorySchema.parse(data);

    // Upload photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      parsed.photo_urls = await uploadMediaFiles(photoFiles, "accessories");
    }

    const supabase = await createClient();

    // Get current user profile for logging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Неавторизовано: " + (authError?.message || "Користувач не знайдений"));
    }

    /* Джерело оплати — сейф або каса. Попередньої перевірки балансу тут
       більше немає: її робить `account_apply` усередині RPC, разом зі
       списанням. Окремий SELECT нічого не гарантував — між ним і списанням
       баланс міг змінитись, — зате давав другий текст помилки для того самого
       правила. */
    const sourceTypeRaw = (formData.get("source_type") as string | null) ?? "safe";
    const sourceType: "safe" | "cash_register" =
      sourceTypeRaw === "cash_register" ? "cash_register" : "safe";
    let sourceId = (formData.get("source_id") as string | null) || (formData.get("safe_id") as string | null);

    let chosenType = sourceType;
    if (!sourceId) {
      const { data: opexSafe } = await supabase
        .from("safes")
        .select("id")
        .eq("type", "opex")
        .single();
      sourceId = opexSafe?.id ?? null;
      chosenType = "safe";
    }

    const totalCost = parsed.cost_price * parsed.stock;

    // 2. Perform insert
    const { data: inserted, error } = await supabase.from("accessories").insert({
      type: parsed.type,
      name: parsed.name,
      price: parsed.price,
      cost_price: parsed.cost_price,
      stock: parsed.stock,
      warranty_months: parsed.warranty_months,
      description: parsed.description,
      is_visible: parsed.is_visible,
      source: parsed.source,
      barcode: parsed.barcode,
      warehouse_location: parsed.warehouse_location,
      supplier_sku: parsed.supplier_sku ?? null,
      min_stock: parsed.min_stock,
      photo_urls: parsed.photo_urls,
      status: "active"
    } as AccessoryInsert).select("id").single();

    if (error) throw error;

    // 3. Perform safe balance deduction
    if (totalCost > 0 && sourceId && inserted?.id) {
      try {
        const description = `Закупівля аксесуарів: ${parsed.name} (Кількість: ${parsed.stock} шт.)`;
        const { error: rpcErr } = await supabase.rpc("purchase_inventory_item", {
          item_type: "accessory",
          item_id: inserted.id,
          /* Веде перед `p_source_id`; для каси мусить бути null. У згенерованих
             типах поле не nullable — `database.ts` навмисно не
             перегенеровується (див. AGENTS.md). */
          // @ts-expect-error — див. коментар вище
          safe_id: chosenType === "safe" ? sourceId : null,
          amount: totalCost,
          description,
          user_id: user.id,
          payment_method: parsed.payment_method,
          p_source_type: chosenType,
          p_source_id: sourceId,
        });
        if (rpcErr) throw rpcErr;
      } catch (rpcError) {
        // Rollback insert on failure
        await supabase.from("accessories").delete().eq("id", inserted.id);
        throw rpcError;
      }
    }

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}



export async function updateAccessory(id: string, prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const data = {
      type: formData.get("type"),
      payment_method: formData.get("payment_method") || "cash",
      name: formData.get("name"),
      price: formData.get("price"),
      cost_price: formData.get("cost_price"),
      stock: formData.get("stock"),
      warranty_months: formData.get("warranty_months") || null,
      description: formData.get("description") || null,
      is_visible: formData.get("is_visible") === "true",
      source: formData.get("source") || "supplier",
      barcode: formData.get("barcode") || null,
      warehouse_location: formData.get("warehouse_location") || null,
      supplier_sku: formData.get("supplier_sku") || null,
      min_stock: formData.get("min_stock") || "3",
      photo_urls: [], // placeholder
    };

    const parsed = accessorySchema.parse(data);

    const supabase = await createClient();
    
    // Upload photos if any
    const photoFiles = formData.getAll("photos").filter(f => f instanceof File && f.size > 0) as File[];
    if (photoFiles.length > 0) {
      const { data: existingAcc } = await supabase.from("accessories").select("photo_urls").eq("id", id).single();
      const existingUrls = existingAcc?.photo_urls || [];
      const newUrls = await uploadMediaFiles(photoFiles, "accessories");
      parsed.photo_urls = [...existingUrls, ...newUrls];
    } else {
      // Don't overwrite existing photos if no new ones are uploaded
      delete (parsed as any).photo_urls;
    }

    /* `payment_method` описує платіж, а не аксесуар — колонки під нього в
       `accessories` немає, тож у запис він не їде.

       `stock` не їде з іншої причини. Кількість тут змінювалась прямим
       UPDATE — без грошей і без сліду, — і це був єдиний такий шлях у
       системі. Тепер її рухають `purchaseAccessoryStock` і
       `writeOffAccessoryStock`, обидві через RPC із рухом по сейфу й записом
       у `inventory_movements`.

       Відкидаємо саме ТУТ, а не лише в формі: readonly-поле знімається в
       devtools за десять секунд, і дірка, закрита тільки версткою, — це не
       закрита дірка. Форма далі шле поле, і це нормально — схема його
       перевірить, а запис проігнорує. */
    const { payment_method: _method, stock: _stock, ...accessoryFields } = parsed;

    const { error } = await supabase.from("accessories").update(accessoryFields as AccessoryUpdate).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteAccessory(id: string): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
    const supabase = await createClient();
    const { error } = await supabase.from("accessories").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function importAccessories(items: unknown[]): Promise<ActionState> {
  try {
    const supabase = await createClient();
    
    const schema = z.array(z.object({
      name: z.string().min(1, "Назва обов'язкова"),
      type: z.enum(ACCESSORY_TYPES),
      price: z.coerce.number().min(0, "Ціна не може бути менше 0"),
      cost_price: z.coerce.number().min(0, "Собівартість не може бути менше 0"),
      stock: z.coerce.number().min(0, "Кількість не може бути менше 0"),
      min_stock: z.coerce.number().min(0).optional().default(3),
      status: z.string().default("active"),
      description: z.string().nullable().optional(),
      is_visible: z.coerce.boolean().optional().default(false),
    }));

    const parsed = schema.parse(items);

    // Get current user profile for logging
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Неавторизовано: " + (authError?.message || "Користувач не знайдений"));
    }

    // 1. Calculate total import cost and check balance
    const { data: opexSafe } = await supabase
      .from("safes")
      .select("id, balance, name")
      .eq("type", "opex")
      .single();

    if (!opexSafe) {
      throw new Error("Сейф OPEX для списання коштів не знайдено");
    }

    const totalImportCost = parsed.reduce((sum, item) => sum + (item.cost_price * item.stock), 0);
    if (totalImportCost > 0 && opexSafe.balance < totalImportCost) {
      throw new Error(`Недостатньо коштів на сейфі "${opexSafe.name}". Необхідно: ${totalImportCost} грн, доступно: ${opexSafe.balance} грн`);
    }

    // 2. Perform insert
    const { data: inserted, error } = await supabase.from("accessories").insert(parsed).select("id, name, cost_price, stock");
    if (error) throw error;

    // 3. Perform safe balance deduction
    if (inserted && inserted.length > 0) {
      const processedIds: string[] = [];
      try {
        for (const item of inserted) {
          const totalCost = item.cost_price * item.stock;
          if (totalCost > 0) {
            const description = `Імпорт аксесуарів: ${item.name} (Кількість: ${item.stock} шт.)`;
            const { error: rpcErr } = await supabase.rpc("purchase_inventory_item", {
              item_type: "accessory",
              item_id: item.id,
              safe_id: opexSafe.id,
              amount: totalCost,
              description,
              user_id: user.id,
              // Масовий імпорт не питає спосіб оплати — товар заводять
              // списком, а не по факту платежу. Готівка як типовий випадок.
              payment_method: "cash",
            });
            if (rpcErr) throw rpcErr;
            processedIds.push(item.id);
          }
        }
      } catch (rpcError) {
        // Rollback: delete all successfully inserted items from this batch
        await supabase.from("accessories").delete().in("id", inserted.map(i => i.id));
        throw rpcError;
      }
    }

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

/* ── Рух складу по позиції ───────────────────────────────────────────────────
 *
 * Доти кількість аксесуара змінювала форма редагування — прямим UPDATE, без
 * грошей і без сліду. Кабель у кількості 0 ставав кабелем у кількості 10, сейф
 * не худнув, у реєстрі не зʼявлялось нічого, а «Вартість бізнесу» росла на
 * товар, якого ніхто не купував.
 *
 * Обидві дії — тонкі обгортки над RPC. Уся робота (сейф, реєстр, картка,
 * рух складу) робиться однією транзакцією в Postgres: розрив між цими
 * записами лишив би стан, з якого код не вміє вийти.
 */

const purchaseStockSchema = z.object({
  accessoryId: z.string().uuid(),
  quantity: z.coerce.number().int().positive("Кількість має бути більше 0"),
  unitCost: z.coerce.number().int().min(0),
  /* Собівартість картки ПІСЛЯ приходу. Форма підставляє середньозважену
     (`weightedCost`) і дозволяє її перебити — тому число приходить готовим, а
     не рахується тут удруге. Два місця з однією формулою рано чи пізно
     розійшлись би, і власник побачив би в модалці одне, а в картці інше. */
  newCostPrice: z.coerce.number().int().min(0),
  safeId: z.string().uuid().nullable().optional(),
  /* Джерело — пара (тип, id). Сейф лишається типовим, щоб старі виклики без
     цих полів працювали так само. */
  sourceType: z.enum(["safe", "cash_register"]).default("safe"),
  sourceId: z.string().uuid().nullable().optional(),
  paymentMethod: z.enum(["cash", "cashless"]).default("cash"),
});

export async function purchaseAccessoryStock(
  input: z.input<typeof purchaseStockSchema>,
): Promise<ActionState> {
  try {
    await requireRole(MONEY_ROLES);
    const parsed = purchaseStockSchema.parse(input);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Неавторизовано: " + (authError?.message || ""));

    /* Джерело питає форма, але типове значення лишається тут, поруч із рештою
       закупівель: `createAccessory` та `importAccessories` беруть OPEX так
       само, і три різні дефолти на одну операцію були б трьома різними
       відповідями на одне питання. */
    let sourceId = parsed.sourceId ?? parsed.safeId ?? null;
    let sourceType = parsed.sourceType;
    if (!sourceId) {
      const { data: opex } = await supabase
        .from("safes")
        .select("id")
        .eq("type", "opex")
        .single();
      sourceId = opex?.id ?? null;
      sourceType = "safe";
    }

    // @ts-expect-error — purchase_accessory_stock немає в згенерованих типах
    // (`database.ts` навмисно не перегенеровується, див. AGENTS.md).
    const { error } = await supabase.rpc("purchase_accessory_stock", {
      p_accessory_id: parsed.accessoryId,
      p_quantity: parsed.quantity,
      p_unit_cost: parsed.unitCost,
      // Веде перед `p_source_id`; для каси мусить бути NULL.
      p_safe_id: sourceType === "safe" ? sourceId : null,
      p_new_cost_price: parsed.newCostPrice,
      p_payment_method: parsed.paymentMethod,
      p_user_id: user.id,
      p_source_type: sourceType,
      p_source_id: sourceId,
    });
    if (error) throw error;

    revalidatePath("/admin/accessories");
    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

const writeOffStockSchema = z.object({
  accessoryId: z.string().uuid(),
  quantity: z.coerce.number().int().positive("Кількість має бути більше 0"),
  /* `write_off` — товар був і зник (брак, втрата, подарунок).
     `adjustment` — товару ніколи не було, число ввели неправильно.
     Обидва значення вже дозволені CHECK-обмеженням `inventory_movements`. */
  reason: z.enum(["write_off", "adjustment"]),
  note: z.string().max(500).nullable().optional(),
});

export async function writeOffAccessoryStock(
  input: z.input<typeof writeOffStockSchema>,
): Promise<ActionState> {
  try {
    await requireRole(MONEY_ROLES);
    const parsed = writeOffStockSchema.parse(input);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user) throw new Error("Неавторизовано: " + (authError?.message || ""));

    // @ts-expect-error — write_off_accessory_stock немає в згенерованих типах.
    const { error } = await supabase.rpc("write_off_accessory_stock", {
      p_accessory_id: parsed.accessoryId,
      p_quantity: parsed.quantity,
      p_reason: parsed.reason,
      p_note: parsed.note ?? null,
      p_user_id: user.id,
    });
    if (error) throw error;

    /* Фінанси перечитуються теж: списання зменшує вартість складу, і міст
       «прибуток → гроші» мусить показати це в той самий момент, інакше на
       сторінці зависне «Нев'язка» до наступного оновлення. */
    revalidatePath("/admin/accessories");
    revalidatePath("/admin/finance");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

/**
 * Позначає аксесуари як "замовлені" — виставляє purchase_ordered_at = now().
 * Елемент зникає зі списку закупівлі до моменту реального поповнення stock.
 */
export async function markAccessoriesOrdered(ids: string[]): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
    if (!ids.length) return { success: true };

    const supabase = await createClient();
    const { error } = await supabase
      .from("accessories")
      .update({ purchase_ordered_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw error;

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

/**
 * Знімає позначку "замовлено" — скидає purchase_ordered_at = NULL.
 * Використовується при ручному очищенні або після реального поповнення складу.
 */
export async function clearPurchaseOrder(ids: string[]): Promise<ActionState> {
  try {
    await requireRole(["owner", "manager"]);
    if (!ids.length) return { success: true };

    const supabase = await createClient();
    const { error } = await supabase
      .from("accessories")
      .update({ purchase_ordered_at: null })
      .in("id", ids);
    if (error) throw error;

    revalidatePath("/admin/accessories");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
