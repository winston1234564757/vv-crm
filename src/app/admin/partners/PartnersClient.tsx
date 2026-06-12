"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { PartnerForm } from "@/components/forms/PartnerForm";
import { IconPlus, IconEdit } from "@/components/icons";

interface PartnerData {
  id: string;
  name: string;
  phone: string;
  promo_code: string;
  discount_percent: number;
  reward_percent: number;
  balance: number;
  status: "active" | "inactive";
  created_at: string;
}

export function PartnersClient({ initialPartners }: { initialPartners: PartnerData[] }) {
  const [partners, setPartners] = useState<PartnerData[]>(initialPartners);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerData | null>(null);

  const openCreateModal = () => {
    setEditingPartner(null);
    setIsModalOpen(true);
  };

  const openEditModal = (partner: PartnerData) => {
    setEditingPartner(partner);
    setIsModalOpen(true);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Next.js revalidatePath will refresh the data automatically
    window.location.reload(); 
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Партнерська Програма</h1>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
        >
          <IconPlus size={16} />
          <span>Створити партнера</span>
        </button>
      </div>

      <div className="rounded-xl border border-warm-border/50 bg-warm-surface overflow-hidden">
        {partners.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">
            Немає жодного партнера. Створіть першого!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-primary">
              <thead className="bg-warm-border/20 text-xs font-medium text-text-secondary uppercase">
                <tr>
                  <th className="px-4 py-3">Магазин / Партнер</th>
                  <th className="px-4 py-3">Телефон</th>
                  <th className="px-4 py-3">Промокод</th>
                  <th className="px-4 py-3">Знижка клієнту</th>
                  <th className="px-4 py-3">Відкат (%)</th>
                  <th className="px-4 py-3">Баланс</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border/50">
                {partners.map(p => (
                  <tr key={p.id} className="hover:bg-warm-border/10 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.phone}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-violet">{p.promo_code}</td>
                    <td className="px-4 py-3 text-cyan">{p.discount_percent}%</td>
                    <td className="px-4 py-3 text-amber">{p.reward_percent}%</td>
                    <td className="px-4 py-3 font-semibold">{Number(p.balance).toLocaleString('uk-UA')} ₴</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === 'active' ? 'bg-emerald/10 text-emerald' : 'bg-rose/10 text-rose'
                      }`}>
                        {p.status === 'active' ? 'Активний' : 'Заблокований'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => openEditModal(p)}
                        className="p-1.5 text-text-secondary hover:text-violet transition-colors rounded-lg hover:bg-violet/10"
                      >
                        <IconEdit size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingPartner ? "Редагувати партнера" : "Новий партнер"}
        size="default"
      >
        <PartnerForm partner={editingPartner || undefined} onSuccess={handleSuccess} />
      </Drawer>
    </div>
  );
}
