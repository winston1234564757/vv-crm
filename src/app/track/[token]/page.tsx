export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { IconRepair, IconLogo } from "@/components/icons";
import { trackTTN } from "@/lib/services/nova-poshta";
import NovaPoshtaWidget from "@/components/ui/NovaPoshtaWidget";

const statusLabels: Record<string, string> = {
  pending: "Прийнято в ремонт", diagnosing: "Діагностика", waiting_parts: "Очікування запчастин",
  repairing: "Ремонтується", ready: "Готовий до видачі", completed: "Виконано",
  handed_over: "Видано клієнту", cancelled: "Скасовано",
};
const statusColors: Record<string, string> = {
  pending: "text-amber bg-amber/10", diagnosing: "text-blue bg-blue/10", waiting_parts: "text-orange bg-orange/10",
  repairing: "text-violet bg-violet/10", ready: "text-cyan bg-cyan/10", completed: "text-emerald bg-emerald/10",
  handed_over: "text-text-secondary bg-iris/5", cancelled: "text-rose bg-rose/10",
};

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: repair, error } = await supabase
    .from("repairs")
    .select("*, customers(name)")
    .eq("tracking_token", token.toUpperCase())
    .single();

  if (error || !repair) notFound();

  const npStatus = repair.np_ttn ? await trackTTN(repair.np_ttn) : null;

  // Parallel fetches for log and shop settings
  const [statusLogRes, settingsRes] = await Promise.all([
    supabase
      .from("repair_status_log")
      .select("*")
      .eq("repair_id", repair.id)
      .eq("is_customer_visible", true)
      .order("created_at"),
    supabase
      .from("settings")
      .select("*")
  ]);

  const statusLog = statusLogRes.data;
  const settingsData = settingsRes.data;

  // Extract contact information from settings fallback to defaults if not configured
  let shopPhone = "+380 99 999 9999";
  let shopName = "VV CRM";
  if (settingsData) {
    const receiptRow = settingsData.find(s => s.key === "receipt_settings");
    if (receiptRow && typeof receiptRow.value === "object" && receiptRow.value !== null) {
      const val = receiptRow.value as any;
      if (val.phone) shopPhone = val.phone;
      if (val.company_name) shopName = val.company_name;
    }
  }
  
  // Intelligent Telegram link formatting
  const cleanPhone = shopPhone.trim();
  let tgLink = "";
  if (cleanPhone.startsWith("@")) {
    tgLink = `https://t.me/${cleanPhone.substring(1)}`;
  } else if (cleanPhone.includes("t.me/")) {
    tgLink = cleanPhone.startsWith("http") ? cleanPhone : `https://${cleanPhone}`;
  } else {
    tgLink = `tg://resolve?phone=${cleanPhone.replace(/[^\d]/g, "")}`;
  }

  return (
    <div className="min-h-screen bg-warm-bg">
      <header className="border-b border-warm-border/50 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/shop" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary">
            <span className="text-violet"><IconLogo /></span> VV CRM
          </Link>
          <Link href="/track" className="text-sm text-violet hover:underline">Інша заявка</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center text-violet"><IconRepair size={40} /></div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Ремонт #{repair.tracking_token}</h1>
          <p className="mt-1 text-sm text-text-secondary">{repair.customers?.name}</p>
        </div>

        <div className="mb-6 rounded-2xl border border-warm-border/60 bg-white p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-secondary">Пристрій</p>
              <p className="font-medium text-text-primary">{repair.device_name}</p>
            </div>
            {repair.device_imei && <div>
              <p className="text-xs text-text-secondary">IMEI</p>
              <p className="font-mono text-xs text-text-primary">{repair.device_imei}</p>
            </div>}
            <div>
              <p className="text-xs text-text-secondary">Проблема</p>
              <p className="text-text-primary">{repair.issue}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Статус</p>
              <span className={`inline-block rounded px-2.5 py-1 text-xs font-medium ${statusColors[repair.status] || "bg-iris/5 text-text-secondary"}`}>
                {statusLabels[repair.status] || repair.status}
              </span>
            </div>
            {repair.price > 0 && <div>
              <p className="text-xs text-text-secondary">Вартість</p>
              <p className="font-semibold text-text-primary">{repair.price.toLocaleString()} грн</p>
            </div>}
            {repair.estimated_completion && <div>
              <p className="text-xs text-text-secondary">Орієнтовна дата</p>
              <p className="text-text-primary">{new Date(repair.estimated_completion).toLocaleDateString("uk-UA")}</p>
            </div>}
            {repair.warranty_months > 0 && (repair.status === "completed" || repair.status === "handed_over") && (
              <div>
                <p className="text-xs text-text-secondary">Гарантія на ремонт</p>
                <p className="font-semibold text-emerald">{repair.warranty_months} міс.</p>
              </div>
            )}
            {repair.np_ttn && <div className="col-span-2">
              <NovaPoshtaWidget ttn={repair.np_ttn} initialStatus={npStatus} />
            </div>}
          </div>
        </div>

        {/* Блок зв'язку з СЦ */}
        <div className="mb-6 rounded-2xl border border-violet/10 bg-violet/[0.02] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
          <div>
            <h4 className="text-xs font-bold text-text-primary">Потрібна консультація щодо ремонту?</h4>
            <p className="text-[11px] text-text-secondary mt-0.5">Зв&apos;яжіться з менеджером нашого сервісного центру {shopName}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto text-xs shrink-0">
            <a
              href={`tel:${shopPhone.replace(/\s+/g, "")}`}
              className="btn-press w-full sm:w-auto rounded-xl bg-violet px-4 py-2.5 font-semibold text-white transition-colors hover:bg-violet-hover flex items-center justify-center text-center"
            >
              📞 Зателефонувати
            </a>
            <a
              href={tgLink}
              target="_blank"
              rel="noreferrer"
              className="btn-press w-full sm:w-auto rounded-xl bg-white border border-warm-border text-violet font-semibold px-4 py-2.5 transition-colors hover:bg-iris/5 flex items-center justify-center text-center"
            >
              💬 Telegram підтримка
            </a>
          </div>
        </div>

        {repair.device_condition_photos && repair.device_condition_photos.length > 0 && (
          <div className="mb-6 rounded-2xl border border-warm-border/60 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Фото пристрою на момент приймання</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {repair.device_condition_photos.map((url: string, i: number) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl bg-warm-bg">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {statusLog && statusLog.length > 0 && (
          <div className="rounded-2xl border border-warm-border/60 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">Історія статусів</h3>
            <div className="relative">
              <div className="absolute left-[7px] top-1 h-[calc(100%-8px)] w-px bg-iris/10" />
              <div className="space-y-5">
                {statusLog.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="relative z-10 mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-violet bg-white" />
                    <div>
                      <p className="text-xs text-text-secondary">{new Date(log.created_at).toLocaleString("uk-UA")}</p>
                      <p className="text-sm font-medium text-text-primary">{statusLabels[log.to_status] || log.to_status}</p>
                      {log.notes && <p className="text-xs text-text-secondary mt-0.5">{log.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

