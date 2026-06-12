"use client";

import { useActionState, useState } from "react";
import { updateSettingsAction, updateProfileRoleAction } from "@/lib/actions/settings";
import type { ParsedSettings, ProfileRow } from "@/lib/data-settings";
import { InlineError } from "@/components/ui/InlineError";
import type { ActionState } from "@/lib/actions/types";

interface SettingsClientProps {
  initialSettings: ParsedSettings;
  initialProfiles: ProfileRow[];
  currentUserId: string;
}

const roleLabels: Record<string, string> = {
  owner: "Власник",
  manager: "Менеджер",
  sales: "Продавець",
  technician: "Технік",
};

export default function SettingsClient({
  initialSettings,
  initialProfiles,
  currentUserId,
}: SettingsClientProps) {
  const [shopName, setShopName] = useState(initialSettings.shop_name);
  const [profiles, setProfiles] = useState<ProfileRow[]>(initialProfiles);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Tech state
  const [techOpex, setTechOpex] = useState(initialSettings.distribution_tech.opex);
  const [techGrowth, setTechGrowth] = useState(initialSettings.distribution_tech.growth);
  const [techProfit, setTechProfit] = useState(initialSettings.distribution_tech.net_profit);

  // Acc state
  const [accOpex, setAccOpex] = useState(initialSettings.distribution_accessories.opex);
  const [accGrowth, setAccGrowth] = useState(initialSettings.distribution_accessories.growth);
  const [accProfit, setAccProfit] = useState(initialSettings.distribution_accessories.net_profit);

  // Rep state
  const [repOpex, setRepOpex] = useState(initialSettings.distribution_repairs.opex);
  const [repGrowth, setRepGrowth] = useState(initialSettings.distribution_repairs.growth);
  const [repProfit, setRepProfit] = useState(initialSettings.distribution_repairs.net_profit);

  const techTotal = techOpex + techGrowth + techProfit;
  const accTotal = accOpex + accGrowth + accProfit;
  const repTotal = repOpex + repGrowth + repProfit;

  const [settingsState, settingsAction, isPending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      setError("");
      setSuccessMsg("");
      
      const res = await updateSettingsAction(null, formData);
      if (res.success) {
        setSuccessMsg("Налаштування успішно збережено!");
        return { success: true };
      } else {
        setError(res.error || "Помилка збереження налаштувань");
        return { success: false };
      }
    },
    { success: false }
  );

  async function handleRoleChange(profileId: string, role: string) {
    setError("");
    setSuccessMsg("");
    const res = await updateProfileRoleAction(profileId, role);
    if (res.success) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role } : p))
      );
      setSuccessMsg("Роль користувача успішно оновлено!");
    } else {
      setError(res.error || "Не вдалося оновити роль");
    }
  }

  return (
    <div className="space-y-6">
      <InlineError message={error} onClose={() => setError("")} />
      
      {successMsg && (
        <div className="rounded-xl bg-emerald/10 p-4 text-sm text-emerald">
          {successMsg}
        </div>
      )}

      <form action={settingsAction} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Store settings card */}
        <div className="card p-5 space-y-4">
          <h2 className="text-base font-semibold text-text-primary">Параметри магазину</h2>
          
          <div>
            <label htmlFor="shop_name" className="mb-1.5 block text-xs font-medium text-text-secondary">
              Назва магазину / майстерні
            </label>
            <input
              id="shop_name"
              name="shop_name"
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full rounded-xl border border-warm-border bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Валюта системи</label>
            <input
              type="text"
              value="UAH (Гривня)"
              disabled
              className="w-full rounded-xl border border-warm-border bg-warm-bg px-4 py-3 text-sm text-text-muted outline-none cursor-not-allowed"
            />
          </div>
        </div>

        {/* Action card */}
        <div className="card p-5 flex flex-col justify-between">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-text-primary">Зберегти зміни</h2>
            <p className="text-xs text-text-secondary">
              Зміна назви магазину оновлює заголовок у сайдбарі та на публічній сторінці трекінгу ремонтів.
              Зміна розподілів впливає на розподіл нових надходжень між сейфами OPEX, Growth та Чистий прибуток.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isPending || techTotal !== 100 || accTotal !== 100 || repTotal !== 100}
            className="btn-press mt-4 flex w-full items-center justify-center rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
          >
            {isPending ? "Збереження..." : "Зберегти всі налаштування"}
          </button>
        </div>

        {/* Splits card */}
        <div className="card p-5 space-y-5 md:col-span-2">
          <h2 className="text-base font-semibold text-text-primary">Фінансовий спліт (Розподіл часток каси)</h2>
          <p className="text-xs text-text-secondary">
            Налаштуйте, скільки відсотків від доходів кожної каси має йти до сейфів OPEX, Growth та Чистий прибуток.
            Сума кожної каси повинна дорівнювати <b>рівно 100%</b>.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Tech splits */}
            <div className="space-y-3 p-4 rounded-xl bg-warm-bg/50 border border-warm-border/60">
              <h3 className="text-sm font-semibold text-text-primary">Каса техніки</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                    <span>OPEX (Операційні витрати)</span>
                    <span className="font-semibold text-text-primary">{techOpex}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    name="tech_opex"
                    value={techOpex}
                    onChange={(e) => setTechOpex(Number(e.target.value))}
                    className="w-full accent-violet"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                    <span>Growth (Розвиток)</span>
                    <span className="font-semibold text-text-primary">{techGrowth}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    name="tech_growth"
                    value={techGrowth}
                    onChange={(e) => setTechGrowth(Number(e.target.value))}
                    className="w-full accent-violet"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                    <span>Чистий прибуток</span>
                    <span className="font-semibold text-text-primary">{techProfit}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    name="tech_profit"
                    value={techProfit}
                    onChange={(e) => setTechProfit(Number(e.target.value))}
                    className="w-full accent-violet"
                  />
                </div>
                <div className="pt-2 border-t border-warm-border flex justify-between items-center text-xs">
                  <span>Всього:</span>
                  <span className={`font-semibold ${techTotal === 100 ? "text-emerald" : "text-rose"}`}>
                    {techTotal}% {techTotal === 100 ? "✓" : `(потрібно 100%)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Accessory splits */}
            <div className="space-y-3 p-4 rounded-xl bg-warm-bg/50 border border-warm-border/60">
              <h3 className="text-sm font-semibold text-text-primary">Каса аксесуарів</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                    <span>OPEX (Операційні витрати)</span>
                    <span className="font-semibold text-text-primary">{accOpex}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    name="acc_opex"
                    value={accOpex}
                    onChange={(e) => setAccOpex(Number(e.target.value))}
                    className="w-full accent-violet"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                    <span>Growth (Розвиток)</span>
                    <span className="font-semibold text-text-primary">{accGrowth}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    name="acc_growth"
                    value={accGrowth}
                    onChange={(e) => setAccGrowth(Number(e.target.value))}
                    className="w-full accent-violet"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                    <span>Чистий прибуток</span>
                    <span className="font-semibold text-text-primary">{accProfit}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    name="acc_profit"
                    value={accProfit}
                    onChange={(e) => setAccProfit(Number(e.target.value))}
                    className="w-full accent-violet"
                  />
                </div>
                <div className="pt-2 border-t border-warm-border flex justify-between items-center text-xs">
                  <span>Всього:</span>
                  <span className={`font-semibold ${accTotal === 100 ? "text-emerald" : "text-rose"}`}>
                    {accTotal}% {accTotal === 100 ? "✓" : `(потрібно 100%)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Repair splits */}
            <div className="space-y-3 p-4 rounded-xl bg-warm-bg/50 border border-warm-border/60">
              <h3 className="text-sm font-semibold text-text-primary">Каса ремонтів</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                    <span>OPEX (Операційні витрати)</span>
                    <span className="font-semibold text-text-primary">{repOpex}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    name="rep_opex"
                    value={repOpex}
                    onChange={(e) => setRepOpex(Number(e.target.value))}
                    className="w-full accent-violet"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                    <span>Growth (Розвиток)</span>
                    <span className="font-semibold text-text-primary">{repGrowth}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    name="rep_growth"
                    value={repGrowth}
                    onChange={(e) => setRepGrowth(Number(e.target.value))}
                    className="w-full accent-violet"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-secondary flex justify-between">
                    <span>Чистий прибуток</span>
                    <span className="font-semibold text-text-primary">{repProfit}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    name="rep_profit"
                    value={repProfit}
                    onChange={(e) => setRepProfit(Number(e.target.value))}
                    className="w-full accent-violet"
                  />
                </div>
                <div className="pt-2 border-t border-warm-border flex justify-between items-center text-xs">
                  <span>Всього:</span>
                  <span className={`font-semibold ${repTotal === 100 ? "text-emerald" : "text-rose"}`}>
                    {repTotal}% {repTotal === 100 ? "✓" : `(потрібно 100%)`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Profile/Users management card */}
      <div className="card p-5 space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Користувачі системи</h2>
        <p className="text-xs text-text-secondary">
          Керуйте ролями та рівнями доступу співробітників майстерні. Зміни застосовуються миттєво.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
                <th className="pb-2 pr-4">Ім'я / Email</th>
                <th className="pb-2 pr-4">Поточна роль</th>
                <th className="pb-2 text-right">Зміна ролі</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const isSelf = p.id === currentUserId;
                return (
                  <tr key={p.id} className="border-b border-iris/5 text-text-primary">
                    <td className="py-3 pr-4 font-medium">
                      {p.full_name || "Користувач"} {isSelf && <span className="text-xs text-violet font-normal">(Ви)</span>}
                    </td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">
                      {roleLabels[p.role] || p.role}
                    </td>
                    <td className="py-3 text-right">
                      <select
                        value={p.role}
                        disabled={isSelf}
                        onChange={(e) => handleRoleChange(p.id, e.target.value)}
                        className="rounded-lg border border-warm-border bg-transparent px-3 py-1.5 text-xs text-text-primary outline-none focus:border-violet disabled:opacity-50"
                      >
                        <option value="owner">Власник</option>
                        <option value="manager">Менеджер</option>
                        <option value="sales">Продавець</option>
                        <option value="technician">Технік</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
