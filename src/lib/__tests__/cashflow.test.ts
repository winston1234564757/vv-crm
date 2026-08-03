import { describe, it, expect } from "vitest";
import { classifyMove, summarize, unroundedMoves, type CheckedMove, type RawMove } from "../cashflow";

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

describe("unroundedMoves", () => {
  function cm(over: Partial<CheckedMove> = {}): CheckedMove {
    return {
      id: "t1",
      at: "2026-07-31T18:46:00",
      description: "",
      amount: 100,
      from_type: "safe",
      to_type: "supplier",
      reference_type: "inventory",
      ...over,
    };
  }

  it("не чіпає округлені суми", () => {
    expect(unroundedMoves([cm({ amount: 620 }), cm({ amount: 3000 })])).toEqual([]);
  });

  // Обидві реальні: SSD SanDisk 542 і потім чорнила — картка, записана готівкою.
  it("ловить неокруглену витрату", () => {
    const bad = cm({ id: "ssd", amount: 542, description: "SSD SanDisk 128GB" });
    expect(unroundedMoves([cm(), bad]).map((m) => m.id)).toEqual(["ssd"]);
  });

  /* Розподіл ділить круглу суму на три частки за відсотками — частки не круглі
     за побудовою. Якби перевірка їх ловила, список був би нескінченним шумом. */
  it("пропускає внутрішній розподіл між касою і сейфом", () => {
    const split = cm({
      amount: 2170,
      from_type: "cash_register",
      to_type: "safe",
      reference_type: "distribution",
    });
    expect(unroundedMoves([split])).toEqual([]);
  });

  // Вилучення частки виходить НАЗОВНІ, тож внутрішнім не рахується і ловиться.
  it("ловить неокруглене вилучення частки назовні", () => {
    const withdrawal = cm({
      id: "w79",
      amount: 79,
      from_type: "safe",
      to_type: "external",
      reference_type: "distribution",
    });
    expect(unroundedMoves([withdrawal]).map((m) => m.id)).toEqual(["w79"]);
  });

  it("порожній список нічого не ловить", () => {
    expect(unroundedMoves([])).toEqual([]);
  });

  /* Бекфіл авансу власника (03.08) записав корекцію парою: сторно −3 498 із
     сейфа ЧП і рівний йому аванс +3 498 з Growth. Назовні не пішло ні гривні,
     тож у списку помилок вводу їм не місце. */
  it("пропускає сторновану пару", () => {
    const storno = cm({ id: "st", amount: -3498, from_type: "safe", to_type: "external" });
    const advance = cm({ id: "adv", amount: 3498, from_type: "safe", to_type: "external" });
    expect(unroundedMoves([storno, advance])).toEqual([]);
  });

  // Пара гасить рівно один запис. Другий такий самий — уже справжнє вилучення.
  it("ловить неспарений запис на ту саму суму", () => {
    const storno = cm({ id: "st", amount: -3498, from_type: "safe", to_type: "external" });
    const paired = cm({ id: "adv", amount: 3498, from_type: "safe", to_type: "external" });
    const lone = cm({ id: "real", amount: 3498, from_type: "safe", to_type: "external" });
    expect(unroundedMoves([storno, paired, lone]).map((m) => m.id)).toEqual(["real"]);
  });
});
