export const dynamic = "force-dynamic";

import SettingsClient from "@/components/SettingsClient";
import { getSettings, getProfiles } from "@/lib/data-settings";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const currentUserId = user.id;

  const [settings, profiles] = await Promise.all([
    getSettings(),
    getProfiles(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Налаштування системи</h1>
          <p className="text-sm text-text-secondary">Керування параметрами магазину та правами доступу персоналу</p>
        </div>
      </div>
      <SettingsClient
        initialSettings={settings}
        initialProfiles={profiles}
        currentUserId={currentUserId}
      />
    </div>
  );
}
