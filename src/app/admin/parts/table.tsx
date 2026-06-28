"use client";

import { useState, useTransition } from "react";
import { IconSearch, IconEdit, IconDelete, IconWarning } from "@/components/icons";
import { deletePart, bulkUpdatePartsTtn, receivePartFromTransit, payDeferredPartAction } from "@/lib/actions/parts";
import Drawer from "@/components/ui/Drawer";
import { PartForm } from "@/components/forms/PartForm";
import { PartDetailView } from "@/components/PartDetailView";
import { InlineError } from "@/components/ui/InlineError";

import type { Database } from "@/types/database";

type PartRow = Database["public"]["Tables"]["parts"]["Row"] & { supplier_name: string };
type SafeRow = Database["public"]["Tables"]["safes"]["Row"];

const typeLabels: Record<string, string> = { screen: "Екран", battery: "АКБ", charging_port: "Порт", cable: "Шлейф", button: "Кнопка", camera: "Камера", speaker: "Динамік", other: "Інше" };

export function PartsTable({ 
  parts, 
  suppliers,
  usage = [],
  safes = []
}: { 
  parts: PartRow[]; 
  suppliers: { id: string; name: string }[];
  usage?: Parameters<typeof PartDetailView>[0]["usage"];
  safes?: SafeRow[];
}) {
  const [query, setQuery] = useState("");
  const [selectedPart, setSelectedPart] = useState<PartRow | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTtn, setBulkTtn] = useState("");
  const [isPending, startTransition] = useTransition();

  // Receive from transit modal state
  const [receivePart, setReceivePart] = useState<PartRow | null>(null);
  const [receiveQty, setReceiveQty] = useState(1);
  const [isReceiving, setIsReceiving] = useState(false);
  const [selectedSafeId, setSelectedSafeId] = useState<string>("");
  const [receivePaymentStatus, setReceivePaymentStatus] = useState<"paid" | "deferred">("paid");
  const [receiveDueDate, setReceiveDueDate] = useState<string>("");

  // Pay supplier debt state
  const [payingPart, setPayingPart] = useState<PartRow | null>(null);
  const [isPayingDebt, setIsPayingDebt] = useState(false);
  const [paySafeId, setPaySafeId] = useState<string>("");

  async function handleReceive() {
    if (!receivePart) return;
    setIsReceiving(true);
    const res = await receivePartFromTransit(
      receivePart.id,
      receiveQty,
      receivePaymentStatus === "paid" ? (selectedSafeId || null) : null,
      receivePaymentStatus,
      receivePaymentStatus === "deferred" ? receiveDueDate : null
    );
    setIsReceiving(false);
    if (res.success) {
      setReceivePart(null);
    } else {
      setError(res.error ?? "Помилка прийомки");
      setReceivePart(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Видалити цю деталь?")) return;
    const res = await deletePart(id);
    if (!res.success) setError(res.error ?? "");
  }

  const filtered = parts.filter(p => {
    if (filter === "low" && p.stock > p.min_stock) return false;
    if (filter === "transit" && p.status !== "transit") return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.part_number ?? "").toLowerCase().includes(q) || (p.compatible_with ?? "").toLowerCase().includes(q);
  });

  const transitCount = parts.filter(p => p.status === "transit").length;

  async function handleBulkUpdateTtn() {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await bulkUpdatePartsTtn(selectedIds, bulkTtn || null);
      if (res.success) {
        setSelectedIds([]);
        setBulkTtn("");
      } else {
        setError(res.error || "Помилка оновлення ТТН");
      }
    });
  }

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />
      
      {/* BULK ACTIONS PANEL */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-violet/5 border border-violet/20 p-4 animate-entry mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet text-white text-xxs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold text-text-primary">деталей обрано для групових дій</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={bulkTtn}
              onChange={(e) => setBulkTtn(e.target.value)}
              placeholder="Введіть ТТН Нової Пошти..."
              className="rounded-xl border border-warm-border bg-white px-3.5 py-2 text-xs text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40 min-w-[200px]"
            />
            <button
              onClick={handleBulkUpdateTtn}
              disabled={isPending}
              className="rounded-xl bg-violet hover:bg-violet-hover text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isPending ? "Застосування..." : "Застосувати ТТН"}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-warm-border bg-white hover:bg-warm-hover text-text-secondary px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук деталі..." className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${filter === "all" ? "bg-violet text-white" : "bg-violet/5 text-text-secondary hover:bg-violet/10"}`}>Усі</button>
          {transitCount > 0 && (
            <button onClick={() => setFilter("transit")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${filter === "transit" ? "bg-amber text-white" : "bg-amber/10 text-amber hover:bg-amber/20"}`}>
              🚚 В дорозі <span className="rounded-full bg-white/30 px-1.5 text-[10px] font-bold">{transitCount}</span>
            </button>
          )}
          <button onClick={() => setFilter("low")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${filter === "low" ? "bg-rose text-white" : "bg-rose/5 text-text-secondary hover:bg-rose/10"}`}>Закінчуються</button>
        </div>
      </div>
      <div className="mt-4">
        {/* Мобільні картки запчастин */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</p>
          ) : (
            filtered.map((p) => {
              const isLow = p.stock <= p.min_stock;
              const isSelected = selectedIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => { setSelectedPart(p); setIsEditingProfile(false); }}
                  className={`rounded-2xl border border-warm-border p-4 bg-white shadow-sm flex flex-col gap-2.5 transition-colors ${
                    isSelected ? "border-violet bg-violet/[0.02]" : "hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, p.id]);
                          } else {
                            setSelectedIds(selectedIds.filter(id => id !== p.id));
                          }
                        }}
                        className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer mt-1"
                      />
                      <div>
                        <h4 className="font-bold text-sm text-text-primary">{p.name}</h4>
                        <p className="text-[10px] text-text-secondary font-mono mt-0.5">{p.part_number || "Без парт-номера"}</p>
                        {p.payment_status === "deferred" && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose/10 px-2 py-0.5 text-[9px] font-semibold text-rose">
                              💸 Борг: {p.debt_amount.toLocaleString()} ₴
                            </span>
                            {p.payment_due_date && (
                              <span className="text-[10px] text-text-secondary bg-slate-100 px-1.5 py-0.5 rounded">
                                До {new Date(p.payment_due_date).toLocaleDateString('uk-UA')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] bg-iris/5 px-2 py-0.5 rounded font-medium text-text-secondary">
                      {typeLabels[p.type] || p.type}
                    </span>
                  </div>

                  <div className="text-xs text-text-secondary flex justify-between border-t border-slate-100/60 pt-2.5">
                    <span>Сумісність:</span>
                    <span className="text-text-primary font-medium">{p.compatible_with || "—"}</span>
                  </div>

                  <div className="text-xs text-text-secondary flex justify-between">
                    <span>Постачальник / ТТН:</span>
                    <span className="text-text-primary font-medium flex items-center gap-1.5">
                      {p.supplier_name}
                      {p.np_ttn && (
                        <a href={`https://novaposhta.ua/tracking/#${p.np_ttn}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-violet hover:underline font-mono">
                          (ТТН) ↗
                        </a>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100/60 pt-2.5 text-xs">
                    {p.status === "transit" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber">
                        🚚 В дорозі
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span>На складі:</span>
                        <span className={`font-bold ${isLow ? "text-rose" : "text-cyan"}`}>
                          {p.stock} шт
                        </span>
                        {isLow && <span className="inline-flex items-center text-rose"><IconWarning size={12} /></span>}
                      </div>
                    )}
                    <span className="font-bold text-text-primary">{p.cost_price.toLocaleString()} грн</span>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-100/60 pt-2.5" onClick={(e) => e.stopPropagation()}>
                    {p.status === "transit" && (
                      <button
                        onClick={() => { 
                          setReceivePart(p); 
                          setReceiveQty(1); 
                          setReceivePaymentStatus("paid");
                          setReceiveDueDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                          const opexSafe = safes.find(s => s.type === "opex" || s.name.toLowerCase().includes("opex"));
                          setSelectedSafeId(opexSafe ? opexSafe.id : (safes[0]?.id || ""));
                        }}
                        className="flex h-8 items-center gap-1.5 px-3 rounded-xl bg-emerald/10 hover:bg-emerald/20 text-emerald text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <span>✅ Прийняти на склад</span>
                      </button>
                    )}
                    {p.payment_status === "deferred" && (
                      <button
                        onClick={() => {
                          setPayingPart(p);
                          setPaySafeId(safes.find(s => s.type === "opex" || s.name.toLowerCase().includes("opex"))?.id ?? safes[0]?.id ?? "");
                        }}
                        className="flex h-8 items-center gap-1.5 px-3 rounded-xl bg-rose/10 hover:bg-rose/20 text-rose text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <span>💸 Сплатити борг</span>
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedPart(p); setIsEditingProfile(true); }}
                      className="flex h-8 px-2.5 items-center justify-center rounded-xl bg-violet/5 hover:bg-violet/10 text-violet text-xs font-semibold gap-1 transition-colors cursor-pointer"
                    >
                      <IconEdit size={14} />
                      <span>Редагувати</span>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose/5 hover:bg-rose/10 text-rose transition-colors cursor-pointer"
                    >
                      <IconDelete size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Десктопна таблиця */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
                <th className="pb-2 pr-4 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filtered.map(p => p.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer bg-transparent"
                  />
                </th>
                <th className="pb-2 pr-4">Назва</th>
                <th className="pb-2 pr-4">Part №</th>
                <th className="pb-2 pr-4">Тип</th>
                <th className="pb-2 pr-4">Походження</th>
                <th className="pb-2 pr-4">Сумісність</th>
                <th className="pb-2 pr-4">Постачальник</th>
                <th className="pb-2 pr-4">ТТН</th>
                <th className="pb-2 pr-4 text-right">Склад</th>
                <th className="pb-2 pr-4 text-right">Собів.</th>
                <th className="pb-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td></tr>
              ) : (
                filtered.map(p => {
                  const isLow = p.stock <= p.min_stock;
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => { setSelectedPart(p); setIsEditingProfile(false); }}
                      className={`border-b border-iris/5 text-text-primary transition-colors cursor-pointer ${isSelected ? "bg-violet/[0.04]" : "hover:bg-violet/[0.02]"}`}
                    >
                      <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, p.id]);
                            } else {
                              setSelectedIds(selectedIds.filter(id => id !== p.id));
                            }
                          }}
                          className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer bg-transparent"
                        />
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {p.name}
                        {p.payment_status === "deferred" && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose/10 px-2 py-0.5 text-[9px] font-semibold text-rose whitespace-nowrap">
                              💸 Борг: {p.debt_amount.toLocaleString()} ₴
                            </span>
                            {p.payment_due_date && (
                              <span className="text-[10px] text-text-secondary bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                До {new Date(p.payment_due_date).toLocaleDateString('uk-UA')}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-text-secondary font-mono">{p.part_number || "—"}</td>
                      <td className="py-3 pr-4 text-xs text-text-secondary"><span className="rounded bg-iris/5 px-2 py-0.5">{typeLabels[p.type] || p.type}</span></td>
                      <td className="py-3 pr-4 text-xs text-text-secondary">
                        {p.origin_type ? <span className="rounded bg-violet/5 px-2 py-0.5 font-semibold text-violet">{p.origin_type}</span> : "—"}
                      </td>
                      <td className="py-3 pr-4 text-xs text-text-secondary">{p.compatible_with || "—"}</td>
                      <td className="py-3 pr-4 text-xs text-text-secondary">{p.supplier_name}</td>
                      <td className="py-3 pr-4 text-xs text-text-secondary">{p.np_ttn ? <a href={`https://novaposhta.ua/tracking/#${p.np_ttn}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-violet hover:underline font-mono cursor-pointer">{p.np_ttn}</a> : "—"}</td>
                      <td className="py-3 pr-4 text-right">
                        {p.status === "transit" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber/10 px-2.5 py-1 text-[11px] font-semibold text-amber">
                            🚚 В дорозі
                          </span>
                        ) : (
                          <span className={`font-medium ${isLow ? "text-rose" : "text-cyan"}`}>
                            {p.stock} {isLow && <span className="inline-flex items-center ml-1 text-rose"><IconWarning size={12} /></span>}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-text-secondary">{p.cost_price.toLocaleString()} грн</td>
                      <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {p.status === "transit" && (
                            <button
                              onClick={() => { 
                                setReceivePart(p); 
                                setReceiveQty(1); 
                                setReceivePaymentStatus("paid");
                                setReceiveDueDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                                const opexSafe = safes.find(s => s.type === "opex" || s.name.toLowerCase().includes("opex"));
                                setSelectedSafeId(opexSafe ? opexSafe.id : (safes[0]?.id || ""));
                              }}
                              className="btn-press rounded-lg bg-emerald/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald transition-colors hover:bg-emerald/20 cursor-pointer whitespace-nowrap"
                            >
                              ✅ Прийняти
                            </button>
                          )}
                          {p.payment_status === "deferred" && (
                            <button
                              onClick={() => {
                                setPayingPart(p);
                                setPaySafeId(safes.find(s => s.type === "opex" || s.name.toLowerCase().includes("opex"))?.id ?? safes[0]?.id ?? "");
                              }}
                              className="btn-press rounded-lg bg-rose/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose transition-colors hover:bg-rose/20 cursor-pointer whitespace-nowrap"
                            >
                              💸 Сплатити борг
                            </button>
                          )}
                          <button onClick={() => { setSelectedPart(p); setIsEditingProfile(true); }} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet cursor-pointer"><IconEdit /></button>
                          <button onClick={() => handleDelete(p.id)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose cursor-pointer"><IconDelete /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer 
        isOpen={!!selectedPart} 
        onClose={() => { setSelectedPart(null); setIsEditingProfile(false); }} 
        title={isEditingProfile ? "Редагувати деталь" : "Деталі запчастини"} 
        size="half"
      >
        {selectedPart && (
          isEditingProfile ? (
            <PartForm 
              onSuccess={() => { setSelectedPart(null); setIsEditingProfile(false); }} 
              part={selectedPart} 
              suppliers={suppliers} 
            />
          ) : (
            <PartDetailView 
              part={selectedPart} 
              usage={usage.filter(u => u.part_id === selectedPart.id)}
              onEdit={() => setIsEditingProfile(true)} 
              onClose={() => setSelectedPart(null)} 
            />
          )
        )}
      </Drawer>

      {/* Receive from transit modal */}
      {receivePart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-entry">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-text-primary mb-1">✅ Прийняти на склад</h3>
            <p className="text-sm text-text-secondary mb-4 leading-snug">{receivePart.name}</p>
 
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Кількість одиниць що прийняються</label>
                <input
                  type="number"
                  min="1"
                  value={receiveQty}
                  onChange={(e) => setReceiveQty(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl border border-warm-border px-4 py-2.5 text-sm text-text-primary outline-none focus:border-violet/40"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-text-secondary">Спосіб оплати при прийомці</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReceivePaymentStatus("paid")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                      receivePaymentStatus === "paid"
                        ? "border-violet bg-violet/5 text-violet"
                        : "border-warm-border bg-warm-surface text-text-secondary hover:border-slate-300"
                    }`}
                  >
                    <span>💳</span>
                    <span>Оплатити зараз</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceivePaymentStatus("deferred")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                      receivePaymentStatus === "deferred"
                        ? "border-rose bg-rose/5 text-rose"
                        : "border-warm-border bg-warm-surface text-text-secondary hover:border-slate-300"
                    }`}
                  >
                    <span>📅</span>
                    <span>Відкладена оплата</span>
                  </button>
                </div>
              </div>

              {receivePaymentStatus === "paid" && safes.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary font-semibold">Сейф для списання коштів</label>
                  <select
                    value={selectedSafeId}
                    onChange={(e) => setSelectedSafeId(e.target.value)}
                    className="w-full rounded-xl border border-warm-border bg-white px-4 py-2.5 text-sm text-text-primary outline-none focus:border-violet/40 cursor-pointer"
                  >
                    <option value="">Не списувати (без оплати)</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.balance.toLocaleString()} ₴)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {receivePaymentStatus === "deferred" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary font-semibold">Дата оплати постачальнику</label>
                  <input
                    type="date"
                    value={receiveDueDate}
                    onChange={(e) => setReceiveDueDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-warm-border px-4 py-2.5 text-sm text-text-primary outline-none focus:border-violet/40"
                  />
                </div>
              )}
 
              <div className="rounded-xl bg-emerald/5 border border-emerald/20 p-3 text-xs text-text-secondary">
                <p className="font-medium text-text-primary mb-0.5">Сума прийомки</p>
                <p className="text-sm font-bold text-emerald">{(receivePart.cost_price * receiveQty).toLocaleString()} грн</p>
                <p className="mt-1 text-[10px] text-text-secondary">
                  {receivePaymentStatus === "deferred"
                    ? "Буде сформовано заборгованість постачальнику. Кошти з сейфів зараз не списуються."
                    : selectedSafeId 
                      ? "Гроші будуть списані з обраного сейфу автоматично, буде створено фінансову транзакцію." 
                      : "Списання коштів вимкнено. Гроші з сейфів не будуть списані."}
                </p>
              </div>
 
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setReceivePart(null)}
                  className="flex-1 rounded-xl border border-warm-border py-2.5 text-sm text-text-secondary hover:bg-warm-surface transition-colors cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleReceive}
                  disabled={isReceiving}
                  className="flex-1 rounded-xl bg-emerald py-2.5 text-sm font-semibold text-white hover:bg-emerald/90 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isReceiving ? "Приймаю..." : "Прийняти на склад"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay debt modal */}
      {payingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-entry">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-text-primary mb-1">💳 Оплатити борг постачальнику</h3>
            <p className="text-sm text-text-secondary mb-4 leading-snug">{payingPart.name}</p>

            <div className="space-y-4">
              <div className="rounded-xl bg-rose/5 border border-rose/20 p-3 text-xs text-text-secondary">
                <div className="flex justify-between font-medium text-text-primary mb-0.5">
                  <span>Сума до сплати:</span>
                  <span className="text-sm font-bold text-rose">{payingPart.debt_amount?.toLocaleString() || 0} грн</span>
                </div>
                {payingPart.payment_due_date && (
                  <p className="mt-1 text-[10px] text-text-secondary">
                    Термін оплати: <span className="font-semibold">{new Date(payingPart.payment_due_date).toLocaleDateString('uk-UA')}</span>
                  </p>
                )}
              </div>

              {safes.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary font-semibold">Оплатити з сейфу</label>
                  <select
                    value={paySafeId}
                    onChange={(e) => setPaySafeId(e.target.value)}
                    className="w-full rounded-xl border border-warm-border bg-white px-4 py-2.5 text-sm text-text-primary outline-none focus:border-violet/40 cursor-pointer"
                  >
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.balance.toLocaleString()} ₴)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setPayingPart(null)}
                  className="flex-1 rounded-xl border border-warm-border py-2.5 text-sm text-text-secondary hover:bg-warm-surface transition-colors cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  onClick={async () => {
                    if (!paySafeId) return;
                    setIsPayingDebt(true);
                    const res = await payDeferredPartAction(payingPart.id, paySafeId);
                    setIsPayingDebt(false);
                    if (res.success) {
                      setPayingPart(null);
                    } else {
                      setError(res.error ?? "Помилка оплати боргу");
                    }
                  }}
                  disabled={isPayingDebt || !paySafeId}
                  className="flex-1 rounded-xl bg-violet py-2.5 text-sm font-semibold text-white hover:bg-violet-hover disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isPayingDebt ? "Оплата..." : "Сплатити"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
