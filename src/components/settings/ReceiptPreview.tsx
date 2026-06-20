"use client";

import { useState } from "react";

interface ReceiptPreviewProps {
  companyName: string;
  companySubtitle: string;
  address: string;
  phone: string;
  footerText: string;
  activePreviewTemplate: "sale" | "repair_acceptance" | "repair_warranty";
  
  saleTitle: string;
  saleShowSeller: boolean;
  saleShowBuyer: boolean;
  saleShowQr: boolean;
  saleWarrantyText: string;

  repAccTitle: string;
  repAccShowSeller: boolean;
  repAccShowBuyer: boolean;
  repAccShowQr: boolean;
  repAccWarrantyText: string;

  repWarrTitle: string;
  repWarrShowSeller: boolean;
  repWarrShowBuyer: boolean;
  repWarrShowQr: boolean;
  repWarrWarrantyText: string;
}

export function ReceiptPreview({
  companyName,
  companySubtitle,
  address,
  phone,
  footerText,
  activePreviewTemplate,
  saleTitle,
  saleShowSeller,
  saleShowBuyer,
  saleShowQr,
  saleWarrantyText,
  repAccTitle,
  repAccShowSeller,
  repAccShowBuyer,
  repAccShowQr,
  repAccWarrantyText,
  repWarrTitle,
  repWarrShowSeller,
  repWarrShowBuyer,
  repWarrShowQr,
  repWarrWarrantyText,
}: ReceiptPreviewProps) {
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex items-center justify-between w-full max-w-[340px] mb-3">
        <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
          Прев&apos;ю чека
        </p>
        <div className="flex gap-1 bg-warm-bg rounded-lg p-0.5 border border-warm-border">
          <button
            type="button"
            onClick={() => setPaperWidth(58)}
            className={`px-2.5 py-1 text-[9px] font-semibold rounded cursor-pointer transition-colors ${
              paperWidth === 58 ? "bg-white text-violet shadow-sm" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            58 мм
          </button>
          <button
            type="button"
            onClick={() => setPaperWidth(80)}
            className={`px-2.5 py-1 text-[9px] font-semibold rounded cursor-pointer transition-colors ${
              paperWidth === 80 ? "bg-white text-violet shadow-sm" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            80 мм
          </button>
        </div>
      </div>

      {/* Receipt Emulator container */}
      <div
        style={{ maxWidth: paperWidth === 58 ? "260px" : "340px" }}
        className="w-full rounded-2xl bg-white border border-warm-border shadow-lg p-6 font-mono text-[10px] text-black space-y-3 relative overflow-hidden select-none transition-all duration-300 ease-out border-b-8 border-b-zinc-200"
      >
        {/* Paper tear visual detail */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet/20 via-violet/5 to-violet/20" />

        {/* Company Header */}
        <div className="text-center pb-1 space-y-0.5">
          <h3 className="text-xs font-bold uppercase tracking-wide break-words">{companyName || "НАЗВА КОМПАНІЇ"}</h3>
          <p className="text-[8px] text-gray-500 break-words">{companySubtitle || "Сфера діяльності"}</p>
          <p className="text-[7px] text-gray-400 mt-1 break-words">
            {address || "Адреса"} <br /> {phone || "Телефон"}
          </p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Document Header */}
        <div className="space-y-0.5 text-[8px]">
          {activePreviewTemplate === "sale" && (
            <>
              <p className="font-extrabold">{saleTitle || "ТОВАРНИЙ ЧЕК"} №054E9184</p>
              <p>Дата: 14 червня 2026 о 07:00</p>
              {saleShowSeller && <p className="truncate">Продавець: viktor.koshel24@gmail.com</p>}
            </>
          )}
          {activePreviewTemplate === "repair_acceptance" && (
            <>
              <p className="font-extrabold">{repAccTitle || "КВИТАНЦІЯ ПРИЙМАННЯ"} №3a7b9c1d</p>
              <p>Дата: 14 червня 2026 о 07:00</p>
              {repAccShowSeller && <p className="truncate">Прийняв: Олександр (майстер)</p>}
            </>
          )}
          {activePreviewTemplate === "repair_warranty" && (
            <>
              <p className="font-extrabold">{repWarrTitle || "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ"} №3a7b9c1d</p>
              <p>Дата видачі: 14 червня 2026</p>
              {repWarrShowSeller && <p className="truncate">Видав: Олександр (майстер)</p>}
            </>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Buyer section */}
        {((activePreviewTemplate === "sale" && saleShowBuyer) ||
          (activePreviewTemplate === "repair_acceptance" && repAccShowBuyer) ||
          (activePreviewTemplate === "repair_warranty" && repWarrShowBuyer)) && (
          <>
            <div className="space-y-0.5 text-[8px]">
              <p className="text-gray-400 uppercase font-extrabold text-[7px]">
                {activePreviewTemplate === "sale" ? "Покупець" : "Замовник"}
              </p>
              <p className="font-extrabold">Іванченко Олексій</p>
              <p>+380 93 111 2233</p>
            </div>
            <div className="border-t border-dashed border-gray-400 my-2" />
          </>
        )}

        {/* Items list / Device details */}
        <div className="space-y-1">
          {activePreviewTemplate === "sale" && (
            <>
              <p className="text-[7px] text-gray-400 uppercase font-extrabold">Перелік товарів</p>
              <div className="flex justify-between text-[8px]">
                <span className="truncate max-w-[150px]">Xiaomi Redmi Note 13</span>
                <span>1 x 8 500 ₴</span>
              </div>
              <div className="border-t border-dashed border-gray-300 my-1" />
              <div className="text-right text-[9px] font-extrabold">
                РАЗОМ ДО СПЛАТИ: 8 500 ₴
              </div>
            </>
          )}
          
          {activePreviewTemplate === "repair_acceptance" && (
            <>
              <p className="text-[7px] text-gray-400 uppercase font-extrabold">Інформація про пристрій</p>
              <div className="space-y-0.5 text-[8px]">
                <p><strong>Модель:</strong> iPhone 14 Pro Max</p>
                <p><strong>IMEI/SN:</strong> 358291048291048</p>
                <p><strong>Комплект:</strong> Коробка, кабель, чохол</p>
                <p><strong>Стан:</strong> Grade B (Сліди використання)</p>
                <p className="break-words"><strong>Несправність:</strong> Розбите скло екрану, немає зображення</p>
              </div>
            </>
          )}

          {activePreviewTemplate === "repair_warranty" && (
            <>
              <p className="text-[7px] text-gray-400 uppercase font-extrabold">Деталі ремонту</p>
              <div className="space-y-0.5 text-[8px]">
                <p><strong>Модель:</strong> iPhone 14 Pro Max</p>
                <p className="break-words"><strong>Виконано:</strong> Заміна дисплейного модуля (Original)</p>
                <p><strong>Сума до сплати:</strong> 6 500 ₴ (Сплачено)</p>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Warranty terms text */}
        <div className="space-y-1">
          <p className="text-[7px] text-gray-400 uppercase font-extrabold">
            {activePreviewTemplate === "repair_acceptance" ? "Умови ремонту" : "Гарантійні зобов'язання"}
          </p>
          {activePreviewTemplate === "sale" && (
            <>
              <p className="font-extrabold text-[8px]">Гарантія дійсна до: 14.12.2026</p>
              <p className="text-[7px] text-gray-600 leading-normal whitespace-pre-wrap break-words">
                {saleWarrantyText || "Умови гарантії..."}
              </p>
            </>
          )}
          {activePreviewTemplate === "repair_acceptance" && (
            <p className="text-[7px] text-gray-600 leading-normal whitespace-pre-wrap break-words">
              {repAccWarrantyText || "Умови ремонту..."}
            </p>
          )}
          {activePreviewTemplate === "repair_warranty" && (
            <>
              <p className="font-extrabold text-[8px] text-violet">Термін гарантії: 3 міс.</p>
              <p className="text-[7px] text-gray-600 leading-normal whitespace-pre-wrap break-words">
                {repWarrWarrantyText || "Умови гарантії на ремонт..."}
              </p>
            </>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Signatures */}
        {(activePreviewTemplate === "repair_acceptance" || activePreviewTemplate === "repair_warranty") && (
          <>
            <div className="pt-1 grid grid-cols-2 gap-4 text-center text-[7px] text-black">
              <div>
                <p>{activePreviewTemplate === "repair_acceptance" ? "Здав (підпис)" : "Отримав (підпис)"}</p>
                <p className="mt-3 font-bold">___________</p>
              </div>
              <div>
                <p>{activePreviewTemplate === "repair_acceptance" ? "Прийняв (підпис)" : "Видав (підпис)"}</p>
                <p className="mt-3 font-bold">___________</p>
              </div>
            </div>
            <div className="border-t border-dashed border-gray-400 my-2" />
          </>
        )}

        {/* Footer info & QR */}
        <div className="flex flex-col items-center justify-center text-center pt-1 space-y-1.5">
          {((activePreviewTemplate === "sale" && saleShowQr) ||
            (activePreviewTemplate === "repair_acceptance" && repAccShowQr) ||
            (activePreviewTemplate === "repair_warranty" && repWarrShowQr)) && (
            <div className="w-12 h-12 border border-gray-300 flex items-center justify-center bg-gray-50 text-[7px] text-gray-400">
              [QR]
            </div>
          )}
          <div className="text-[7px] text-gray-500 leading-tight whitespace-pre-wrap break-words">
            {footerText}
          </div>
        </div>
      </div>
    </div>
  );
}
