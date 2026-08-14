import { createClient } from "./supabase/server";
import { isCashless, splitByKind } from "@/lib/utils/finance";
import { dayKey } from "./utils/day";
import { getSettings } from "./data-settings";
import { supabaseCast } from "./utils/supabase";
import { loadDataset, type LoadedDataset } from "./profit-dataset";
import {
  comparisonFor,
  dailySeries,
  datasetWindowStart,
  floorAtEpoch,
  resolveRange,
  sliceExpenses,
  sliceProfit,
  chartWindow,
  LEDGER_MAX_DAYS,
  type Comparison,
  type DatedRepair,
  type DatedSale,
  type DayPoint,
  type ProfitResult,
  type RangePreset,
  PARTNER_SHARE,
} from "./profit";

export { PARTNER_SHARE };

/**
 * Вікно, за яким рахується щоденний темп витрат.
 *
 * Тридцять днів — компроміс: коротше вікно стрибає від однієї великої покупки,
 * довше не помічає, що витрати змінились. Магазин молодший за вікно —
 * `floorAtEpoch` обріже його до епохи, і темп рахуватиметься за фактичними
 * днями роботи, а не за вигаданими тридцятьма.
 */
const OPEX_WINDOW_DAYS = 30;

/**
 * Витрати, більші за це, у щоденний темп не входять.
 *
 * Купівля вітрини за 60 000 ₴ — не щоденна витрата, і розмазувати її по днях
 * означало б стверджувати, що магазин палить по дві тисячі на добу. Такі
 * покупки видно окремо в русі грошей і в містку «прибуток → гроші».
 */
const OPEX_BURST_CUTOFF = 50000;

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
  ownerId: string | null;
  isMe: boolean;
  /** Взято повз сейф ЧП — аванс. Див. `advances` у `PartnerLedger`. */
  isAdvance: boolean;
  sourceName: string;
  sourceType: "safe" | "cash_register" | "unknown";
  paymentMethod: "cash" | "cashless" | null;
  description: string | null;
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
  /**
   * Готівка на руках: готівкові каси плюс ГОТІВКОВІ половини сейфів.
   * Безготівка, розподілена в сейф, сюди не входить — у шухляді її немає.
   */
  cashOnHand: number;
  /** Картка й перекази: рахунок безготівки плюс безготівкові половини сейфів. */
  cashless: number;
  /**
   * На скільки днів вистачить сейфа OPEX при поточному темпі витрат.
   * `null` — витрат за вікном ще не було, тобто рахувати немає з чого.
   */
  runwayDays: number | null;
  /** Середні витрати на день за вікном. Без штучної підлоги: скільки є, стільки й є. */
  dailyOpex: number;
  /** Залишок сейфа OPEX — саме він ділиться, а не всі гроші магазину. */
  opexSafeBalance: number;
  /** Сума витрат, з якої порахований темп. Показується, щоб число можна було перевірити. */
  opexWindowTotal: number;
  /** Ширина вікна в днях — друга половина того самого пояснення. */
  opexWindowDays: number;
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
    /** Товарні чеки ПЛЮС видані сьогодні платні ремонти — усі операції дня. */
    count: number;
    /**
     * Виторг дня за всіма категоріями, включно з ремонтами — те саме число,
     * що в hero. Раніше картка ремонти виключала, і два числа на одному екрані
     * законно розходились; тепер розходитись нема чому.
     */
    revenue: number;
    /**
     * Розбивка виторгу дня: готівка, безготівка, борг.
     *
     * Джерел два, бо їх у базі два: у продажів це `payment_splits` чека, у
     * ремонтів — каса, в яку лягла оплата (`transactions.reference_type =
     * 'repair_payment'`), бо методу платежу в ремонті немає взагалі. Без
     * другого джерела ремонт, оплачений карткою, тихо їхав би в готівку —
     * рутинний випадок для сервісу, не крайній.
     *
     * Готівка продажів рахується залишком (`− cardRevenue`), щоб поглинути
     * розподілену знижку; готівка ремонтів — прямою сумою платежів у грошові
     * каси. Що не покрите ні тим, ні тим, — це `debt`.
     */
    cashRevenue: number;
    cardRevenue: number;
    /**
     * Виторг дня, за який гроші ще не прийшли: ремонт видали в борг. Нуль у
     * звичайний день. Не можна складати в готівку — каси за ним порожні.
     */
    debt: number;
    /**
     * Усі операції дня, найновіші першими — без обрізки. Раніше сюди їхали
     * лише чотири останні, і в завантажений день картка мовчки ховала решту
     * за «і ще N»; список коротший за день — це не картка дня.
     * `receipts.length === count` завжди.
     */
    receipts: { id: string; at: string; amount: number; kind: "sale" | "repair" }[];
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
  /**
   * Сейфи з половинами балансу — для форми вилучення частки. Окремо від
   * `sources`: там сейфи змішані з касами, у яких поділу немає, а формі
   * половини потрібні, щоб порахувати, скільки покриє сейф ЧП, а скільки
   * доведеться брати авансом.
   */
  withdrawSafes: {
    id: string;
    name: string;
    type: string;
    balance: number;
    cashBalance: number;
    cardBalance: number;
  }[];
  /** Єдине дозволене джерело зняття частки. `null` — сейфа ЧП немає. */
  netProfitSafeId: string | null;
}

export interface RevenueSplit {
  cashRevenue: number;
  cardRevenue: number;
  /**
   * Виторг, за який гроші ще не прийшли: ремонт видали в борг. Нуль у
   * звичайний день. Не можна складати в готівку — каси за ним порожні.
   */
  debt: number;
}

/**
 * Розбивка виторгу вікна: готівка, безготівка, борг.
 *
 * Джерел два, бо їх у базі два: у продажів це `payment_splits` чека, у
 * ремонтів — каса, в яку лягла оплата (`transactions.reference_type =
 * 'repair_payment'`), бо методу платежу в ремонті немає взагалі. Без другого
 * джерела ремонт, оплачений карткою, тихо їхав би в готівку.
 *
 * Платежі ремонтів НЕ фільтруються по вікну навмисно. Ремонт визнається
 * виторгом на видачі, а передоплата могла зайти раніше — розбивка відповідає
 * на «чим за це заплатили», а не «скільки фізично впало в касу того дня». На
 * друге питання відповідає «Гроші в наявності», і воно рахується з кас.
 *
 * Готівка продажів — залишком, щоб поглинути розподілену знижку, якої в
 * спліт-оплатах немає. Готівка ремонтів — прямою сумою платежів.
 */
export async function revenueSplit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loaded: LoadedDataset,
  saleRows: DatedSale[],
  repairRows: DatedRepair[],
  totalRevenue: number,
  repairRevenue: number,
): Promise<RevenueSplit> {
  const salesCardRevenue = saleRows.reduce(
    (s, r) =>
      s +
      (loaded.paymentSplitsBySale.get(r.id) ?? [])
        .filter((p) => p.method !== "cash")
        .reduce((a, p) => a + p.amount, 0),
    0,
  );

  const cashlessRegisterIds = new Set(
    loaded.cashRegisters.filter((c) => isCashless(c.type)).map((c) => c.id),
  );
  let repairCardRevenue = 0;
  let repairCashRevenue = 0;
  if (repairRows.length > 0) {
    const { data: repairPayments } = await supabase
      .from("transactions")
      .select("amount, to_id")
      .eq("reference_type", "repair_payment")
      .in(
        "reference_id",
        repairRows.map((r) => r.id),
      );
    for (const p of repairPayments ?? []) {
      if (p.to_id && cashlessRegisterIds.has(p.to_id)) repairCardRevenue += p.amount;
      else repairCashRevenue += p.amount;
    }
  }

  const salesCashRevenue = Math.max(0, totalRevenue - repairRevenue - salesCardRevenue);
  const cardRevenue = salesCardRevenue + repairCardRevenue;
  const cashRevenue = salesCashRevenue + repairCashRevenue;

  return {
    cardRevenue,
    cashRevenue,
    debt: Math.max(0, totalRevenue - cardRevenue - cashRevenue),
  };
}

export async function getDashboardMoney(
  preset: RangePreset,
  userId?: string,
): Promise<DashboardMoney> {
  const supabase = await createClient();
  const now = new Date();
  const settings = await getSettings();
  const epoch = settings.finance_epoch;
  const capitalCategoryId = settings.capital_category_id;

  // Стадія 1: сейфи. Маленький запит (≤5 рядків), але `netProfitSafeId` з
  // нього потрібен трьом наступним розрахункам — фільтру витрат, OPEX
  // run-rate і леджеру, — тож він мусить бути першим.
  /* Половини `balance_cash` / `balance_cashless` є в базі під CHECK-обмеженням
     `balance = balance_cash + balance_cashless`, але у згенерованих типах їх
     немає — `database.ts` тут навмисно не перегенеровується. Тому каст. */
  const safesRaw = await supabase.from("safes").select("*");
  const safesRes = {
    data: supabaseCast<
      {
        id: string;
        name: string;
        type: string;
        balance: number;
        balance_cash: number | null;
        balance_cashless: number | null;
      }[]
    >(safesRaw.data ?? []),
    error: safesRaw.error,
  };
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
    Math.min(datasetWindowStart(preset, now).getTime(), ledgerStart.getTime()),
  );
  const window = floorAtEpoch(rawStart, todayRange.end, epoch);

  // Стадія 2 і 3: датасет (одна паралельна пачка + добір собівартостей) разом
  // із транзакціями та власниками для леджера, яким датасет не потрібен.
  //
  // Вилучення частки тягнемо ПО ВСІХ власниках, не лише по поточному: обидва
  // мають бачити, хто скільки і коли взяв.
  //
  // Беремо ВСЕ, що виходить назовні як `distribution`, і не фільтруємо за
  // джерелом. Розділяє форми `buildLedger`: зняття з сейфа ЧП — нормальне,
  // воно й зменшило баланс сейфа; будь-яке інше джерело — аванс, тобто гроші,
  // взяті наперед повз сейф. Вони бази нарахування не збільшують, але проти
  // власника рахуються повністю.
  //
  // Раніше тут стояв фільтр `from_type=cash_register OR from_id=ЧП` — під нього
  // підпадали лише історичні зняття з каси. Аванс, узятий із сейфа OPEX чи
  // Growth, у леджер не потрапляв би взагалі, і «знято власником» показувало б
  // МЕНШЕ, ніж власник насправді взяв. Саме навпаки до того, для чого аванси
  // існують.
  //
  // `reference_type=distribution` відсікає витрати, оплачені з сейфа ЧП: вони
  // теж виходять «назовні», але це не чиясь частка. На базу нарахування вони
  // все одно впливають — через баланс сейфа, який вони зменшили.
  const withdrawalCols =
    "id, created_at, amount, from_id, from_type, reference_type, created_by, description, payment_method";

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
    supabase
      .from("transactions")
      .select(withdrawalCols)
      .eq("to_type", "external")
      .eq("reference_type", "distribution"),
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

  const mainRange = resolveRange(preset, now);
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
  const rawChart = chartWindow(preset, now);
  const chartWin = floorAtEpoch(rawChart.start, rawChart.end, epoch);
  const fromKey = dayKey(chartWin.start);
  const toKey = dayKey(new Date(chartWin.end.getTime() - 1));
  const series = chartWin.empty ? [] : daily.filter((p) => p.day >= fromKey && p.day <= toKey);

  const registerKinds = splitByKind(loaded.cashRegisters);
  const safeRows = safesRes.data ?? [];
  // `safesTotal` більше не потрібен: готівка й безготівка рахуються половинами.

  /* Сейф НЕ спільний котел. Тут колись стояв коментар, що після розподілу
     картка в сейфі вже невідрізнима від готівки, — він застарів, коли сейфи
     отримали половини `balance_cash` / `balance_cashless`.
     Поки він жив, безготівка, розподілена в сейф, показувалась як «готівка на
     руках»: на 31.07 це 2 049 ₴ у Growth, які власник у шухляді не знайшов би.

     Тепер готівка — це готівкові каси плюс ГОТІВКОВІ половини сейфів, а
     безготівка — рахунок плюс безготівкові половини. Сума не змінилась, змінився
     поділ. */
  const safesCash = safeRows.reduce((s, sf) => s + (sf.balance_cash ?? 0), 0);
  const safesCashless = safeRows.reduce((s, sf) => s + (sf.balance_cashless ?? 0), 0);

  const cashless = registerKinds.cashless + safesCashless;
  const cashOnHand = registerKinds.cash + safesCash;
  const cashTotal = cashOnHand + cashless;

  /* OPEX run-rate: 30 повних календарних днів, без вилучень прибутку і без
     одноразових бурстів (> 50k), які інакше вдавали б щоденні витрати.
     Вікно календарне, а не ковзне, щоб узгоджуватись із рештою розрахунків.

     ПІДЛОГИ 500 ₴/ДЕНЬ ТУТ БІЛЬШЕ НЕМАЄ, і це не косметика. На реальних даних
     справжній темп був 342 ₴/день, а підлога піднімала його до 500 — тобто
     завищувала витрати на 46%. Запас через це показувався як 9 днів замість
     14 і перетинав поріг попередження: константа сама вигадувала тривогу,
     якої дані не підтверджували. Показник, що вигадує тривогу, гірший за його
     відсутність — йому перестають вірити рівно тоді, коли він знадобиться.

     Витрат немає взагалі — `dailyOpex = 0` і запас нерахований (`null`).
     Ділити на нуль, підставляючи вигадане число, — це те саме, від чого щойно
     позбулись. */
  const opexFrom = new Date(todayRange.start);
  opexFrom.setDate(opexFrom.getDate() - (OPEX_WINDOW_DAYS - 1));
  const opexWindow = floorAtEpoch(opexFrom, todayRange.end, epoch);
  const regularOpexTotal = ds.expenses
    .filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= opexWindow.start.getTime() && t < opexWindow.end.getTime();
    })
    .filter((e) => e.amount < OPEX_BURST_CUTOFF && e.paid_from_safe_id !== netProfitSafeId)
    .reduce((s, e) => s + e.amount, 0);
  const dailyOpex = Math.round(regularOpexTotal / OPEX_WINDOW_DAYS);

  const opexSafeBalance = (safesRes.data ?? []).find((s) => s.type === "opex")?.balance ?? 0;
  const runwayDays = dailyOpex > 0 ? Math.round(opexSafeBalance / dailyOpex) : null;

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

  /* Сейфи для форми вилучення частки — окремо від `sources`, бо їй потрібні
     половини балансу, а `sources` змішує сейфи з касами, у яких поділу немає.
     Половини тут не косметика: знімають або готівку, або безготівку, і саме
     обрана половина вирішує, скільки покриє сейф ЧП, а скільки доведеться
     брати авансом. */
  const withdrawSafes = (safesRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    balance: s.balance,
    cashBalance: s.balance_cash ?? s.balance,
    cardBalance: s.balance_cashless ?? 0,
  }));

  const inToday = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= todayRange.start.getTime() && t < todayRange.end.getTime();
  };

  const todaySaleRows = ds.sales.filter((s) => inToday(s.created_at));
  const todayRepairRows = ds.repairs.filter((r) => inToday(r.settled_at));

  // Усі операції дня в одному списку: товарний чек і виданий ремонт для
  // касира — те саме «пробили», і сторінка Продажів їх уже показує разом,
  // тепер тим самим днем видачі (`settled_at`, див. `repairSettledAt`).
  //
  // Ремонти з ціною 0 у список не йдуть — так само як їх не показує сторінка
  // Продажів. Гарантійна переробка не чек: у виторг вона додає нуль, а рядок
  // «0 ₴» і зайва одиниця в лічильнику чеків тільки шумлять. У P&L вона
  // лишається — там від неї є собівартість.
  const todayReceipts = [
    ...todaySaleRows.map((s) => ({
      id: s.id,
      at: s.created_at,
      amount: s.total_amount,
      kind: "sale" as const,
    })),
    ...todayRepairRows
      .filter((r) => r.price > 0)
      .map((r) => ({
        id: r.id,
        at: r.settled_at,
        amount: r.price,
        kind: "repair" as const,
      })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // Виторг — усі категорії, як у hero: картка називається «Продажі сьогодні»,
  // але відповідає на «скільки сьогодні заробили», а не «скільки з них не
  // ремонтами».
  const todayRevenue = today.profit.revenue;
  const repairRevenue =
    today.profit.byCategory.find((c) => c.category === "repair")?.revenue ?? 0;
  const split = await revenueSplit(
    supabase,
    loaded,
    todaySaleRows,
    todayRepairRows,
    todayRevenue,
    repairRevenue,
  );

  const partnerLedger = buildLedger({
    // Чистими від епохи: денний ряд уже покриває саме це вікно. Довідково —
    // нарахування рахується з сейфа, а не звідси.
    totalNet: daily.reduce((s, d) => s + d.net, 0),
    npInflows: (npInflowsRes as { data: { amount: number }[] | null }).data ?? [],
    withdrawals: (withdrawalsRes as { data: WithdrawalRow[] | null }).data ?? [],
    owners: ownersRes.data ?? [],
    safes: safesRes.data ?? [],
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
    opexSafeBalance,
    opexWindowTotal: regularOpexTotal,
    opexWindowDays: OPEX_WINDOW_DAYS,
    monthProfit: month.profit.profit,
    todayProfit: today.profit.profit,
    monthExpenses: month.expenses,
    comparison: comparisonFor(ds, preset, now, epoch),
    series,
    daily,
    todaySales: {
      count: todayReceipts.length,
      revenue: todayRevenue,
      cardRevenue: split.cardRevenue,
      cashRevenue: split.cashRevenue,
      debt: split.debt,
      receipts: todayReceipts,
    },
    partnerShare,
    partnerLedger,
    sources,
    withdrawSafes,
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
  description?: string | null;
  payment_method?: "cash" | "cashless" | null;
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
 * Виняток — аванси: вилучення частки повз сейф ЧП. Ті гроші сейфа не бачили,
 * тож у базу їх не повертаємо (інакше вона виросла б на суму, якої в сейфі
 * ніколи не було), але проти власника рахуємо повністю: він узяв наперед і
 * його залишок від'ємний, доки розподіл не наздожене. З ними інваріант
 * читається як `сума залишків = баланс сейфа − аванси`.
 *
 * Саме через ці зняття повз сейф нарахування якийсь час рахувалось від
 * заробленого: база «скільки завели в сейф» їх не бачила, і залишок ішов у
 * мінус при цілком здоровому бізнесі. Тепер вони не ламають модель, а є її
 * явною частиною.
 *
 * Форм авансу дві. Історична — зняття прямо з каси, доки `withdraw_owner_share`
 * приймала касу джерелом; таких більше не з'явиться. Чинна — зняття з сейфа
 * OPEX або Growth, коли в ЧП забракло: без неї власнику, який хоче взяти гроші
 * наперед, лишався б тільки шлях повз систему, і сейфи знову почали б брехати.
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
  safes?: { id: string; name: string; type: string }[];
  userId?: string;
  netProfitSafeId: string | null;
  safeBalance: number;
  approximate: boolean;
}): PartnerLedger {
  const isAdvance = (t: WithdrawalRow) =>
    !(t.from_type === "safe" && !!input.netProfitSafeId && t.from_id === input.netProfitSafeId);

  const safeMap = new Map<string, string>();
  for (const s of input.safes ?? []) {
    safeMap.set(s.id, s.name);
  }

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

  const withdrawals: WithdrawalEntry[] = [...input.withdrawals]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((t) => {
      const advance = isAdvance(t);
      let sourceName = "Невідоме джерело";
      let sourceType: "safe" | "cash_register" | "unknown" = "unknown";

      if (t.from_type === "safe") {
        sourceType = "safe";
        if (t.from_id && safeMap.has(t.from_id)) {
          sourceName = `Сейф «${safeMap.get(t.from_id)}»`;
        } else if (!advance) {
          sourceName = "Сейф «Чистий прибуток»";
        } else {
          sourceName = "Сейф (аванс)";
        }
      } else if (t.from_type === "cash_register") {
        sourceType = "cash_register";
        sourceName = "Каса (історичний аванс)";
      }

      return {
        id: t.id,
        at: t.created_at,
        amount: t.amount,
        ownerName: nameOf(t.created_by),
        ownerId: t.created_by,
        isMe: t.created_by === input.userId,
        isAdvance: advance,
        sourceName,
        sourceType,
        paymentMethod: t.payment_method ?? null,
        description: t.description ?? null,
      };
    });

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
