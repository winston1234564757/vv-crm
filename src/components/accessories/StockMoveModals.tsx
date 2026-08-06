"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, FieldLabel, fieldClass, fieldTone } from "@/components/ui/Input";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import {
  PaymentSourcePicker,
  spendableRegisters,
  type ChosenSource,
} from "@/components/ui/PaymentSourcePicker";
import { purchaseAccessoryStock, writeOffAccessoryStock } from "@/lib/actions/accessories";
import { weightedCost } from "@/lib/inventory-cost";
import { cn } from "@/lib/utils/cn";

/**
 * Дві дії, якими тепер рухається кількість аксесуара.
 *
 * Доти її редагували в картці товару: прямий UPDATE `stock` без грошей і без
 * сліду. Кабель у кількості 0 ставав кабелем у кількості 10, сейф не худнув, у
 * реєстрі не зʼявлялось нічого, а «Вартість бізнесу» росла на товар, якого ніхто
 * не купував.
 *
 * Обидві модалки живуть в одному файлі не з ліні: вони — дві половини одного
 * питання «скільки в нас цього товару і чому», ділять одну позицію, одні
 * підписи й одну поведінку помилок. Рознесені по файлах, вони почали б
 * розходитись у дрібницях, які власник читає як різні смисли.
 */

export interface StockMoveTarget {
  id: string;
  name: string;
  stock: number;
  cost_price: number;
}

export interface SafeOption {
  id: string;
  name: string;
  type: string;
  balance: number;
}

/* ── Закупівля ───────────────────────────────────────────────────────────── */

export function PurchaseStockModal({
  item,
  safes,
  registers = [],
  onClose,
  onDone,
}: {
  item: StockMoveTarget;
  safes: SafeOption[];
  /** Каси як джерело. Компонент лишить із них лише безготівкові. */
  registers?: SafeOption[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState(String(item.cost_price));
  /* Собівартість картки тримається окремим станом, а не рахується при рендері:
     число підставляється середньозваженою, але власник має право його
     перебити — постачальник міг віддати партію дешевше «за старою домовленістю»,
     і машина цього не знає. `touched` розрізняє «ще не чіпав» і «поставив саме
     стільки»; без нього перебите число стиралось би на кожен рух кількості. */
  const [costPrice, setCostPrice] = useState("");
  const [touched, setTouched] = useState(false);
  const [source, setSource] = useState<ChosenSource | null>(defaultSource(safes));
  const [method, setMethod] = useState<"cash" | "cashless">("cash");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const qty = toInt(quantity);
  const cost = toInt(unitCost);
  const total = qty * cost;
  const suggested = weightedCost(item.stock, item.cost_price, qty, cost);
  const effectiveCost = touched ? toInt(costPrice) : suggested;

  async function submit() {
    setError("");
    setPending(true);
    const res = await purchaseAccessoryStock({
      accessoryId: item.id,
      quantity: qty,
      unitCost: cost,
      newCostPrice: effectiveCost,
      sourceType: source?.type ?? "safe",
      sourceId: total > 0 ? source?.id ?? null : null,
      // Каса диктує спосіб сама; для сейфа шлемо вибір користувача.
      paymentMethod: source?.method ?? method,
    });
    setPending(false);
    if (!res.success) {
      setError(res.error ?? "Не вдалося провести закупівлю");
      return;
    }
    onDone?.();
    onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Закупити"
      description={`${item.name} · зараз на складі ${item.stock} шт`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Скасувати
          </Button>
          <Button onClick={submit} isLoading={pending} disabled={qty <= 0}>
            Провести
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Кількість"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            label="Ціна за штуку (грн)"
            type="number"
            min={0}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            hint="Підставлена поточна собівартість"
          />
        </div>

        {/* Сума й нова собівартість стоять ДО вибору сейфа навмисно: спершу
            «скільки це коштує», потім «звідки платимо». Зворотний порядок
            змушував би вибирати сейф, не знаючи суми. */}
        <div className="rounded-[var(--radius-md)] bg-hover px-3 py-2.5 text-sm">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-muted">До списання</span>
            <span className="font-semibold tabular text-ink">
              {total.toLocaleString("uk-UA")} ₴
            </span>
          </p>
          <p className="mt-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="text-muted">Стане на складі</span>
            <span className="tabular text-ink">{item.stock + qty} шт</span>
          </p>
        </div>

        <div>
          <Input
            label="Собівартість картки після приходу (грн)"
            type="number"
            min={0}
            value={touched ? costPrice : String(suggested)}
            onChange={(e) => {
              setTouched(true);
              setCostPrice(e.target.value);
            }}
            hint={
              item.stock > 0 && cost !== item.cost_price
                ? `Середньозважена: ${item.stock} шт по ${item.cost_price.toLocaleString("uk-UA")} плюс ${qty} шт по ${cost.toLocaleString("uk-UA")}`
                : "Можна перебити вручну"
            }
          />
          {touched && (
            <button
              type="button"
              onClick={() => setTouched(false)}
              className="mt-1.5 text-xs text-muted underline underline-offset-2 transition-colors hover:text-ink"
            >
              Повернути середньозважену ({suggested.toLocaleString("uk-UA")} ₴)
            </button>
          )}
        </div>

        {/* Нульова закупівля буває: постачальник дав зразок. Питати про сейф,
            коли платити нічого, означало б вимагати відповідь на питання, якого
            немає. */}
        {total > 0 && (
          <>
            <PaymentSourcePicker
              safes={safes}
              registers={spendableRegisters(registers)}
              value={source}
              onChange={setSource}
            />
            {/* Половини має лише сейф. У каси спосіб оплати — це вона сама. */}
            {source?.type === "safe" && (
              <PaymentMethodPicker value={method} onChange={setMethod} />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Списання ────────────────────────────────────────────────────────────── */

/**
 * Причини списання.
 *
 * `reason` в базі має лише два значення — `write_off` і `adjustment`, — бо саме
 * їх приймає CHECK на `inventory_movements`. Різниця між ними не косметична:
 * «товар був і зник» проти «товару ніколи не було». Що саме сталося, лягає в
 * `note` словами — колонку додано цією ж роботою.
 */
const WRITE_OFF_REASONS = [
  { key: "broken", label: "Брак", reason: "write_off" as const, note: "брак" },
  { key: "lost", label: "Втрата", reason: "write_off" as const, note: "втрата" },
  { key: "gift", label: "Подарунок", reason: "write_off" as const, note: "подарунок клієнту" },
  { key: "miscount", label: "Помилка обліку", reason: "adjustment" as const, note: "виправлення обліку" },
];

export function WriteOffStockModal({
  item,
  onClose,
  onDone,
}: {
  item: StockMoveTarget;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [reasonKey, setReasonKey] = useState(WRITE_OFF_REASONS[0].key);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const qty = toInt(quantity);
  const picked = WRITE_OFF_REASONS.find((r) => r.key === reasonKey) ?? WRITE_OFF_REASONS[0];
  const tooMany = qty > item.stock;

  async function submit() {
    setError("");
    setPending(true);
    const res = await writeOffAccessoryStock({
      accessoryId: item.id,
      quantity: qty,
      reason: picked.reason,
      // Коментар необовʼязковий, але сам рід події записуємо завжди: рядок
      // «−2 шт» без причини — це слід, з якого нічого не дізнаєшся.
      note: note.trim() ? `${picked.note}: ${note.trim()}` : picked.note,
    });
    setPending(false);
    if (!res.success) {
      setError(res.error ?? "Не вдалося списати");
      return;
    }
    onDone?.();
    onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Списати"
      description={`${item.name} · зараз на складі ${item.stock} шт`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Скасувати
          </Button>
          <Button variant="danger" onClick={submit} isLoading={pending} disabled={qty <= 0 || tooMany}>
            Списати
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}

        <Input
          label="Кількість"
          type="number"
          min={1}
          max={item.stock}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          error={tooMany ? `На складі лише ${item.stock} шт` : undefined}
        />

        <div>
          <p className="mb-1.5 block text-xs font-medium text-muted">Причина</p>
          <div role="group" aria-label="Причина" className="grid grid-cols-2 gap-2">
            {WRITE_OFF_REASONS.map((r) => (
              <Button
                key={r.key}
                variant={reasonKey === r.key ? "primary" : "secondary"}
                aria-pressed={reasonKey === r.key}
                onClick={() => setReasonKey(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="writeoff-note">Коментар</FieldLabel>
          <input
            id="writeoff-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Необовʼязково — що саме сталося"
            className={cn(fieldClass, fieldTone(false))}
          />
        </div>

        {/* Списання не рухає гроші, але зменшує вартість складу — і міст це
            побачить. Сказати про це тут дешевше, ніж потім пояснювати, чому
            «Вартість бізнесу» впала без жодної витрати. */}
        <p className="text-[11px] leading-relaxed text-faint">
          Гроші не рухаються. Вартість складу зменшиться на{" "}
          <span className="tabular">
            {(qty * item.cost_price).toLocaleString("uk-UA")} ₴
          </span>{" "}
          — це врахує звірка на сторінці фінансів.
        </p>
      </div>
    </Modal>
  );
}

/* ── Спільне ─────────────────────────────────────────────────────────────── */

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 px-3 py-2 text-xs leading-relaxed text-danger">
      {message}
    </p>
  );
}

/** OPEX як типове джерело — так само, як у `createAccessory` й `importAccessories`. */
function defaultSource(safes: SafeOption[]): ChosenSource | null {
  const s = safes.find((x) => x.type === "opex") ?? safes[0];
  return s ? { type: "safe", id: s.id, method: null, name: s.name } : null;
}

/** Порожнє поле — це нуль, а не NaN: інакше сума мовчки стає «NaN ₴». */
function toInt(v: string): number {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
