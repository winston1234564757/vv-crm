export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { IconRepair, IconLogo } from "@/components/icons";
import { trackTTN } from "@/lib/services/nova-poshta";
import NovaPoshtaWidget from "@/components/ui/NovaPoshtaWidget";

import { StatusPill } from "@/components/ui/StatusPill";
import { labelOf, repairStatusPublic, orderStatusPublic, orderItemType } from "@/lib/domain-labels";

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();
  const decodedToken = decodeURIComponent(token).trim();

  // Check if token is a phone number (e.g. +38097... or 097...)
  const isPhone = /^\+?[\d\s\-\(\)]+$/.test(decodedToken) && decodedToken.replace(/\D/g, "").length >= 9;

  if (isPhone) {
    const cleanPhone = decodedToken.replace(/\D/g, "");
    const { data: repairs, error: phoneError } = await supabase
      .from("repairs")
      .select("id, tracking_token, public_token, device_name, status, created_at, customers!inner(phone)")
      .ilike("customers.phone", `%${cleanPhone.slice(-9)}%`)
      .order("created_at", { ascending: false });

    if (phoneError || !repairs || repairs.length === 0) notFound();

    // If only one repair found, redirect to its secret public token
    if (repairs.length === 1) {
      redirect(`/track/${repairs[0].public_token}`);
    }

    // If multiple repairs found, render a list
    return (
      <div className="min-h-screen bg-warm-bg">
        <header className="border-b border-warm-border/50 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <Link href="/shop" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary">
              <span className="text-violet"><IconLogo /></span> VV CRM
            </Link>
            <Link href="/track" className="text-sm text-violet hover:underline">Новий пошук</Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8">
          <div className="mb-8 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Ваші ремонти</h1>
            <p className="mt-1 text-sm text-text-secondary">Оберіть заявку для перегляду деталей</p>
          </div>
          
          <div className="space-y-4">
            {repairs.map((r: any) => (
              <Link key={r.id} href={`/track/${r.public_token}`} className="block rounded-2xl border border-warm-border/60 bg-white p-5 transition-colors hover:border-violet/40 hover:bg-violet/[0.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-text-primary">{r.device_name}</h3>
                    <p className="text-xs text-text-secondary mt-1">Заявка #{r.tracking_token} · {new Date(r.created_at).toLocaleDateString("uk-UA")}</p>
                  </div>
                  <StatusPill map={repairStatusPublic} value={r.status} />
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Default behavior: token is the secret public_token (unguessable, not the 0001 number)
  const { data: repair, error } = await supabase
    .from("repairs")
    .select("*, customers(name)")
    .eq("public_token", decodedToken)
    .single();

  // Не ремонт — можливо, це клієнтське замовлення (той самий публічний токен,
  // але з префіксом 'o'). client_orders не в згенерованих типах — локальний каст.
  if (error || !repair) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase as any)
      .from("client_orders")
      .select("*, customers(name, phone)")
      .eq("public_token", decodedToken)
      .single();

    if (!order) notFound();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orderLog } = await (supabase as any)
      .from("client_order_status_log")
      .select("*")
      .eq("order_id", order.id)
      .eq("is_customer_visible", true)
      .order("created_at");

    const remaining = Math.max(0, (order.agreed_price ?? 0) - (order.deposit ?? 0));

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
            <h1 className="text-xl font-semibold tracking-tight text-text-primary text-balance">Замовлення #{order.order_no}</h1>
            <p className="mt-1 text-sm text-text-secondary">{order.customers?.name}</p>
          </div>

          <div className="mb-6 rounded-2xl border border-warm-border/60 bg-white p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-text-secondary">Категорія</p>
                <p className="font-medium text-text-primary">{labelOf(orderItemType, order.item_type).label}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Статус</p>
                <StatusPill map={orderStatusPublic} value={order.status} />
              </div>
              <div className="col-span-2">
                <p className="text-xs text-text-secondary">Товар</p>
                <p className="font-medium text-text-primary">{order.item_name}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Узгоджена ціна</p>
                <p className="font-semibold text-text-primary">{(order.agreed_price ?? 0).toLocaleString()} грн</p>
              </div>
              {(order.deposit ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-text-secondary">Аванс / Залишок</p>
                  <p className="font-semibold text-text-primary">
                    {(order.deposit ?? 0).toLocaleString()} / {remaining.toLocaleString()} грн
                  </p>
                </div>
              )}
              {order.deadline && (
                <div>
                  <p className="text-xs text-text-secondary">Орієнтовний термін</p>
                  <p className="text-text-primary">{new Date(order.deadline).toLocaleDateString("uk-UA")}</p>
                </div>
              )}
            </div>
          </div>

          {orderLog && orderLog.length > 0 && (
            <div className="rounded-2xl border border-warm-border/60 bg-white p-6">
              <h3 className="mb-4 text-sm font-semibold text-text-primary tracking-tight">Історія статусів</h3>
              <div className="relative">
                <div className="absolute left-[7px] top-1 h-[calc(100%-8px)] w-px bg-iris/10" />
                <div className="space-y-5">
                  {orderLog.map((log: { id: string; created_at: string; to_status: string; notes?: string | null }) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="relative z-10 mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-violet bg-white" />
                      <div>
                        <p className="text-xs text-text-secondary">{new Date(log.created_at).toLocaleString("uk-UA")}</p>
                        <p className="text-sm font-medium text-text-primary">{labelOf(orderStatusPublic, log.to_status).label}</p>
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
          <h1 className="text-xl font-semibold tracking-tight text-text-primary text-balance">Ремонт #{repair.tracking_token}</h1>
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
              <StatusPill map={repairStatusPublic} value={repair.status} />
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
            <h3 className="mb-3 text-sm font-semibold text-text-primary tracking-tight">Фото пристрою на момент приймання</h3>
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
            <h3 className="mb-4 text-sm font-semibold text-text-primary tracking-tight">Історія статусів</h3>
            <div className="relative">
              <div className="absolute left-[7px] top-1 h-[calc(100%-8px)] w-px bg-iris/10" />
              <div className="space-y-5">
                {statusLog.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="relative z-10 mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-violet bg-white" />
                    <div>
                      <p className="text-xs text-text-secondary">{new Date(log.created_at).toLocaleString("uk-UA")}</p>
                      <p className="text-sm font-medium text-text-primary">{labelOf(repairStatusPublic, log.to_status).label}</p>
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

