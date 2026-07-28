import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import { splitByKind } from "@/lib/utils/finance";
import { dayKey } from "./utils/day";
import { getSettings } from "./data-settings";
import {
  comparisonFor,
  dailySeries,
  datasetWindowStart,
  dayRange,
  floorAtEpoch,
  resolveRange,
  sliceExpenses,
  sliceProfit,
  toDatedRepairs,
  chartWindow,
  REPAIR_PNL_COLUMNS,
  LEDGER_MAX_DAYS,
  type Comparison,
  type DatedExpense,
  type DatedRepair,
  type DatedSale,
  type DayPoint,
  type ProfitDataset,
  type ProfitDeviceCost,
  type ProfitResult,
  type RepairPnlRow,
  type ProfitSaleItem,
  type RangePreset,
  PARTNER_SHARE,
} from "./profit";

export { PARTNER_SHARE };

/** Скільки останніх чеків показуємо в картці «Продажі сьогодні». */
const TODAY_RECEIPTS_SHOWN = 3;

export interface OwnerShare {
  id: string;
  name: string;
  /** Це рядок поточного користувача — UI підсвічує його. */
  isMe: boolean;
  withdrawn: number;
  /** Нараховано − вилучено. Від'ємне означає, що власник узяв наперед. */
  available: number;
}

export interface WithdrawalEntry {
  id: string;
  at: string;
  amount: number;
  ownerName: string;
  /** Взято повз сейф ЧП — аванс. Див. `advances` у `PartnerLedger`. */
  isAdvance: boolean;
}

export interface PartnerLedger {
  /**
   * База нарахування: усе, що зараз лежить у сейфі ЧП, плюс зняте З НЬОГО.
   * Тобто скільки чистого прибутку взагалі дійшло до сейфа й не витрачено
   * повз частки. Аванси (`advances`) сюди не входять — вони через сейф не
   * проходили.
   */
  accrualBase: number;
  /** 50% від бази. Однакова для обох власників. */
  accruedPerOwner: number;
  /** Обидва власники, поточний користувач першим. */
  owners: OwnerShare[];
  /** Історія зняттів частки, найновіші першими. */
  withdrawals: WithdrawalEntry[];
  /**
   * Історичні зняття частки просто з каси, повз сейф ЧП, разом. Такі гроші
   * ніколи не потрапляли в сейф, тож базу не збільшують, але проти власника
   * рахуються — це аванс, взятий наперед. Нових бути не може:
   * `withdraw_owner_share` тепер приймає джерелом лише сейф ЧП.
   */
  advances: number;
  /** Скільки грошей узагалі завели в сейф ЧП. Довідково. */
  totalDistributed: number;
  /**
   * Скільки лежить у сейфі зараз. Сума залишків обох власників дорівнює
   * `safeBalance − advances`.
   */
  safeBalance: number;
  /**
   * Зароблено чистими від епохи. Довідково — показує розрив між заробленим і
   * тим, що справді розподілили в сейф. У нарахування НЕ входить.
   */
  totalNet: number;
  /**
   * Вибірка не дотяглася до епохи (магазин працює довше за `LEDGER_MAX_DAYS`),
   * тож `totalNet` занижений. На нарахування не впливає.
   */
  approximate: boolean;
}

export interface DashboardMoney {
  profit: ProfitResult;
  /** Витрати за обраний період (`expenses.created_at`, той самий діапазон, що й profit). */
  expenses: number;
  /** Сума балансів усіх кас і сейфів (готівка + безготівка). */
  cashTotal: number;
  /** Готівка на руках: каси готівкового типу плюс сейфи. Без безготівки. */
  cashOnHand: number;
  /** Нерозподілена картка/переказ — лише рахунок безготівки. */
  cashless: number;
  runwayDays: number;
  dailyOpex: number;
  /** Прибуток за поточний місяць — незалежно від обраного пресету. */
  monthProfit: number;
  /** Прибуток за сьогодні — незалежно від обраного пресету. */
  todayProfit: number;
  /** Витрати за поточний місяць — незалежно від обраного пресету. Для футера. */
  monthExpenses: number;
  /**
   * База порівняння для обраного пресету, або `null` коли бази бракує —
   * тоді UI не малює дельту взагалі. Див. `comparisonFor`.
   */
  comparison: Comparison | null;
  /**
   * Ряд під графік за вікном обраного періоду (`chartWindow`). Коротший, якщо
   * епоха ближча за початок вікна.
   */
  series: DayPoint[];
  /** Весь вибраний період по днях. Дні без даних присутні з нулями. */
  daily: DayPoint[];
  /**
   * Чеки за сьогодні. Виводяться з того самого датасету, тож окремого запиту
   * не коштують, а виторг тут той самий, що в hero — це один розрахунок.
   */
  todaySales: {
    count: number;
    revenue: number;
    /**
     * Розбивка виторгу дня за методом оплати, з `payment_splits` сьогоднішніх
     * чеків. `cardRevenue` — сума нечеготівкових спліт-оплат; `cashRevenue` =
     * `revenue − cardRevenue`, притиснуто знизу до нуля.
     *
     * `revenue` — це виторг ЛИШЕ з продажів (категорія `repair` з
     * `byCategory` виключена навмисно, картка про ремонти нічого не каже), з
     * розподіленою знижкою (`allocateSaleRevenue`). Спліт-оплати рахуються з
     * тих самих чеків, тож база тепер спільна для обох чисел — `Math.max(0,
     * …)` лишається лише підстраховкою на округлення знижки/рефанду в межах
     * чека, а не заглушкою на чужу категорію.
     */
    cashRevenue: number;
    cardRevenue: number;
    /** Найновіші першими, обрізано до `TODAY_RECEIPTS_SHOWN`. */
    receipts: { id: string; at: string; amount: number }[];
  };
  /**
   * Частка співвласника — 50% чистого прибутку (маржа − витрати) за
   * фіксованими вікнами. Може бути від'ємною.
   */
  partnerShare: {
    today: { net: number; share: number };
    week: { net: number; share: number };
    month: { net: number; share: number };
  };
  partnerLedger: PartnerLedger;
  sources: { id: string; name: string; type: "safe" | "cash_register"; balance: number }[];
  /** Єдине дозволене джерело зняття частки. `null` — сейфа ЧП немає. */
  netProfitSafeId: string | null;
}

/**
 * Дашборду треба одні й ті самі гроші в шести розрізах. Раніше кожен розріз
 * ходив у базу окремо: `profitForRange` викликалась до чотирьох разів по
 * два-три запити, стільки ж разів рахувались витрати, а `getDailyShares`
 * поверх усього сканував продажі/ремонти/витрати від епохи без верхньої межі —
 * запит, який росте лінійно, скільки б магазин не працював.
 *
 * Тепер рядки тягнуться один раз за вікно `datasetWindowStart`, а всі розрізи
 * ріжуться з них у пам'яті через `lib/profit`. Три послідовні стадії замість
 * ~18 роунд-тріпів, і рушій прибутку лишається рівно один — денний ряд під
 * графіком не може розійтися з KPI над ним.
 */
async function loadDataset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  start: Date,
  end: Date,
): Promise<{
  dataset: ProfitDataset;
  cashRegisters: { id: string; name: string; balance: number; type: string }[];
  /**
   * Спліт-оплати продажів, ключ — `sales.id`. Живе окремо від `DatedSale`
   * (тип спільний з `lib/profit`, який про оплати нічого не знає) — потрібні
   * лише для розбивки готівка/картка в картці «Продажі сьогодні».
   */
  paymentSplitsBySale: Map<string, { amount: number; method: string }[]>;
}> {
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  const empty = start >= end;

  const [salesRes, repairsRes, expensesRes, cashRes] = await Promise.all([
    empty
      ? Promise.resolve({ data: [] })
      : supabase
          .from("sales")
          .select(
            "id, created_at, total_amount, discount, sale_items(item_type, item_id, quantity, unit_cost, total_price), payment_splits(amount, method)",
          )
          .gte("created_at", startStr)
          .lt("created_at", endStr),
    empty
      ? Promise.resolve({ data: [] })
      : supabase
          .from("repairs")
          .select(REPAIR_PNL_COLUMNS)
          .is("inventory_device_id", null)
          // Грубий фільтр: ремонт міг закритись оплатою або видачею, тож
          // тягнемо обидві дати, а точне рішення лишається за
          // `toDatedRepairs` — там одне правило на всю систему.
          .or(
            `and(paid_at.gte.${startStr},paid_at.lt.${endStr}),` +
              `and(completed_at.gte.${startStr},completed_at.lt.${endStr})`,
          ),
    empty
      ? Promise.resolve({ data: [] })
      : supabase
          .from("expenses")
          .select("created_at, amount, category_id, paid_from_safe_id")
          .gte("created_at", startStr)
          .lt("created_at", endStr),
    supabase.from("cash_registers").select("balance, id, name, type"),
  ]);

  const salesData = supabaseCast<
    {
      id: string;
      created_at: string;
      total_amount: number;
      discount: number | null;
      sale_items: ProfitSaleItem[] | null;
      payment_splits: { amount: number; method: string }[] | null;
    }[]
  >(salesRes.data ?? []);

  // Собівартість пристрою — `cost_price + repair_cost`, а не `unit_cost` чека,
  // тож мапу треба добрати окремим запитом. Він залежить від списку продажів,
  // тому єдиний, що не влазить у Promise.all вище.
  const deviceIds = new Set<string>();
  for (const sale of salesData) {
    for (const item of sale.sale_items ?? []) {
      if (item.item_type === "device" && item.item_id) deviceIds.add(item.item_id);
    }
  }

  const devices = new Map<string, ProfitDeviceCost>();
  if (deviceIds.size > 0) {
    const { data } = await supabase
      .from("devices")
      .select("id, cost_price, repair_cost")
      .in("id", [...deviceIds]);
    for (const d of data ?? []) {
      devices.set(d.id, { cost_price: d.cost_price, repair_cost: d.repair_cost });
    }
  }

  const sales: DatedSale[] = salesData.map((s) => ({
    id: s.id,
    created_at: s.created_at,
    total_amount: s.total_amount,
    discount: s.discount,
    items: s.sale_items ?? [],
  }));

  const paymentSplitsBySale = new Map<string, { amount: number; method: string }[]>();
  for (const s of salesData) {
    paymentSplitsBySale.set(s.id, s.payment_splits ?? []);
  }

  const repairs: DatedRepair[] = toDatedRepairs(
    supabaseCast<RepairPnlRow[]>(repairsRes.data ?? []),
    start,
    end,
  );

  const expenses: DatedExpense[] = (expensesRes.data ?? []).map((e) => ({
    created_at: e.created_at,
    amount: e.amount,
    category_id: e.category_id,
    paid_from_safe_id: e.paid_from_safe_id,
  }));

  return {
    dataset: { sales, repairs, expenses, devices, windowStart: start },
    cashRegisters: cashRes.data ?? [],
    paymentSplitsBySale,
  };
}

/**
 * @param day необов'язковий ключ `YYYY-MM-DD` — коли заданий, головні цифри
 *   (`profit`/`expenses`) рахуються за цей конкретний день замість вікна
 *   пресету. Використовується денною навігацією на вкладці «Сьогодні». Решта
 *   (todayProfit, monthProfit, partnerShare, ledger) завжди прив'язані до `now`.
 */
export async function getDashboardMoney(
  preset: RangePreset,
  userId?: string,
  day?: string | null,
): Promise<DashboardMoney> {
  const supabase = await createClient();
  const now = new Date();
  const settings = await getSettings();
  const epoch = settings.finance_epoch;
  const capitalCategoryId = settings.capital_category_id;

  // Стадія 1: сейфи. Маленький запит (≤5 рядків), але `netProfitSafeId` з
  // нього потрібен трьом наступним розрахункам — фільтру витрат, OPEX
  // run-rate і леджеру, — тож він мусить бути першим.
  const safesRes = await supabase.from("safes").select("balance, type, id, name");
  const netProfitSafe = (safesRes.data ?? []).find((s) => s.type === "net_profit");
  const netProfitSafeId = netProfitSafe?.id ?? null;
  const netProfitSafeBalance = netProfitSafe?.balance ?? 0;

  // Вікно вибірки: найраніше з усього, що дашборд збирається спитати. Пресети
  // і бази порівняння дає `datasetWindowStart`, але леджер тягне глибше —
  // «нараховано» це 50% чистого прибутку від самої епохи, тож вибірка мусить
  // дотягтися до неї. Верхня межа — завтрашня північ, щоб «сьогодні» влізло
  // цілком.
  //
  // `LEDGER_MAX_DAYS` — стеля, за якою вибірка перестає рости: 400 днів
  // продажів цього магазину це кілька тисяч рядків, далі час відповіді почне
  // псуватись і правильною відповіддю стане денна rollup-таблиця, а не ще
  // ширший запит. Коли стеля спрацювала, леджер позначається `approximate`.
  const todayRange = resolveRange("today", now);
  const capStart = new Date(todayRange.start);
  capStart.setDate(capStart.getDate() - LEDGER_MAX_DAYS);

  const epochDate = epoch ? new Date(epoch) : null;
  const epochValid = epochDate && !Number.isNaN(epochDate.getTime()) ? epochDate : null;
  const ledgerApproximate = !!epochValid && epochValid.getTime() < capStart.getTime();
  const ledgerStart = epochValid
    ? new Date(Math.max(epochValid.getTime(), capStart.getTime()))
    : capStart;

  const rawStart = new Date(
    Math.min(datasetWindowStart(preset, now, day).getTime(), ledgerStart.getTime()),
  );
  const window = floorAtEpoch(rawStart, todayRange.end, epoch);

  // Стадія 2 і 3: датасет (одна паралельна пачка + добір собівартостей) разом
  // із транзакціями та власниками для леджера, яким датасет не потрібен.
  //
  // Вилучення частки тягнемо ПО ВСІХ власниках, не лише по поточному: обидва
  // мають бачити, хто скільки і коли взяв.
  //
  // Джерел два, і різниця між ними принципова. Зняття з сейфа ЧП — нормальна
  // форма, вона й зменшила баланс сейфа. Зняття прямо з каси — історичне:
  // так робили, доки `withdraw_owner_share` приймала касу джерелом. Ці гроші
  // сейфа не бачили, тож базу не збільшують, але проти власника рахуються.
  // Розділяє їх `buildLedger`; тут лише витягуємо обидві форми.
  //
  // `reference_type=distribution` відсікає витрати, оплачені з сейфа ЧП: вони
  // теж виходять «назовні», але це не чиясь частка. На базу нарахування вони
  // все одно впливають — через баланс сейфа, який вони зменшили.
  const withdrawalCols =
    "id, created_at, amount, from_id, from_type, reference_type, created_by";

  const [loaded, npInflowsRes, withdrawalsRes, ownersRes] = await Promise.all([
    loadDataset(supabase, window.start, window.end),
    netProfitSafeId
      ? supabase
          .from("transactions")
          .select("amount")
          .eq("to_type", "safe")
          .eq("to_id", netProfitSafeId)
          .eq("reference_type", "distribution")
      : Promise.resolve({ data: [] as { amount: number }[] }),
    netProfitSafeId
      ? supabase
          .from("transactions")
          .select(withdrawalCols)
          .eq("to_type", "external")
          .eq("reference_type", "distribution")
          .or(`from_type.eq.cash_register,from_id.eq.${netProfitSafeId}`)
      : supabase
          .from("transactions")
          .select(withdrawalCols)
          .eq("to_type", "external")
          .eq("reference_type", "distribution")
          .eq("from_type", "cash_register"),
    supabase.from("profiles").select("id, full_name").eq("role", "owner"),
  ]);

  const ds = loaded.dataset;

  const sliceMoney = (start: Date, end: Date) => {
    const w = floorAtEpoch(start, end, epoch);
    return {
      profit: sliceProfit(ds, w.start, w.end),
      expenses: sliceExpenses(ds, w.start, w.end, capitalCategoryId, netProfitSafeId),
    };
  };

  const mainRange = day ? dayRange(day) : resolveRange(preset, now);
  const main = sliceMoney(mainRange.start, mainRange.end);
  const today = sliceMoney(todayRange.start, todayRange.end);
  const week = sliceMoney(resolveRange("7d", now).start, resolveRange("7d", now).end);
  const monthRange = resolveRange("month", now);
  const month = sliceMoney(monthRange.start, monthRange.end);

  const net = (s: { profit: ProfitResult; expenses: number }) => s.profit.profit - s.expenses;
  const partnerShare = {
    today: { net: net(today), share: Math.round(net(today) * PARTNER_SHARE) },
    week: { net: net(week), share: Math.round(net(week) * PARTNER_SHARE) },
    month: { net: net(month), share: Math.round(net(month) * PARTNER_SHARE) },
  };

  // Денний ряд по всьому вікну — з нього живе леджер. Дні до епохи в датасет
  // не потрапили, тож ряд коротшає сам, окремої обрізки не треба.
  const daily = dailySeries(ds, window.start, window.end, {
    capitalCategoryId,
    netProfitSafeId,
  });

  // Графік показує вікно ОБРАНОГО періоду, а не незмінні останні тридцять днів.
  // Ріжемо вже порахований `daily` за ключами днів: другий прохід по датасету
  // дав би ті самі числа, лише повільніше.
  const rawChart = chartWindow(preset, now, day);
  const chartWin = floorAtEpoch(rawChart.start, rawChart.end, epoch);
  const fromKey = dayKey(chartWin.start);
  const toKey = dayKey(new Date(chartWin.end.getTime() - 1));
  const series = chartWin.empty ? [] : daily.filter((p) => p.day >= fromKey && p.day <= toKey);

  const registerKinds = splitByKind(loaded.cashRegisters);
  const safesTotal = (safesRes.data ?? []).reduce((s, sf) => s + sf.balance, 0);

  // Сейфи — спільний котел: після розподілу картка в них уже невідрізнима
  // від готівки. Тому безготівкою вважається лише нерозподілене на рахунку.
  const cashless = registerKinds.cashless;
  const cashOnHand = registerKinds.cash + safesTotal;
  const cashTotal = cashOnHand + cashless;

  // OPEX run-rate: 30 повних календарних днів із датасету, без вилучень
  // прибутку і без одноразових бурстів (> 50k). Раніше це було ковзне вікно
  // «зараз мінус 30×24 год»; календарні дні узгоджуються з рештою розрахунків
  // і на оцінці, яка все одно має підлогу 500 ₴/день, різниці не дають.
  const opexFrom = new Date(todayRange.start);
  opexFrom.setDate(opexFrom.getDate() - 29);
  const opexWindow = floorAtEpoch(opexFrom, todayRange.end, epoch);
  const regularOpexTotal = ds.expenses
    .filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= opexWindow.start.getTime() && t < opexWindow.end.getTime();
    })
    .filter((e) => e.amount < 50000 && e.paid_from_safe_id !== netProfitSafeId)
    .reduce((s, e) => s + e.amount, 0);
  const dailyOpex = Math.max(Math.round(regularOpexTotal / 30), 500);

  const opexSafeBalance = (safesRes.data ?? []).find((s) => s.type === "opex")?.balance ?? 0;
  const runwayDays = Math.round(opexSafeBalance / dailyOpex);

  const sources = [
    ...(safesRes.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      type: "safe" as const,
      balance: s.balance,
    })),
    ...loaded.cashRegisters.map((c) => ({
      id: c.id,
      name: c.name,
      type: "cash_register" as const,
      balance: c.balance,
    })),
  ];

  const todayReceipts = ds.sales
    .filter((s) => {
      const t = new Date(s.created_at).getTime();
      return t >= todayRange.start.getTime() && t < todayRange.end.getTime();
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Лише продажі. Оплати ремонтів і аванси карткою сюди не входять — вони
  // живуть в інших картках, а повна картина по карті це баланс рахунку.
  const todayCardRevenue = todayReceipts.reduce(
    (s, r) =>
      s +
      (loaded.paymentSplitsBySale.get(r.id) ?? [])
        .filter((p) => p.method !== "cash")
        .reduce((a, p) => a + p.amount, 0),
    0,
  );
  // Виторг картки «Продажі сьогодні» — ЛИШЕ продажі: `today.profit.revenue`
  // рахує усі категорії, включно з `repair`, а в ремонтів взагалі немає
  // `payment_splits`. Раніше це заганяло виторг ремонту, оплаченого карткою,
  // у готівку — рутинний випадок для сервісу телефонів, не крайній. Тепер
  // база та сама, що в `cardRevenue`: усі категорії `byCategory`, крім
  // `repair`, з розподіленою знижкою.
  const todaySalesRevenue = today.profit.byCategory
    .filter((c) => c.category !== "repair")
    .reduce((s, c) => s + c.revenue, 0);
  // Притиснуто до нуля лише як підстраховка на округлення розподіленої
  // знижки чи рефанд у межах дня — база вже узгоджена з `cardRevenue`, тож
  // від'ємне значення тут означати мало б лише копійчану похибку заокруглення.
  const todayCashRevenue = Math.max(0, todaySalesRevenue - todayCardRevenue);

  const partnerLedger = buildLedger({
    // Чистими від епохи: денний ряд уже покриває саме це вікно. Довідково —
    // нарахування рахується з сейфа, а не звідси.
    totalNet: daily.reduce((s, d) => s + d.net, 0),
    npInflows: (npInflowsRes as { data: { amount: number }[] | null }).data ?? [],
    withdrawals: (withdrawalsRes as { data: WithdrawalRow[] | null }).data ?? [],
    owners: ownersRes.data ?? [],
    userId,
    netProfitSafeId,
    safeBalance: netProfitSafeBalance,
    approximate: ledgerApproximate,
  });

  return {
    profit: main.profit,
    expenses: main.expenses,
    cashTotal,
    cashOnHand,
    cashless,
    runwayDays,
    dailyOpex,
    monthProfit: month.profit.profit,
    todayProfit: today.profit.profit,
    monthExpenses: month.expenses,
    comparison: day ? null : comparisonFor(ds, preset, now, epoch),
    series,
    daily,
    todaySales: {
      count: todayReceipts.length,
      revenue: todaySalesRevenue,
      cardRevenue: todayCardRevenue,
      cashRevenue: todayCashRevenue,
      receipts: todayReceipts.slice(0, TODAY_RECEIPTS_SHOWN).map((s) => ({
        id: s.id,
        at: s.created_at,
        amount: s.total_amount,
      })),
    },
    partnerShare,
    partnerLedger,
    sources,
    netProfitSafeId,
  };
}

interface WithdrawalRow {
  id: string;
  created_at: string;
  amount: number;
  from_id: string | null;
  from_type: string | null;
  reference_type: string | null;
  created_by: string | null;
}

/**
 * Спільний рахунок часток обох власників.
 *
 * Нарахування рахується ЛИШЕ з сейфа «Чистий прибуток»: база — те, що зараз у
 * сейфі, плюс усе, що з нього вже зняли на частки. Зароблене (`totalNet`)
 * лишається довідковим числом і в нарахування не входить.
 *
 * Звідси інваріант, який можна перевірити руками: сума залишків обох власників
 * дорівнює балансу сейфа. Він тримається тільки тому, що знімати частку можна
 * виключно з цього сейфа — це вбито в `withdraw_owner_share` (міграція
 * 20260727160000).
 *
 * Виняток — аванси: зняття частки прямо з каси, зроблені до цього обмеження.
 * Ті гроші сейфа не бачили, тож у базу їх не повертаємо (інакше вона виросла б
 * на суму, якої в сейфі ніколи не було), але проти власника рахуємо повністю:
 * він узяв наперед і його залишок від'ємний, доки розподіл не наздожене. З
 * ними інваріант читається як `сума залишків = баланс сейфа − аванси`.
 *
 * Саме через ці зняття повз сейф нарахування якийсь час рахувалось від
 * заробленого: база «скільки завели в сейф» їх не бачила, і залишок ішов у
 * мінус при цілком здоровому бізнесі. Тепер вони не ламають модель, а є її
 * явною частиною — і нових з'явитись не може.
 *
 * Витрата, оплачена з сейфа ЧП, зменшує базу обом порівну — і це правильно:
 * її оплатили спільними грошима, які вже були відкладені як прибуток.
 *
 * Ще раніша версія рахувала нарахування за поточний МІСЯЦЬ, а вилучення за весь
 * час — першого числа залишок обвалювався сам собою.
 *
 * Модель припускає рівно двох власників із рівними частками (`PARTNER_SHARE`
 * = 0.5). Третій співвласник зламає арифметику, і це навмисно: краще явна
 * поломка, ніж тихо занижена частка.
 */
function buildLedger(input: {
  totalNet: number;
  npInflows: { amount: number }[];
  withdrawals: WithdrawalRow[];
  owners: { id: string; full_name: string | null }[];
  userId?: string;
  netProfitSafeId: string | null;
  safeBalance: number;
  approximate: boolean;
}): PartnerLedger {
  const isAdvance = (t: WithdrawalRow) =>
    !(t.from_type === "safe" && !!input.netProfitSafeId && t.from_id === input.netProfitSafeId);

  const withdrawnBy = new Map<string, number>();
  let fromSafeTotal = 0;
  let advances = 0;
  for (const t of input.withdrawals) {
    const key = t.created_by ?? "unknown";
    withdrawnBy.set(key, (withdrawnBy.get(key) ?? 0) + t.amount);
    if (isAdvance(t)) advances += t.amount;
    else fromSafeTotal += t.amount;
  }

  // Баланс сейфа — це те, що ЛИШИЛОСЬ після зняттів із нього. Щоб «нараховано»
  // не зменшувалось від того, що хтось узяв своє, зняте з сейфа повертаємо в
  // базу. Аванси не повертаємо: вони зменшили касу, а не сейф.
  const accrualBase = input.safeBalance + fromSafeTotal;
  const accruedPerOwner = Math.round(accrualBase * PARTNER_SHARE);

  const nameOf = (id: string | null) =>
    input.owners.find((o) => o.id === id)?.full_name ?? "Невідомо";

  const owners: OwnerShare[] = input.owners
    .map((o) => {
      const withdrawn = withdrawnBy.get(o.id) ?? 0;
      return {
        id: o.id,
        name: o.full_name ?? "Без імені",
        isMe: o.id === input.userId,
        withdrawn,
        available: accruedPerOwner - withdrawn,
      };
    })
    // Свій рядок першим — далі за іменем, щоб порядок не стрибав між рендерами.
    .sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name, "uk"));

  // Назву джерела в рядок не пишемо — досить прапорця «аванс»: усе інше за
  // визначенням прийшло з сейфа ЧП.
  const withdrawals: WithdrawalEntry[] = [...input.withdrawals]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((t) => ({
      id: t.id,
      at: t.created_at,
      amount: t.amount,
      ownerName: nameOf(t.created_by),
      isAdvance: isAdvance(t),
    }));

  return {
    accrualBase,
    accruedPerOwner,
    owners,
    withdrawals,
    advances,
    totalDistributed: input.npInflows.reduce((s, t) => s + t.amount, 0),
    safeBalance: input.safeBalance,
    totalNet: input.totalNet,
    approximate: input.approximate,
  };
}
