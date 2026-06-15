"use client";

import { useState } from "react";
import { useSaleForm, UseSaleFormProps } from "./sale/useSaleForm";
import SaleFormCategorySelector from "./sale/SaleFormCategorySelector";
import SaleFormItemSelector from "./sale/SaleFormItemSelector";
import SaleFormCustomerSection from "./sale/SaleFormCustomerSection";
import SaleFormExtraDetails from "./sale/SaleFormExtraDetails";
import SaleFormPaymentFields from "./sale/SaleFormPaymentFields";
import SaleFormDeliveryFields from "./sale/SaleFormDeliveryFields";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";

export function SaleForm(props: UseSaleFormProps) {
  const form = useSaleForm(props);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  if (form.createdSaleId) {
    const customer = form.localCustomers.find(c => c.id === form.selectedCustomerId);
    const customerName = customer ? customer.name : "Роздрібний покупець";
    const customerPhone = customer ? customer.phone : "";
    
    let printedItemName = "Товар";
    if (form.category === "device") {
      const d = form.inStockDevices.find((x) => x.id === form.itemId);
      printedItemName = d ? `${d.brand} ${d.model}` : "Пристрій";
    } else if (form.category === "accessory") {
      const a = form.activeAccessories.find((x) => x.id === form.itemId);
      printedItemName = a ? a.name : "Аксесуар";
    } else if (form.category === "service") {
      if (form.itemId === "__custom__") {
        const customInput = document.getElementById("item_name") as HTMLInputElement;
        printedItemName = customInput?.value || "Послуга (вручну)";
      } else {
        const s = form.activeServices.find((x) => x.id === form.itemId);
        printedItemName = s ? s.name : "Послуга";
      }
    }

    const handlePrintReceipt = () => {
      setIsPrintModalOpen(true);
    };

    const formattedDate = format(new Date(), "dd MMMM yyyy 'о' HH:mm", { locale: uk });

    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 animate-entry">
        {/* Animated Checkmark Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald/10 text-emerald animate-bounce">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-text-primary">Продаж успішно проведено!</h2>
          <p className="text-xs text-text-secondary mt-1">Транзакція зареєстрована в системі</p>
        </div>

        {/* Short Breakdown */}
        <div className="w-full rounded-2xl bg-warm-bg border border-warm-border p-4 text-left space-y-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-text-secondary">Номер чеку:</span>
            <span className="font-mono font-bold text-text-primary">#{form.createdSaleId.substring(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Товар:</span>
            <span className="font-medium text-text-primary truncate max-w-[200px] text-right" title={printedItemName}>{printedItemName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Покупець:</span>
            <span className="font-medium text-text-primary">{customerName}</span>
          </div>
          <div className="flex justify-between border-t border-warm-border/50 pt-2 text-sm">
            <span className="font-semibold text-text-primary">Сума:</span>
            <span className="font-extrabold text-violet">{parseFloat(form.amount).toLocaleString()} ₴</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handlePrintReceipt}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-hover cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Роздрукувати чек</span>
          </button>
          
          <button
            type="button"
            onClick={form.resetForm}
            className="btn-press w-full rounded-xl bg-white border border-warm-border hover:bg-warm-hover py-3 text-sm font-medium text-text-primary transition-colors cursor-pointer"
          >
            Новий продаж
          </button>

          <button
            type="button"
            onClick={form.onSuccess}
            className="btn-press w-full py-2.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            Закрити вікно
          </button>
        </div>

        {/* ============================================================== */}
        {/* INTERACTIVE WYSIWYG RECEIPT PRINT MODAL */}
        {/* ============================================================== */}
        <ReceiptPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          type="sale"
          data={{
            id: form.createdSaleId,
            customer_name: customerName,
            customer_phone: customerPhone,
            seller_name: "Адміністратор",
            items: [{
              name: printedItemName,
              quantity: 1,
              unit_price: parseFloat(form.amount),
              total_price: parseFloat(form.amount)
            }],
            total_amount: parseFloat(form.amount),
            discount: form.discount,
            warranty_end: form.warrantyEnd,
            register_name: form.getAutoRegisterName()
          }}
        />
      </div>
    );
  }


  return (
    <form action={form.formAction} className="flex flex-col gap-5 p-5">
      {(form.state.error || form.custError) && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {form.state.error || form.custError}
        </div>
      )}

      <SaleFormCategorySelector category={form.category} onChange={form.handleCategoryChange} />

      <SaleFormItemSelector
        category={form.category}
        itemId={form.itemId}
        handleItemSelect={form.handleItemSelect}
        activeAccessories={form.activeAccessories}
        inStockDevices={form.inStockDevices}
        activeServices={form.activeServices}
      />

      <SaleFormCustomerSection
        customers={form.localCustomers}
        selectedCustomerId={form.selectedCustomerId}
        onChange={form.handleCustomerSelect}
        showNewCustomer={form.showNewCustomer}
        setShowNewCustomer={form.setShowNewCustomer}
        newCustName={form.newCustName}
        setNewCustName={form.setNewCustName}
        newCustPhone={form.newCustPhone}
        setNewCustPhone={form.setNewCustPhone}
        newCustEmail={form.newCustEmail}
        setNewCustEmail={form.setNewCustEmail}
        onCreateCustomer={form.handleCreateCustomer}
        custError={form.custError}
      />

      <SaleFormExtraDetails
        promoCode={form.promoCode}
        setPromoCode={form.setPromoCode}
        promoMessage={form.promoMessage}
        handleCheckPromo={form.handleCheckPromo}
        warrantyStart={form.warrantyStart}
        setWarrantyStart={form.setWarrantyStart}
        warrantyEnd={form.warrantyEnd}
        setWarrantyEnd={form.setWarrantyEnd}
      />

      <SaleFormPaymentFields
        amount={form.amount}
        onAmountChange={form.handleAmountChange}
        discount={form.discount}
        isSplit={form.isSplit}
        setIsSplit={form.setIsSplit}
        cashAmount={form.cashAmount}
        onCashAmountChange={form.handleCashAmountChange}
        cardAmount={form.cardAmount}
        onCardAmountChange={form.handleCardAmountChange}
        remainingSplit={form.remainingSplit}
      />

      <div className="rounded-xl bg-iris/5 border border-iris/10 px-4 py-3 text-xs text-text-secondary flex items-center justify-between">
        <span>Каса зарахування:</span>
        <span className="font-semibold text-text-primary">{form.getAutoRegisterName()}</span>
      </div>

      <SaleFormDeliveryFields
        deliveryNeeded={form.deliveryNeeded}
        setDeliveryNeeded={form.setDeliveryNeeded}
        deliveryAddress={form.deliveryAddress}
        setDeliveryAddress={form.setDeliveryAddress}
        deliveryTracking={form.deliveryTracking}
        setDeliveryTracking={form.setDeliveryTracking}
      />

      <button
        type="submit"
        disabled={form.pending || (form.isSplit && form.remainingSplit !== 0)}
        aria-describedby={form.isSplit && form.remainingSplit !== 0 ? "split-payment-error" : undefined}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 btn-press cursor-pointer disabled:cursor-not-allowed"
      >
        {form.pending ? <span className="animate-pulse opacity-60">Зачекайте...</span> : "Провести продаж"}
      </button>
    </form>
  );
}