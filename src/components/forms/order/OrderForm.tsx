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
import { IconPlus, IconDelete } from "@/components/icons";
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

interface ItemRow {
  key: string;
  item_type: OrderItemType;
  item_name: string;
  item_url: string;
  unit_price: string;
  quantity: string;
}

const money = (n: number) => `${n.toLocaleString("uk-UA")} грн`;
const newKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const blankItem = (): ItemRow => ({
  key: newKey(),
  item_type: "device",
  item_name: "",
  item_url: "",
  unit_price: "",
  quantity: "1",
});

export function OrderForm({ customers, onSuccess }: OrderFormProps) {
  const initialState: ActionState<CreatedClientOrder> = { success: false, error: "" };
  const [state, formAction, pending] = useActionState(createClientOrder, initialState);

  // --- клієнт ---
  // `customers` довантажується батьком уже ПІСЛЯ монтування форми — не копіюємо
  // проп у стан (інакше список лишиться порожнім). Тримаємо лише щойно створених.
  const [createdCustomers, setCreatedCustomers] = useState<Customer[]>([]);
  const allCustomers = [...customers, ...createdCustomers];
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [custError, setCustError] = useState("");

  // --- товари ---
  const [items, setItems] = useState<ItemRow[]>([blankItem()]);

  // --- оплата/деталі (заголовок) ---
  const [deposit, setDeposit] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");

  // Видимість чека виводимо прямо зі стану екшена (жодного setState в ефекті).
  const [receiptDismissed, setReceiptDismissed] = useState(false);

  const lineTotal = (it: ItemRow) => (parseInt(it.unit_price, 10) || 0) * (parseInt(it.quantity, 10) || 0);
  const total = items.reduce((s, it) => s + lineTotal(it), 0);
  const depositNum = parseInt(deposit, 10) || 0;
  const remaining = Math.max(0, total - depositNum);

  const depositError =
    depositNum > total ? "Аванс не може перевищувати підсумок" : deposit ? validatePrice(deposit) : null;

  const itemsValid = items.every(
    (it) => it.item_name.trim().length >= 2 && validatePrice(it.unit_price || 0) === null,
  );

  const selectedCustomer = allCustomers.find((c) => c.id === selectedCustomerId);
  const hasErrors = !selectedCustomerId || !itemsValid || depositError !== null;

  const itemsPayload = items.map((it) => ({
    item_type: it.item_type,
    item_name: it.item_name.trim(),
    item_url: it.item_url.trim() || null,
    unit_price: parseInt(it.unit_price, 10) || 0,
    quantity: parseInt(it.quantity, 10) || 1,
  }));

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, blankItem()]);
  }
  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }

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
      setCreatedCustomers((prev) => [...prev, c]);
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
        {/* Позиції та аванс постять через приховані JSON/числові поля. */}
        <input type="hidden" name="items" value={JSON.stringify(itemsPayload)} />
        <input type="hidden" name="deposit" value={depositNum} />

        {/* Клієнт */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">Клієнт</h3>
          <SaleFormCustomerSection
            customers={allCustomers}
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

        {/* Товари */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Товари під замовлення</h3>
            <button
              type="button"
              onClick={addItem}
              className="btn-press inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              <IconPlus size={14} /> Додати товар
            </button>
          </div>

          {items.map((it, idx) => (
            <div key={it.key} className="animate-entry rounded-[var(--radius-md)] border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Позиція {idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="Прибрати позицію"
                  >
                    <IconDelete size={14} />
                  </button>
                )}
              </div>

              <Select
                label="Категорія"
                value={it.item_type}
                onChange={(e) => updateItem(it.key, { item_type: e.target.value as OrderItemType })}
                options={optionsOf(orderItemType)}
              />

              <Input
                label="Назва / опис товару"
                value={it.item_name}
                onChange={(e) => updateItem(it.key, { item_name: e.target.value })}
                placeholder="Напр. iPhone 15 Pro 256GB Natural Titanium"
                required
              />

              <Input
                label="Посилання на товар"
                type="url"
                value={it.item_url}
                onChange={(e) => updateItem(it.key, { item_url: e.target.value })}
                placeholder="https://..."
                hint="Опціонально — картка товару у постачальника (не друкується в чеку)"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Ціна за одиницю, грн"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={it.unit_price}
                  onChange={(e) => updateItem(it.key, { unit_price: e.target.value })}
                  placeholder="0"
                />
                <Input
                  label="Кількість"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                  placeholder="1"
                />
              </div>

              {lineTotal(it) > 0 && (
                <p className="text-right text-xs text-muted">
                  Сума позиції: <span className="tabular font-medium text-ink">{money(lineTotal(it))}</span>
                </p>
              )}
            </div>
          ))}
        </section>

        {/* Оплата та деталі */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-ink">Оплата та терміни</h3>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Аванс, грн"
              type="number"
              inputMode="numeric"
              min={0}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="0"
              error={depositError ?? undefined}
              hint="Якщо > 0 — потрапляє в касу"
            />
            <Input
              label="Термін виконання"
              name="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <Textarea
            label="Нотатки"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Колір, конфігурація, домовленості..."
          />
        </section>

        {/* Підсумок */}
        {total > 0 && (
          <div className="animate-entry rounded-[var(--radius-md)] border border-border bg-hover/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Підсумок ({items.length} поз.)</span>
              <span className="tabular font-medium text-ink">{money(total)}</span>
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
          <div className="rounded-[var(--radius-md)] bg-danger/10 p-3 text-sm text-danger">{state.error}</div>
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
            order_items: itemsPayload.map((it) => ({
              item_name: it.item_name,
              quantity: it.quantity,
              unit_price: it.unit_price,
            })),
            agreed_price: total,
            deposit: depositNum,
            deadline: deadline || null,
            order_status: "new",
          }}
        />
      )}
    </>
  );
}
