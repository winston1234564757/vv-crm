export const dynamic = "force-dynamic";

import SettingsClient from "@/components/SettingsClient";
import { getSettings, getProfiles } from "@/lib/data-settings";
import { requirePageRole } from "@/lib/utils/rbac";
import Link from "next/link";
import { IconEye } from "@/components/icons";

export default async function SettingsPage() {
  // Усі три дії сторінки — розподіл по сейфах, реквізити чеків і зміна ролей
  // персоналу — вже вимагають власника всередині себе. Читання лишалось
  // відкритим, хоча показує відсотки розподілу, цілі й список працівників.
  const { user } = await requirePageRole(["owner"]);
  const currentUserId = user.id;

  const [settings, profiles] = await Promise.all([
    getSettings(),
    getProfiles(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary text-balance">Налаштування системи</h1>
          <p className="text-sm text-text-secondary">Керування параметрами магазину та правами доступу персоналу</p>
        </div>
        <Link
          href="/shop"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-violet/20 px-4 py-2 text-sm font-medium text-violet transition-colors hover:bg-violet/5 sm:self-auto"
        >
          <IconEye /> Переглянути вітрину
        </Link>
      </div>
      <SettingsClient
        initialSettings={settings}
        initialProfiles={profiles}
        currentUserId={currentUserId}
      />
    </div>
  );
}
