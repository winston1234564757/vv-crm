"use client";

import { useActionState, useEffect, useState } from "react";
import { createCustomer, updateCustomer } from "@/lib/actions/customers";
import { Input } from "@/components/ui/Input";
import { validatePhone, validateEmail, validateDiscount } from "@/lib/validation/validation";

const initialState = { success: false, error: "" };

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  telegram_id: string | null;
  notes: string | null;
  discount_percent: number;
  vip_status: string | null;
  source: string | null;
  preferred_contact: string | null;
  tags: string[] | string | null;
}

interface CustomerFormProps {
  onSuccess: () => void;
  customer?: Customer;
}

export function CustomerForm({ onSuccess, customer }: CustomerFormProps) {
  const action = customer ? updateCustomer.bind(null, customer.id) : createCustomer;
  const [state, actionFn, pending] = useActionState(action, initialState);

  // Values state
  const [name, setName] = useState(customer?.name ?? "");
  const [phoneState, setPhoneState] = useState(customer?.phone ?? "");
  const [discountPercent, setDiscountPercent] = useState(customer?.discount_percent.toString() ?? "0");
  const [email, setEmail] = useState(customer?.email ?? "");

  // Touched state
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [discountTouched, setDiscountTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  // Derived error states
  const nameError = nameTouched && !name.trim() ? "Ім'я клієнта є обов'язковим" : null;
  const phoneError = phoneTouched ? validatePhone(phoneState) : null;
  const discountError = discountTouched ? validateDiscount(discountPercent) : null;
  const emailError = emailTouched ? validateEmail(email) : null;

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  const hasErrors =
    !name.trim() ||
    !phoneState.trim() ||
    validatePhone(phoneState) !== null ||
    validateDiscount(discountPercent) !== null ||
    validateEmail(email) !== null;

  return (
    <form action={actionFn} className="space-y-4">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>
      )}

      <Input
        label="Ім'я клієнта"
        name="name"
        required
        placeholder="Олександр"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameTouched(true);
        }}
        onBlur={() => setNameTouched(true)}
        error={nameTouched && nameError ? nameError : undefined}
      />
      
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Телефон"
          name="phone"
          required
          placeholder="+380991234567"
          value={phoneState}
          onChange={(e) => {
            setPhoneState(e.target.value);
            setPhoneTouched(true);
          }}
          onBlur={() => setPhoneTouched(true)}
          error={phoneTouched && phoneError ? phoneError : undefined}
        />
        <Input
          label="Постійна знижка (%)"
          name="discount_percent"
          type="number"
          min="0"
          max="100"
          value={discountPercent}
          onChange={(e) => {
            setDiscountPercent(e.target.value);
            setDiscountTouched(true);
          }}
          onBlur={() => setDiscountTouched(true)}
          error={discountTouched && discountError ? discountError : undefined}
          required
        />
      </div>
      
      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="email@example.com (опціонально)"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setEmailTouched(true);
        }}
        onBlur={() => setEmailTouched(true)}
        error={emailTouched && emailError ? emailError : undefined}
      />
      
      <Input
        label="Telegram ID"
        name="telegram_id"
        placeholder="@username (опціонально)"
        defaultValue={customer?.telegram_id ?? ""}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="vip_status" className="mb-1.5 block text-xs font-medium text-text-secondary">
            VIP Статус
          </label>
          <select
            id="vip_status"
            name="vip_status"
            defaultValue={customer?.vip_status ?? "regular"}
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet"
          >
            <option value="regular">Звичайний</option>
            <option value="silver">Срібний</option>
            <option value="gold">Золотий</option>
            <option value="platinum">Платінум</option>
          </select>
        </div>
        <div>
          <label htmlFor="source" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Звідки прийшов
          </label>
          <select
            id="source"
            name="source"
            defaultValue={customer?.source ?? "walk_in"}
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet"
          >
            <option value="walk_in">Візит</option>
            <option value="referral">Рекомендація</option>
            <option value="social">Соцмережі</option>
            <option value="online">Онлайн</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="preferred_contact" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Бажаний спосіб зв&apos;язку
          </label>
          <select
            id="preferred_contact"
            name="preferred_contact"
            defaultValue={customer?.preferred_contact ?? "phone"}
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet"
          >
            <option value="phone">Телефон</option>
            <option value="telegram">Telegram</option>
            <option value="viber">Viber</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div>
          <label htmlFor="tags" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Теги (через кому)
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            placeholder="постійний, оптовик, перевірений"
            defaultValue={customer?.tags ?? ""}
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet"
          />
        </div>
      </div>

      <div className="w-full">
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Примітки</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={customer?.notes ?? ""}
          className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
          placeholder="Додаткова інформація..."
        />
      </div>

      <button
        type="submit"
        disabled={pending || hasErrors}
        className="btn-press mt-4 w-full rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Збереження..." : customer ? "Зберегти зміни" : "Зберегти клієнта"}
      </button>
    </form>
  );
}
