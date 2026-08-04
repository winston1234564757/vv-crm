import { describe, it, expect } from "vitest";
import {
  classifyMove,
  summarize,
  safeHalfDrift,
  moveMethod,
  type RawMove,
  type SafeMove,
} from "../cashflow";

function mv(over: Partial<RawMove> = {}): RawMove {
  return {
    amount: 100,
    from_type: "customer",
    to_type: "cash_register",
    reference_type: "sale",
    ...over,
  };
}

describe("classifyMove", () => {
  it("клієнт → каса це надходження", () => {
    expect(classifyMove(mv())).toBe("inflow");
  });

  it("сейф → постачальник це витрата", () => {
    expect(
      classifyMove(mv({ from_type: "safe", to_type: "supplier", reference_type: "inventory" })),
    ).toBe("outflow");
  });

  it("каса → сейф це внутрішній переказ", () => {
    expect(
      classifyMove(
        mv({ from_type: "cash_register", to_type: "safe", reference_type: "distribution" }),
      ),
    ).toBe("internal");
  });

  // Той самий reference_type, різні класи — саме тому класифікуємо за
  // сторонами, а не за типом операції.
  it("distribution назовні це витрата, попри те що всередину це переказ", () => {
    const inside = mv({
      from_type: "cash_register",
      to_type: "safe",
      reference_type: "distribution",
    });
    const outside = mv({ from_type: "safe", to_type: "external", reference_type: "distribution" });
    expect(classifyMove(inside)).toBe("internal");
    expect(classifyMove(outside)).toBe("outflow");
  });

  it("зовні → зовні не рахується ніяк", () => {
    expect(classifyMove(mv({ from_type: "customer", to_type: "supplier" }))).toBe("internal");
  });
});

describe("summarize", () => {
  const moves: RawMove[] = [
    mv({ amount: 18260, reference_type: "sale" }),
    mv({ amount: 10600, reference_type: "repair_payment" }),
    mv({ amount: 200, reference_type: "client_order" }),
    mv({ amount: 14500, from_type: "external", to_type: "safe", reference_type: "top_up" }),
    mv({ amount: 23690, from_type: "safe", to_type: "supplier", reference_type: "inventory" }),
    mv({ amount: 7151, from_type: "safe", to_type: "external", reference_type: "expense" }),
    mv({ amount: 3759, from_type: "safe", to_type: "external", reference_type: "distribution" }),
    mv({ amount: 240, from_type: "safe", to_type: "external", reference_type: "accessory" }),
    mv({ amount: 30930, from_type: "cash_register", to_type: "safe", reference_type: "distribution" }),
  ];

  it("складає тотожність без розриву", () => {
    const s = summarize(moves, 4350, 13070);
    expect(s.inflow).toBe(43560);
    expect(s.outflow).toBe(34840);
    expect(s.closing).toBe(13070);
    expect(s.drift).toBe(0);
  });

  // Без цієї половини тест не доводив би, що звірка взагалі щось перевіряє.
  it("показує розрив рівно на суму зайвого руху", () => {
    const s = summarize([...moves, mv({ amount: 500, reference_type: "sale" })], 4350, 13070);
    expect(s.drift).toBe(-500);
  });

  it("внутрішні перекази не входять у потік, але рахуються окремо", () => {
    const s = summarize(moves, 4350, 13070);
    expect(s.internal).toEqual({ count: 1, total: 30930 });
  });

  it("розділяє операційний потік і власників", () => {
    const s = summarize(moves, 4350, 13070);
    expect(s.operatingNet).toBe(-2021);
    expect(s.ownerNet).toBe(10741);
  });

  it("top_up і вихідний distribution не потрапляють в операційні", () => {
    const s = summarize(moves, 4350, 13070);
    expect(s.inflowLines.find((l) => l.key === "top_up")?.owner).toBe(true);
    expect(s.outflowLines.find((l) => l.key === "distribution")?.owner).toBe(true);
    expect(s.inflowLines.find((l) => l.key === "sale")?.owner).toBe(false);
  });

  it("порожній період дає нулі, а не падіння", () => {
    const s = summarize([], 0, 0);
    expect(s).toMatchObject({ opening: 0, inflow: 0, outflow: 0, closing: 0, drift: 0 });
    expect(s.inflowLines).toEqual([]);
  });

  it("рядки впорядковані за спаданням суми", () => {
    const s = summarize(moves, 4350, 13070);
    expect(s.inflowLines.map((l) => l.key)).toEqual([
      "sale",
      "top_up",
      "repair_payment",
      "client_order",
    ]);
  });
});

/* Звірка половин сейфа.

   Пишеться не «про всяк випадок»: 29.07 сейф Growth мав правильний сумарний
   баланс при половинах, розбіжних на 550 ₴, і `summarize().drift` дорівнював
   нулю. Розрив прожив тиждень, бо його не бачив жоден екран. */
function sm(over: Partial<SafeMove> = {}): SafeMove {
  return {
    amount: 100,
    from_type: "cash_register",
    from_id: "reg-1",
    to_type: "safe",
    to_id: "safe-1",
    payment_method: "cash",
    ...over,
  };
}

const SAFE = { id: "safe-1", name: "Growth", balance_cash: 0, balance_cashless: 0 };

describe("moveMethod", () => {
  it("NULL це готівка — так само, як його читає safe_apply", () => {
    expect(moveMethod({ payment_method: null })).toBe("cash");
  });

  it("невідоме значення теж падає в готівку, а не ламає підрахунок", () => {
    expect(moveMethod({ payment_method: "картка" })).toBe("cash");
  });

  it("cashless лишається cashless", () => {
    expect(moveMethod({ payment_method: "cashless" })).toBe("cashless");
  });
});

describe("safeHalfDrift", () => {
  it("сходиться — порожній масив, екран мовчить", () => {
    const moves = [sm({ amount: 500 })];
    expect(safeHalfDrift(moves, [{ ...SAFE, balance_cash: 500 }])).toEqual([]);
  });

  it("ловить саме той випадок, який пропустив сумарний drift", () => {
    /* Прихід 550 з безготівкової каси записаний без методу → реєстр рахує його
       готівкою. Колонки кажуть: уся сума безготівкова. Сумарно 550 = 550,
       тобто `drift` = 0, а половини розходяться на 550 в обидва боки. */
    const moves = [sm({ amount: 550, payment_method: null })];
    const drift = safeHalfDrift(moves, [
      { ...SAFE, balance_cash: 0, balance_cashless: 550 },
    ]);

    expect(drift).toHaveLength(1);
    expect(drift[0].cash).toBe(-550);
    expect(drift[0].cashless).toBe(550);
    // Сумарно все «сходиться» — саме тому потрібна окрема перевірка.
    expect(drift[0].cash + drift[0].cashless).toBe(0);
  });

  it("списання зменшує ту половину, якою платили", () => {
    const moves = [
      sm({ amount: 1000, payment_method: "cash" }),
      sm({
        amount: 300,
        from_type: "safe",
        from_id: "safe-1",
        to_type: "external",
        to_id: null,
        payment_method: "cash",
      }),
    ];
    expect(safeHalfDrift(moves, [{ ...SAFE, balance_cash: 700 }])).toEqual([]);
  });

  it("рухи чужих сейфів не впливають", () => {
    const moves = [sm({ amount: 400, to_id: "safe-2" })];
    const drift = safeHalfDrift(moves, [SAFE]);
    expect(drift).toEqual([]);
  });

  it("повертає тільки розбіжні сейфи, а не всі підряд", () => {
    const moves = [sm({ amount: 100, to_id: "safe-1" }), sm({ amount: 100, to_id: "safe-2" })];
    const drift = safeHalfDrift(moves, [
      { id: "safe-1", name: "Growth", balance_cash: 100, balance_cashless: 0 },
      { id: "safe-2", name: "OPEX", balance_cash: 999, balance_cashless: 0 },
    ]);
    expect(drift.map((d) => d.name)).toEqual(["OPEX"]);
  });
});
