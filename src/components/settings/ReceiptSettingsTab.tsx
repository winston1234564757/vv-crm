"use client";

import { ReceiptPreview } from "./ReceiptPreview";

interface ReceiptSettingsTabProps {
  companyName: string;
  setCompanyName: (val: string) => void;
  companySubtitle: string;
  setCompanySubtitle: (val: string) => void;
  address: string;
  setAddress: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  footerText: string;
  setFooterText: (val: string) => void;
  
  activePreviewTemplate: "sale" | "repair_acceptance" | "repair_warranty";
  setActivePreviewTemplate: (val: "sale" | "repair_acceptance" | "repair_warranty") => void;

  saleTitle: string;
  setSaleTitle: (val: string) => void;
  saleShowSeller: boolean;
  setSaleShowSeller: (val: boolean) => void;
  saleShowBuyer: boolean;
  setSaleShowBuyer: (val: boolean) => void;
  saleShowQr: boolean;
  setSaleShowQr: (val: boolean) => void;
  saleWarrantyText: string;
  setSaleWarrantyText: (val: string) => void;

  repAccTitle: string;
  setRepAccTitle: (val: string) => void;
  repAccShowSeller: boolean;
  setRepAccShowSeller: (val: boolean) => void;
  repAccShowBuyer: boolean;
  setRepAccShowBuyer: (val: boolean) => void;
  repAccShowQr: boolean;
  setRepAccShowQr: (val: boolean) => void;
  repAccWarrantyText: string;
  setRepAccWarrantyText: (val: string) => void;

  repWarrTitle: string;
  setRepWarrTitle: (val: string) => void;
  repWarrShowSeller: boolean;
  setRepWarrShowSeller: (val: boolean) => void;
  repWarrShowBuyer: boolean;
  setRepWarrShowBuyer: (val: boolean) => void;
  repWarrShowQr: boolean;
  setRepWarrShowQr: (val: boolean) => void;
  repWarrWarrantyText: string;
  setRepWarrWarrantyText: (val: string) => void;

  action: (formData: FormData) => void;
  isReceiptPending: boolean;
}

export function ReceiptSettingsTab({
  companyName,
  setCompanyName,
  companySubtitle,
  setCompanySubtitle,
  address,
  setAddress,
  phone,
  setPhone,
  footerText,
  setFooterText,
  activePreviewTemplate,
  setActivePreviewTemplate,
  saleTitle,
  setSaleTitle,
  saleShowSeller,
  setSaleShowSeller,
  saleShowBuyer,
  setSaleShowBuyer,
  saleShowQr,
  setSaleShowQr,
  saleWarrantyText,
  setSaleWarrantyText,
  repAccTitle,
  setRepAccTitle,
  repAccShowSeller,
  setRepAccShowSeller,
  repAccShowBuyer,
  setRepAccShowBuyer,
  repAccShowQr,
  setRepAccShowQr,
  repAccWarrantyText,
  setRepAccWarrantyText,
  repWarrTitle,
  setRepWarrTitle,
  repWarrShowSeller,
  setRepWarrShowSeller,
  repWarrShowBuyer,
  setRepWarrShowBuyer,
  repWarrShowQr,
  setRepWarrShowQr,
  repWarrWarrantyText,
  setRepWarrWarrantyText,
  action,
  isReceiptPending,
}: ReceiptSettingsTabProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Settings Panel */}
      <form action={action} className="lg:col-span-7 space-y-6">
        <div className="card p-5 space-y-4 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md border border-iris/10 rounded-2xl shadow-sm">
          <h2 className="text-base font-semibold text-text-primary">Реквізити шапки та підвалу чека</h2>
          <p className="text-xs text-text-secondary">
            Ці дані будуть однаковими для всіх чеків та актів. Вони друкуються вгорі та внизу кожної квитанції.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="company_name" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Назва організації</label>
              <input
                id="company_name"
                type="text"
                name="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                required
              />
            </div>
            <div>
              <label htmlFor="company_subtitle" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Сфера діяльності / Підзаголовок</label>
              <input
                id="company_subtitle"
                type="text"
                name="company_subtitle"
                value={companySubtitle}
                onChange={(e) => setCompanySubtitle(e.target.value)}
                className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                required
              />
            </div>
            <div>
              <label htmlFor="address" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Адреса магазину</label>
              <input
                id="address"
                type="text"
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                required
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Контактний телефон</label>
              <input
                id="phone"
                type="text"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="footer_text" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Загальний текст підвалу (подяка)</label>
            <textarea
              id="footer_text"
              name="footer_text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-xs text-text-primary outline-none focus:border-violet resize-none"
              required
            />
          </div>
        </div>

        {/* Template specific settings */}
        <div className="card p-5 space-y-4 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md border border-iris/10 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-warm-border pb-3 gap-2">
            <h2 className="text-base font-semibold text-text-primary">Шаблони за сутностями</h2>
            <div className="flex gap-1 bg-warm-bg rounded-lg p-0.5 border border-warm-border w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActivePreviewTemplate("sale")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-semibold rounded-md cursor-pointer transition-colors ${
                  activePreviewTemplate === "sale" ? "bg-white text-violet shadow-sm" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Продаж
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTemplate("repair_acceptance")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-semibold rounded-md cursor-pointer transition-colors ${
                  activePreviewTemplate === "repair_acceptance" ? "bg-white text-violet shadow-sm" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Акт прийому
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTemplate("repair_warranty")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-semibold rounded-md cursor-pointer transition-colors ${
                  activePreviewTemplate === "repair_warranty" ? "bg-white text-violet shadow-sm" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Гарантія ремонту
              </button>
            </div>
          </div>

          {/* SALE TEMPLATE FORM */}
          <div className={activePreviewTemplate === "sale" ? "space-y-4" : "hidden"}>
            <div>
              <label htmlFor="sale_title" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Назва документа (заголовок чека)</label>
              <input
                id="sale_title"
                type="text"
                name="sale_title"
                value={saleTitle}
                onChange={(e) => setSaleTitle(e.target.value)}
                className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4 border border-warm-border/30 rounded-xl p-3 bg-warm-bg/25">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saleShowSeller}
                  onChange={(e) => setSaleShowSeller(e.target.checked)}
                  className="rounded border-warm-border text-violet focus:ring-violet"
                />
                <input type="hidden" name="sale_show_seller" value={saleShowSeller ? "true" : "false"} />
                <span className="text-[11px] font-medium text-text-primary">Продавець</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saleShowBuyer}
                  onChange={(e) => setSaleShowBuyer(e.target.checked)}
                  className="rounded border-warm-border text-violet focus:ring-violet"
                />
                <input type="hidden" name="sale_show_buyer" value={saleShowBuyer ? "true" : "false"} />
                <span className="text-[11px] font-medium text-text-primary">Покупець</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saleShowQr}
                  onChange={(e) => setSaleShowQr(e.target.checked)}
                  className="rounded border-warm-border text-violet focus:ring-violet"
                />
                <input type="hidden" name="sale_show_qr" value={saleShowQr ? "true" : "false"} />
                <span className="text-[11px] font-medium text-text-primary">QR-код</span>
              </label>
            </div>

            <div>
              <label htmlFor="sale_warranty_text" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Текст гарантійних зобов&apos;язань</label>
              <textarea
                id="sale_warranty_text"
                name="sale_warranty_text"
                value={saleWarrantyText}
                onChange={(e) => setSaleWarrantyText(e.target.value)}
                rows={5}
                className="w-full text-xs rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-text-primary outline-none focus:border-violet leading-relaxed"
                required
              />
            </div>
          </div>

          {/* REPAIR ACCEPTANCE TEMPLATE FORM */}
          <div className={activePreviewTemplate === "repair_acceptance" ? "space-y-4" : "hidden"}>
            <div>
              <label htmlFor="repair_acceptance_title" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Назва документа (заголовок чека)</label>
              <input
                id="repair_acceptance_title"
                type="text"
                name="repair_acceptance_title"
                value={repAccTitle}
                onChange={(e) => setRepAccTitle(e.target.value)}
                className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4 border border-warm-border/30 rounded-xl p-3 bg-warm-bg/25">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={repAccShowSeller}
                  onChange={(e) => setRepAccShowSeller(e.target.checked)}
                  className="rounded border-warm-border text-violet focus:ring-violet"
                />
                <input type="hidden" name="repair_acceptance_show_seller" value={repAccShowSeller ? "true" : "false"} />
                <span className="text-[11px] font-medium text-text-primary">Прийняв майстер</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={repAccShowBuyer}
                  onChange={(e) => setRepAccShowBuyer(e.target.checked)}
                  className="rounded border-warm-border text-violet focus:ring-violet"
                />
                <input type="hidden" name="repair_acceptance_show_buyer" value={repAccShowBuyer ? "true" : "false"} />
                <span className="text-[11px] font-medium text-text-primary">Замовник</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={repAccShowQr}
                  onChange={(e) => setRepAccShowQr(e.target.checked)}
                  className="rounded border-warm-border text-violet focus:ring-violet"
                />
                <input type="hidden" name="repair_acceptance_show_qr" value={repAccShowQr ? "true" : "false"} />
                <span className="text-[11px] font-medium text-text-primary">QR-код</span>
              </label>
            </div>

            <div>
              <label htmlFor="repair_acceptance_warranty_text" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Правила сервісного центру (умови приймання)</label>
              <textarea
                id="repair_acceptance_warranty_text"
                name="repair_acceptance_warranty_text"
                value={repAccWarrantyText}
                onChange={(e) => setRepAccWarrantyText(e.target.value)}
                rows={5}
                className="w-full text-xs rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-text-primary outline-none focus:border-violet leading-relaxed"
                required
              />
            </div>
          </div>

          {/* REPAIR WARRANTY TEMPLATE FORM */}
          <div className={activePreviewTemplate === "repair_warranty" ? "space-y-4" : "hidden"}>
            <div>
              <label htmlFor="repair_warranty_title" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Назва документа (заголовок чека)</label>
              <input
                id="repair_warranty_title"
                type="text"
                name="repair_warranty_title"
                value={repWarrTitle}
                onChange={(e) => setRepWarrTitle(e.target.value)}
                className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4 border border-warm-border/30 rounded-xl p-3 bg-warm-bg/25">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={repWarrShowSeller}
                  onChange={(e) => setRepWarrShowSeller(e.target.checked)}
                  className="rounded border-warm-border text-violet focus:ring-violet"
                />
                <input type="hidden" name="repair_warranty_show_seller" value={repWarrShowSeller ? "true" : "false"} />
                <span className="text-[11px] font-medium text-text-primary">Видав майстер</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={repWarrShowBuyer}
                  onChange={(e) => setRepWarrShowBuyer(e.target.checked)}
                  className="rounded border-warm-border text-violet focus:ring-violet"
                />
                <input type="hidden" name="repair_warranty_show_buyer" value={repWarrShowBuyer ? "true" : "false"} />
                <span className="text-[11px] font-medium text-text-primary">Замовник</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={repWarrShowQr}
                  onChange={(e) => setRepWarrShowQr(e.target.checked)}
                  className="rounded border-warm-border text-violet focus:ring-violet"
                />
                <input type="hidden" name="repair_warranty_show_qr" value={repWarrShowQr ? "true" : "false"} />
                <span className="text-[11px] font-medium text-text-primary">QR-код</span>
              </label>
            </div>

            <div>
              <label htmlFor="repair_warranty_warranty_text" className="mb-1.5 block text-[11px] font-semibold text-text-secondary">Умови гарантії на ремонтні роботи</label>
              <textarea
                id="repair_warranty_warranty_text"
                name="repair_warranty_warranty_text"
                value={repWarrWarrantyText}
                onChange={(e) => setRepWarrWarrantyText(e.target.value)}
                rows={5}
                className="w-full text-xs rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-text-primary outline-none focus:border-violet leading-relaxed"
                required
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isReceiptPending}
          className="btn-press flex w-full items-center justify-center rounded-xl bg-violet py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer shadow-md shadow-violet/10 active:scale-[0.98]"
        >
          {isReceiptPending ? "Збереження..." : "Зберегти шаблони чеків"}
        </button>
      </form>

      {/* Right Live Preview Panel */}
      <div className="lg:col-span-5 flex flex-col items-center">
        <div className="w-full sticky top-6">
          <ReceiptPreview
            companyName={companyName}
            companySubtitle={companySubtitle}
            address={address}
            phone={phone}
            footerText={footerText}
            activePreviewTemplate={activePreviewTemplate}
            saleTitle={saleTitle}
            saleShowSeller={saleShowSeller}
            saleShowBuyer={saleShowBuyer}
            saleShowQr={saleShowQr}
            saleWarrantyText={saleWarrantyText}
            repAccTitle={repAccTitle}
            repAccShowSeller={repAccShowSeller}
            repAccShowBuyer={repAccShowBuyer}
            repAccShowQr={repAccShowQr}
            repAccWarrantyText={repAccWarrantyText}
            repWarrTitle={repWarrTitle}
            repWarrShowSeller={repWarrShowSeller}
            repWarrShowBuyer={repWarrShowBuyer}
            repWarrShowQr={repWarrShowQr}
            repWarrWarrantyText={repWarrWarrantyText}
          />
        </div>
      </div>
    </div>
  );
}
