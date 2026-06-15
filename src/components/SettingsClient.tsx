"use client";

import { useActionState, useState } from "react";
import { updateSettingsAction, updateProfileRoleAction, updateReceiptSettingsAction } from "@/lib/actions/settings";
import type { ParsedSettings, ProfileRow } from "@/lib/data-settings";
import { InlineError } from "@/components/ui/InlineError";
import type { ActionState } from "@/lib/actions/types";

import { GeneralSettingsTab } from "./settings/GeneralSettingsTab";
import { StaffSettingsTab } from "./settings/StaffSettingsTab";
import { ReceiptSettingsTab } from "./settings/ReceiptSettingsTab";

interface SettingsClientProps {
  initialSettings: ParsedSettings;
  initialProfiles: ProfileRow[];
  currentUserId: string;
}

export default function SettingsClient({
  initialSettings,
  initialProfiles,
  currentUserId,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"general" | "staff" | "receipts">("general");
  const [profiles, setProfiles] = useState<ProfileRow[]>(initialProfiles);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Receipt settings state for Live Preview and Form
  const [companyName, setCompanyName] = useState(initialSettings.receipt_settings?.company_name || "VV CRM");
  const [companySubtitle, setCompanySubtitle] = useState(initialSettings.receipt_settings?.company_subtitle || "Магазин та сервісний центр");
  const [address, setAddress] = useState(initialSettings.receipt_settings?.address || "м. Київ, вул. Хрещатик 1");
  const [phone, setPhone] = useState(initialSettings.receipt_settings?.phone || "+380 99 999 9999");
  const [footerText, setFooterText] = useState(initialSettings.receipt_settings?.footer_text || "Дякуємо за покупку! Чекаємо Вас знову!");

  // Template active previews
  const [activePreviewTemplate, setActivePreviewTemplate] = useState<"sale" | "repair_acceptance" | "repair_warranty">("sale");

  const [saleTitle, setSaleTitle] = useState(initialSettings.receipt_settings?.templates?.sale?.title || "ТОВАРНИЙ ЧЕК");
  const [saleShowSeller, setSaleShowSeller] = useState(initialSettings.receipt_settings?.templates?.sale?.show_seller ?? true);
  const [saleShowBuyer, setSaleShowBuyer] = useState(initialSettings.receipt_settings?.templates?.sale?.show_buyer ?? true);
  const [saleWarrantyText, setSaleWarrantyText] = useState(initialSettings.receipt_settings?.templates?.sale?.warranty_text || "");
  const [saleShowQr, setSaleShowQr] = useState(initialSettings.receipt_settings?.templates?.sale?.show_qr ?? true);

  const [repAccTitle, setRepAccTitle] = useState(initialSettings.receipt_settings?.templates?.repair_acceptance?.title || "КВИТАНЦІЯ ПРИЙМАННЯ");
  const [repAccShowSeller, setRepAccShowSeller] = useState(initialSettings.receipt_settings?.templates?.repair_acceptance?.show_seller ?? true);
  const [repAccShowBuyer, setRepAccShowBuyer] = useState(initialSettings.receipt_settings?.templates?.repair_acceptance?.show_buyer ?? true);
  const [repAccWarrantyText, setRepAccWarrantyText] = useState(initialSettings.receipt_settings?.templates?.repair_acceptance?.warranty_text || "");
  const [repAccShowQr, setRepAccShowQr] = useState(initialSettings.receipt_settings?.templates?.repair_acceptance?.show_qr ?? true);

  const [repWarrTitle, setRepWarrTitle] = useState(initialSettings.receipt_settings?.templates?.repair_warranty?.title || "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ");
  const [repWarrShowSeller, setRepWarrShowSeller] = useState(initialSettings.receipt_settings?.templates?.repair_warranty?.show_seller ?? true);
  const [repWarrShowBuyer, setRepWarrShowBuyer] = useState(initialSettings.receipt_settings?.templates?.repair_warranty?.show_buyer ?? true);
  const [repWarrWarrantyText, setRepWarrWarrantyText] = useState(initialSettings.receipt_settings?.templates?.repair_warranty?.warranty_text || "");
  const [repWarrShowQr, setRepWarrShowQr] = useState(initialSettings.receipt_settings?.templates?.repair_warranty?.show_qr ?? true);

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

  const [receiptState, receiptSettingsAction, isReceiptPending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      setError("");
      setSuccessMsg("");
      
      const res = await updateReceiptSettingsAction(null, formData);
      if (res.success) {
        setSuccessMsg("Налаштування шаблонів чеків успішно збережено!");
        return { success: true };
      } else {
        setError(res.error || "Помилка збереження шаблонів чеків");
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
      throw new Error(res.error || "Не вдалося оновити роль");
    }
  }

  return (
    <div className="space-y-6">
      <InlineError message={error} onClose={() => setError("")} />
      
      {successMsg && (
        <div className="rounded-xl bg-emerald/10 p-4 text-sm text-emerald border border-emerald/10 shadow-sm transition-all duration-200">
          {successMsg}
        </div>
      )}

      {/* Vercel-style Tab Selector */}
      <div className="flex border-b border-warm-border gap-2 bg-white/30 dark:bg-zinc-900/30 p-1 rounded-t-2xl">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "general"
              ? "border-violet text-violet font-extrabold"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Загальні налаштування
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "staff"
              ? "border-violet text-violet font-extrabold"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Співробітники
        </button>
        <button
          onClick={() => setActiveTab("receipts")}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "receipts"
              ? "border-violet text-violet font-extrabold"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Конструктор чеків
        </button>
      </div>

      <div className="transition-all duration-300">
        {activeTab === "general" && (
          <div className="animate-entry">
            <GeneralSettingsTab
              initialSettings={initialSettings}
              action={settingsAction}
              isPending={isPending}
            />
          </div>
        )}

        {activeTab === "staff" && (
          <div className="animate-entry">
            <StaffSettingsTab
              profiles={profiles}
              currentUserId={currentUserId}
              onRoleChange={handleRoleChange}
            />
          </div>
        )}

        {activeTab === "receipts" && (
          <div className="animate-entry">
            <ReceiptSettingsTab
              companyName={companyName}
              setCompanyName={setCompanyName}
              companySubtitle={companySubtitle}
              setCompanySubtitle={setCompanySubtitle}
              address={address}
              setAddress={setAddress}
              phone={phone}
              setPhone={setPhone}
              footerText={footerText}
              setFooterText={setFooterText}
              activePreviewTemplate={activePreviewTemplate}
              setActivePreviewTemplate={setActivePreviewTemplate}
              saleTitle={saleTitle}
              setSaleTitle={setSaleTitle}
              saleShowSeller={saleShowSeller}
              setSaleShowSeller={setSaleShowSeller}
              saleShowBuyer={saleShowBuyer}
              setSaleShowBuyer={setSaleShowBuyer}
              saleShowQr={saleShowQr}
              setSaleShowQr={setSaleShowQr}
              saleWarrantyText={saleWarrantyText}
              setSaleWarrantyText={setSaleWarrantyText}
              repAccTitle={repAccTitle}
              setRepAccTitle={setRepAccTitle}
              repAccShowSeller={repAccShowSeller}
              setRepAccShowSeller={setRepAccShowSeller}
              repAccShowBuyer={repAccShowBuyer}
              setRepAccShowBuyer={setRepAccShowBuyer}
              repAccShowQr={repAccShowQr}
              setRepAccShowQr={setRepAccShowQr}
              repAccWarrantyText={repAccWarrantyText}
              setRepAccWarrantyText={setRepAccWarrantyText}
              repWarrTitle={repWarrTitle}
              setRepWarrTitle={setRepWarrTitle}
              repWarrShowSeller={repWarrShowSeller}
              setRepWarrShowSeller={setRepWarrShowSeller}
              repWarrShowBuyer={repWarrShowBuyer}
              setRepWarrShowBuyer={setRepWarrShowBuyer}
              repWarrShowQr={repWarrShowQr}
              setRepWarrShowQr={setRepWarrShowQr}
              repWarrWarrantyText={repWarrWarrantyText}
              setRepWarrWarrantyText={setRepWarrWarrantyText}
              action={receiptSettingsAction}
              isReceiptPending={isReceiptPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}
