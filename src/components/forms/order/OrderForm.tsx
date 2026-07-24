"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import SaleFormCustomerSection from "@/components/forms/sale/SaleFormCustomerSection";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";
import { createClientOrder } from "@/lib/actions/orders";
import { createCustomer } from "@/lib/actions/customers";
import { orderItemType, optionsOf } from "@/lib/domain-labels";
import { validatePrice } from "@/lib/validation/validation";
import type { ActionState } from "@/lib/actions/types";
import type { CreatedClientOrder, OrderItemType } from "@/types/orders";

interface Customer {
  id: string;
  name: string;
  phone: string;
  discount_percent: number;
  notes?: string | null;
}

interface OrderFormProps {
  customers: Customer[];
  onSuccess: () => void;
}

const money = (n: number) => `${n.toLocaleString("uk-UA")} грн`;

export function OrderForm({ customers, onSuccess }: OrderFormProps) {
  const initialState: ActionState<CreatedClientOrder> = { success: false, error: "" };
  const [state, formAction, pending] = useActionState(createClientOrder, initialState);

  // --- клієнт ---
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [custError, setCustError] = useState("");

  // --- товар ---
  const [itemType, setItemType] = useState<OrderItemType>("device");
  const [itemName, setItemName] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");

  // --- чек після створення ---
  // Видимість чека виводимо прямо зі стану екшена (жодного setState в ефекті):
  // успіх → чек відкритий, доки користувач його не закриє.
  const [receiptDismissed, setReceiptDismissed] = useState(false);

  const priceNum = parseInt(agreedPrice, 10) || 0;
  const depositNum = parseInt(deposit, 10) || 0;
  const remaining = Math.max(0, priceNum - depositNum);

  const priceError = agreedPrice ? validatePrice(agreedPrice) : null;
  const depositError =
    depositNum > priceNum ? "Аванс не може перевищувати ціну" : deposit ? validatePrice(deposit) : null;

  const selectedCustomer = localCustomers.find((c) => c.id === selectedCustomerId);
  const hasErrors =
    !selectedCustomerId ||
    itemName.trim().length < 2 ||
    priceError !== null ||
    depositError !== null;

  function handleCustomerSelect(id: string) {
    if (id === "__new__") {
      setShowNewCustomer(true);
      setSelectedCustomerId("");
      return;
    }
    setShowNewCustomer(false);
    setSelectedCustomerId(id);
  }

  async function handleCreateCustomer() {
    if (!newCustName.trim() || !newCustPhone.trim()) return;
    setCustError("");
    const fd = new FormData();
    fd.set("name", newCustName);
    fd.set("phone", newCustPhone);
    fd.set("email", newCustEmail);
    const res = await createCustomer({ success: false, error: "" }, fd);
    if (res.success && res.data) {
      const c = res.data as Customer;
      setLocalCustomers((prev) => [...prev, c]);
      setSelectedCustomerId(c.id);
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
    } else {
      setCustError(res.error || "Помилка створення клієнта");
    }
  }

  return (
    <>
      <form action={formAction} className="space-y-6">
        {/* Клієнт */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">Клієнт</h3>
          <SaleFormCustomerSection
            customers={localCustomers}
            selectedCustomerId={selectedCustomerId}
            onChange={handleCustomerSelect}
            showNewCustomer={showNewCustomer}
            setShowNewCustomer={setShowNewCustomer}
            newCustName={newCustName}
            setNewCustName={setNewCustName}
            newCustPhone={newCustPhone}
            setNewCustPhone={setNewCustPhone}
            newCustEmail={newCustEmail}
            setNewCustEmail={setNewCustEmail}
            onCreateCustomer={handleCreateCustomer}
            custError={custError}
          />
        </section>

        {/* Товар */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-ink">Товар під замовлення</h3>

          <Select
            label="Категорія"
            name="item_type"
            value={itemType}
            onChange={(e) => setItemType(e.target.value as OrderItemType)}
            options={optionsOf(orderItemType)}
          />

          <Input
            label="Назва / опис товару"
            name="item_name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Напр. iPhone 15 Pro 256GB Natural Titanium"
            required
          />

          <Input
            label="Посилання на товар"
            name="item_url"
            type="url"
            value={itemUrl}
            onChange={(e) => setItemUrl(e.target.value)}
            placeholder="https://..."
            hint="Опціонально — напр. картка товару у постачальника (актуально для аксесуарів)"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Узгоджена ціна, грн"
              name="agreed_price"
              type="number"
              inputMode="numeric"
              min={0}
              value={agreedPrice}
              onChange={(e) => setAgreedPrice(e.target.value)}
              placeholder="0"
              error={priceError ?? undefined}
            />
            <Input
              label="Аванс, грн"
              name="deposit"
              type="number"
              inputMode="numeric"
              min={0}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="0"
              error={depositError ?? undefined}
              hint="Якщо > 0 — потрапляє в касу"
            />
          </div>

          <Input
            label="Термін виконання"
            name="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />

          <Textarea
            label="Нотатки"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Колір, конфігурація, домовленості..."
          />
        </section>

        {/* Підсумок */}
        {priceNum > 0 && (
          <div className="animate-entry rounded-[var(--radius-md)] border border-border bg-hover/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Узгоджена ціна</span>
              <span className="tabular font-medium text-ink">{money(priceNum)}</span>
            </div>
            {depositNum > 0 && (
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-muted">Аванс</span>
                <span className="tabular font-medium text-success">− {money(depositNum)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="font-medium text-ink">Залишок до сплати</span>
              <span className="tabular text-base font-semibold text-ink">{money(remaining)}</span>
            </div>
          </div>
        )}

        {state.error && (
          <div className="rounded-[var(--radius-md)] bg-danger/10 p-3 text-sm text-danger">
            {state.error}
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth isLoading={pending} disabled={hasErrors}>
          Оформити замовлення
        </Button>
      </form>

      {state.success && state.data && (
        <ReceiptPrintModal
          isOpen={!receiptDismissed}
          onClose={() => {
            setReceiptDismissed(true);
            onSuccess();
          }}
          type="order"
          data={{
            id: state.data.id,
            order_no: state.data.order_no,
            public_token: state.data.public_token,
            customer_name: selectedCustomer?.name || "Клієнт",
            customer_phone: selectedCustomer?.phone,
            item_type: itemType,
            item_name: itemName,
            item_url: itemUrl || null,
            agreed_price: priceNum,
            deposit: depositNum,
            deadline: deadline || null,
            order_status: "new",
          }}
        />
      )}
    </>
  );
}
