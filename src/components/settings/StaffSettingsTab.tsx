"use client";

import { useState } from "react";
import type { ProfileRow } from "@/lib/data-settings";

interface StaffSettingsTabProps {
  profiles: ProfileRow[];
  currentUserId: string;
  onRoleChange: (profileId: string, role: string) => Promise<void>;
}

const roleLabels: Record<string, string> = {
  owner: "Власник",
  manager: "Менеджер",
  sales: "Продавець",
  technician: "Технік",
};

export function StaffSettingsTab({
  profiles,
  currentUserId,
  onRoleChange,
}: StaffSettingsTabProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleSelectChange(profileId: string, role: string) {
    setUpdatingId(profileId);
    try {
      await onRoleChange(profileId, role);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="card p-5 space-y-4 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md border border-iris/10 rounded-2xl shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Користувачі системи</h2>
        <p className="text-xs text-text-secondary mt-1">
          Керуйте ролями та рівнями доступу співробітників майстерні. Зміни застосовуються миттєво.
        </p>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iris/10 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <th className="pb-3 pr-4">Ім&apos;я / Email</th>
              <th className="pb-3 pr-4">Поточна роль</th>
              <th className="pb-3 text-right">Зміна ролі</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-iris/5">
            {profiles.map((p) => {
              const isSelf = p.id === currentUserId;
              const isUpdating = updatingId === p.id;

              return (
                <tr key={p.id} className="text-text-primary hover:bg-violet/[0.01] transition-colors">
                  <td className="py-4 pr-4 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{p.full_name || "Користувач"}</span>
                      {isSelf && (
                        <span className="text-[10px] bg-violet/10 text-violet px-2 py-0.5 rounded-full font-normal">
                          Ви
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-xs text-text-secondary">
                    <span className="px-2.5 py-1 rounded-lg bg-warm-surface border border-warm-border/30">
                      {roleLabels[p.role] || p.role}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      {isUpdating && (
                        <span className="text-[10px] text-violet animate-pulse font-medium">
                          Оновлення...
                        </span>
                      )}
                      <select
                        value={p.role}
                        disabled={isSelf || isUpdating}
                        onChange={(e) => handleSelectChange(p.id, e.target.value)}
                        className="rounded-xl border border-warm-border/60 bg-transparent px-3 py-1.5 text-xs text-text-primary outline-none transition-all focus:border-violet disabled:opacity-50 cursor-pointer"
                      >
                        <option value="owner">Власник</option>
                        <option value="manager">Менеджер</option>
                        <option value="sales">Продавець</option>
                        <option value="technician">Технік</option>
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
