/**
 * ТИМЧАСОВО. Діагностика заглиблень — видалити після знаходження причини.
 *
 * Модалка показує заглушку Next.js замість причини, і `guard` її не ловить:
 * отже падає не в тілі дії. Локально відтворити не вдалось — з anon-ключем RLS
 * віддає нуль рядків, і шляхи, що залежать від даних, не виконуються.
 *
 * Тому роут відкриває власник у своєму браузері: сюди приїжджають його кукі,
 * `requireRole` проходить, і кожен завантажувач виконується на справжніх даних.
 * Повертає ЛИШЕ кількості й тексти помилок — жодних сум і жодних рядків.
 */
import { NextResponse } from "next/server";
import { checkRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";

export async function GET() {
  const access = await checkRole(MONEY_ROLES);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const out: Record<string, unknown> = { role: access.role };

  const probe = async (label: string, call: () => Promise<unknown>) => {
    try {
      const r = (await call()) as { rows?: unknown[]; error?: string | null };
      out[label] =
        r && typeof r === "object" && "rows" in r
          ? { ok: true, rows: r.rows?.length ?? 0, error: r.error ?? null }
          : { ok: true };
    } catch (e) {
      out[label] = {
        ok: false,
        thrown: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : null,
      };
    }
  };

  try {
    const d = await import("@/lib/data-drilldown");
    await probe("cashflow_inventory", () => d.getCashFlowLineRows("outflow:inventory"));
    await probe("cashflow_sale", () => d.getCashFlowLineRows("inflow:sale"));
    await probe("bridge_inventory", () => d.getBridgeLineRows("inventory"));
    await probe("bridge_profit", () => d.getBridgeLineRows("__profit"));
    await probe("worth_safes", () => d.getWorthPartRows("safes"));
    await probe("sku", () => d.getSkuSaleRows("accessory:unknown", "30d"));
  } catch (e) {
    out.importError = e instanceof Error ? e.message : String(e);
    out.importStack = e instanceof Error ? e.stack?.split("\n").slice(0, 10) : null;
  }

  /* Завантажувачі САМОЇ сторінки. Якщо кидає щось із них, падає рендер
     /admin/finance — а разом із ним і будь-яка серверна дія на цій сторінці,
     навіть та, що сама відпрацювала успішно. */
  await probe("page_getMoneyPicture", async () =>
    (await import("@/lib/data-bridge")).getMoneyPicture(),
  );
  await probe("page_getCashFlow", async () =>
    (await import("@/lib/data-cashflow")).getCashFlow(),
  );
  await probe("page_getFinanceData", async () =>
    (await import("@/lib/data-finance")).getFinanceData(),
  );
  await probe("page_getFinanceReport", async () =>
    (await import("@/lib/data-finance")).getFinanceReport("30d"),
  );
  await probe("page_getSkuReport", async () =>
    (await import("@/lib/data-sku")).getSkuReport("30d"),
  );

  return NextResponse.json(out, { status: 200 });
}
