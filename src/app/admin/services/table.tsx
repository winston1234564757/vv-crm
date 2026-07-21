"use client";

import { useState } from "react";
import { IconSearch, IconEdit, IconDelete } from "@/components/icons";
import Drawer from "@/components/ui/Drawer";
import { ServiceForm } from "@/components/forms/ServiceForm";
import { ServiceDetailView } from "@/components/ServiceDetailView";
import { deleteService } from "@/lib/actions/services";
import { InlineError } from "@/components/ui/InlineError";
import { useRouter } from "next/navigation";
import type { SaleWithDetails } from "@/lib/data-sales";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  photo_urls: string[] | null;
  is_visible: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  duration_minutes: number | null;
  warranty_days: number | null;
};

const categoryLabels: Record<string, string> = {
  diagnostics: "Діагностика", software: "ПЗ / Прошивка", cleaning: "Чистка", setup: "Налаштування", other: "Інше",
};

export function ServicesTable({ services, sales = [] }: { services: ServiceRow[]; sales?: SaleWithDetails[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = services.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук послуги..."
            className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
          />
        </div>
      </div>

      <div className="mt-4">
        {/* Мобільні картки послуг */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</p>
          ) : (
            filtered.map((s) => {
              const isActive = s.status === "active";
              return (
                <div
                  key={s.id}
                  onClick={() => { setSelectedService(s); setIsEditing(false); }}
                  className="rounded-2xl border border-warm-border p-4 bg-surface shadow-sm flex flex-col gap-2.5 transition-colors hover:border-border-strong cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-text-primary">{s.name}</h4>
                      {s.description && (
                        <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-2">{s.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] bg-iris/5 px-2 py-0.5 rounded font-medium text-text-secondary uppercase">
                      {categoryLabels[s.category] || s.category}
                    </span>
                  </div>

                  <div className="text-xs text-text-secondary flex justify-between border-t border-border pt-2.5">
                    <span>Ціна послуги:</span>
                    <span className="text-text-primary font-bold">{s.price.toLocaleString()} грн</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-text-secondary text-[10px]">Видима:</span>
                        <span className={`font-medium ${s.is_visible ? "text-cyan" : "text-text-secondary"}`}>
                          {s.is_visible ? "Так" : "Ні"}
                        </span>
                      </div>
                      {s.duration_minutes && (
                        <div className="flex items-center gap-1">
                          <span className="text-text-secondary text-[10px]">Тривалість:</span>
                          <span className="text-text-primary font-medium">{s.duration_minutes} хв</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium ${isActive ? "bg-cyan/15 text-cyan" : "bg-iris/10 text-text-secondary"}`}>
                        {isActive ? "Активна" : "Неактивна"}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border pt-2.5" onClick={(e) => e.stopPropagation()}>
                    {deletingId === s.id ? (
                      <div className="flex items-center gap-1.5 animate-entry">
                        <span className="text-xs text-rose mr-1">Видалити?</span>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary bg-iris/5 hover:bg-iris/10 rounded-lg transition-colors cursor-pointer"
                        >
                          Ні
                        </button>
                        <button
                          onClick={async () => {
                            const res = await deleteService(s.id);
                            if (!res.success) {
                              setError(res.error ?? "");
                            } else {
                              setDeletingId(null);
                              router.refresh();
                            }
                          }}
                          className="px-3 py-1.5 text-[11px] font-semibold text-white bg-rose hover:bg-rose/90 rounded-lg transition-colors cursor-pointer"
                        >
                          Так
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { setSelectedService(s); setIsEditing(true); }}
                          className="flex h-8 px-2.5 items-center justify-center rounded-xl bg-violet/5 hover:bg-violet/10 text-violet text-xs font-semibold gap-1 transition-colors cursor-pointer"
                        >
                          <IconEdit size={14} />
                          <span>Редагувати</span>
                        </button>
                        <button
                          onClick={() => setDeletingId(s.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose/5 hover:bg-rose/10 text-rose transition-colors cursor-pointer"
                        >
                          <IconDelete size={14} />
                        </button>
                      </>
                    )}
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
                <th className="pb-2 pr-4">Назва</th>
                <th className="pb-2 pr-4">Категорія</th>
                <th className="pb-2 pr-4">Ціна</th>
                <th className="pb-2 pr-4">Видимість</th>
                <th className="pb-2 pr-4">Статус</th>
                <th className="pb-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr 
                    key={s.id} 
                    onClick={() => { setSelectedService(s); setIsEditing(false); }}
                    className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02] cursor-pointer"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-text-primary">{s.name}</div>
                      {s.description && <div className="text-xs text-text-secondary mt-0.5 line-clamp-1">{s.description}</div>}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded bg-iris/5 px-2 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
                        {categoryLabels[s.category] || s.category}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium">{s.price.toLocaleString()} грн</td>
                    <td className="py-3 pr-4">
                      {s.is_visible ? (
                        <span className="text-xs font-medium text-cyan">Так</span>
                      ) : (
                        <span className="text-xs text-text-secondary">Ні</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium ${s.status === "active" ? "bg-cyan/15 text-cyan" : "bg-iris/10 text-text-secondary"}`}>
                        {s.status === "active" ? "Активна" : "Неактивна"}
                      </span>
                    </td>
                    <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {deletingId === s.id ? (
                          <div className="flex items-center gap-1.5 animate-entry">
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1.5 text-[11px] font-semibold text-text-secondary bg-iris/5 hover:bg-iris/10 rounded-lg transition-colors cursor-pointer"
                            >
                              Ні
                            </button>
                            <button
                              onClick={async () => {
                                const res = await deleteService(s.id);
                                if (!res.success) {
                                  setError(res.error ?? "");
                                } else {
                                  setDeletingId(null);
                                  router.refresh();
                                }
                              }}
                              className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-rose hover:bg-rose/90 rounded-lg transition-colors cursor-pointer"
                            >
                              Видалити
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setSelectedService(s);
                                setIsEditing(true);
                              }}
                              className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet cursor-pointer"
                            >
                              <IconEdit />
                            </button>
                            <button
                              onClick={() => setDeletingId(s.id)}
                              className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose cursor-pointer"
                            >
                              <IconDelete />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer 
        isOpen={!!selectedService} 
        onClose={() => { setSelectedService(null); setIsEditing(false); }} 
        title={isEditing ? "Редагувати послугу" : "Деталі послуги"}
      >
        {selectedService && (
          isEditing ? (
            <ServiceForm 
              onSuccess={() => { setSelectedService(null); setIsEditing(false); router.refresh(); }} 
              service={selectedService} 
            />
          ) : (
            <ServiceDetailView 
              service={selectedService} 
              onEdit={() => setIsEditing(true)} 
              onClose={() => setSelectedService(null)} 
              sales={sales}
            />
          )
        )}
      </Drawer>
    </>
  );
}
