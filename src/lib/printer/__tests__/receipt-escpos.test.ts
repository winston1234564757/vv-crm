import { describe, it, expect } from "vitest";
import {
  DEFAULT_PRINTER_CONFIG,
  buildReceiptBytes,
  composeReceipt,
  renderBlocksAsText,
  type ResolvedReceipt,
} from "../receipt-escpos";
import { encode } from "../codec";
import { DEFAULT_WIDTH } from "../layout";

const BASE: ResolvedReceipt = {
  type: "sale",
  id: "726e411f-aaaa-bbbb-cccc-dddddddddddd",
  date: "21 липня 2026 о 12:42",
  company: {
    name: "МОБІМАРКЕТ",
    subtitle: "Магазин та сервісний центр",
    address: "м. Березівка, пров. Шевченка 2",
    phone: "+380 967953488",
  },
  title: "ТОВАРНИЙ ЧЕК",
  footerText: "Дякуємо за покупку!\nЧекаємо Вас знову!",
  showSeller: true,
  showBuyer: true,
  showQr: true,
  qrData: "https://example.com/track/abc",
  customerName: "Наталя Асорті",
  customerPhone: "0678692009",
  employeeName: "Адміністратор",
  warrantyText: "",
  totalAmount: 9000,
  items: [{ name: "Realme 9 RMX3521", quantity: 2, unitPrice: 4500, totalPrice: 9000 }],
};

function lines(receipt: ResolvedReceipt): string[] {
  return renderBlocksAsText(composeReceipt(receipt));
}

describe("receipt composition", () => {
  it("never emits a line wider than the paper", () => {
    // The single failure that ruins a receipt: an over-long line wraps and
    // drags every following line out of alignment.
    const receipt: ResolvedReceipt = {
      ...BASE,
      type: "repair_acceptance",
      customerName: "Дуже Довге Прізвище Замовника Тут",
      device: {
        name: "Samsung Galaxy A54 5G Enterprise Edition",
        imei: "864244060473394827364758",
        accessories: "Пристрій, зарядний пристрій, чохол, коробка",
        condition: "Grade B (Хороший)",
      },
      issue: "Не заряджається, не реагує на кнопку живлення взагалі ніяк",
      warrantyText:
        "1. Безкоштовне зберігання готового пристрою - до 14 днів.\n2. СЦ не несе відповідальності за збереження даних.",
    };

    for (const line of lines(receipt)) {
      expect(line.length).toBeLessThanOrEqual(DEFAULT_WIDTH);
    }
  });

  it("prints only the first eight characters of the id", () => {
    expect(lines(BASE).some((l) => l.includes("№726e411f"))).toBe(true);
    expect(lines(BASE).some((l) => l.includes("aaaa"))).toBe(false);
  });

  describe("sale", () => {
    it("lists items and a total that adds up", () => {
      const out = lines(BASE);
      expect(out).toContain("Realme 9 RMX3521");
      expect(out.some((l) => l.includes("2 x 4 500 = 9 000"))).toBe(true);
      expect(out.some((l) => l.includes("ДО СПЛАТИ:") && l.includes("9 000 грн"))).toBe(true);
    });

    it("falls back to a placeholder line when nothing was itemised", () => {
      const out = lines({ ...BASE, items: [], totalAmount: 450 });
      expect(out).toContain("Товар / послуга");
      expect(out.some((l) => l.includes("450 грн"))).toBe(true);
    });

    it("shows a discount only when there is one", () => {
      expect(lines(BASE).some((l) => l.includes("Знижка"))).toBe(false);
      expect(lines({ ...BASE, discount: 10 }).some((l) => l.includes("Знижка"))).toBe(true);
      expect(lines({ ...BASE, discount: 0 }).some((l) => l.includes("Знижка"))).toBe(false);
    });

    it("labels the staff member as the seller", () => {
      expect(lines(BASE).some((l) => l.startsWith("Продавець:"))).toBe(true);
    });

    it("has no signature lines — a sale is not counter-signed", () => {
      expect(lines(BASE).some((l) => l.includes("підпис"))).toBe(false);
    });
  });

  describe("repair acceptance", () => {
    const acceptance: ResolvedReceipt = {
      ...BASE,
      type: "repair_acceptance",
      title: "КВИТАНЦІЯ ПРИЙМАННЯ",
      items: undefined,
      totalAmount: undefined,
      device: {
        name: "Realme 9 RMX3521",
        imei: "864244060473-39",
        accessories: "Пристрій",
        condition: "Grade B (Хороший)",
      },
      issue: "Не заряджається",
      warrantyText: "1. Безкоштовне зберігання готового пристрою - до 14 днів.",
    };

    it("carries the device identity — the point of the document", () => {
      const out = lines(acceptance);
      expect(out).toContain("Модель: Realme 9 RMX3521");
      expect(out).toContain("IMEI/SN: 864244060473-39");
      expect(out).toContain("Комплект: Пристрій");
      expect(out).toContain("Стан: Grade B (Хороший)");
    });

    it("names the reported fault under its own heading", () => {
      const out = lines(acceptance);
      expect(out).toContain("ЗАЯВЛЕНА НЕСПРАВНІСТЬ");
      expect(out).toContain("Не заряджається");
    });

    it("prints two signature rules", () => {
      const out = lines(acceptance);
      expect(out).toContain("Здав (підпис)");
      expect(out).toContain("Прийняв (підпис)");
      expect(out.filter((l) => /^_+$/.test(l))).toHaveLength(2);
    });

    it("shows no money — nothing has been paid yet", () => {
      expect(lines(acceptance).some((l) => l.includes("грн"))).toBe(false);
    });

    it("labels the staff member as the receiver", () => {
      expect(lines(acceptance).some((l) => l.startsWith("Прийняв:"))).toBe(true);
    });
  });

  describe("repair warranty", () => {
    const warranty: ResolvedReceipt = {
      ...BASE,
      type: "repair_warranty",
      title: "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ",
      items: undefined,
      totalAmount: undefined,
      device: { name: "Realme 9 RMX3521", imei: "864244060473-39" },
      issue: "Заміна роз'єму живлення",
      repairItems: [
        { name: "Роз'єм живлення Type-C", quantity: 1, unitPrice: 250, totalPrice: 250 },
        { name: "Робота майстра", quantity: 1, unitPrice: 300, totalPrice: 300 },
      ],
      warrantyText: "Термін гарантії: 3 міс.",
    };

    it("totals the parts and labour", () => {
      const out = lines(warranty);
      expect(out.some((l) => l.includes("РАЗОМ:") && l.includes("550 грн"))).toBe(true);
      expect(out.some((l) => l.includes("(сплачено)"))).toBe(true);
    });

    it("falls back to the flat price when nothing was itemised", () => {
      const out = lines({ ...warranty, repairItems: [], price: 700 });
      expect(out.some((l) => l.includes("ДО СПЛАТИ:") && l.includes("700 грн"))).toBe(true);
    });

    it("omits accessories and condition — irrelevant on handover", () => {
      const out = lines(warranty);
      expect(out.some((l) => l.startsWith("Комплект:"))).toBe(false);
      expect(out.some((l) => l.startsWith("Стан:"))).toBe(false);
    });
  });

  describe("toggles", () => {
    it("drops the buyer block when hidden", () => {
      const out = lines({ ...BASE, showBuyer: false });
      expect(out.some((l) => l.includes("Наталя"))).toBe(false);
      expect(out).not.toContain("ПОКУПЕЦЬ");
    });

    it("drops the seller line when hidden", () => {
      expect(lines({ ...BASE, showSeller: false }).some((l) => l.startsWith("Продавець:"))).toBe(
        false,
      );
    });

    it("drops the QR when hidden", () => {
      expect(lines(BASE)).toContain("[QR]");
      expect(lines({ ...BASE, showQr: false })).not.toContain("[QR]");
    });

    it("drops the QR when there is no payload to encode", () => {
      expect(lines({ ...BASE, qrData: "" })).not.toContain("[QR]");
    });
  });

  it("uses the edited values, so paper matches the preview", () => {
    const out = lines({ ...BASE, company: { ...BASE.company, name: "ІНША НАЗВА" } });
    expect(out).toContain("ІНША НАЗВА");
    expect(out).not.toContain("МОБІМАРКЕТ");
  });
});

describe("receipt rendering", () => {
  it("starts by resetting and selecting CP1251 at the probed index", () => {
    const out = Array.from(buildReceiptBytes(BASE));
    // ESC @, FS ., ESC t 23 — the order the printer requires.
    expect(out.slice(0, 7)).toEqual([0x1b, 0x40, 0x1c, 0x2e, 0x1b, 0x74, 23]);
  });

  it("encodes every glyph — no line falls back to '?'", () => {
    const out = buildReceiptBytes({
      ...BASE,
      type: "repair_acceptance",
      device: { name: "Пристрій Ґ Є І Ї", imei: "123", accessories: "Річ", condition: "Добрий" },
      issue: "Не заряджається — «зовсім»",
      warrantyText: "Ціна 1 500 ₴, гарантія 3 міс.",
    });
    expect(Array.from(out)).not.toContain(0x3f);
  });

  it("feeds the tail so the text clears the tear bar", () => {
    const out = Array.from(buildReceiptBytes(BASE));
    expect(out.slice(-3)).toEqual([0x1b, 0x64, DEFAULT_PRINTER_CONFIG.feedLines]);
  });

  it("appends a cut only when the printer has a cutter", () => {
    const withCut = Array.from(
      buildReceiptBytes(BASE, { ...DEFAULT_PRINTER_CONFIG, cut: true }),
    );
    expect(withCut.slice(-4)).toEqual([0x1d, 0x56, 66, 0]);
    expect(Array.from(buildReceiptBytes(BASE))).not.toContain(0x56);
  });

  it("leaves bold and magnification off at the end", () => {
    // A receipt that ends mid-mode would bleed its styling into the next one,
    // since the printer keeps state between jobs.
    const out = Array.from(buildReceiptBytes(BASE));
    const lastBold = lastIndexOfSequence(out, [0x1b, 0x45]);
    const lastSize = lastIndexOfSequence(out, [0x1d, 0x21]);
    expect(out[lastBold + 2]).toBe(0);
    expect(out[lastSize + 2]).toBe(0);
  });

  it("does not re-emit a mode that is already active", () => {
    const out = Array.from(buildReceiptBytes(BASE));
    const boldToggles = countSequence(out, [0x1b, 0x45]);
    // Far fewer than one per line; the renderer tracks current state.
    expect(boldToggles).toBeLessThan(renderBlocksAsText(composeReceipt(BASE)).length);
  });

  it("sends the QR as a native symbol, never as an image", () => {
    const out = Array.from(buildReceiptBytes(BASE));
    expect(countSequence(out, [0x1d, 0x28, 0x6b])).toBeGreaterThan(0);
    expect(countSequence(out, [0x1d, 0x76, 0x30])).toBe(0);
  });

  it("carries the QR payload verbatim", () => {
    const out = buildReceiptBytes(BASE);
    const payload = Array.from(new TextEncoder().encode(BASE.qrData));
    expect(indexOfSequence(Array.from(out), payload)).toBeGreaterThan(-1);
  });

  it("respects a narrower column count", () => {
    const narrow = { ...DEFAULT_PRINTER_CONFIG, columns: 24 };
    for (const line of renderBlocksAsText(composeReceipt(BASE, narrow.columns), narrow.columns)) {
      expect(line.length).toBeLessThanOrEqual(24);
    }
  });

  it("produces the same bytes for the same receipt", () => {
    expect(Array.from(buildReceiptBytes(BASE))).toEqual(Array.from(buildReceiptBytes(BASE)));
  });

  it("encodes Cyrillic through CP1251, not as raw Unicode", () => {
    const out = Array.from(buildReceiptBytes(BASE));
    expect(indexOfSequence(out, Array.from(encode("МОБІМАРКЕТ", "cp1251")))).toBeGreaterThan(-1);
  });
});

function indexOfSequence(haystack: number[], needle: number[]): number {
  if (needle.length === 0) return -1;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function lastIndexOfSequence(haystack: number[], needle: number[]): number {
  outer: for (let i = haystack.length - needle.length; i >= 0; i--) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function countSequence(haystack: number[], needle: number[]): number {
  let count = 0;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    count++;
  }
  return count;
}
