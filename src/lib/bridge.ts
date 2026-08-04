/**
 * Міст «прибуток → гроші»: чому зароблене не дорівнює тому, що в касі.
 *
 * Питання, на яке жоден екран не відповідав: прибуток з епохи 25 585 ₴, а в
 * касах і сейфах 17 650 ₴. Різниця не помилка — гроші лежать у товарі на складі,
 * у капітальних витратах і в кишенях власників. Але поки цього не видно,
 * кожен місяць закінчується питанням «то де гроші».
 *
 * ЧОМУ ОКРЕМИЙ МОДУЛЬ. Він не імпортує ні `profit.ts`, ні `cashflow.ts` — те
 * саме правило, що тримає ці два нарізно. Міст не зводить прибуток і рух
 * грошей в одне число, він ПОЯСНЮЄ їхню різницю; приймає вже пораховані обома
 * числа і не може створити циклічну залежність.
 *
 * ЧОМУ `unexplained` ОКРЕМИМ РЯДКОМ. Наївна версія цього містка
 * («прибуток мінус закупівлі») не зійшлася на 30 383 ₴. Спокуса — додати
 * балансуючий рядок, щоб зійшлось. Це б перетворило звіт на декорацію: він
 * завжди сходився б і ніколи нічого не ловив. Тут нев'язка лишається окремим
 * числом, і ненульова означає помилку обліку, яку треба знайти, а не
 * замаскувати. Те саме рішення, що `drift` у `cashflow.ts`.
 */

export interface BridgeInput {
  /** Прибуток за період після операційних витрат (з `profit.ts`). */
  netProfit: number;
  /**
   * Приріст складу за собівартістю: скільки заплачено за товар мінус уся
   * собівартість списаного за період.
   *
   * «Уся» означає і собівартість проданих товарів, і деталі, витрачені на
   * ремонти: обидві зменшили прибуток, але грошей у момент списання не
   * забрали — гроші пішли раніше, коли товар купували. Якщо врахувати лише
   * собівартість продажів, міст не зійдеться рівно на вартість деталей у
   * ремонтах (на реальних даних це було 950 ₴).
   *
   * Додатний означає «купили більше, ніж списали» — гроші осіли в товарі.
   */
  inventoryDelta: number;
  /**
   * Гроші, які вже зайшли, але виторгом ще не стали: оплачені й не видані
   * ремонти плюс передоплати замовлень.
   *
   * Ремонт заробляється НА ВИДАЧІ (`repairSettledAt`), а платять за нього
   * часто раніше. На реальних даних це 1 400 ₴ по ремонтах і 200 ₴ по
   * замовленнях — без цього рядка міст не сходився.
   */
  deferredRevenue: number;
  /** Приріст боргу клієнтів: продано й видано, гроші ще не зайшли. */
  receivablesDelta: number;
  /** Приріст боргу постачальникам: товар у нас, гроші ще не пішли. */
  payablesDelta: number;
  /**
   * Капітальні витрати — обладнання, ремонт приміщення, запуск. Вони свідомо
   * виключені з P&L (`sliceExpenses` відкидає `capital_category_id`), тож
   * прибуток їх не бачить, а каса бачить.
   */
  capitalExpenses: number;
  /** Власники внесли своїх грошей (`top_up`). */
  ownerContributions: number;
  /**
   * Власники забрали.
   *
   * Це не лише `distribution` → `external`, а Й витрати, оплачені з сейфа
   * «Чистий прибуток»: `sliceExpenses` виключає їх з операційних саме тому,
   * що це вилучення частки в іншій обгортці. Прибуток їх не бачить, каса
   * бачить — тож у містку вони мусять стояти поруч зі звичайним вилученням,
   * інакше залишиться незрозуміла різниця (на реальних даних 600 ₴).
   */
  ownerDraws: number;
  /** Ручні звірки з реальністю (`adjustment`). Від'ємні — списання. */
  adjustments: number;
  /** Факт: скільки грошей у касах і сейфах додалось за період. */
  actualCashChange: number;
}

export interface BridgeLine {
  key: string;
  label: string;
  /** Зі знаком: додатне збільшує гроші відносно прибутку, від'ємне зменшує. */
  amount: number;
  /** Чому цей рядок узагалі є. Показується поруч, не в тултипі. */
  hint: string;
}

export interface CashBridge {
  netProfit: number;
  lines: BridgeLine[];
  /** `netProfit + Σ lines` — скільки грошей мало б додатись за нашою моделлю. */
  explained: number;
  /** Скільки додалось насправді. */
  actual: number;
  /** `actual − explained`. Нуль — модель пояснює все. */
  unexplained: number;
  balanced: boolean;
}

/**
 * Рядки завжди в одному порядку й завжди всі, навіть нульові.
 *
 * Ховати нульові рядки означало б, що склад форми стрибає між періодами і
 * читач щоразу шукає очима, куди подівся рядок. Для звіту, який дивляться
 * щотижня, стабільність важливіша за компактність.
 */
export function buildBridge(input: BridgeInput): CashBridge {
  const lines: BridgeLine[] = [
    {
      key: "inventory",
      label: "Осіло в товарі на складі",
      amount: -input.inventoryDelta,
      hint: "Куплено більше, ніж продано. У прибутку цих грошей немає — товар ще не проданий.",
    },
    {
      key: "deferred",
      label: "Оплачено наперед",
      amount: input.deferredRevenue,
      hint: "Ремонти, за які заплатили, але ще не забрали, і передоплати замовлень. Гроші вже в касі, виторгом стануть на видачі.",
    },
    {
      key: "receivables",
      label: "Борг клієнтів",
      amount: -input.receivablesDelta,
      hint: "Віддано, гроші ще не зайшли. У прибутку вже враховано.",
    },
    {
      key: "payables",
      label: "Борг постачальникам",
      amount: input.payablesDelta,
      hint: "Товар у нас, гроші ще не пішли. Тимчасово тримає касу повнішою.",
    },
    {
      key: "capital",
      label: "Капітальні витрати",
      amount: -input.capitalExpenses,
      hint: "Обладнання й запуск. Свідомо не входять у прибуток, але з каси пішли.",
    },
    {
      key: "owner_in",
      label: "Внески власників",
      amount: input.ownerContributions,
      hint: "Особисті гроші, докладені в бізнес. Це не заробіток.",
    },
    {
      key: "owner_out",
      label: "Вилучення власників",
      amount: -input.ownerDraws,
      hint: "Забрана частка. Зменшує касу, але не є витратою бізнесу.",
    },
    {
      key: "adjustments",
      label: "Звірки з реальністю",
      amount: input.adjustments,
      hint: "Ручні списання й дозаписи, коли перерахунок купюр не збігся з базою.",
    },
  ];

  const explained = input.netProfit + lines.reduce((s, l) => s + l.amount, 0);
  const unexplained = input.actualCashChange - explained;

  return {
    netProfit: input.netProfit,
    lines,
    explained,
    actual: input.actualCashChange,
    unexplained,
    balanced: unexplained === 0,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */

export interface NetWorthInput {
  /** Готівка й безготівка в касах. */
  registers: number;
  /** Усі сейфи разом. */
  safes: number;
  /** Девайси на складі за собівартістю (`cost_price + repair_cost`). */
  devicesAtCost: number;
  accessoriesAtCost: number;
  partsAtCost: number;
  /** Клієнти винні нам. */
  receivables: number;
  /** Ми винні постачальникам. */
  payables: number;
  /** Скільки власників ділять залишок. Модель системи — двоє порівну. */
  ownerCount: number;
}

export interface NetWorthPart {
  key: string;
  label: string;
  amount: number;
  /** `asset` малюється в плюс, `liability` — у мінус. */
  kind: "asset" | "liability";
}

export interface NetWorth {
  parts: NetWorthPart[];
  /** Гроші, які можна витратити сьогодні. */
  liquid: number;
  /** Товар за собівартістю. Не гроші, поки не проданий. */
  inventory: number;
  total: number;
  /** Частка одного власника. */
  perOwner: number;
}

/**
 * Скільки коштує бізнес просто зараз.
 *
 * Найбільша дірка прозорості з усіх знайдених: каси, сейфи, склад і борги все
 * є в базі, але ніде не зведені, тож на пряме питання «скільки в нас усього»
 * жоден екран не відповідав.
 *
 * Склад рахується за СОБІВАРТІСТЮ, а не за цінником: продажна ціна — це
 * надія, а не актив. Магазин, який рахує склад по роздрібу, бачить прибуток,
 * якого ще не заробив.
 */
export function netWorth(input: NetWorthInput): NetWorth {
  const parts: NetWorthPart[] = [
    { key: "registers", label: "Каси", amount: input.registers, kind: "asset" },
    { key: "safes", label: "Сейфи", amount: input.safes, kind: "asset" },
    { key: "devices", label: "Техніка на складі", amount: input.devicesAtCost, kind: "asset" },
    { key: "accessories", label: "Аксесуари", amount: input.accessoriesAtCost, kind: "asset" },
    { key: "parts", label: "Запчастини", amount: input.partsAtCost, kind: "asset" },
    { key: "receivables", label: "Борг клієнтів", amount: input.receivables, kind: "asset" },
    { key: "payables", label: "Борг постачальникам", amount: input.payables, kind: "liability" },
  ];

  const liquid = input.registers + input.safes;
  const inventory = input.devicesAtCost + input.accessoriesAtCost + input.partsAtCost;
  const total = liquid + inventory + input.receivables - input.payables;

  // Ділення на нуль тут дало б Infinity на екрані. Один власник — усе його.
  const owners = input.ownerCount > 0 ? input.ownerCount : 1;

  return { parts, liquid, inventory, total, perOwner: Math.round(total / owners) };
}
