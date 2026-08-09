# Характеристики аксесуарів живлення — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кабелі, зарядні блоки й павербанки отримують структуровані характеристики (розʼєми, потужність, порти, комплектний кабель), які заповнюються розбором назви, фільтруються фасетами на складі та в касі й показуються рядком на вітрині.

**Architecture:** Одна колонка `accessories.specs jsonb`, описана zod-схемою в `src/lib/accessory-specs.ts`. Той самий модуль містить парсер назв постачальника — він працює у формі, в CSV-імпорті й у разовій заливці 33 наявних позицій. Фасети рахуються чистими функціями над масивом товарів на клієнті; серверні дії лише валідують те, що прийшло.

**Tech Stack:** Next.js 16.2.7 (App Router, Server Actions), React 19, zod 4, vitest 4, Supabase (DDL через MCP `apply_migration`), Tailwind.

## Global Constraints

- `src/types/database.ts` **не регенерується** — тип колонки додається вручну, доступ до неї в місцях, де згенерований тип її не знає, через `as any` (див. `AGENTS.md`).
- Next.js у цьому проєкті має ламкі зміни щодо тренувальних даних — перед написанням коду читати `node_modules/next/dist/docs/`.
- Міграції: `apply_migration` ставить власний штамп часу. Після виклику **обовʼязково** `list_migrations`, перейменувати локальний `.sql` під версію, яку записав прод, і тільки тоді комітити (`docs/MIGRATIONS.md`).
- Файли міграцій лежать у `supabase/migrations/`, іменування `YYYYMMDDHHMMSS_snake_case.sql`.
- Тести — vitest, `npm test`, файли в `__tests__/` поруч із модулем.
- Мова інтерфейсу — українська. Коментарі в коді — українською, пояснюють *чому*, не *що*.
- Порти зберігаються як перелік типів **без кількості**: блок із двома USB-A не відрізняється від блока з одним.
- Вати й ампери — два незалежні поля, заповнюється те, що надруковане на коробці. Перерахунок амперів у вати заборонений.
- Комплекти (блок + кабель) **не потрапляють** у фасети кабелів.

---

### Task 1: Типи, zod-схема й підписи

**Files:**
- Create: `src/lib/accessory-specs.ts`
- Test: `src/lib/__tests__/accessory-specs.test.ts`

**Interfaces:**
- Consumes: нічого
- Produces: типи `Connector`, `Port`, `Protocol`, `CableSpec`, `ChargerSpec`, `PowerbankSpec`, `PowerSpec`; константи `CONNECTOR_LABELS`, `PORT_LABELS`, `PROTOCOL_LABELS`; схема `powerSpecSchema`; функція `parsePowerSpec(value: unknown): PowerSpec | null`

- [ ] **Step 1: Написати падаючий тест**

Створити `src/lib/__tests__/accessory-specs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parsePowerSpec, CONNECTOR_LABELS } from "../accessory-specs";

describe("parsePowerSpec", () => {
  it("приймає кабель із обовʼязковими розʼємами", () => {
    expect(parsePowerSpec({ cable: { from: "usb_a", to: "usb_c", amps: 3, length_m: 1 } })).toEqual({
      cable: { from: "usb_a", to: "usb_c", amps: 3, length_m: 1 },
    });
  });

  it("відкидає кабель без розʼємів — такий товар невидимий для всіх фільтрів", () => {
    expect(() => parsePowerSpec({ cable: { watts: 60 } })).toThrow();
  });

  it("відкидає відʼємні числа", () => {
    expect(() => parsePowerSpec({ cable: { from: "usb_c", to: "usb_c", watts: -1 } })).toThrow();
  });

  it("відкидає дублікати в портах", () => {
    expect(() => parsePowerSpec({ charger: { protocols: ["pd"], ports: ["usb_c", "usb_c"] } })).toThrow();
  });

  it("порожні порти дозволені — на коробці їх може бути не вказано", () => {
    expect(parsePowerSpec({ charger: { watts: 30, protocols: ["pd"], ports: [] } })).toEqual({
      charger: { watts: 30, protocols: ["pd"], ports: [] },
    });
  });

  it("порожній обʼєкт стає null, а не {}", () => {
    expect(parsePowerSpec({})).toBeNull();
    expect(parsePowerSpec(null)).toBeNull();
    expect(parsePowerSpec(undefined)).toBeNull();
  });

  it("має підпис для кожного розʼєму, включно з «Інше»", () => {
    expect(CONNECTOR_LABELS.other).toBe("Інше");
    expect(CONNECTOR_LABELS.micro_usb).toBe("microUSB");
  });
});
```

- [ ] **Step 2: Запустити тест і переконатись, що він падає**

Run: `npx vitest run src/lib/__tests__/accessory-specs.test.ts`
Expected: FAIL — `Failed to resolve import "../accessory-specs"`

- [ ] **Step 3: Написати мінімальну реалізацію**

Створити `src/lib/accessory-specs.ts`:

```ts
import { z } from "zod";

/* ── Словник ────────────────────────────────────────────────────────────────
 *
 * `other` існує навмисно: список розʼємів закритий, а розʼєми кабеля —
 * обовʼязкові. Без запасного значення перший же USB→AUX неможливо було б
 * завести взагалі.
 */

export type Connector = "usb_a" | "usb_c" | "lightning" | "micro_usb" | "other";
export type Port = "usb_a" | "usb_c";
export type Protocol = "pd" | "qc3";

export const CONNECTOR_LABELS: Record<Connector, string> = {
  usb_a: "USB-A",
  usb_c: "Type-C",
  lightning: "Lightning",
  micro_usb: "microUSB",
  other: "Інше",
};

export const PORT_LABELS: Record<Port, string> = {
  usb_a: "USB-A",
  usb_c: "USB-C",
};

export const PROTOCOL_LABELS: Record<Protocol, string> = {
  pd: "PD",
  qc3: "QC3.0",
};

export interface CableSpec {
  from: Connector;
  to: Connector;
  watts?: number;
  amps?: number;
  length_m?: number;
}

export interface ChargerSpec {
  watts?: number;
  protocols: Protocol[];
  ports: Port[];
}

export interface PowerbankSpec {
  mah?: number;
  watts?: number;
  wireless: boolean;
  ports: Port[];
}

export interface PowerSpec {
  cable?: CableSpec;
  charger?: ChargerSpec;
  powerbank?: PowerbankSpec;
}

const connectorEnum = z.enum(["usb_a", "usb_c", "lightning", "micro_usb", "other"]);
const portEnum = z.enum(["usb_a", "usb_c"]);
const protocolEnum = z.enum(["pd", "qc3"]);

const positive = z.number().positive().optional();

/* Порти без дублікатів: `["usb_c","usb_c"]` означало б «два USB-C», а
   кількість ми свідомо не зберігаємо — тож це просто зіпсовані дані. */
const portList = z
  .array(portEnum)
  .refine((v) => new Set(v).size === v.length, "Порти не можуть дублюватись");

const cableSchema = z.object({
  from: connectorEnum,
  to: connectorEnum,
  watts: positive,
  amps: positive,
  length_m: positive,
});

const chargerSchema = z.object({
  watts: positive,
  protocols: z.array(protocolEnum),
  ports: portList,
});

const powerbankSchema = z.object({
  mah: positive,
  watts: positive,
  wireless: z.boolean(),
  ports: portList,
});

export const powerSpecSchema = z.object({
  cable: cableSchema.optional(),
  charger: chargerSchema.optional(),
  powerbank: powerbankSchema.optional(),
});

/**
 * Розбирає значення з БД або з форми. Порожній набір повертається як `null`:
 * `{}` у колонці виглядав би як «характеристики є», і товар не потрапив би в
 * чипс «Без характеристик», хоча заповнювати його треба.
 */
export function parsePowerSpec(value: unknown): PowerSpec | null {
  if (value === null || value === undefined) return null;
  const parsed = powerSpecSchema.parse(value);
  if (!parsed.cable && !parsed.charger && !parsed.powerbank) return null;
  return parsed;
}
```

- [ ] **Step 4: Запустити тести**

Run: `npx vitest run src/lib/__tests__/accessory-specs.test.ts`
Expected: PASS, 7 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/accessory-specs.ts src/lib/__tests__/accessory-specs.test.ts
git commit -m "feat(аксесуари): модель характеристик живлення"
```

---

### Task 2: Парсер назв постачальника

**Files:**
- Modify: `src/lib/accessory-specs.ts`
- Create: `src/lib/__tests__/accessory-specs-parser.test.ts`

**Interfaces:**
- Consumes: типи з Task 1
- Produces: `parseNameToSpecs(name: string, type: string): PowerSpec | null`

Парсер — центральна частина фічі, а не разовий скрипт. Він працює у формі, в імпорті й у заливці. Без нього заповнення лишається ручним, і через три місяці половина каталогу — «Без характеристик».

- [ ] **Step 1: Написати падаючий тест**

Створити `src/lib/__tests__/accessory-specs-parser.test.ts`. Це табличний тест по всіх 33 наявних назвах — він же ловить регресію, якщо правила розбору колись поправлять:

```ts
import { describe, it, expect } from "vitest";
import { parseNameToSpecs, type PowerSpec } from "../accessory-specs";

const CABLES: [string, PowerSpec][] = [
  ["Кабель Baseus Cafule USB to MicroUSB 2.4A (1m)",
   { cable: { from: "usb_a", to: "micro_usb", amps: 2.4, length_m: 1 } }],
  ["Кабель Baseus Cafule USB to Type-C 3A (1m)",
   { cable: { from: "usb_a", to: "usb_c", amps: 3, length_m: 1 } }],
  ["Кабель Baseus Superior Series Fast Charging USB to Type-C 100W (1m)",
   { cable: { from: "usb_a", to: "usb_c", watts: 100, length_m: 1 } }],
  ["Кабель Borofone BX114 Structure Type-C to Lightning 27W (1m)",
   { cable: { from: "usb_c", to: "lightning", watts: 27, length_m: 1 } }],
  ["Кабель Borofone BX114 Structure USB to Lightning 2.4A (1m)",
   { cable: { from: "usb_a", to: "lightning", amps: 2.4, length_m: 1 } }],
  ["Кабель Borofone BX114 Structure USB to MicroUSB 2.4A (1m)",
   { cable: { from: "usb_a", to: "micro_usb", amps: 2.4, length_m: 1 } }],
  ["Кабель Borofone BX115 Lotto Type-C to Type-C 60W (1m)",
   { cable: { from: "usb_c", to: "usb_c", watts: 60, length_m: 1 } }],
  ["Кабель Borofone BX115 Lotto USB to Type-C 3A (1m)",
   { cable: { from: "usb_a", to: "usb_c", amps: 3, length_m: 1 } }],
  ["Кабель Hoco U127 Power Type-C to Lightning (1.2m)",
   { cable: { from: "usb_c", to: "lightning", length_m: 1.2 } }],
  ["Кабель Hoco U144 New Type-C to Lightning 27W (1.2m)",
   { cable: { from: "usb_c", to: "lightning", watts: 27, length_m: 1.2 } }],
  ["Кабель Hoco U144 New Type-C to Type-C 60W (1.2m)",
   { cable: { from: "usb_c", to: "usb_c", watts: 60, length_m: 1.2 } }],
  ["Кабель Hoco U144 New USB to Lightning 2.4A (1.2m)",
   { cable: { from: "usb_a", to: "lightning", amps: 2.4, length_m: 1.2 } }],
  ["Кабель Hoco X109 Energy silicone USB to Lightning (1m)",
   { cable: { from: "usb_a", to: "lightning", length_m: 1 } }],
  ["Кабель Hoco X127 Exceed Type-C to Type-C 60W (1m)",
   { cable: { from: "usb_c", to: "usb_c", watts: 60, length_m: 1 } }],
  ["Кабель Hoco X96 Hyper Type-C to Lightning 20W (0.25m)",
   { cable: { from: "usb_c", to: "lightning", watts: 20, length_m: 0.25 } }],
  ["Кабель Hoco X96 Hyper Type-C to Type-C 100W (1m)",
   { cable: { from: "usb_c", to: "usb_c", watts: 100, length_m: 1 } }],
  ["Кабель Hoco X96 Hyper Type-C to Type-C 60W (1m)",
   { cable: { from: "usb_c", to: "usb_c", watts: 60, length_m: 1 } }],
  ["Кабель WIWU C086 Stellar USB to MicroUSB 2.1A (1m)",
   { cable: { from: "usb_a", to: "micro_usb", amps: 2.1, length_m: 1 } }],
];

const CHARGERS: [string, PowerSpec][] = [
  ["МЗП Borofone BA95A Ilustre QC3.0 18W (1USB-A)",
   { charger: { watts: 18, protocols: ["qc3"], ports: ["usb_a"] } }],
  ["МЗП Borofone BA97A PD30W (1USB-C)",
   { charger: { watts: 30, protocols: ["pd"], ports: ["usb_c"] } }],
  ["МЗП Borofone BN29 Fuente PD30W+QC3.0 (1USB-A/1C)",
   { charger: { watts: 30, protocols: ["pd", "qc3"], ports: ["usb_a", "usb_c"] } }],
  ["МЗП Hoco C104A PD20W (1USB-C)",
   { charger: { watts: 20, protocols: ["pd"], ports: ["usb_c"] } }],
  ["МЗП Hoco C145A Charm QC3.0 18W (1USB-A)",
   { charger: { watts: 18, protocols: ["qc3"], ports: ["usb_a"] } }],
  ["МЗП Hoco C147A PD20W+QC3.0 (1USB-A/1C) + кабель Type-C to Type-C",
   { charger: { watts: 20, protocols: ["pd", "qc3"], ports: ["usb_a", "usb_c"] },
     cable: { from: "usb_c", to: "usb_c" } }],
  ["МЗП Hoco C149A Charm PD30W+QC3.0 (1USB-A/1C)",
   { charger: { watts: 30, protocols: ["pd", "qc3"], ports: ["usb_a", "usb_c"] } }],
  ["МЗП Hoco CS111A Lounge QC3.0 22.5W (1USB-A) + кабель USB to Type-C",
   { charger: { watts: 22.5, protocols: ["qc3"], ports: ["usb_a"] },
     cable: { from: "usb_a", to: "usb_c" } }],
  ["МЗП Hoco CS112A Lounge PD30W+QC3.0 (1USB-A/1C)",
   { charger: { watts: 30, protocols: ["pd", "qc3"], ports: ["usb_a", "usb_c"] } }],
  ["МЗП Hoco CS112A Lounge PD30W+QC3.0 + кабель Type-C to Type-C",
   { charger: { watts: 30, protocols: ["pd", "qc3"], ports: [] },
     cable: { from: "usb_c", to: "usb_c" } }],
  ["МЗП Hoco CS21A Rich QC3.0 18W + кабель USB to MicroUSB",
   { charger: { watts: 18, protocols: ["qc3"], ports: [] },
     cable: { from: "usb_a", to: "micro_usb" } }],
  ["МЗП Hoco CS55A Surplus PD30W+QC3.0 (1USB-A/1C) + кабель Type-C to Lightning (White)",
   { charger: { watts: 30, protocols: ["pd", "qc3"], ports: ["usb_a", "usb_c"] },
     cable: { from: "usb_c", to: "lightning" } }],
  ["МЗП Hoco CS93A Leader PD20W (1USB-C) + кабель Type-C to Type-C",
   { charger: { watts: 20, protocols: ["pd"], ports: ["usb_c"] },
     cable: { from: "usb_c", to: "usb_c" } }],
  ["МЗП Hoco N62 Gentle PD30W (1USB-C) + кабель Type-C to Lightning",
   { charger: { watts: 30, protocols: ["pd"], ports: ["usb_c"] },
     cable: { from: "usb_c", to: "lightning" } }],
];

describe("parseNameToSpecs — кабелі", () => {
  it.each(CABLES)("%s", (name, expected) => {
    expect(parseNameToSpecs(name, "cable")).toEqual(expected);
  });
});

describe("parseNameToSpecs — зарядні блоки", () => {
  it.each(CHARGERS)("%s", (name, expected) => {
    expect(parseNameToSpecs(name, "charger")).toEqual(expected);
  });
});

describe("parseNameToSpecs — павербанк", () => {
  it("розбирає ємність, потужність і БЗП", () => {
    expect(
      parseNameToSpecs("Power Bank Hoco J140A Tony ultra-thin PD20W з БЗП 5000 mAh", "powerbank"),
    ).toEqual({ powerbank: { mah: 5000, watts: 20, wireless: true, ports: [] } });
  });
});

describe("parseNameToSpecs — межі", () => {
  it("часткове розібрання: без довжини лишає length_m порожнім", () => {
    const res = parseNameToSpecs("Кабель Hoco Type-C to Type-C 60W", "cable");
    expect(res?.cable?.from).toBe("usb_c");
    expect(res?.cable?.length_m).toBeUndefined();
  });

  it("нерозбірна назва кабеля дає null, а не напівпорожній кабель", () => {
    expect(parseNameToSpecs("Кабель невідомий", "cable")).toBeNull();
  });

  it("категорії поза живленням не розбираються взагалі", () => {
    expect(parseNameToSpecs("Чохол Silicone Case USB to Type-C", "case")).toBeNull();
  });
});
```

- [ ] **Step 2: Запустити тест і переконатись, що він падає**

Run: `npx vitest run src/lib/__tests__/accessory-specs-parser.test.ts`
Expected: FAIL — `parseNameToSpecs is not a function`

- [ ] **Step 3: Написати реалізацію**

Дописати в кінець `src/lib/accessory-specs.ts`:

```ts
/* ── Розбір назви постачальника ──────────────────────────────────────────────
 *
 * Назви від Hoco/Borofone/Baseus дисципліновані: «X to Y», «PD30W+QC3.0»,
 * «(1USB-A/1C)», «(1.2m)». Це дозволяє заповнити характеристики автоматично, а
 * ручне введення лишити виправленням, а не основною роботою.
 *
 * Розбір навмисно ЧАСТКОВИЙ: розібрав розʼєми, не розібрав довжину — записує
 * розʼєми. «Все або нічого» викидало б корисне разом із незрозумілим.
 */

/* Розʼєми шукаємо не regexp-ами по сирому тексту, а по токенах: «MicroUSB»
   містить «USB», і будь-який пошук «останнього збігу» плутав би microUSB з
   USB-A. Заміна на токени знімає перекриття раз і назавжди. */
function tokenizeConnectors(text: string): string {
  return text
    .replace(/micro\s*-?\s*usb/gi, " §MICRO§ ")
    .replace(/type\s*-?\s*c/gi, " §TYPEC§ ")
    .replace(/lightning/gi, " §LIGHT§ ")
    .replace(/\busb\b/gi, " §USBA§ ");
}

const TOKEN_TO_CONNECTOR: Record<string, Connector> = {
  "§MICRO§": "micro_usb",
  "§TYPEC§": "usb_c",
  "§LIGHT§": "lightning",
  "§USBA§": "usb_a",
};

function connectorsIn(text: string): Connector[] {
  const found = tokenizeConnectors(text).match(/§[A-Z]+§/g) ?? [];
  return found.map((t) => TOKEN_TO_CONNECTOR[t]).filter(Boolean);
}

/** «USB to Type-C» → { from: usb_a, to: usb_c }. Розділювач — окреме слово `to`. */
function parseConnectorPair(text: string): { from: Connector; to: Connector } | null {
  const sep = text.match(/\sto\s/i);
  if (!sep || sep.index === undefined) return null;

  const left = connectorsIn(text.slice(0, sep.index));
  const right = connectorsIn(text.slice(sep.index + sep[0].length));
  if (left.length === 0 || right.length === 0) return null;

  /* Зліва беремо ОСТАННІЙ розʼєм, справа ПЕРШИЙ: обидва стоять упритул до
     «to», а решта назви — бренд і серія, де теж трапляються ці слова. */
  return { from: left[left.length - 1], to: right[0] };
}

function num(match: RegExpMatchArray | null): number | undefined {
  if (!match) return undefined;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Максимальні вати з тексту: «PD30W+QC3.0» це блок на 30 Вт, а не на 3. */
function maxWatts(text: string): number | undefined {
  const all = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*W\b/gi)]
    .map((m) => Number(m[1].replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
  return all.length ? Math.max(...all) : undefined;
}

function parseAmps(text: string): number | undefined {
  return num(text.match(/(\d+(?:[.,]\d+)?)\s*A\b/i));
}

function parseLength(text: string): number | undefined {
  return num(text.match(/\((\d+(?:[.,]\d+)?)\s*m\)/i));
}

function parseProtocols(text: string): Protocol[] {
  const out: Protocol[] = [];
  // `\bPD\b` не працює: у «PD30W» після PD стоїть цифра, тобто межі слова немає.
  if (/\bPD/i.test(text)) out.push("pd");
  if (/\bQC/i.test(text)) out.push("qc3");
  return out;
}

/** «(1USB-A/1C)» → ["usb_a","usb_c"]. Дужка без USB усередині (як «(White)») ігнорується. */
function parsePorts(text: string): Port[] {
  const inner = text.match(/\(([^)]*USB[^)]*)\)/i)?.[1];
  if (!inner) return [];
  const out: Port[] = [];
  if (/USB\s*-?\s*A/i.test(inner)) out.push("usb_a");
  if (/USB\s*-?\s*C/i.test(inner) || /\/\s*\d*\s*C\b/i.test(inner)) out.push("usb_c");
  return out;
}

function parseCablePart(text: string): CableSpec | null {
  const pair = parseConnectorPair(text);
  if (!pair) return null;
  return {
    ...pair,
    watts: maxWatts(text),
    amps: parseAmps(text),
    length_m: parseLength(text),
  };
}

/**
 * Розбирає назву товару в характеристики. Категорії поза живленням дають `null`
 * одразу: «Чохол ... USB» не має ставати кабелем через випадкове слово в назві.
 */
export function parseNameToSpecs(name: string, type: string): PowerSpec | null {
  if (type !== "cable" && type !== "charger" && type !== "powerbank") return null;

  if (type === "cable") {
    const cable = parseCablePart(name);
    return cable ? { cable } : null;
  }

  /* Комплект: усе до «+ кабель» описує блок, усе після — вкладений кабель.
     Ділимо текст, щоб вати блока не потрапили в кабель і навпаки. */
  const kit = name.match(/\+\s*кабель/i);
  const headPart = kit && kit.index !== undefined ? name.slice(0, kit.index) : name;
  const cablePart = kit && kit.index !== undefined ? name.slice(kit.index) : null;

  const spec: PowerSpec = {};

  if (type === "charger") {
    spec.charger = {
      watts: maxWatts(headPart),
      protocols: parseProtocols(headPart),
      ports: parsePorts(headPart),
    };
  } else {
    spec.powerbank = {
      mah: num(headPart.match(/(\d+)\s*mAh/i)),
      watts: maxWatts(headPart),
      wireless: /БЗП|MagSafe|wireless/i.test(headPart),
      ports: parsePorts(headPart),
    };
  }

  if (cablePart) {
    const cable = parseCablePart(cablePart);
    if (cable) spec.cable = cable;
  }

  return spec;
}
```

- [ ] **Step 4: Запустити тести**

Run: `npx vitest run src/lib/__tests__/accessory-specs-parser.test.ts`
Expected: PASS, 36 passed (18 кабелів + 14 блоків + павербанк + 3 межові)

- [ ] **Step 5: Коміт**

```bash
git add src/lib/accessory-specs.ts src/lib/__tests__/accessory-specs-parser.test.ts
git commit -m "feat(аксесуари): розбір характеристик із назви постачальника"
```

---

### Task 3: Рядок характеристик `formatSpec`

**Files:**
- Modify: `src/lib/accessory-specs.ts`
- Modify: `src/lib/__tests__/accessory-specs.test.ts`

**Interfaces:**
- Consumes: типи й підписи з Task 1
- Produces: `formatSpec(specs: PowerSpec | null | undefined): string` — порожній рядок, якщо характеристик немає

- [ ] **Step 1: Написати падаючий тест**

Дописати в `src/lib/__tests__/accessory-specs.test.ts`:

```ts
import { formatSpec } from "../accessory-specs";

describe("formatSpec", () => {
  it("кабель: розʼєми, потужність, довжина", () => {
    expect(formatSpec({ cable: { from: "usb_a", to: "usb_c", amps: 3, length_m: 1 } }))
      .toBe("USB-A→Type-C · 3A · 1м");
  });

  it("кабель у ватах", () => {
    expect(formatSpec({ cable: { from: "usb_c", to: "usb_c", watts: 60, length_m: 1.2 } }))
      .toBe("Type-C→Type-C · 60Вт · 1.2м");
  });

  it("блок: потужність, протоколи, порти", () => {
    expect(formatSpec({ charger: { watts: 30, protocols: ["pd", "qc3"], ports: ["usb_a", "usb_c"] } }))
      .toBe("PD30W+QC3.0 · USB-A, USB-C");
  });

  it("комплект: блок плюс вкладений кабель", () => {
    expect(formatSpec({
      charger: { watts: 20, protocols: ["pd"], ports: ["usb_c"] },
      cable: { from: "usb_c", to: "usb_c" },
    })).toBe("PD20W · USB-C · + Type-C→Type-C");
  });

  it("блок без вказаних портів не малює порожній хвіст", () => {
    expect(formatSpec({ charger: { watts: 18, protocols: ["qc3"], ports: [] } }))
      .toBe("QC3.0 18W");
  });

  it("павербанк", () => {
    expect(formatSpec({ powerbank: { mah: 5000, watts: 20, wireless: true, ports: [] } }))
      .toBe("5000 mAh · 20Вт · БЗП");
  });

  it("без характеристик — порожній рядок", () => {
    expect(formatSpec(null)).toBe("");
  });
});
```

- [ ] **Step 2: Запустити тест і переконатись, що він падає**

Run: `npx vitest run src/lib/__tests__/accessory-specs.test.ts`
Expected: FAIL — `formatSpec is not a function`

- [ ] **Step 3: Написати реалізацію**

Дописати в `src/lib/accessory-specs.ts`:

```ts
/* ── Читабельний рядок ───────────────────────────────────────────────────────
 *
 * Стоїть під назвою в таблиці складу, на картці POS і на вітрині. Назву не
 * замінює: назва від постачальника і характеристики можуть розійтись, і саме
 * сусідство робить розбіжність помітною оком.
 */

function cablePiece(c: CableSpec): string {
  const parts = [`${CONNECTOR_LABELS[c.from]}→${CONNECTOR_LABELS[c.to]}`];
  if (c.watts !== undefined) parts.push(`${c.watts}Вт`);
  if (c.amps !== undefined) parts.push(`${c.amps}A`);
  if (c.length_m !== undefined) parts.push(`${c.length_m}м`);
  return parts.join(" · ");
}

/** «PD30W+QC3.0», «QC3.0 18W», «PD20W» — так, як пишуть на коробці. */
function powerLabel(watts: number | undefined, protocols: Protocol[]): string {
  if (protocols.length === 0) return watts !== undefined ? `${watts}Вт` : "";
  if (protocols.includes("pd")) {
    const head = watts !== undefined ? `PD${watts}W` : "PD";
    return protocols.includes("qc3") ? `${head}+QC3.0` : head;
  }
  return watts !== undefined ? `QC3.0 ${watts}W` : "QC3.0";
}

export function formatSpec(specs: PowerSpec | null | undefined): string {
  if (!specs) return "";
  const parts: string[] = [];

  if (specs.charger) {
    const power = powerLabel(specs.charger.watts, specs.charger.protocols);
    if (power) parts.push(power);
    if (specs.charger.ports.length) {
      parts.push(specs.charger.ports.map((p) => PORT_LABELS[p]).join(", "));
    }
  }

  if (specs.powerbank) {
    if (specs.powerbank.mah !== undefined) parts.push(`${specs.powerbank.mah} mAh`);
    /* Протоколи павербанка не зберігаються — на одну позицію в каталозі це
       зайве поле. Тому просто вати, без «PD»: вигадувати протокол із наявності
       БЗП було б твердженням, якого дані не містять. */
    if (specs.powerbank.watts !== undefined) parts.push(`${specs.powerbank.watts}Вт`);
    if (specs.powerbank.wireless) parts.push("БЗП");
    if (specs.powerbank.ports.length) {
      parts.push(specs.powerbank.ports.map((p) => PORT_LABELS[p]).join(", "));
    }
  }

  if (specs.cable) {
    /* Кабель у комплекті йде з «+», окремий кабель — без нього: інакше
       «блок + кабель» і «кабель» виглядали б однаково. */
    const isKit = Boolean(specs.charger || specs.powerbank);
    parts.push(isKit ? `+ ${cablePiece(specs.cable)}` : cablePiece(specs.cable));
  }

  return parts.join(" · ");
}
```

- [ ] **Step 4: Запустити тести**

Run: `npx vitest run src/lib/__tests__/accessory-specs.test.ts`
Expected: PASS, 14 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/accessory-specs.ts src/lib/__tests__/accessory-specs.test.ts
git commit -m "feat(аксесуари): рядок характеристик під назвою товару"
```

---

### Task 4: Фасети — підрахунок і збіг

**Files:**
- Modify: `src/lib/accessory-specs.ts`
- Create: `src/lib/__tests__/accessory-facets.test.ts`

**Interfaces:**
- Consumes: типи з Task 1
- Produces:
  - `type FacetKey = "connector" | "watts" | "kit" | "wireless"`
  - `interface Facet { key: FacetKey; value: string; label: string; units: number }`
  - `interface FacetGroup { key: FacetKey; label: string; facets: Facet[] }`
  - `type ActiveFacets = Partial<Record<FacetKey, string>>`
  - `interface FacetItem { type: string; stock: number; specs: PowerSpec | null }`
  - `buildFacets(items: FacetItem[], type: string): FacetGroup[]`
  - `matchesFacets(item: FacetItem, active: ActiveFacets): boolean`
  - `kitCableUnits(items: FacetItem[], connectorValue: string): number`
  - константа `NO_SPECS = "__none__"`, `BARE_CHARGER = "__bare__"`

- [ ] **Step 1: Написати падаючий тест**

Створити `src/lib/__tests__/accessory-facets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildFacets,
  matchesFacets,
  kitCableUnits,
  NO_SPECS,
  BARE_CHARGER,
  type FacetItem,
} from "../accessory-specs";

function cable(stock: number, from: any, to: any): FacetItem {
  return { type: "cable", stock, specs: { cable: { from, to } } };
}

function charger(stock: number, watts: number, kitTo?: any): FacetItem {
  return {
    type: "charger",
    stock,
    specs: {
      charger: { watts, protocols: ["pd"], ports: ["usb_c"] },
      ...(kitTo ? { cable: { from: "usb_c", to: kitTo } } : {}),
    },
  };
}

describe("buildFacets — кабелі", () => {
  const items: FacetItem[] = [
    cable(4, "usb_c", "usb_c"),
    cable(2, "usb_c", "usb_c"),
    cable(3, "usb_a", "micro_usb"),
    { type: "cable", stock: 9, specs: null },
  ];

  it("бейдж рахує суму штук, а не кількість позицій", () => {
    const group = buildFacets(items, "cable")[0];
    const typeC = group.facets.find((f) => f.value === "usb_c>usb_c");
    expect(typeC?.units).toBe(6);
    expect(typeC?.label).toBe("Type-C→Type-C");
  });

  it("пари з нульовим залишком лишаються в списку — це сигнал до закупівлі", () => {
    const group = buildFacets([cable(0, "usb_a", "usb_c")], "cable")[0];
    expect(group.facets.map((f) => f.value)).toContain("usb_a>usb_c");
    expect(group.facets[0].units).toBe(0);
  });

  it("товари без характеристик отримують окремий чипс", () => {
    const group = buildFacets(items, "cable")[0];
    const none = group.facets.find((f) => f.value === NO_SPECS);
    expect(none?.units).toBe(9);
    expect(none?.label).toBe("Без характеристик");
  });

  it("комплекти не потрапляють у фасети кабелів", () => {
    const group = buildFacets([...items, charger(5, 30, "usb_c")], "cable")[0];
    const typeC = group.facets.find((f) => f.value === "usb_c>usb_c");
    expect(typeC?.units).toBe(6);
  });
});

describe("buildFacets — блоки", () => {
  const items = [charger(3, 18), charger(4, 30), charger(2, 30, "usb_c")];

  it("перший ряд — потужність", () => {
    const groups = buildFacets(items, "charger");
    expect(groups[0].key).toBe("watts");
    expect(groups[0].facets.find((f) => f.value === "30")?.units).toBe(6);
  });

  it("другий ряд — комплектність", () => {
    const groups = buildFacets(items, "charger");
    expect(groups[1].key).toBe("kit");
    expect(groups[1].facets.find((f) => f.value === BARE_CHARGER)?.units).toBe(7);
    expect(groups[1].facets.find((f) => f.value === "usb_c>usb_c")?.units).toBe(2);
  });
});

describe("matchesFacets", () => {
  it("ряди комбінуються через AND", () => {
    const item = charger(2, 30, "usb_c");
    expect(matchesFacets(item, { watts: "30", kit: "usb_c>usb_c" })).toBe(true);
    expect(matchesFacets(item, { watts: "20", kit: "usb_c>usb_c" })).toBe(false);
    expect(matchesFacets(item, { watts: "30", kit: BARE_CHARGER })).toBe(false);
  });

  it("порожній набір фасетів пропускає все", () => {
    expect(matchesFacets(charger(1, 18), {})).toBe(true);
  });

  it("чипс «Без характеристик» відбирає саме порожні", () => {
    const bare: FacetItem = { type: "cable", stock: 1, specs: null };
    expect(matchesFacets(bare, { connector: NO_SPECS })).toBe(true);
    expect(matchesFacets(cable(1, "usb_c", "usb_c"), { connector: NO_SPECS })).toBe(false);
  });
});

describe("kitCableUnits", () => {
  it("рахує кабелі, які лежать усередині комплектів", () => {
    const items = [cable(0, "usb_c", "usb_c"), charger(3, 30, "usb_c"), charger(1, 20, "lightning")];
    expect(kitCableUnits(items, "usb_c>usb_c")).toBe(3);
    expect(kitCableUnits(items, "usb_c>lightning")).toBe(1);
  });
});
```

- [ ] **Step 2: Запустити тест і переконатись, що він падає**

Run: `npx vitest run src/lib/__tests__/accessory-facets.test.ts`
Expected: FAIL — `buildFacets is not a function`

- [ ] **Step 3: Написати реалізацію**

Дописати в `src/lib/accessory-specs.ts`:

```ts
/* ── Фасети ──────────────────────────────────────────────────────────────────
 *
 * Чисті функції над масивом товарів: React тут не потрібен, а без нього те
 * саме працює і на складі, і в касі, і в тестах.
 *
 * Бейдж — сума ШТУК, а не кількість позицій: питання звучало «скільки
 * залишилось», і «12 позицій» замість «41 шт» ввело б в оману саме там, де
 * цифра й потрібна.
 */

export const NO_SPECS = "__none__";
export const BARE_CHARGER = "__bare__";

export type FacetKey = "connector" | "watts" | "kit" | "wireless";

export interface Facet {
  key: FacetKey;
  value: string;
  label: string;
  units: number;
}

export interface FacetGroup {
  key: FacetKey;
  label: string;
  facets: Facet[];
}

export type ActiveFacets = Partial<Record<FacetKey, string>>;

export interface FacetItem {
  type: string;
  stock: number;
  specs: PowerSpec | null;
}

function pairValue(c: CableSpec): string {
  return `${c.from}>${c.to}`;
}

function pairLabel(value: string): string {
  const [from, to] = value.split(">") as [Connector, Connector];
  return `${CONNECTOR_LABELS[from]}→${CONNECTOR_LABELS[to]}`;
}

/** Накопичує штуки по значенню фасета, зберігаючи порядок першої появи. */
function tally(): {
  add: (value: string, units: number) => void;
  entries: () => [string, number][];
} {
  const map = new Map<string, number>();
  return {
    add: (value, units) => map.set(value, (map.get(value) ?? 0) + units),
    entries: () => [...map.entries()],
  };
}

function facetValueOf(item: FacetItem, key: FacetKey): string | null {
  const s = item.specs;
  if (!s) return NO_SPECS;

  switch (key) {
    case "connector":
      /* Свідомо тільки власний кабель товару. Комплект — це блок; якби його
         вкладений кабель рахувався тут, «7 шт Type-C→Type-C» перестало б
         означати «7 кабелів на полиці». */
      return item.type === "cable" && s.cable ? pairValue(s.cable) : null;
    case "watts": {
      const w = s.charger?.watts ?? s.powerbank?.watts;
      return w === undefined ? null : String(w);
    }
    case "kit":
      if (!s.charger && !s.powerbank) return null;
      return s.cable ? pairValue(s.cable) : BARE_CHARGER;
    case "wireless":
      return s.powerbank ? (s.powerbank.wireless ? "yes" : "no") : null;
  }
}

function labelFor(key: FacetKey, value: string): string {
  if (value === NO_SPECS) return "Без характеристик";
  if (value === BARE_CHARGER) return "Тільки блок";
  switch (key) {
    case "connector":
      return pairLabel(value);
    case "watts":
      return `${value}W`;
    case "kit":
      return `+ ${pairLabel(value)}`;
    case "wireless":
      return value === "yes" ? "З БЗП" : "Без БЗП";
  }
}

const GROUPS_BY_TYPE: Record<string, { key: FacetKey; label: string }[]> = {
  cable: [{ key: "connector", label: "Розʼєм" }],
  charger: [
    { key: "watts", label: "Потужність" },
    { key: "kit", label: "Комплект" },
  ],
  powerbank: [
    { key: "watts", label: "Потужність" },
    { key: "wireless", label: "БЗП" },
  ],
};

export function buildFacets(items: FacetItem[], type: string): FacetGroup[] {
  const groups = GROUPS_BY_TYPE[type];
  if (!groups) return [];

  const scoped = items.filter((i) => i.type === type);

  return groups.map(({ key, label }, index) => {
    const counter = tally();
    for (const item of scoped) {
      const value = facetValueOf(item, key);
      if (value === null) continue;
      /* «Без характеристик» показуємо один раз — у першому ряду. Інакше той
         самий товар давав би однаковий чипс у кожному ряду. */
      if (value === NO_SPECS && index !== 0) continue;
      counter.add(value, item.stock);
    }
    return {
      key,
      label,
      facets: counter
        .entries()
        .map(([value, units]) => ({ key, value, label: labelFor(key, value), units }))
        .sort((a, b) => {
          if (a.value === NO_SPECS) return 1;
          if (b.value === NO_SPECS) return -1;
          return b.units - a.units || a.label.localeCompare(b.label);
        }),
    };
  });
}

export function matchesFacets(item: FacetItem, active: ActiveFacets): boolean {
  for (const [key, value] of Object.entries(active) as [FacetKey, string][]) {
    if (!value) continue;
    if (facetValueOf(item, key) !== value) return false;
  }
  return true;
}

/**
 * Скільки кабелів такої пари лежить усередині комплектів. Показується сірим
 * підписом під фасетом кабелів, коли той дає нуль: інакше при нулі на полиці
 * замовляється зайва партія, хоча чотири штуки вже лежать у коробках з блоками.
 */
export function kitCableUnits(items: FacetItem[], connectorValue: string): number {
  return items
    .filter((i) => i.type !== "cable" && i.specs?.cable && pairValue(i.specs.cable) === connectorValue)
    .reduce((sum, i) => sum + i.stock, 0);
}
```

- [ ] **Step 4: Запустити тести**

Run: `npx vitest run src/lib/__tests__/accessory-facets.test.ts`
Expected: PASS, 10 passed

- [ ] **Step 5: Коміт**

```bash
git add src/lib/accessory-specs.ts src/lib/__tests__/accessory-facets.test.ts
git commit -m "feat(аксесуари): фасети характеристик із підрахунком залишків"
```

---

### Task 5: Міграція `specs jsonb`

**Files:**
- Create: `supabase/migrations/<версія-з-прода>_accessory_power_specs.sql`
- Modify: `src/types/database.ts` (три місця: `Row`, `Insert`, `Update` таблиці `accessories`)

**Interfaces:**
- Consumes: нічого
- Produces: колонка `accessories.specs jsonb`, поле `specs: Json | null` у типах

- [ ] **Step 1: Застосувати міграцію через MCP**

Викликати `mcp__supabase__apply_migration`:

```
name: accessory_power_specs
query: alter table public.accessories add column if not exists specs jsonb;
```

- [ ] **Step 2: Прочитати версію, яку записав прод**

Викликати `mcp__supabase__list_migrations` і взяти найсвіжішу версію.

`apply_migration` ігнорує імʼя файлу і ставить власний штамп. Пропущений крок
призводить до того, що файл у репо описує міграцію, якої в проді немає — саме
так у серпні розійшлись 35 файлів (див. `docs/MIGRATIONS.md`).

- [ ] **Step 3: Створити локальний файл під цією ж версією**

```bash
printf 'alter table public.accessories add column if not exists specs jsonb;\n' \
  > supabase/migrations/<версія-з-кроку-2>_accessory_power_specs.sql
```

- [ ] **Step 4: Дописати колонку в типи вручну**

У `src/types/database.ts` у блоці `accessories` додати рядок у всі три секції —
`Row`, `Insert`, `Update` — поруч із `source`:

```ts
          specs: Json | null
```

в `Row`, і

```ts
          specs?: Json | null
```

в `Insert` та `Update`. Файл **не** регенерувати: регенерація ламає
`@ts-expect-error` на RPC-викликах по всьому проєкту (`AGENTS.md`).

- [ ] **Step 5: Перевірити типи й закомітити**

Run: `npx tsc --noEmit`
Expected: без помилок

```bash
git add supabase/migrations src/types/database.ts
git commit -m "feat(аксесуари): колонка specs для характеристик живлення"
```

---

### Task 6: Запис характеристик у серверних діях

**Files:**
- Modify: `src/lib/accessory-specs.ts`
- Modify: `src/lib/actions/accessories.ts:22-39` (схема), `:101-117` (insert), `:161-210` (update)
- Modify: `src/lib/__tests__/accessory-specs.test.ts`

**Interfaces:**
- Consumes: `powerSpecSchema`, `parsePowerSpec`
- Produces: `specsFromFormData(formData: FormData): PowerSpec | null`

Розбір назви тут **не** запускається: він живе на клієнті (форма й прев'ю
імпорту), щоб користувач бачив і правив результат до запису. Сервер лише
валідує те, що прийшло.

- [ ] **Step 1: Написати падаючий тест**

Дописати в `src/lib/__tests__/accessory-specs.test.ts`:

```ts
import { specsFromFormData } from "../accessory-specs";

function fd(pairs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(pairs)) f.append(k, v);
  return f;
}

describe("specsFromFormData", () => {
  it("збирає кабель", () => {
    expect(specsFromFormData(fd({
      type: "cable", cable_from: "usb_a", cable_to: "usb_c", cable_amps: "3", cable_length_m: "1",
    }))).toEqual({ cable: { from: "usb_a", to: "usb_c", amps: 3, length_m: 1 } });
  });

  it("порожнє числове поле дає undefined, а не 0", () => {
    const res = specsFromFormData(fd({
      type: "cable", cable_from: "usb_c", cable_to: "usb_c", cable_watts: "", cable_amps: "",
    }));
    expect(res).toEqual({ cable: { from: "usb_c", to: "usb_c" } });
  });

  it("збирає блок із комплектним кабелем", () => {
    expect(specsFromFormData(fd({
      type: "charger", charger_watts: "20", charger_protocols: "pd",
      charger_ports: "usb_c", has_kit_cable: "true", cable_from: "usb_c", cable_to: "usb_c",
    }))).toEqual({
      charger: { watts: 20, protocols: ["pd"], ports: ["usb_c"] },
      cable: { from: "usb_c", to: "usb_c" },
    });
  });

  it("без тумблера комплекту кабель не пишеться, навіть якщо поля лишились у DOM", () => {
    const res = specsFromFormData(fd({
      type: "charger", charger_watts: "30", charger_protocols: "pd",
      cable_from: "usb_c", cable_to: "usb_c",
    }));
    expect(res?.cable).toBeUndefined();
  });

  it("категорія поза живленням дає null", () => {
    expect(specsFromFormData(fd({ type: "case", cable_from: "usb_a", cable_to: "usb_c" }))).toBeNull();
  });

  it("кабель без розʼємів кидає помилку, а не пише напівтовар", () => {
    expect(() => specsFromFormData(fd({ type: "cable", cable_watts: "60" }))).toThrow();
  });
});
```

- [ ] **Step 2: Запустити тест і переконатись, що він падає**

Run: `npx vitest run src/lib/__tests__/accessory-specs.test.ts`
Expected: FAIL — `specsFromFormData is not a function`

- [ ] **Step 3: Реалізувати збирач**

Дописати в `src/lib/accessory-specs.ts`:

```ts
/* ── Збирання з форми ────────────────────────────────────────────────────────
 *
 * Порожнє поле мусить стати `undefined`, а не `0`: «0 Вт» це стверджувальна
 * брехня, а порожньо — чесне «на коробці не вказано».
 */

function numField(formData: FormData, name: string): number | undefined {
  const raw = (formData.get(name) as string | null)?.trim();
  if (!raw) return undefined;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function specsFromFormData(formData: FormData): PowerSpec | null {
  const type = formData.get("type");
  if (type !== "cable" && type !== "charger" && type !== "powerbank") return null;

  const raw: Record<string, unknown> = {};

  /* Кабель пишеться або як самостійний товар, або як вміст комплекту — і в
     другому випадку лише за увімкненим тумблером. Поля можуть лишитись у DOM
     після вимкнення, і без цієї перевірки згорнутий комплект усе одно
     зберігав би кабель. */
  const wantsCable = type === "cable" || formData.get("has_kit_cable") === "true";
  if (wantsCable) {
    raw.cable = {
      from: formData.get("cable_from") || undefined,
      to: formData.get("cable_to") || undefined,
      watts: numField(formData, "cable_watts"),
      amps: numField(formData, "cable_amps"),
      length_m: numField(formData, "cable_length_m"),
    };
  }

  if (type === "charger") {
    raw.charger = {
      watts: numField(formData, "charger_watts"),
      protocols: formData.getAll("charger_protocols") as string[],
      ports: formData.getAll("charger_ports") as string[],
    };
  }

  if (type === "powerbank") {
    raw.powerbank = {
      mah: numField(formData, "powerbank_mah"),
      watts: numField(formData, "powerbank_watts"),
      wireless: formData.get("powerbank_wireless") === "true",
      ports: formData.getAll("powerbank_ports") as string[],
    };
  }

  return parsePowerSpec(raw);
}
```

- [ ] **Step 4: Підключити до серверних дій**

У `src/lib/actions/accessories.ts` додати імпорт після рядка 12:

```ts
import { specsFromFormData, powerSpecSchema } from "@/lib/accessory-specs";
```

У `accessorySchema` (рядок 22) додати поле:

```ts
  specs: z.union([powerSpecSchema, z.null()]).optional().default(null),
```

У `createAccessory` в обʼєкт `data` (рядок 43) додати:

```ts
      specs: specsFromFormData(formData),
```

і в `.insert({...})` (рядок 101) додати перед `status`:

```ts
      // `PowerSpec` — інтерфейс без індексної сигнатури, тож у `Json` він не
      // ллється напряму. Приведення тут, а не послаблення типу `Json` у
      // `database.ts`, який ми навмисно не чіпаємо.
      specs: parsed.specs as unknown as Json,
```

Додати `Json` до імпорту типів на рядку 9:

```ts
import type { Database, Json } from "@/types/database";
```

У `updateAccessory` в обʼєкт `data` (рядок 161) додати той самий рядок
`specs: specsFromFormData(formData),`. Деструктуризація на рядку 208 лишається
без змін — `specs` має їхати в `update`, на відміну від `stock` і
`payment_method`.

- [ ] **Step 5: Запустити тести й типи**

Run: `npx vitest run src/lib/__tests__/ && npx tsc --noEmit`
Expected: PASS, без помилок типів

- [ ] **Step 6: Коміт**

```bash
git add src/lib/accessory-specs.ts src/lib/actions/accessories.ts src/lib/__tests__/accessory-specs.test.ts
git commit -m "feat(аксесуари): запис характеристик при створенні й редагуванні"
```

---

### Task 7: Поля характеристик у формі товару

**Files:**
- Create: `src/components/forms/AccessorySpecFields.tsx`
- Modify: `src/components/forms/AccessoryForm.tsx:28` (тип пропса), `:64-78` (селект категорії + назва), і вставка секції після рядка 115

**Interfaces:**
- Consumes: `parseNameToSpecs`, `CONNECTOR_LABELS`, `PORT_LABELS`, `PROTOCOL_LABELS`, типи
- Produces: компонент `<AccessorySpecFields type name specs />`

Правило підстановки: при **створенні** парсер заповнює всі розібрані поля, при
**редагуванні** — тільки порожні. Друге захищає ручні правки: якщо потужність
виправлено з `100W` на `60W`, бо назва від постачальника бреше, подальша правка
назви не повинна тихо повернути 100.

- [ ] **Step 1: Створити компонент**

Створити `src/components/forms/AccessorySpecFields.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import {
  parseNameToSpecs,
  CONNECTOR_LABELS,
  PORT_LABELS,
  PROTOCOL_LABELS,
  type Connector,
  type Port,
  type Protocol,
  type PowerSpec,
} from "@/lib/accessory-specs";

const selectClass =
  "w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40";

function ConnectorSelect({ label, name, value, onChange }: {
  label: string;
  name: string;
  value: Connector | "";
  onChange: (v: Connector) => void;
}) {
  return (
    <div className="w-full">
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</label>
      <select
        name={name}
        required
        value={value}
        onChange={(e) => onChange(e.target.value as Connector)}
        className={selectClass}
      >
        <option value="" disabled>Оберіть…</option>
        {(Object.keys(CONNECTOR_LABELS) as Connector[]).map((c) => (
          <option key={c} value={c}>{CONNECTOR_LABELS[c]}</option>
        ))}
      </select>
    </div>
  );
}

function CheckboxRow<T extends string>({ legend, name, labels, values, onToggle }: {
  legend: string;
  name: string;
  labels: Record<T, string>;
  values: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{legend}</span>
      <div className="flex gap-4">
        {(Object.keys(labels) as T[]).map((k) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name={name}
              value={k}
              checked={values.includes(k)}
              onChange={() => onToggle(k)}
              className="h-4 w-4 rounded border-iris/20 text-violet focus:ring-violet"
            />
            <span className="text-sm text-text-primary">{labels[k]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function AccessorySpecFields({ type, name, specs }: {
  /** Поточна категорія із селекта форми. */
  type: string;
  /** Поточна назва товару — з неї підставляються значення. */
  name: string;
  /** Уже збережені характеристики. Присутні лише в режимі редагування. */
  specs?: PowerSpec | null;
}) {
  const isEdit = Boolean(specs);

  const [cableFrom, setCableFrom] = useState<Connector | "">(specs?.cable?.from ?? "");
  const [cableTo, setCableTo] = useState<Connector | "">(specs?.cable?.to ?? "");
  const [cableWatts, setCableWatts] = useState(specs?.cable?.watts?.toString() ?? "");
  const [cableAmps, setCableAmps] = useState(specs?.cable?.amps?.toString() ?? "");
  const [cableLength, setCableLength] = useState(specs?.cable?.length_m?.toString() ?? "");

  const [chargerWatts, setChargerWatts] = useState(specs?.charger?.watts?.toString() ?? "");
  const [protocols, setProtocols] = useState<Protocol[]>(specs?.charger?.protocols ?? []);
  const [ports, setPorts] = useState<Port[]>(specs?.charger?.ports ?? []);
  const [hasKitCable, setHasKitCable] = useState(Boolean(specs?.charger && specs?.cable));

  const [mah, setMah] = useState(specs?.powerbank?.mah?.toString() ?? "");
  const [pbWatts, setPbWatts] = useState(specs?.powerbank?.watts?.toString() ?? "");
  const [wireless, setWireless] = useState(specs?.powerbank?.wireless ?? false);
  const [pbPorts, setPbPorts] = useState<Port[]>(specs?.powerbank?.ports ?? []);

  const [derived, setDerived] = useState(false);
  const lastParsed = useRef("");

  /* Підстановка з назви. У режимі редагування заповнюються ТІЛЬКИ порожні
     поля: інакше правка назви заднім числом затирала б ручні виправлення, і
     побачити це було б неможливо — правив же ти зовсім інше. */
  useEffect(() => {
    const key = `${type}|${name}`;
    if (key === lastParsed.current) return;
    lastParsed.current = key;

    const parsed = parseNameToSpecs(name, type);
    if (!parsed) return;

    const fill = (current: string, next: number | undefined) =>
      next === undefined ? current : !isEdit || !current ? String(next) : current;
    const fillC = (current: Connector | "", next: Connector | undefined) =>
      next === undefined ? current : !isEdit || !current ? next : current;

    if (parsed.cable) {
      setCableFrom((c) => fillC(c, parsed.cable!.from));
      setCableTo((c) => fillC(c, parsed.cable!.to));
      setCableWatts((c) => fill(c, parsed.cable!.watts));
      setCableAmps((c) => fill(c, parsed.cable!.amps));
      setCableLength((c) => fill(c, parsed.cable!.length_m));
      if (type !== "cable") setHasKitCable((v) => (isEdit ? v : true));
    }
    if (parsed.charger) {
      setChargerWatts((c) => fill(c, parsed.charger!.watts));
      setProtocols((p) => (!isEdit || p.length === 0 ? parsed.charger!.protocols : p));
      setPorts((p) => (!isEdit || p.length === 0 ? parsed.charger!.ports : p));
    }
    if (parsed.powerbank) {
      setMah((c) => fill(c, parsed.powerbank!.mah));
      setPbWatts((c) => fill(c, parsed.powerbank!.watts));
      setWireless((w) => (!isEdit ? parsed.powerbank!.wireless : w));
      setPbPorts((p) => (!isEdit || p.length === 0 ? parsed.powerbank!.ports : p));
    }
    setDerived(true);
  }, [name, type, isEdit]);

  if (type !== "cable" && type !== "charger" && type !== "powerbank") return null;

  const cableBlock = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <ConnectorSelect label="Звідки" name="cable_from" value={cableFrom} onChange={setCableFrom} />
        <ConnectorSelect label="Куди" name="cable_to" value={cableTo} onChange={setCableTo} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Вт" name="cable_watts" type="number" step="0.1" placeholder="60"
               value={cableWatts} onChange={(e) => setCableWatts(e.target.value)} />
        <Input label="A" name="cable_amps" type="number" step="0.1" placeholder="2.4"
               value={cableAmps} onChange={(e) => setCableAmps(e.target.value)} />
        <Input label="Довжина, м" name="cable_length_m" type="number" step="0.05" placeholder="1"
               value={cableLength} onChange={(e) => setCableLength(e.target.value)} />
      </div>
      <p className="text-[11px] leading-relaxed text-text-secondary">
        Вати й ампери — як на коробці. Одне з полів може лишитись порожнім; перераховувати не треба.
      </p>
    </div>
  );

  return (
    <div className="border-t border-warm-border/50 pt-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Характеристики</h3>
        {derived && (
          <span className="text-[11px] text-text-secondary">розібрано з назви — перевір</span>
        )}
      </div>

      {type === "cable" && cableBlock}

      {type === "charger" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Потужність, Вт" name="charger_watts" type="number" step="0.5" placeholder="30"
                   value={chargerWatts} onChange={(e) => setChargerWatts(e.target.value)} />
            <CheckboxRow<Protocol>
              legend="Протоколи" name="charger_protocols" labels={PROTOCOL_LABELS}
              values={protocols}
              onToggle={(v) => setProtocols((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
            />
          </div>
          <CheckboxRow<Port>
            legend="Порти" name="charger_ports" labels={PORT_LABELS} values={ports}
            onToggle={(v) => setPorts((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="has_kit_cable" value="true" checked={hasKitCable}
                   onChange={(e) => setHasKitCable(e.target.checked)}
                   className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet" />
            <span className="text-sm font-medium text-text-primary">У комплекті кабель</span>
          </label>
          {hasKitCable && cableBlock}
        </div>
      )}

      {type === "powerbank" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ємність, mAh" name="powerbank_mah" type="number" placeholder="5000"
                   value={mah} onChange={(e) => setMah(e.target.value)} />
            <Input label="Потужність, Вт" name="powerbank_watts" type="number" step="0.5" placeholder="20"
                   value={pbWatts} onChange={(e) => setPbWatts(e.target.value)} />
          </div>
          <CheckboxRow<Port>
            legend="Порти" name="powerbank_ports" labels={PORT_LABELS} values={pbPorts}
            onToggle={(v) => setPbPorts((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="powerbank_wireless" value="true" checked={wireless}
                   onChange={(e) => setWireless(e.target.checked)}
                   className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet" />
            <span className="text-sm font-medium text-text-primary">Бездротова зарядка (БЗП)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="has_kit_cable" value="true" checked={hasKitCable}
                   onChange={(e) => setHasKitCable(e.target.checked)}
                   className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet" />
            <span className="text-sm font-medium text-text-primary">У комплекті кабель</span>
          </label>
          {hasKitCable && cableBlock}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Підключити до форми**

У `src/components/forms/AccessoryForm.tsx`:

Додати імпорти після рядка 13:

```tsx
import { AccessorySpecFields } from "./AccessorySpecFields";
import { parsePowerSpec, type PowerSpec } from "@/lib/accessory-specs";
```

У тип пропса `accessory` (рядок 28) додати `specs?: unknown`.

Замінити селект категорії (рядки 66-75) на керований, додавши перед `return`:

```tsx
  const [type, setType] = useState(accessory?.type ?? "case");
  const [name, setName] = useState(accessory?.name ?? "");
  const existingSpecs: PowerSpec | null = accessory?.specs
    ? (() => { try { return parsePowerSpec(accessory.specs); } catch { return null; } })()
    : null;
```

і в самому селекті додати `value={type} onChange={(e) => setType(e.target.value)}`
замість `defaultValue`, а в полі назви (рядок 78) — `value={name}
onChange={(e) => setName(e.target.value)}` замість `defaultValue`.

Вставити секцію одразу після блоку «Мінімальний залишок» (після рядка 130):

```tsx
      <AccessorySpecFields
        key={type}
        type={type}
        name={name}
        specs={existingSpecs}
      />
```

`key={type}` навмисне: зміна категорії скидає стан секції. Без цього ампери
кабеля лишались би у стані після перемикання на «Зарядний пристрій» і поїхали
б у formData разом із полями блока.

- [ ] **Step 3: Перевірити типи й збірку**

Run: `npx tsc --noEmit && npm run lint`
Expected: без помилок

- [ ] **Step 4: Перевірити вручну**

Run: `npm run dev`
Відкрити `/admin/accessories` → «Додати аксесуар» → категорія «Кабель» → назва
`Кабель Hoco X96 Hyper Type-C to Type-C 60W (1m)`.
Expected: розʼєми `Type-C`/`Type-C`, Вт `60`, довжина `1` заповнились самі,
праворуч підпис «розібрано з назви — перевір».

- [ ] **Step 5: Коміт**

```bash
git add src/components/forms/AccessorySpecFields.tsx src/components/forms/AccessoryForm.tsx
git commit -m "feat(аксесуари): поля характеристик у формі з підстановкою з назви"
```

---

### Task 8: Компонент фасетів

**Files:**
- Create: `src/components/accessories/SpecFacets.tsx`

**Interfaces:**
- Consumes: `buildFacets`, `kitCableUnits`, `NO_SPECS`, типи `FacetGroup`, `ActiveFacets`, `FacetItem`
- Produces: компонент `<SpecFacets items type active onChange showKitHint />`

- [ ] **Step 1: Створити компонент**

Створити `src/components/accessories/SpecFacets.tsx`:

```tsx
"use client";

import {
  buildFacets,
  kitCableUnits,
  NO_SPECS,
  type ActiveFacets,
  type FacetItem,
  type FacetKey,
} from "@/lib/accessory-specs";

export function SpecFacets({ items, type, active, onChange, showKitHint = false }: {
  /** Повний набір товарів категорії — бейджі рахуються по ньому, не по сторінці. */
  items: FacetItem[];
  type: string;
  active: ActiveFacets;
  onChange: (next: ActiveFacets) => void;
  /** Підпис «у комплектах: N» під нульовим фасетом кабелів. Лише на складі. */
  showKitHint?: boolean;
}) {
  const groups = buildFacets(items, type);
  if (groups.length === 0) return null;

  function toggle(key: FacetKey, value: string) {
    onChange(active[key] === value ? { ...active, [key]: undefined } : { ...active, [key]: value });
  }

  return (
    <div className="mt-3 space-y-2">
      {groups.map((group) => (
        <div key={group.key} className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-medium text-text-secondary w-[72px]">
            {group.label}
          </span>
          {/* Один рядок із горизонтальним скролом, без переносу: висота блоку
              лишається передбачуваною, і товар не їде під згин екрана. */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {group.facets.map((f) => {
              const isActive = active[group.key] === f.value;
              const hint =
                showKitHint && group.key === "connector" && f.units === 0 && f.value !== NO_SPECS
                  ? kitCableUnits(items, f.value)
                  : 0;
              return (
                <button
                  key={f.value}
                  onClick={() => toggle(group.key, f.value)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-violet text-white"
                      : "bg-violet/5 text-text-secondary hover:bg-violet/10 hover:text-text-primary"
                  }`}
                >
                  {f.label}
                  <span className={isActive ? "ml-1.5 opacity-80" : "ml-1.5 text-text-muted"}>
                    {f.units} шт
                  </span>
                  {hint > 0 && (
                    <span className="ml-1.5 text-text-muted">· у комплектах: {hint}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Перевірити типи**

Run: `npx tsc --noEmit`
Expected: без помилок

- [ ] **Step 3: Коміт**

```bash
git add src/components/accessories/SpecFacets.tsx
git commit -m "feat(аксесуари): компонент фасетних фільтрів"
```

---

### Task 9: Фасети й рядок характеристик на складі

**Files:**
- Modify: `src/app/admin/accessories/table.tsx:20-38` (тип рядка), `:75-77` (стан), `:103-107` (фільтр), `:202-213` (чипси), `:237` і `:342` (рядок характеристик)
- Modify: `src/app/admin/accessories/page.tsx` (додати `specs` у вибірку, якщо вона перелічує колонки)

**Interfaces:**
- Consumes: `SpecFacets`, `formatSpec`, `matchesFacets`, `parsePowerSpec`
- Produces: нічого для наступних задач

- [ ] **Step 1: Перевірити вибірку на сторінці**

Run: `grep -n "from(\"accessories\")" -A 3 src/app/admin/accessories/page.tsx`
Якщо вибірка `select("*")` — нічого не міняти, `specs` приїде сам. Якщо колонки
перелічені — дописати `specs`.

- [ ] **Step 2: Розширити тип рядка й стан**

У `src/app/admin/accessories/table.tsx` додати імпорти після рядка 18:

```tsx
import { SpecFacets } from "@/components/accessories/SpecFacets";
import { formatSpec, matchesFacets, parsePowerSpec, type ActiveFacets, type PowerSpec } from "@/lib/accessory-specs";
```

У тип `AccessoryRow` (рядок 20) додати:

```tsx
  specs?: unknown;
```

Після рядка 77 (`const [sort, setSort] = ...`) додати:

```tsx
  const [facets, setFacets] = useState<ActiveFacets>({});

  /* Розбираємо один раз на рендер: `parsePowerSpec` кидає на зіпсованих даних,
     а падіння всієї сторінки складу через одну криву колонку — надто дорого. */
  const specsById = new Map<string, PowerSpec | null>(
    accessories.map((a) => {
      try {
        return [a.id, parsePowerSpec(a.specs)] as const;
      } catch {
        return [a.id, null] as const;
      }
    }),
  );

  const facetItems = accessories.map((a) => ({
    type: a.type,
    stock: a.stock,
    specs: specsById.get(a.id) ?? null,
  }));
```

- [ ] **Step 3: Застосувати фасети у фільтрі**

Замінити тіло `accessories.filter` (рядки 103-107) на:

```tsx
  const filtered = accessories.filter((a) => {
    if (filter !== "all" && a.type !== filter) return false;
    const item = { type: a.type, stock: a.stock, specs: specsById.get(a.id) ?? null };
    if (!matchesFacets(item, facets)) return false;
    if (!query) return true;
    return a.name.toLowerCase().includes(query.toLowerCase());
  });
```

У `usePagination` (рядок 130) додати фасети в `resetKey`, щоб зміна фільтра
скидала сторінку:

```tsx
  const pager = usePagination(sorted, {
    resetKey: `${query}|${filter}|${sort.col}|${sort.dir}|${JSON.stringify(facets)}`,
  });
```

- [ ] **Step 4: Вставити ряди чипсів**

Одразу після закриття блоку з кнопками категорій (після рядка 213, перед
`<div className="mt-4">`) додати:

```tsx
      <SpecFacets
        items={facetItems}
        type={filter}
        active={facets}
        onChange={setFacets}
        showKitHint
      />
```

Скидати фасети при зміні категорії — інакше обраний розʼєм кабеля лишався б
активним на блоках і давав порожній список. У `onClick` кнопки категорії
(рядок 206) замінити `onClick={() => setFilter(f)}` на:

```tsx
              onClick={() => { setFilter(f); setFacets({}); }}
```

- [ ] **Step 5: Додати рядок характеристик**

У мобільній картці після заголовка (рядок 237) додати:

```tsx
                      {formatSpec(specsById.get(a.id)) && (
                        <p className="text-[10px] text-text-secondary mt-0.5">
                          {formatSpec(specsById.get(a.id))}
                        </p>
                      )}
```

У десктопній таблиці замінити комірку назви (рядок 342) на:

```tsx
                    <td className="py-3 pr-4 font-medium">
                      {a.name}
                      {formatSpec(specsById.get(a.id)) && (
                        <span className="block text-[11px] font-normal text-text-secondary">
                          {formatSpec(specsById.get(a.id))}
                        </span>
                      )}
                    </td>
```

- [ ] **Step 6: Перевірити**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: без помилок, усі тести проходять

Run: `npm run dev`, відкрити `/admin/accessories`, обрати «Кабель».
Expected: другий ряд чипсів із бейджами; поки характеристики не залиті —
єдиний чипс «Без характеристик · 28 шт».

- [ ] **Step 7: Коміт**

```bash
git add src/app/admin/accessories/table.tsx src/app/admin/accessories/page.tsx
git commit -m "feat(аксесуари): фасети й рядок характеристик на сторінці складу"
```

---

### Task 10: Фасети й рядок характеристик у POS

**Files:**
- Modify: `src/app/admin/sales/pos/pos-types.ts` (тип `Accessory`)
- Modify: `src/app/admin/sales/pos/usePOSCatalog.ts:11-13` (стан), `:40-49` (фільтр)
- Modify: `src/app/admin/sales/pos/POSCatalog.tsx` (пропси + ряди чипсів + рядок на картці)

**Interfaces:**
- Consumes: `SpecFacets`, `formatSpec`, `matchesFacets`, `parsePowerSpec`
- Produces: нічого для наступних задач

- [ ] **Step 1: Розширити тип**

У `src/app/admin/sales/pos/pos-types.ts` в тип `Accessory` додати `specs?: unknown;`.

- [ ] **Step 2: Додати стан і фільтр у хук**

У `src/app/admin/sales/pos/usePOSCatalog.ts` додати імпорт:

```ts
import { matchesFacets, parsePowerSpec, type ActiveFacets, type PowerSpec } from "@/lib/accessory-specs";
```

Після рядка 13 додати:

```ts
  const [activeFacets, setActiveFacets] = useState<ActiveFacets>({});
```

Після `activeAccessories` (рядок 22) додати:

```ts
  const accessorySpecs = useMemo(() => {
    const map = new Map<string, PowerSpec | null>();
    for (const a of activeAccessories) {
      try {
        map.set(a.id, parsePowerSpec((a as { specs?: unknown }).specs));
      } catch {
        map.set(a.id, null);
      }
    }
    return map;
  }, [activeAccessories]);

  /* Фасети рахуються по товарах у наявності: каталог каси й так показує лише
     `stock > 0`, тож чипса «0 шт» тут не буває — на відміну від складу, де
     нуль і є сигналом до закупівлі. */
  const accessoryFacetItems = useMemo(
    () => activeAccessories.map((a) => ({
      type: a.type,
      stock: a.stock,
      specs: accessorySpecs.get(a.id) ?? null,
    })),
    [activeAccessories, accessorySpecs],
  );
```

У гілці `activeCategory === "accessory"` (рядок 41) після фільтра по категорії
додати:

```ts
      filtered = filtered.filter((a) =>
        matchesFacets(
          { type: a.type, stock: a.stock, specs: accessorySpecs.get(a.id) ?? null },
          activeFacets,
        ),
      );
```

У масив залежностей `useMemo` (рядок 55) додати `activeFacets` і `accessorySpecs`.

У `return` хука додати `activeFacets`, `setActiveFacets`, `accessoryFacetItems`,
`accessorySpecs`.

- [ ] **Step 3: Прокинути в каталог**

У `src/app/admin/sales/pos/POSCatalog.tsx` додати імпорти:

```tsx
import { SpecFacets } from "@/components/accessories/SpecFacets";
import { formatSpec, type ActiveFacets, type FacetItem, type PowerSpec } from "@/lib/accessory-specs";
```

В інтерфейс `POSCatalogProps` додати:

```tsx
  activeFacets: ActiveFacets;
  setActiveFacets: (f: ActiveFacets) => void;
  accessoryFacetItems: FacetItem[];
  accessorySpecs: Map<string, PowerSpec | null>;
```

Під рядом чипсів категорій аксесуарів (там, де використовується
`setActiveAccessoryCategory`) додати:

```tsx
        <SpecFacets
          items={accessoryFacetItems}
          type={activeAccessoryCategory}
          active={activeFacets}
          onChange={setActiveFacets}
        />
```

У кнопці зміни категорії аксесуара додати скидання: `setActiveAccessoryCategory(cat); setActiveFacets({});`

На картці товару під назвою додати:

```tsx
                {formatSpec(accessorySpecs.get(item.id)) && (
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    {formatSpec(accessorySpecs.get(item.id))}
                  </p>
                )}
```

Прокинути нові пропси з `POSClient.tsx` — вони приходять із `usePOSCatalog`.

- [ ] **Step 4: Перевірити**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: без помилок

Run: `npm run dev`, відкрити `/admin/sales/pos` → «Аксесуари» → «Кабель».
Expected: ряд чипсів під категоріями, чипси скроляться горизонтально.

**Верстку на телефоні перевіряє користувач** — розширення Chrome у цьому
середовищі не підключається. Явно сказати про це в звіті.

- [ ] **Step 5: Коміт**

```bash
git add src/app/admin/sales/pos/
git commit -m "feat(каса): фасети й рядок характеристик у каталозі аксесуарів"
```

---

### Task 11: Розбір характеристик у CSV-імпорті

**Files:**
- Modify: `src/app/admin/accessories/ImportAccessoriesButton.tsx:8-18` (тип рядка), парсер файлу, таблиця прев'ю
- Modify: `src/lib/actions/accessories.ts:240-250` (схема імпорту), `:277` (insert)

**Interfaces:**
- Consumes: `parseNameToSpecs`, `formatSpec`, `powerSpecSchema`
- Produces: нічого для наступних задач

Імпорт — основний шлях заведення товару. Якби він лишився єдиним місцем без
розбору, ризик «половина каталогу без характеристик» повернувся б цілком.

- [ ] **Step 1: Розбирати назву в прев'ю**

У `src/app/admin/accessories/ImportAccessoriesButton.tsx` додати імпорт:

```tsx
import { parseNameToSpecs, formatSpec, type PowerSpec } from "@/lib/accessory-specs";
```

В `interface ImportRow` додати:

```tsx
  specs: PowerSpec | null;
```

У місці, де рядок формується (після обчислення `name` і `type`, перед
`parsedRows.push`), додати:

```tsx
          const specs = isValid ? parseNameToSpecs(name, type) : null;
```

і передати `specs` в обʼєкт рядка.

- [ ] **Step 2: Показати колонку в таблиці прев'ю**

У таблиці прев'ю додати колонку «Характеристики» з `formatSpec(row.specs)`, а
для порожнього значення — сірий прочерк:

```tsx
                    <td className="py-2 pr-3 text-xs text-text-secondary">
                      {formatSpec(row.specs) || <span className="text-text-muted">—</span>}
                    </td>
```

Не забути додати заголовок колонки в `<thead>` і збільшити `colSpan` у рядку
«нічого не знайдено», якщо він там є.

- [ ] **Step 3: Приймати specs на сервері**

У `src/lib/actions/accessories.ts` у схему масиву в `importAccessories`
(рядок 240) додати:

```ts
      specs: z.union([powerSpecSchema, z.null()]).optional().default(null),
```

Вставка на рядку 277 (`.insert(parsed)`) змін не потребує — поле поїде саме.

- [ ] **Step 4: Перевірити**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: без помилок

Створити тестовий CSV і залити через UI:

```
name;type;price;cost_price;stock;min_stock
Кабель Hoco X96 Hyper Type-C to Type-C 60W (1m);cable;250;150;2;3
```

Expected: у прев'ю колонка «Характеристики» показує `Type-C→Type-C · 60Вт · 1м`.

- [ ] **Step 5: Коміт**

```bash
git add src/app/admin/accessories/ImportAccessoriesButton.tsx src/lib/actions/accessories.ts
git commit -m "feat(аксесуари): розбір характеристик у CSV-імпорті"
```

---

### Task 12: Деплой №1 і заливка 33 позицій

**Files:**
- Create: `scripts/backfill-accessory-specs.mjs`

**Interfaces:**
- Consumes: `parseNameToSpecs`
- Produces: заповнена колонка `specs` для наявних товарів

Порядок навмисний: спершу UI без вітрини, потім дані, потім вичитка. Вітрина
публічна, і неперевірені характеристики не мають на неї потрапити.

- [ ] **Step 1: Прогнати повну перевірку й викотити**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: усе зелене

```bash
git push origin master
npx vercel --prod
```

- [ ] **Step 2: Написати скрипт заливки**

Створити `scripts/backfill-accessory-specs.mjs`:

```js
/**
 * Разова заливка характеристик у наявні товари живлення.
 *
 * Лежить у репо, а не в історії чату: партія приходить регулярно, і той самий
 * прогін знадобиться знову — після великого імпорту, зробленого до появи
 * розбору.
 *
 * Не перезаписує вже заповнені `specs`: ручні виправлення важать більше за
 * розбір назви.
 *
 * Запуск: node scripts/backfill-accessory-specs.mjs [--apply]
 * Без --apply лише друкує, що буде записано.
 */
import { createClient } from "@supabase/supabase-js";
import { parseNameToSpecs } from "../src/lib/accessory-specs.ts";

const apply = process.argv.includes("--apply");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await supabase
  .from("accessories")
  .select("id, name, type, specs")
  .in("type", ["cable", "charger", "powerbank"]);
if (error) throw error;

let filled = 0;
const unparsed = [];

for (const row of data) {
  if (row.specs) continue;
  const specs = parseNameToSpecs(row.name, row.type);
  if (!specs) {
    unparsed.push(row.name);
    continue;
  }
  console.log(`${row.name}\n  → ${JSON.stringify(specs)}`);
  if (apply) {
    const { error: upErr } = await supabase.from("accessories").update({ specs }).eq("id", row.id);
    if (upErr) throw upErr;
  }
  filled += 1;
}

console.log(`\n${apply ? "Записано" : "Буде записано"}: ${filled} із ${data.length}`);
if (unparsed.length) {
  console.log("\nНе розібрано — заповнити руками:");
  for (const n of unparsed) console.log(`  ${n}`);
}
```

- [ ] **Step 3: Прогнати вхолосту**

Run: `node --experimental-strip-types scripts/backfill-accessory-specs.mjs`
Expected: 33 рядки з розібраними характеристиками, «Буде записано: 33 із 33»

Якщо Node не тягне `.ts`-імпорт — прогнати заливку через MCP
`mcp__supabase__execute_sql`, згенерувавши `UPDATE ... SET specs = '<json>'::jsonb
WHERE id = '<uuid>'` із виводу тесту-фікстури Task 2. Результат той самий;
скрипт лишається в репо для наступних партій.

- [ ] **Step 4: Залити**

Run: `node --experimental-strip-types scripts/backfill-accessory-specs.mjs --apply`
Expected: «Записано: 33 із 33»

Звірити в БД:

```sql
select count(*) filter (where specs is null) as без_характеристик
from accessories where type in ('cable','charger','powerbank');
```
Expected: 0

- [ ] **Step 5: Віддати на вичитку**

Повідомити користувачу: характеристики залиті, дивитись на `/admin/accessories`.
Окремо назвати три позиції, де портів у назві не було і поле лишилось порожнім —
`МЗП Hoco CS112A Lounge PD30W+QC3.0 + кабель Type-C to Type-C`,
`МЗП Hoco CS21A Rich QC3.0 18W + кабель USB to MicroUSB`,
`Power Bank Hoco J140A Tony ultra-thin PD20W з БЗП 5000 mAh`.

**Далі не йти без підтвердження користувача.**

- [ ] **Step 6: Коміт**

```bash
git add scripts/backfill-accessory-specs.mjs
git commit -m "chore(аксесуари): скрипт заливки характеристик у наявні товари"
```

---

### Task 13: Рядок характеристик на вітрині і деплой №2

**Files:**
- Modify: `src/app/shop/ShopContent.tsx:104` (картка аксесуара)

**Interfaces:**
- Consumes: `formatSpec`, `parsePowerSpec`
- Produces: нічого

Виконується **тільки після** того, як користувач підтвердив вичитку в Task 12.
Вітрина публічна: до підтвердження на неї не має потрапити жодна неперевірена
характеристика.

- [ ] **Step 1: Додати рядок на картку**

У `src/app/shop/ShopContent.tsx` додати імпорт:

```tsx
import { formatSpec, parsePowerSpec } from "@/lib/accessory-specs";
```

Замінити рядок із заголовком картки (рядок 104) на:

```tsx
                <h3 className="text-sm font-semibold text-text-primary tracking-tight">{a.name}</h3>
                {(() => {
                  /* Розбір у try: зіпсована колонка не має ронити публічну
                     вітрину — там немає кому прочитати помилку. */
                  let line = "";
                  try {
                    line = formatSpec(parsePowerSpec((a as { specs?: unknown }).specs));
                  } catch {
                    line = "";
                  }
                  return line ? (
                    <p className="mt-1 text-xs font-medium text-violet">{line}</p>
                  ) : null;
                })()}
```

Тип `AccItem` у цьому файлі розширити полем `specs?: unknown`.

- [ ] **Step 2: Перевірити**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: без помилок

Run: `npm run dev`, відкрити `/shop`.
Expected: під назвами кабелів і блоків фіолетовий рядок характеристик.

- [ ] **Step 3: Коміт і деплой**

```bash
git add src/app/shop/ShopContent.tsx
git commit -m "feat(вітрина): характеристики під назвою аксесуара"
git push origin master
npx vercel --prod
```

---

## Перевірка плану на повноту

| Вимога спеки | Задача |
|---|---|
| Колонка `specs jsonb`, тип вручну в `database.ts` | 5 |
| Типи, zod-схема, `other` у розʼємах, порти без кількості | 1 |
| Обовʼязкові `from`/`to`, порожні порти дозволені | 1, 6 |
| Парсер назв, часткове розібрання | 2 |
| Підстановка при створенні / тільки порожні при редагуванні | 7 |
| Розбір в CSV-імпорті з колонкою в прев'ю | 11 |
| `formatSpec` у таблиці, POS і на вітрині | 3, 9, 10, 13 |
| Фасети: суми штук, нулі не ховаються, «Без характеристик» | 4, 9 |
| Комплекти не змішуються з кабелями, підпис «у комплектах» | 4, 8 |
| Горизонтальний скрол чипсів | 8 |
| Фасети в POS; чипса «0 шт» там немає через `stock > 0` | 10 |
| Заливка 33 позицій без здогадок по портах | 12 |
| Порядок викату в два деплої | 12, 13 |
| Довжина без фільтра, тільки показ | 3, 4 |
