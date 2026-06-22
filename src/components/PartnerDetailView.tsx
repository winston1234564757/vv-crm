"use client";

import { useState } from "react";
import { 
  IconEdit, IconFinance, IconBox, IconTruck, IconDelete, IconSpinner
} from "./icons";
import { deletePartner } from "@/lib/actions/partners";
import { InlineError } from "@/components/ui/InlineError";

interface Sale {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  promo_code_used: string | null;
}

type PartnerDetailViewProps = {
  partner: {
    id: string;
    name: string;
    phone: string;
    promo_code: string;
    discount_percent: number;
    reward_percent: number;
    balance: number;
    status: "active" | "inactive";
    created_at: string;
  };
  sales: Sale[];
  onEdit: () => void;
  onClose: () => void;
};

export function PartnerDetailView({ partner, sales, onEdit, onClose }: PartnerDetailViewProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDeletePartner() {
    const confirmed = window.confirm(
      "Ви впевнені, що хочете видалити цього партнера? Цю дію не можна скасувати.\nВсі угоди будуть відв'язані від нього."
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await deletePartner(partner.id);
      if (res.success) {
        onClose();
      } else {
        setDeleteError(res.error || "Не вдалося видалити партнера.");
      }
    } catch (err) {
      console.error("Failed to delete partner:", err);
      setDeleteError("Сталася неочікувана помилка при видаленні.");
    } finally {
      setIsDeleting(false);
    }
  }

  const partnerSales = sales.filter(s => s.promo_code_used === partner.promo_code);
  const totalSalesCount = partnerSales.length;
  const totalSalesVolume = partnerSales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalRewardsEarned = partnerSales.reduce(
    (sum, s) => sum + Math.round((s.total_amount * partner.reward_percent) / 100), 
    0
  );

  return (
    <div className="space-y-6 p-4">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-warm-surface border border-warm-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">#{partner.id.substring(0, 8)}</span>
            <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
              partner.status === 'active' ? 'bg-emerald/10 text-emerald' : 'bg-rose/10 text-rose'
            }`}>
              {partner.status === 'active' ? 'Активний партнер' : 'Блокований'}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-text-primary">{partner.name}</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Промокод партнера: <strong className="text-violet font-mono text-sm">{partner.promo_code}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="btn-press flex items-center gap-1.5 rounded-xl border border-warm-border bg-white hover:bg-warm-hover px-4 py-2.5 text-xs font-semibold text-text-primary transition-colors cursor-pointer"
          >
            <IconEdit size={14} /> Редагувати профіль
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        
        {/* Profile Info */}
        <div className="card p-5 space-y-4 border border-violet/5">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconTruck size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Реквізити</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-text-muted">Телефон зв&apos;язку</p>
              <p className="mt-1 text-sm font-semibold font-mono">
                <a href={`tel:${partner.phone}`} className="text-violet hover:underline">
                  {partner.phone}
                </a>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-warm-border/50 pt-2.5">
              <div>
                <p className="text-text-muted">Знижка клієнтам</p>
                <p className="mt-1 text-sm font-bold text-cyan">{partner.discount_percent}%</p>
              </div>
              <div>
                <p className="text-text-muted">Винагорода (%)</p>
                <p className="mt-1 text-sm font-bold text-amber">{partner.reward_percent}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Financial info */}
        <div className="card p-5 space-y-4 border border-violet/5">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconFinance size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Показники ефективності</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-text-muted font-medium text-[10px]">Поточний баланс</p>
              <p className="mt-1 text-lg font-extrabold text-emerald">{partner.balance.toLocaleString()} ₴</p>
            </div>
            <div>
              <p className="text-text-muted font-medium text-[10px]">Всього виплат/нарахувань</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{totalRewardsEarned.toLocaleString()} ₴</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-warm-border/50 pt-2.5">
            <div>
              <p className="text-text-muted font-medium text-[10px]">Використань промокоду</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{totalSalesCount} разів</p>
            </div>
            <div>
              <p className="text-text-muted font-medium text-[10px]">Генерував продажів на</p>
              <p className="mt-1 text-sm font-semibold text-violet">{totalSalesVolume.toLocaleString()} ₴</p>
            </div>
          </div>
        </div>

        {/* Promo Code Usages History */}
        <div className="card p-5 space-y-4 md:col-span-2 border border-violet/10">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconBox size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Історія використання промокоду</h3>
          </div>
          {partnerSales.length === 0 ? (
            <p className="text-text-muted italic py-4">Цей промокод ще не застосовувався</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-warm-border text-xs font-semibold text-text-secondary">
                    <th className="pb-2">ID Продажу</th>
                    <th className="pb-2">Дата</th>
                    <th className="pb-2">Покупець</th>
                    <th className="pb-2 text-right">Сума чеку</th>
                    <th className="pb-2 text-right">Винагорода ({partner.reward_percent}%)</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerSales.map((s) => {
                    const reward = Math.round((s.total_amount * partner.reward_percent) / 100);
                    return (
                      <tr key={s.id} className="border-b border-warm-border/40 last:border-0 text-text-primary">
                        <td className="py-2.5 font-mono">#{s.id.substring(0, 8)}</td>
                        <td className="py-2.5 text-text-secondary">{new Date(s.created_at).toLocaleDateString("uk-UA")}</td>
                        <td className="py-2.5 font-medium">
                          {s.customer_name} {s.customer_phone && <span className="text-text-secondary font-mono text-[10px]">({s.customer_phone})</span>}
                        </td>
                        <td className="py-2.5 text-right font-mono">{s.total_amount.toLocaleString()} ₴</td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald">+{reward.toLocaleString()} ₴</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {deleteError && (
        <InlineError message={deleteError} onClose={() => setDeleteError("")} />
      )}

      {/* Danger Zone */}
      <div className="card p-5 border border-rose/20 bg-rose/[0.02] flex justify-between items-center">
        <div>
          <p className="font-semibold text-rose text-sm">Небезпечна зона</p>
          <p className="text-[10px] text-text-secondary mt-0.5">Повне видалення партнера. Промокод та всі нарахування будуть анульовані.</p>
        </div>
        <button
          disabled={isDeleting}
          onClick={handleDeletePartner}
          className="btn-press rounded-xl bg-rose hover:bg-rose/90 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
        >
          {isDeleting ? (
            <>
              <IconSpinner size={14} className="animate-spin" />
              Видалення...
            </>
          ) : (
            <>
              <IconDelete size={14} />
              Видалити партнера
            </>
          )}
        </button>
      </div>

    </div>
  );
}
