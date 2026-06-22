"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, IconEdit, IconDelete, IconSpinner } from "@/components/icons";
import { deleteCustomer } from "@/lib/actions/customers";
import Drawer from "@/components/ui/Drawer";
import { CustomerForm } from "@/components/forms/CustomerForm";
import { SaleDetailView } from "@/components/SaleDetailView";
import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import AICopilotDrawer from "@/components/ai/AICopilotDrawer";

import type { SaleWithDetails } from "@/lib/data-sales";
import type { getRepairs } from "@/lib/data-repairs";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  vip_status: string | null;
  source: string | null;
  preferred_contact: string | null;
  tags: string[] | null;
  total_visits: number;
  total_spent: number;
  created_at: string;
  discount_percent: number;
  notes: string | null;
  telegram_id: string | null;
  ai_profile?: {
    psychotype: string;
    tips: string[];
    retention_risk: "low" | "medium" | "high";
    summary: string;
  } | null;
};

type RepairRow = Awaited<ReturnType<typeof getRepairs>>[number];

const vipLabels: Record<string, string> = { regular: "Звичайний", silver: "Срібний", gold: "Золотий", platinum: "Платінум" };
const vipColors: Record<string, string> = { regular: "text-text-secondary bg-iris/5", silver: "text-slate-600 bg-slate-100", gold: "text-amber bg-amber/10", platinum: "text-cyan bg-cyan/10" };

const statusLabels: Record<string, string> = {
  received: "Прийнято", diagnostics: "Діагностика", in_progress: "В роботі",
  awaiting_parts: "Чекає деталі", ready: "Готовий", completed: "Виконано", handed_over: "Видано", cancelled: "Скасовано",
};

export function CustomersTable({
  customers,
  sales,
  repairs
}: {
  customers: CustomerRow[];
  sales: SaleWithDetails[];
  repairs: RepairRow[];
}) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<RepairRow | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const [aiProfile, setAiProfile] = useState<{
    psychotype: string;
    tips: string[];
    retention_risk: "low" | "medium" | "high";
    summary: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingMsg, setIsGeneratingMsg] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [msgTemplate, setMsgTemplate] = useState<string>("repair_ready");

  async function handleAnalyze() {
    if (!selectedCustomer) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_customer_profile", entityId: selectedCustomer.id })
      });
      if (!res.ok) throw new Error("Помилка генерації профілю");
      const data = await res.json();
      setAiProfile(data.profile);
      selectedCustomer.ai_profile = data.profile;
      router.refresh();
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      alert("Не вдалося сформувати профіль клієнта: " + errMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleGenerateMessage(templateType: string) {
    if (!selectedCustomer) return;
    setIsGeneratingMsg(true);
    setMsgTemplate(templateType);
    try {
      const res = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_customer_message", entityId: selectedCustomer.id, templateType })
      });
      if (!res.ok) throw new Error("Помилка генерації повідомлення");
      const data = await res.json();
      setGeneratedMessage(data.message);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      alert("Не вдалося згенерувати повідомлення: " + errMessage);
    } finally {
      setIsGeneratingMsg(false);
    }
  }

  function handleCopy() {
    if (!generatedMessage) return;
    navigator.clipboard.writeText(generatedMessage);
    alert("Повідомлення скопійовано!");
  }

  const filtered = customers.filter((c) => {
    if (!q) return true;
    const lq = q.toLowerCase();
    return c.name.toLowerCase().includes(lq) || c.phone.includes(lq);
  });

  const getClientSales = (customerId: string) => sales.filter(s => s.customer_id === customerId);
  const getClientRepairs = (customerId: string) => repairs.filter(r => r.customer_id === customerId);

  async function handleDelete(id: string) {
    if (!confirm("Видалити цього клієнта?")) return;
    await deleteCustomer(id);
    setDeletingId(null);
  }

  return (
    <>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук за ім'ям або телефоном..."
          className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
              <th className="pb-2 pr-4">Ім&apos;я</th>
              <th className="pb-2 pr-4">Телефон</th>
              <th className="pb-2 pr-4 text-left text-xs font-medium text-text-secondary">VIP</th>
              <th className="pb-2 pr-4 text-right">Візитів</th>
              <th className="pb-2 pr-4 text-right">Витрачено</th>
              <th className="pb-2 pr-4 text-right">Дата</th>
              <th className="pb-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomer(c);
                    setIsEditingCustomer(false);
                    setAiProfile(c.ai_profile || null);
                    setGeneratedMessage(null);
                    setIsCopilotOpen(false);
                  }}
                  className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02] cursor-pointer"
                >
                  <td className="py-3 pr-4 font-medium">
                    <div className="flex items-center gap-2">
                       {c.name}
                      {c.discount_percent > 0 && (
                        <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan">-{c.discount_percent}%</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-text-secondary font-mono text-xs">
                    <a
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-violet hover:underline"
                    >
                      {c.phone}
                    </a>
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${(c.vip_status && vipColors[c.vip_status]) || ""}`}>
                      {c.vip_status ? (vipLabels[c.vip_status] || c.vip_status) : "—"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">{c.total_visits}</td>
                  <td className="py-3 pr-4 text-right font-medium">{c.total_spent.toLocaleString()} грн</td>
                  <td className="py-3 pr-4 text-right text-text-secondary text-xs">{c.created_at.split("T")[0]}</td>
                  <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setSelectedCustomer(c);
                          setIsEditingCustomer(true);
                          setAiProfile(c.ai_profile || null);
                          setGeneratedMessage(null);
                          setIsCopilotOpen(false);
                        }}
                        className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet"
                      >
                        <IconEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"
                      >
                        <IconDelete />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail & Edit Drawer */}
      {selectedCustomer && (
        <Drawer
          isOpen={!!selectedCustomer}
          onClose={() => { setSelectedCustomer(null); setIsEditingCustomer(false); setIsCopilotOpen(false); }}
          title={isEditingCustomer ? `Редагувати клієнта: ${selectedCustomer.name}` : `Клієнт: ${selectedCustomer.name}`}
          size="default"
        >
          {isEditingCustomer ? (
            <CustomerForm 
              onSuccess={() => { setSelectedCustomer(null); setIsEditingCustomer(false); }} 
              customer={selectedCustomer} 
            />
          ) : (
            <div className="space-y-6 p-4">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsCopilotOpen(true)}
                  className="btn-press flex items-center gap-1.5 rounded-xl border border-violet/20 bg-violet/[0.03] hover:bg-violet/10 text-violet px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
                >
                  ✨ AI Copilot Чат
                </button>
                <button
                  onClick={() => setIsEditingCustomer(true)}
                  className="btn-press flex items-center gap-1.5 rounded-xl border border-warm-border bg-white hover:bg-warm-hover px-4 py-2.5 text-xs font-semibold text-text-primary transition-colors cursor-pointer"
                >
                  <IconEdit size={14} /> Редагувати профіль
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 rounded-2xl bg-violet/5 border border-violet/10 p-5">
                <div>
                  <p className="text-xs text-text-secondary font-medium">Телефон</p>
                  <p className="mt-1 text-sm font-semibold font-mono">
                    <a
                      href={`tel:${selectedCustomer.phone}`}
                      className="text-violet hover:underline"
                    >
                      {selectedCustomer.phone}
                    </a>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary font-medium">Постійна знижка</p>
                  <p className="mt-1 text-sm font-semibold text-cyan">
                    {selectedCustomer.discount_percent > 0 ? `${selectedCustomer.discount_percent}%` : "Відсутня"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary font-medium">Telegram</p>
                  <p className="mt-1 text-sm text-text-primary">{selectedCustomer.telegram_id || "—"}</p>
                </div>
                {selectedCustomer.email && (
                  <div>
                    <p className="text-xs text-text-secondary font-medium">Email</p>
                    <p className="mt-1 text-sm text-text-primary">{selectedCustomer.email}</p>
                  </div>
                )}
                 {selectedCustomer.notes && (
                  <div className="md:col-span-3 border-t border-warm-border pt-3">
                    <p className="text-xs text-text-secondary font-medium">Примітки</p>
                    <p className="mt-1 text-sm text-text-primary">{selectedCustomer.notes}</p>
                  </div>
                )}
              </div>

              {/* AI Profile Section */}
              <div className="border-t border-iris/10 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                    <span>✨ VV CRM Intelligence</span>
                  </h3>
                  {aiProfile && (
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="text-xs text-violet hover:text-violet-hover font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isAnalyzing ? "Оновлення..." : "Оновити аналіз"}
                    </button>
                  )}
                </div>

                {isAnalyzing ? (
                  <div className="rounded-2xl border border-violet/15 bg-violet/[0.02] p-6 flex flex-col items-center justify-center space-y-3">
                    <div className="animate-spin text-violet"><IconSpinner size={24} /></div>
                    <p className="text-xs text-text-secondary">Аналізуємо історію клієнта та будуємо психотип...</p>
                  </div>
                ) : aiProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Psychotype card */}
                      <div className="rounded-2xl border border-violet/10 bg-white p-4 space-y-2">
                        <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">Психотип клієнта</span>
                        <p className="text-sm font-bold text-violet">{aiProfile.psychotype}</p>
                        <p className="text-xs text-text-secondary leading-relaxed">{aiProfile.summary}</p>
                      </div>

                      {/* Churn risk card */}
                      <div className="rounded-2xl border border-violet/10 bg-white p-4 space-y-2">
                        <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">Ризик відтоку</span>
                        <div>
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                            aiProfile.retention_risk === "low" 
                              ? "bg-emerald-500/10 text-emerald-600" 
                              : aiProfile.retention_risk === "medium"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-rose-500/10 text-rose-600"
                          }`}>
                            {aiProfile.retention_risk === "low" ? "Низький" : aiProfile.retention_risk === "medium" ? "Середній" : "Високий"}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary">Складено на основі періодичності візитів та витрат клієнта.</p>
                      </div>
                    </div>

                    {/* Communication Tips */}
                    <div className="rounded-2xl border border-violet/10 bg-violet/[0.02] p-4 space-y-2.5">
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Поради щодо комунікації:</h4>
                      <ul className="space-y-2">
                        {aiProfile.tips?.map((tip: string, idx: number) => (
                          <li key={idx} className="text-xs text-text-primary flex items-start gap-2">
                            <span className="text-violet mt-0.5">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* SMS / Telegram message generator */}
                    <div className="rounded-2xl border border-warm-border bg-warm-surface p-4 space-y-3">
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">✉️ Розумні повідомлення</h4>
                      <p className="text-[11px] text-text-secondary">Згенеруйте готовий текст повідомлення, адаптований під цей психотип клієнта.</p>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGenerateMessage("repair_ready")}
                          disabled={isGeneratingMsg}
                          className="btn-press flex-1 rounded-xl bg-white border border-warm-border hover:bg-warm-hover text-xs font-semibold py-2 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isGeneratingMsg && msgTemplate === "repair_ready" ? "Генерація..." : "Ремонт готовий"}
                        </button>
                        <button
                          onClick={() => handleGenerateMessage("promo")}
                          disabled={isGeneratingMsg}
                          className="btn-press flex-1 rounded-xl bg-white border border-warm-border hover:bg-warm-hover text-xs font-semibold py-2 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isGeneratingMsg && msgTemplate === "promo" ? "Генерація..." : "Пропозиція послуги"}
                        </button>
                      </div>

                      {generatedMessage && (
                        <div className="space-y-2 pt-2">
                          <div className="relative">
                            <textarea
                              readOnly
                              value={generatedMessage}
                              className="w-full min-h-[90px] rounded-xl border border-warm-border bg-white p-3 text-xs text-text-primary placeholder-iris/40 outline-none resize-none font-sans"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={handleCopy}
                              className="rounded-xl bg-violet hover:bg-violet-hover text-white text-xs font-semibold px-4 py-2 transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              Копіювати текст
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-violet/20 p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <p className="text-xs text-text-secondary max-w-xs">
                      Складіть інтелектуальний профіль клієнта, щоб отримати поради з продажу, оцінку ризику та ШІ-генератор повідомлень.
                    </p>
                    <button
                      onClick={handleAnalyze}
                      className="rounded-xl bg-violet hover:bg-violet-hover text-white text-xs font-semibold px-5 py-2.5 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      Скласти ШІ-профіль
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-text-primary border-b border-iris/10 pb-2">Історія покупок</h3>
                  <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2">
                    {getClientSales(selectedCustomer.id).length === 0 ? (
                      <p className="text-xs text-text-secondary py-4">Ще немає покупок</p>
                    ) : (
                      getClientSales(selectedCustomer.id).map((sale) => (
                        <div 
                          key={sale.id} 
                          onClick={() => setSelectedSale(sale)}
                          className="rounded-xl border border-warm-border/60 bg-white p-3.5 space-y-2 text-xs cursor-pointer hover:border-violet/40 hover:shadow-sm transition-all"
                        >
                          <div className="flex justify-between items-center text-text-secondary">
                            <span className="hover:text-violet transition-colors">{sale.created_at.split("T")[0]} {sale.created_at.split("T")[1]?.substring(0, 5)}</span>
                            <span className="font-semibold text-violet">{sale.total_amount.toLocaleString()} грн</span>
                          </div>
                          <div className="space-y-1">
                            {sale.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-text-primary">
                                <span>{item.name} <span className="text-text-secondary font-normal">x{item.quantity}</span></span>
                                <span>{item.total_price.toLocaleString()} грн</span>
                              </div>
                            ))}
                          </div>
                          {sale.discount > 0 && <div className="text-right text-[10px] text-cyan font-medium">Знижка клієнта: {sale.discount}%</div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-text-primary border-b border-iris/10 pb-2">Історія ремонтів</h3>
                  <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2">
                    {getClientRepairs(selectedCustomer.id).length === 0 ? (
                      <p className="text-xs text-text-secondary py-4">Ще немає ремонтів</p>
                    ) : (
                      getClientRepairs(selectedCustomer.id).map((rep) => (
                        <div 
                          key={rep.id} 
                          onClick={() => setSelectedRepair(rep)}
                          className="rounded-xl border border-warm-border/60 bg-white p-3.5 space-y-1 text-xs cursor-pointer hover:border-violet/40 hover:shadow-sm transition-all"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-text-primary hover:text-violet transition-colors">{rep.device_name}</span>
                            <span className="font-semibold text-text-primary">{rep.price.toLocaleString()} грн</span>
                          </div>
                          <p className="text-text-secondary text-[11px]"><strong className="text-text-primary">Проблема:</strong> {rep.issue}</p>
                          <div className="flex justify-between items-center pt-2 text-[10px] text-text-secondary">
                            <span>Прийнято: {rep.created_at.split("T")[0]}</span>
                            <span className="font-semibold bg-violet/5 px-2 py-0.5 rounded text-violet">{statusLabels[rep.status] || rep.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Drawer>
      )}

      {/* Sale Detail Drawer */}
      <Drawer
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title="Деталі продажу"
        size="half"
      >
        {selectedSale && (
          <SaleDetailView 
            sale={selectedSale} 
            onClose={() => setSelectedSale(null)} 
          />
        )}
      </Drawer>

      {/* Repair Detail/Edit Drawer */}
      <Drawer
        isOpen={!!selectedRepair}
        onClose={() => { setSelectedRepair(null); setIsEditingRepair(false); }}
        title={isEditingRepair ? "Редагувати ремонт" : "Деталі ремонту"}
        size="half"
      >
        {selectedRepair && (
          isEditingRepair ? (
            <EditRepairForm 
              onSuccess={() => { setSelectedRepair(null); setIsEditingRepair(false); router.refresh(); }} 
              repair={selectedRepair} 
            />
          ) : (
            <RepairDetailView 
              repair={{
                ...selectedRepair,
                ai_diagnostic: selectedRepair.ai_diagnostic as {
                  possible_causes: string[];
                  required_parts: string[];
                  estimated_difficulty: "easy" | "medium" | "hard";
                  step_by_step_guide: string[];
                  time_estimate_hours: number;
                } | null
              }}
              onEdit={() => setIsEditingRepair(true)} 
              onClose={() => setSelectedRepair(null)} 
            />
          )
        )}
      </Drawer>

      {/* AI Copilot Drawer */}
      {selectedCustomer && (
        <AICopilotDrawer
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          entityType="customer"
          entityId={selectedCustomer.id}
          entityName={selectedCustomer.name}
        />
      )}
    </>
  );
}

