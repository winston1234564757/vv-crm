"use client";

import { useState, useMemo } from "react";

interface DeviceItem { id: string; type: string; brand: string | null; model: string | null; storage: string | null; price: number; description: string | null; photo_urls: string[] | null; status: string; }
interface AccItem { id: string; type: string; name: string; price: number; description: string | null; photo_urls: string[] | null; status: string; stock: number; }
interface SvcItem { id: string; name: string; price: number; description: string | null; }

export function ShopContent({ devices, accessories, services }: { devices: DeviceItem[]; accessories: AccItem[]; services: SvcItem[] }) {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const brands = useMemo(() => [...new Set(devices.map(d => d.brand).filter(Boolean) as string[])].sort(), [devices]);
  const types = useMemo(() => [...new Set(devices.map(d => d.type).filter(Boolean) as string[])].sort(), [devices]);

  const filteredDevices = useMemo(() => devices.filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (!(d.brand ?? "").toLowerCase().includes(q) && !(d.model ?? "").toLowerCase().includes(q) && !(d.storage ?? "").toLowerCase().includes(q)) return false;
    }
    if (brandFilter && d.brand !== brandFilter) return false;
    if (typeFilter && d.type !== typeFilter) return false;
    if (minPrice && d.price < Number(minPrice)) return false;
    if (maxPrice && d.price > Number(maxPrice)) return false;
    return true;
  }), [devices, search, brandFilter, typeFilter, minPrice, maxPrice]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Filters */}
      {(devices.length > 0 || accessories.length > 0) && (
        <section className="mb-8 rounded-2xl border border-warm-border/60 bg-white p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук..." className="w-full rounded-xl border border-warm-border/60 bg-warm-bg px-4 py-2.5 text-sm outline-none focus:border-violet/40" />
            {brands.length > 0 && (
              <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="w-full rounded-xl border border-warm-border/60 bg-warm-bg px-4 py-2.5 text-sm outline-none focus:border-violet/40">
                <option value="">Всі бренди</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            {types.length > 0 && (
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full rounded-xl border border-warm-border/60 bg-warm-bg px-4 py-2.5 text-sm outline-none focus:border-violet/40">
                <option value="">Всі типи</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Ціна від" className="w-full rounded-xl border border-warm-border/60 bg-warm-bg px-4 py-2.5 text-sm outline-none focus:border-violet/40" />
            <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Ціна до" className="w-full rounded-xl border border-warm-border/60 bg-warm-bg px-4 py-2.5 text-sm outline-none focus:border-violet/40" />
          </div>
        </section>
      )}

      {/* Devices */}
      {filteredDevices.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight text-text-primary">Техніка в наявності</h2>
          <p className="mb-6 text-sm text-text-secondary">Всі пристрої перевірені та мають гарантію</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDevices.map((d) => (
              <div key={d.id} className="group rounded-2xl border border-warm-border/60 bg-white p-5 transition-all hover:shadow-sm">
                {d.photo_urls && d.photo_urls.length > 0 ? (
                  <div className="mb-4 aspect-[4/3] overflow-hidden rounded-xl bg-warm-bg">
                    <img src={d.photo_urls[0]} alt={`${d.brand} ${d.model}`} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="mb-4 flex aspect-[4/3] items-center justify-center rounded-xl bg-violet/5 text-4xl text-violet/20">
                    📱
                  </div>
                )}
                <h3 className="text-sm font-semibold text-text-primary">{d.brand} {d.model}</h3>
                {d.storage && <p className="text-xs text-text-secondary">{d.storage}</p>}
                {d.description && <p className="mt-1.5 text-xs text-text-secondary line-clamp-2">{d.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-bold tracking-tight text-text-primary">{d.price.toLocaleString()} грн</span>
                  <span className="rounded bg-cyan/10 px-2 py-0.5 text-[10px] font-medium text-cyan">В наявності</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Accessories */}
      {accessories.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight text-text-primary">Аксесуари</h2>
          <p className="text-text-secondary mt-1">Ми зв&apos;яжемося з вами найближчим часом для підтвердження</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {accessories.map((a) => (
              <div key={a.id} className="group rounded-2xl border border-warm-border/60 bg-white p-5 transition-all hover:shadow-sm">
                {a.photo_urls && a.photo_urls.length > 0 ? (
                  <div className="mb-4 aspect-square overflow-hidden rounded-xl bg-warm-bg">
                    <img src={a.photo_urls[0]} alt={a.name ?? ""} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="mb-4 flex aspect-square items-center justify-center rounded-xl bg-violet/5 text-4xl text-violet/20">
                    📦
                  </div>
                )}
                <h3 className="text-sm font-semibold text-text-primary">{a.name}</h3>
                {a.description && <p className="mt-1.5 text-xs text-text-secondary line-clamp-2">{a.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-bold tracking-tight text-text-primary">{a.price.toLocaleString()} грн</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${(a.stock ?? 0) > 0 ? "bg-cyan/10 text-cyan" : "bg-rose/10 text-rose"}`}>
                    {(a.stock ?? 0) > 0 ? `${a.stock} шт` : "Немає"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight text-text-primary">Послуги</h2>
          <p className="mb-6 text-sm text-text-secondary">Ремонт, налаштування, діагностика</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.id} className="group rounded-2xl border border-warm-border/60 bg-white p-5 transition-all hover:shadow-sm">
                <h3 className="text-sm font-semibold text-text-primary">{s.name}</h3>
                {s.description && <p className="mt-1.5 text-xs text-text-secondary">{s.description}</p>}
                <div className="mt-3">
                  <span className="text-lg font-bold tracking-tight text-text-primary">{s.price.toLocaleString()} грн</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {filteredDevices.length === 0 && accessories.length === 0 && services.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 text-6xl">🔧</div>
          <h2 className="text-xl font-semibold text-text-primary">Вітрина порожня</h2>
          <p className="mt-2 text-sm text-text-secondary">Товари з&apos;являться тут, як тільки адміністратор додасть їх на вітрину</p>
        </div>
      )}
    </main>
  );
}
