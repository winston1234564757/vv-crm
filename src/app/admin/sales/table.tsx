"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { IconSearch, IconChevronDown } from "@/components/icons";
import { SaleDetailView } from "@/components/SaleDetailView";
import Drawer from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/utils/cn";
import { parseMinAmount } from "@/lib/sales-list-params";
import type { SalesSort, SalesDir, SalesScope } from "@/lib/sales-list-params";
import type { SaleWithDetails, SalesRow, SoldRepair } from "@/lib/data-sales";
import { labelOf, paymentStatus as domainPaymentStatus } from "@/lib/domain-labels";
import { paymentMethodLabel } from "@/lib/utils/finance";
import Link from "next/link";

/* Оплата ремонту пишеться в касу без поділу на готівку/картку, тож у колонці
   «Метод оплати» для нього стоїть стан розрахунку — єдине, що дані знають. */
function paymentStatusLabel(status: string | null) {
  return labelOf(domainPaymentStatus, status).label;
}

const selectClass =
  "rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent cursor-pointer";

interface SalesTableProps {
  rows: SalesRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  query: string;
  category: string;
  payment: string;
  sort: SalesSort;
  dir: SalesDir;
  scope: SalesScope;
  minAmount: number | null;
}

/**
 * Наступний стан сортування за кліком по «Сумі»: спадання → зростання →
 * назад до дати.
 *
 * Третій крок обов'язковий. Без нього дата — стан, у який уже не повернутись
 * кліком, і щоб побачити свіжі чеки треба чистити URL руками. Найбільший чек
 * першим — теж навмисно: сортування додавали під розіграш, і корисний бік у
 * нього рівно один.
 */
/**
 * Порожній результат при обмеженій вибірці — це найчастіше не «нічого немає», а
 * «шукане не проходить межу»: або старше за відкриття магазину, або дешевше за
 * поріг. Без цієї підказки залишається думати, що чек загубився.
 *
 * Обидві причини разом, а не перша знайдена: коли активні й поріг, і межа дати,
 * прибрати одну ще не означає побачити рядок, і підказка про одну лише
 * відправила б шукати не там.
 */
function EmptyHint({ scope, minAmount }: { scope: SalesScope; minAmount: number | null }) {
  const reasons = [
    minAmount !== null && `лише від ${minAmount} ₴`,
    scope === "since_open" && "лише від відкриття магазину",
  ].filter((r): r is string => !!r);

  if (reasons.length === 0) return null;
  return (
    <span className="mt-1 block text-xs text-faint">
      Показані {reasons.join(" і ")} — послаб фільтри, якщо чек має бути тут
    </span>
  );
}

function nextSort(sort: SalesSort, dir: SalesDir): { sort: SalesSort | null; dir: SalesDir | null } {
  if (sort !== "amount") return { sort: "amount", dir: "desc" };
  if (dir === "desc") return { sort: "amount", dir: "asc" };
  return { sort: null, dir: null };
}

/** Ключ рядка. Id продажу й id ремонту живуть у різних таблицях — префікс розводить їх. */
function rowKey(row: SalesRow) {
  return row.kind === "sale" ? `s-${row.sale.id}` : `r-${row.repair.id}`;
}

function rowDate(row: SalesRow) {
  return row.kind === "sale" ? row.sale.created_at : row.repair.completed_at;
}

export function SalesTable({ rows, total, page, pageSize, pageCount, query, category, payment, sort, dir, scope, minAmount }: SalesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<SoldRepair | null>(null);

  /* Локальні дзеркала пропсів: без них кожне натискання клавіші їхало б у базу
     окремим запитом, а поле перемальовувалось би з сервера посеред набору.
     Поріг тримаємо рядком, а не числом — щоб поле можна було очистити в нуль
     символів, а не в «0», який фільтрує так само, як відсутність порогу.

     Синхронізація зі пропсом — присвоєнням під час рендера, а не в `useEffect`.
     Так React радить «підганяти стан під зміну пропса»: він перерендерює
     одразу, без зайвого проходу з промальовкою, і саме цю різницю ловить
     react-hooks («Avoid calling setState directly within an effect»). Побічний
     бонус: дебаунс нижче бачить уже синхронізовану чернетку, тож не встигає
     запланувати запит на значення, яке щойно приїхало з сервера. */
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftMin, setDraftMin] = useState(minAmount === null ? "" : String(minAmount));
  const [applied, setApplied] = useState({ query, minAmount });
  if (applied.query !== query || applied.minAmount !== minAmount) {
    setApplied({ query, minAmount });
    if (applied.query !== query) setDraftQuery(query);
    if (applied.minAmount !== minAmount) setDraftMin(minAmount === null ? "" : String(minAmount));
  }

  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "" || v === "all") p.delete(k);
        else p.set(k, v);
      }
      // Any change to search/filters/page size returns to the first page.
      if (!("page" in patch)) p.delete("page");
      startTransition(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
    },
    [router, pathname, searchParams],
  );

  // Debounce search so each keystroke does not hit the database.
  useEffect(() => {
    if (draftQuery === query) return;
    const t = setTimeout(() => push({ q: draftQuery || null }), 350);
    return () => clearTimeout(t);
  }, [draftQuery, query, push]);

  /* Той самий дебаунс для порогу. Порівнюємо з уже застосованим значенням, а не
     з попереднім чернетковим: інакше набір «3 → 30 → 300» дав би три запити. */
  useEffect(() => {
    const parsed = parseMinAmount(draftMin || undefined);
    if (parsed === minAmount) return;
    const t = setTimeout(() => push({ min: parsed === null ? null : String(parsed) }), 350);
    return () => clearTimeout(t);
  }, [draftMin, minAmount, push]);

  function summarize(sale: SaleWithDetails) {
    return sale.items.length > 0
      ? sale.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")
      : sale.notes || "Товар / Послуга";
  }

  /* Пристрій і що з ним робили — рівно те, що в товарному продажі дає перелік
     позицій. Опис робіт часто довгий, тож модель попереду: за нею впізнають. */
  function repairSummary(repair: SoldRepair) {
    return repair.issue ? `${repair.device_name} — ${repair.issue}` : repair.device_name;
  }

  const empty = rows.length === 0;
  const byAmount = sort === "amount";

  /* Клік по «Сумі» на десктопі й select на мобільному крутять один і той самий
     стан в URL — це не два механізми, а два входи в один. */
  function toggleAmountSort() {
    const next = nextSort(sort, dir);
    push({ sort: next.sort, dir: next.dir });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><IconSearch size={15} /></span>
          <input
            type="text"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="Пошук за товаром, покупцем..."
            className="w-full rounded-[var(--radius-md)] border border-border bg-surface pl-9 pr-4 py-2 text-base md:text-sm text-ink placeholder-faint outline-none transition-colors focus:border-accent"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Поріг участі в розіграші: показує лише чеки від указаної суми.
              `inputMode=numeric` — щоб на телефоні одразу відкривалась цифрова
              клавіатура, поле заповнюють біля каси. */}
          <label className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-muted focus-within:border-accent transition-colors">
            <span className="whitespace-nowrap text-xs">від</span>
            <input
              type="text"
              inputMode="numeric"
              value={draftMin}
              onChange={(e) => setDraftMin(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="0"
              aria-label="Показувати чеки від суми, ₴"
              className="w-14 bg-transparent text-base md:text-sm tabular text-ink placeholder-faint outline-none"
            />
            <span className="text-xs">₴</span>
          </label>
          <select value={category} onChange={(e) => push({ cat: e.target.value })} className={selectClass}>
            <option value="all">Всі категорії</option>
            <option value="device">Техніка</option>
            <option value="accessory">Аксесуари</option>
            <option value="service">Послуги</option>
            <option value="part">Запчастини</option>
            <option value="repair">Ремонти</option>
          </select>
          {/* Фільтр методу оплати ховає ремонти: у їхніх платежах методу немає.
              Тому підказка, а не мовчазний порожній список. */}
          <select
            value={payment}
            onChange={(e) => push({ pay: e.target.value })}
            className={selectClass}
            title="Ремонти мають лише стан розрахунку, тож фільтр за методом їх не показує"
          >
            <option value="all">Всі оплати</option>
            <option value="cash">Готівка</option>
            <option value="card">Картка</option>
            <option value="transfer">Переказ</option>
          </select>
          {/* Сортування дублюється селектом, бо на мобільному таблиці з
              заголовками немає взагалі — там картки, і клікати по «Сумі» ніде. */}
          <select
            value={byAmount ? `amount_${dir}` : "date"}
            onChange={(e) => {
              const v = e.target.value;
              push(
                v === "date"
                  ? { sort: null, dir: null }
                  : { sort: "amount", dir: v === "amount_asc" ? "asc" : "desc" },
              );
            }}
            className={selectClass}
            aria-label="Сортування"
          >
            <option value="date">Спочатку свіжі</option>
            <option value="amount_desc">Сума: від найбільшої</option>
            <option value="amount_asc">Сума: від найменшої</option>
          </select>
          {/* Межа вибірки. За замовчуванням — від відкриття магазину: до нього
              чеки писались «з рук», і за сумою вони перебивають справжні, тож у
              топі розіграшу їм не місце. Перемикач видимий, а не захований у
              коді — інакше зникнення старих чеків читалось би як втрата даних. */}
          <select
            value={scope}
            onChange={(e) => push({ scope: e.target.value === "ever" ? "ever" : null })}
            className={selectClass}
            aria-label="Період"
            title="До відкриття магазину чеки писались з рук — за замовчуванням вони не показуються"
          >
            <option value="since_open">Від відкриття</option>
            <option value="ever">Увесь час</option>
          </select>
        </div>
      </div>

      <div className={cn("transition-opacity", isPending && "opacity-60")}>
        {/* Мобільний список карток */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {empty ? (
            <p className="py-12 text-center text-sm text-muted">
              Продажів не знайдено
              <EmptyHint scope={scope} minAmount={minAmount} />
            </p>
          ) : (
            rows.map((row) => {
              const isRepair = row.kind === "repair";
              const amount = isRepair ? row.repair.price : row.sale.total_amount;
              return (
                <button
                  key={rowKey(row)}
                  onClick={() =>
                    row.kind === "sale" ? setSelectedSale(row.sale) : setSelectedRepair(row.repair)
                  }
                  className="card card-hover btn-press p-4 flex flex-col gap-2.5 text-left cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="tabular text-xs text-muted">
                        #{(isRepair ? row.repair.id : row.sale.id).substring(0, 8)}
                      </span>
                      <h4 className="font-semibold text-sm text-ink mt-1">
                        {isRepair ? row.repair.customer_name : row.sale.customer_name}
                      </h4>
                    </div>
                    {isRepair ? (
                      <Badge tone="accent">Ремонт</Badge>
                    ) : (
                      <Badge tone="neutral">
                        {paymentMethodLabel(row.sale.payments)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted border-t border-border pt-2.5">
                    <span className="text-ink">
                      {isRepair ? repairSummary(row.repair) : summarize(row.sale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <span className="text-muted tabular">{format(new Date(rowDate(row)), "dd.MM.yyyy HH:mm")}</span>
                    {!isRepair && row.sale.is_warranty ? (
                      <Badge tone="accent">Гарантія</Badge>
                    ) : (
                      <span className="font-semibold text-sm text-success tabular">{amount.toLocaleString()} ₴</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Десктопна таблиця */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted">
                <th className="pb-2 pr-4 font-medium">ID</th>
                <th className="pb-2 pr-4 font-medium">Дата</th>
                <th className="pb-2 pr-4 font-medium">Клієнт</th>
                <th className="pb-2 pr-4 font-medium">Товари</th>
                <th className="pb-2 pr-4 font-medium">Метод оплати</th>
                <th
                  className="pb-2 pr-4 font-medium text-right"
                  aria-sort={byAmount ? (dir === "desc" ? "descending" : "ascending") : "none"}
                >
                  <button
                    type="button"
                    onClick={toggleAmountSort}
                    className={cn(
                      "ml-auto flex items-center gap-1 font-medium transition-colors cursor-pointer hover:text-ink",
                      byAmount ? "text-ink" : "text-muted",
                    )}
                    title="Сортувати за сумою"
                  >
                    Сума
                    <IconChevronDown
                      size={13}
                      className={cn(
                        "transition-transform",
                        byAmount ? "text-accent" : "text-faint",
                        byAmount && dir === "asc" && "rotate-180",
                      )}
                    />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {empty ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted">
                    Продажів не знайдено
                    <EmptyHint scope={scope} minAmount={minAmount} />
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isRepair = row.kind === "repair";
                  const id = isRepair ? row.repair.id : row.sale.id;
                  const summary = isRepair ? repairSummary(row.repair) : summarize(row.sale);
                  return (
                    <tr
                      key={rowKey(row)}
                      onClick={() =>
                        row.kind === "sale" ? setSelectedSale(row.sale) : setSelectedRepair(row.repair)
                      }
                      className="border-b border-border text-ink transition-colors hover:bg-hover cursor-pointer"
                    >
                      <td className="py-3 pr-4 tabular text-xs text-muted">{id.substring(0, 8)}</td>
                      <td className="py-3 pr-4 text-xs text-muted tabular">{format(new Date(rowDate(row)), "dd.MM.yyyy HH:mm")}</td>
                      <td className="py-3 pr-4 font-medium">
                        {isRepair ? row.repair.customer_name : row.sale.customer_name}
                      </td>
                      <td className="py-3 pr-4 max-w-[240px] text-xs" title={summary}>
                        <span className="flex items-center gap-1.5">
                          {isRepair && <Badge tone="accent">Ремонт</Badge>}
                          <span className="truncate">{summary}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted">
                        {isRepair
                          ? paymentStatusLabel(row.repair.payment_status)
                          : paymentMethodLabel(row.sale.payments)}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold tabular">
                        {!isRepair && row.sale.is_warranty
                          ? <Badge tone="accent">Гарантія</Badge>
                          : `${(isRepair ? row.repair.price : row.sale.total_amount).toLocaleString()} ₴`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        start={(page - 1) * pageSize}
        shown={rows.length}
        pageSize={pageSize}
        onPageChange={(next) => push({ page: String(next) })}
        onPageSizeChange={(size) => push({ size: String(size) })}
        itemLabel="операцій"
      />

      <Drawer isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title="Деталі продажу" size="half">
        {selectedSale && <SaleDetailView sale={selectedSale} onClose={() => setSelectedSale(null)} />}
      </Drawer>

      {/* Зведення, а не робоче місце: керувати ремонтом — на сторінці Ремонтів,
          інакше та сама дія жила б у двох розділах і розійшлася б, як розійшлися
          статуси. */}
      <Drawer isOpen={!!selectedRepair} onClose={() => setSelectedRepair(null)} title="Ремонт" size="half">
        {selectedRepair && (
          <div className="space-y-5 p-1">
            <div>
              <p className="tabular text-xs text-muted">#{selectedRepair.id.substring(0, 8)}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{selectedRepair.device_name}</h3>
              <p className="mt-0.5 text-sm text-muted">{selectedRepair.customer_name}</p>
            </div>

            {selectedRepair.issue && (
              <div className="rounded-[var(--radius-md)] border border-border p-3">
                <p className="text-xs font-medium text-muted">Виконані роботи</p>
                <p className="mt-1 text-sm text-ink">{selectedRepair.issue}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted">Сума</p>
                <p className="mt-0.5 font-semibold tabular text-ink">
                  {selectedRepair.price.toLocaleString()} ₴
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Розрахунок</p>
                <p className="mt-0.5">
                  <Badge tone={labelOf(domainPaymentStatus, selectedRepair.payment_status).tone}>
                    {paymentStatusLabel(selectedRepair.payment_status)}
                  </Badge>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Видано</p>
                <p className="mt-0.5 tabular text-ink">
                  {selectedRepair.completed_at
                    ? format(new Date(selectedRepair.completed_at), "dd.MM.yyyy HH:mm")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Гарантія</p>
                <p className="mt-0.5 text-ink">
                  {selectedRepair.warranty_months ? `${selectedRepair.warranty_months} міс.` : "—"}
                </p>
              </div>
            </div>

            <Link
              href={`/admin/repairs?q=${selectedRepair.id}`}
              className="inline-flex items-center rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover"
            >
              Відкрити в Ремонтах
            </Link>
          </div>
        )}
      </Drawer>
    </>
  );
}
