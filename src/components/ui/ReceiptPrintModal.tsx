"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { IconClose } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import type { ReceiptSettings } from "@/lib/data-settings";
import { supabaseCast } from "@/lib/utils/supabase";

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "sale" | "repair_acceptance" | "repair_warranty";
  data: {
    id: string;
    created_at?: string;
    customer_name: string;
    customer_phone?: string;
    seller_name?: string;
    // For sale:
    items?: Array<{ name: string; quantity: number; unit_price: number; total_price: number }>;
    total_amount?: number;
    discount?: number;
    warranty_end?: string | null;
    register_name?: string;
    // For repairs:
    device_name?: string;
    device_imei?: string | null;
    device_accessories_included?: string | null;
    device_condition?: string | null;
    issue?: string;
    warranty_months?: number;
    tracking_token?: string | null;
    price?: number;
    // For warranty receipt — list of parts/services performed:
    repairItems?: Array<{ name: string; quantity: number; unit_price: number }>;
  };
}

export default function ReceiptPrintModal({ isOpen, onClose, type, data }: ReceiptPrintModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Editable receipt fields
  const [companyName, setCompanyName] = useState("");
  const [companySubtitle, setCompanySubtitle] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [footerText, setFooterText] = useState("");

  const [title, setTitle] = useState("");
  const [showSeller, setShowSeller] = useState(true);
  const [showBuyer, setShowBuyer] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [warrantyText, setWarrantyText] = useState("");

  // Customer custom details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Custom metadata (e.g. employee)
  const [employeeName, setEmployeeName] = useState("");
  
  // Custom device parameters (only for repair type)
  const [deviceName, setDeviceName] = useState("");
  const [deviceImei, setDeviceImei] = useState("");
  const [deviceAccessories, setDeviceAccessories] = useState("");
  const [deviceCondition, setDeviceCondition] = useState("");
  const [issue, setIssue] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch settings & populate initial states
  useEffect(() => {
    if (!isOpen) return;

    // Reset default customer and basic fields
    setCustomerName(data.customer_name || "Роздрібний покупець");
    setCustomerPhone(data.customer_phone || "");
    setEmployeeName(data.seller_name || "Адміністратор");

    if (type.startsWith("repair")) {
      setDeviceName(data.device_name || "");
      setDeviceImei(data.device_imei || "");
      setDeviceAccessories(data.device_accessories_included || "Тільки пристрій");
      
      const conditionMap: Record<string, string> = {
        perfect: "Grade A (Ідеальний)",
        good: "Grade B (Хороший)",
        fair: "Grade C (Середній)",
        poor: "Поганий",
        damaged: "Пошкоджений"
      };
      const condVal = data.device_condition || "";
      setDeviceCondition(conditionMap[condVal] || condVal || "Не вказано");
      setIssue(data.issue || "");
    }

    async function loadReceiptSettings() {
      try {
        const supabase = createClient();
        const { data: dbData, error } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "receipt_settings")
          .single();

        if (error) throw error;
        
        if (dbData?.value) {
          const settings = supabaseCast<ReceiptSettings>(dbData.value);
          setCompanyName(settings.company_name || "VV CRM");
          setCompanySubtitle(settings.company_subtitle || "Магазин та сервісний центр");
          setAddress(settings.address || "м. Київ, вул. Хрещатик 1");
          setPhone(settings.phone || "+380 99 999 9999");
          setFooterText(settings.footer_text || "Дякуємо за покупку!\nЧекаємо Вас знову!");

          const template = settings.templates?.[type];
          if (template) {
            setTitle(template.title || getFallbackTitle(type));
            setShowSeller(template.show_seller ?? true);
            setShowBuyer(template.show_buyer ?? true);
            setShowQr(template.show_qr ?? true);
            
            // If the item has its own specific warranty fields, default to it, otherwise use database template text
            if (type === "sale" && data.warranty_end) {
              const formattedDate = format(new Date(data.warranty_end), "dd.MM.yyyy");
              setWarrantyText(template.warranty_text 
                ? `Гарантія дійсна до: ${formattedDate}\n\n${template.warranty_text}`
                : `Гарантія дійсна до: ${formattedDate}\n\nПри виявленні несправностей протягом гарантійного терміну товар приймається на діагностику за наявності цього чеку.`);
            } else if (type === "repair_warranty" && data.warranty_months) {
              setWarrantyText(`Термін гарантії: ${data.warranty_months} міс.\n\n` + (template.warranty_text || "Гарантія поширюється виключно на замінені деталі та виконані роботи."));
            } else {
              setWarrantyText(template.warranty_text || "");
            }
          } else {
            loadFallbacks();
          }
        } else {
          loadFallbacks();
        }
      } catch (err) {
        console.error("Failed to load receipt settings, loading fallbacks:", err);
        loadFallbacks();
      }
    }

    function loadFallbacks() {
      setCompanyName("VV CRM");
      setCompanySubtitle(type.startsWith("repair") ? "Сервісний центр" : "Магазин та сервісний центр");
      setAddress("м. Київ, вул. Хрещатик 1");
      setPhone("+380 99 999 9999");
      setFooterText("Дякуємо за покупку!\nЧекаємо Вас знову!");
      setTitle(getFallbackTitle(type));
      setShowSeller(true);
      setShowBuyer(true);
      setShowQr(true);

      if (type === "sale" && data.warranty_end) {
        setWarrantyText(`Гарантія дійсна до: ${format(new Date(data.warranty_end), "dd.MM.yyyy")}\n\nПри виявленні несправностей протягом гарантійного терміну товар приймається на діагностику за наявності цього чеку.`);
      } else if (type === "repair_acceptance") {
        setWarrantyText("1. Безкоштовне зберігання готового пристрою - до 14 днів.\n2. СЦ не несе відповідальності за збереження даних.\n3. Пристрій приймається без гарантії на інші несправності.");
      } else if (type === "repair_warranty") {
        setWarrantyText(`Термін гарантії: ${data.warranty_months || 0} міс.\n\nГарантія поширюється виключно на замінені деталі та виконані роботи.`);
      } else {
        setWarrantyText("");
      }
    }

    loadReceiptSettings();
  }, [isOpen, type, data]);

  function getFallbackTitle(t: string) {
    if (t === "sale") return "ТОВАРНИЙ ЧЕК";
    if (t === "repair_acceptance") return "КВИТАНЦІЯ ПРИЙМАННЯ";
    return "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ";
  }

  const handlePrint = () => {
    setIsPrinting(true);
    // Give state a brief window to render the printable portal
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  if (!mounted || !isOpen) return null;

  const formattedDate = data.created_at
    ? format(new Date(data.created_at), "dd MMMM yyyy 'о' HH:mm", { locale: uk })
    : format(new Date(), "dd MMMM yyyy 'о' HH:mm", { locale: uk });

  const qrData = type === "sale"
    ? `VV-CRM-SALE-${data.id}`
    : typeof window !== "undefined"
      ? `${window.location.origin}/track/${data.tracking_token || data.id}`
      : `VV-CRM-REPAIR-${data.id}`;

  const renderReceiptContent = () => (
    <>
      {/* Company info */}
      <div className="text-center pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide">{companyName || "НАЗВА КОМПАНІЇ"}</h3>
        <p className="text-[9px] text-gray-500">{companySubtitle || "Сфера діяльності"}</p>
        <p className="text-[8px] text-gray-400 mt-0.5">{address || "Адреса"}</p>
        <p className="text-[8px] text-gray-400">{phone || "Телефон"}</p>
      </div>
      
      <div className="receipt-divider" />
      
      {/* Document Meta */}
      <div className="space-y-0.5 text-[9px]">
        <p className="font-bold">{title} №{data.id.substring(0, 8)}</p>
        <p>Дата: {formattedDate}</p>
        {type === "sale" && data.register_name && (
          <p>Каса: {data.register_name}</p>
        )}
        {showSeller && (
          <p>
            {type === "repair_acceptance" ? "Прийняв" : type === "repair_warranty" ? "Видав" : "Продавець"}: {employeeName}
          </p>
        )}
      </div>
      
      <div className="receipt-divider" />
      
      {/* Buyer info */}
      {showBuyer && (
        <>
          <div className="space-y-0.5 text-[9px]">
            <p className="text-gray-400 uppercase font-bold">
              {type === "sale" ? "Покупець" : "Замовник"}
            </p>
            <p className="font-bold">{customerName}</p>
            {customerPhone && <p className="font-mono text-[9px]">{customerPhone}</p>}
          </div>
          <div className="receipt-divider" />
        </>
      )}

      {/* Sale Items / Device details */}
      <div className="space-y-1">
        {type === "sale" && (
          <>
            <p className="text-[9px] text-gray-400 uppercase font-bold mb-1">Перелік товарів</p>
            <table className="w-full text-left text-[9px]">
              <thead>
                <tr className="border-b border-black/20 font-bold">
                  <th className="py-0.5">Назва</th>
                  <th className="py-0.5 text-center">К-ть</th>
                  <th className="py-0.5 text-right">Сума</th>
                </tr>
              </thead>
              <tbody>
                {(!data.items || data.items.length === 0) ? (
                  <tr>
                    <td className="py-1 truncate max-w-[150px]">Товар / послуга</td>
                    <td className="py-1 text-center">1</td>
                    <td className="py-1 text-right">{(data.total_amount || 0).toLocaleString()} ₴</td>
                  </tr>
                ) : (
                  data.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-black/10 last:border-0">
                      <td className="py-1 truncate max-w-[150px]">{item.name}</td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-right">{item.total_price.toLocaleString()} ₴</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            <div className="receipt-divider" />

            <div className="text-right space-y-0.5 text-[9px]">
              {data.discount && data.discount > 0 ? (
                <p>Знижка: {data.discount}%</p>
              ) : null}
              <p className="text-[11px] font-bold">РАЗОМ ДО СПЛАТИ: {(data.total_amount || 0).toLocaleString()} ₴</p>
            </div>
          </>
        )}

        {type === "repair_acceptance" && (
          <>
            <p className="text-[9px] text-gray-400 uppercase font-bold">Інформація про пристрій</p>
            <div className="space-y-0.5 text-[9px]">
              <p><strong>Модель:</strong> {deviceName}</p>
              {deviceImei && <p><strong>IMEI/SN:</strong> {deviceImei}</p>}
              <p><strong>Комплект:</strong> {deviceAccessories}</p>
              <p><strong>Стан:</strong> {deviceCondition}</p>
            </div>
            
            <div className="receipt-divider" />
            
            <div className="space-y-0.5 text-[9px]">
              <p className="text-gray-400 uppercase font-bold">Заявлена несправність</p>
              <p className="font-bold leading-normal">{issue}</p>
            </div>
          </>
        )}

        {type === "repair_warranty" && (
          <>
            <p className="text-[9px] text-gray-400 uppercase font-bold">Деталі ремонту</p>
            <div className="space-y-0.5 text-[9px]">
              <p><strong>Модель:</strong> {deviceName}</p>
              {deviceImei && <p><strong>IMEI/SN:</strong> {deviceImei}</p>}
              {issue && <p><strong>Несправність:</strong> {issue}</p>}
            </div>

            {/* Parts & Services table */}
            {data.repairItems && data.repairItems.length > 0 && (
              <>
                <div className="receipt-divider" />
                <p className="text-[9px] text-gray-400 uppercase font-bold">Виконані роботи / деталі</p>
                <table className="w-full text-left text-[9px] mt-0.5">
                  <thead>
                    <tr className="border-b border-black/20 font-bold">
                      <th className="py-0.5">Найменування</th>
                      <th className="py-0.5 text-center">К-ть</th>
                      <th className="py-0.5 text-right">Сума</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.repairItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-black/10 last:border-0">
                        <td className="py-0.5 pr-1">{item.name}</td>
                        <td className="py-0.5 text-center">{item.quantity}</td>
                        <td className="py-0.5 text-right">{(item.unit_price * item.quantity).toLocaleString()} ₴</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-right pt-0.5">
                  <span className="text-[10px] font-bold">
                    РАЗОМ: {data.repairItems.reduce((s, i) => s + i.unit_price * i.quantity, 0).toLocaleString()} ₴ (Сплачено)
                  </span>
                </div>
              </>
            )}

            {/* Fallback if no items */}
            {(!data.repairItems || data.repairItems.length === 0) && (
              <p className="font-bold text-[10px] mt-1">Сума до сплати: {(data.price || 0).toLocaleString()} ₴ (Сплачено)</p>
            )}
          </>
        )}
      </div>

      {warrantyText && (
        <>
          <div className="receipt-divider" />
          <div className="space-y-0.5">
            <p className="text-[9px] text-gray-400 uppercase font-bold">
              {type === "repair_acceptance" ? "Умови ремонту" : "Гарантійні зобов'язання"}
            </p>
            <p className="text-[8px] text-gray-600 leading-normal whitespace-pre-wrap">
              {warrantyText}
            </p>
          </div>
        </>
      )}

      {/* Signatures */}
      {(type === "repair_acceptance" || type === "repair_warranty") && (
        <>
          <div className="receipt-divider" />
          <div className="pt-2 grid grid-cols-2 gap-4 text-center text-[8px] text-black">
            <div>
              <p>{type === "repair_acceptance" ? "Здав (підпис)" : "Отримав (підпис)"}</p>
              <p className="mt-4 font-bold">___________</p>
            </div>
            <div>
              <p>{type === "repair_acceptance" ? "Прийняв (підпис)" : "Видав (підпис)"}</p>
              <p className="mt-4 font-bold">___________</p>
            </div>
          </div>
        </>
      )}

      {/* QR Code and Footer */}
      <div className="flex flex-col items-center justify-center text-center pt-2 space-y-1.5">
        {showQr && (
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrData)}`}
            alt="QR Code"
            className="w-16 h-16 border p-0.5 bg-white"
          />
        )}
        <div className="text-[8px] text-gray-500 leading-tight whitespace-pre-wrap">
          {footerText}
        </div>
      </div>
    </>
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-warm-bg/80 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative bg-warm-surface border border-warm-border rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] max-h-[750px] z-10"
            >
              {/* Left Side: Editor Form */}
              <div className="w-full md:w-3/5 p-6 overflow-y-auto border-r border-warm-border/50 flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex justify-between items-center pb-2 border-b border-warm-border/40">
                    <div>
                      <h2 className="text-base font-bold text-text-primary">Редактор чека (WYSIWYG)</h2>
                      <p className="text-[10px] text-text-secondary">Зміни відображаються у правому прев&apos;ю миттєво</p>
                    </div>
                    <button
                      onClick={onClose}
                      className="btn-press flex h-8 w-8 items-center justify-center rounded-full bg-violet/5 text-text-secondary transition-colors hover:bg-violet/10 hover:text-violet cursor-pointer"
                    >
                      <IconClose size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    {/* Company Name */}
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-text-secondary">Назва компанії</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                      />
                    </div>
                    {/* Subtitle */}
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-text-secondary">Сфера діяльності</label>
                      <input
                        type="text"
                        value={companySubtitle}
                        onChange={(e) => setCompanySubtitle(e.target.value)}
                        className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                      />
                    </div>
                    {/* Address */}
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-text-secondary">Адреса</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                      />
                    </div>
                    {/* Phone */}
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-text-secondary">Телефон</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                      />
                    </div>
                    {/* Customer Name */}
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-text-secondary">
                        {type === "sale" ? "Ім'я покупця" : "Ім'я замовника"}
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                      />
                    </div>
                    {/* Customer Phone */}
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-text-secondary">Телефон клієнта</label>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                      />
                    </div>
                    {/* Document Title */}
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[10px] font-bold text-text-secondary">Заголовок документа</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                      />
                    </div>

                    {/* Repair details */}
                    {type.startsWith("repair") && (
                      <>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-text-secondary">Модель пристрою</label>
                          <input
                            type="text"
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-text-secondary">IMEI / Серійний номер</label>
                          <input
                            type="text"
                            value={deviceImei}
                            onChange={(e) => setDeviceImei(e.target.value)}
                            className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-text-secondary">Комплектація</label>
                          <input
                            type="text"
                            value={deviceAccessories}
                            onChange={(e) => setDeviceAccessories(e.target.value)}
                            className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-text-secondary">Стан пристрою</label>
                          <input
                            type="text"
                            value={deviceCondition}
                            onChange={(e) => setDeviceCondition(e.target.value)}
                            className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-[10px] font-bold text-text-secondary">
                            {type === "repair_acceptance" ? "Заявлена несправність" : "Виконані роботи"}
                          </label>
                          <textarea
                            value={issue}
                            onChange={(e) => setIssue(e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet resize-none"
                          />
                        </div>
                      </>
                    )}

                    {/* Warranty Text */}
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[10px] font-bold text-text-secondary">
                        {type === "repair_acceptance" ? "Умови ремонту" : "Гарантійні умови"}
                      </label>
                      <textarea
                        value={warrantyText}
                        onChange={(e) => setWarrantyText(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet resize-none"
                      />
                    </div>
                    {/* Footer Text */}
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[10px] font-bold text-text-secondary">Текст підвалу чека</label>
                      <textarea
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-warm-border bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet resize-none"
                      />
                    </div>

                    {/* Checkboxes */}
                    <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showSeller}
                          onChange={(e) => setShowSeller(e.target.checked)}
                          className="rounded border-warm-border text-violet focus:ring-violet"
                        />
                        <span className="text-[11px] text-text-primary">Показувати продавця/майстра</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showBuyer}
                          onChange={(e) => setShowBuyer(e.target.checked)}
                          className="rounded border-warm-border text-violet focus:ring-violet"
                        />
                        <span className="text-[11px] text-text-primary">Показувати покупця</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showQr}
                          onChange={(e) => setShowQr(e.target.checked)}
                          className="rounded border-warm-border text-violet focus:ring-violet"
                        />
                        <span className="text-[11px] text-text-primary">Показувати QR-код</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Lower Action Buttons */}
                <div className="flex gap-3 pt-5 border-t border-warm-border/40 mt-5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl bg-white border border-warm-border hover:bg-warm-hover py-3 text-xs font-semibold text-text-primary transition-colors cursor-pointer"
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex-1 btn-press flex items-center justify-center gap-1.5 rounded-xl bg-violet py-3 text-xs font-semibold text-white transition-colors hover:bg-violet-hover cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    <span>Друкувати</span>
                  </button>
                </div>
              </div>

              {/* Right Side: Virtual Receipt Preview */}
              <div className="w-full md:w-2/5 bg-warm-bg/70 p-6 flex flex-col items-center justify-center overflow-y-auto">
                <p className="text-[9px] font-bold text-text-secondary uppercase tracking-wider mb-3">
                  Емулятор 80мм стрічки
                </p>
                <div className="w-full max-w-[280px] bg-white rounded-xl border border-warm-border shadow-md p-5 font-mono text-[9px] text-black space-y-3.5 relative overflow-hidden select-none">
                  {/* Visual Tear Lines effect */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-violet/15" />
                  
                  {renderReceiptContent()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Area (rendered outside dialog when print is active) */}
      {(isOpen || isPrinting) && createPortal(
        <div id="reusable-print-container" className="printable-receipt hidden font-mono text-black">
          {renderReceiptContent()}
        </div>,
        document.body
      )}
    </>
  );
}
