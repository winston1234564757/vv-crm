"use client";

import { useState } from "react";
import SearchSelect from "@/components/ui/SearchSelect";
import { validatePhone, validateEmail } from "@/lib/validation/validation";

interface Customer {
  id: string;
  name: string;
  phone: string;
  discount_percent: number;
}

interface SaleFormCustomerSectionProps {
  customers: Customer[];
  selectedCustomerId: string;
  onChange: (id: string) => void;
  showNewCustomer: boolean;
  setShowNewCustomer: (show: boolean) => void;
  newCustName: string;
  setNewCustName: (val: string) => void;
  newCustPhone: string;
  setNewCustPhone: (val: string) => void;
  newCustEmail: string;
  setNewCustEmail: (val: string) => void;
  onCreateCustomer: () => void;
  custError: string;
}

export default function SaleFormCustomerSection({
  customers,
  selectedCustomerId,
  onChange,
  showNewCustomer,
  newCustName,
  setNewCustName,
  newCustPhone,
  setNewCustPhone,
  newCustEmail,
  setNewCustEmail,
  onCreateCustomer,
  custError,
}: SaleFormCustomerSectionProps) {
  return (
    <div>
      <SearchSelect
        label="Клієнт (опціонально)"
        name="customer_id"
        options={[
          { id: "", label: "Не вказано" },
          ...customers.map((c) => ({
            id: c.id,
            label: `${c.name} (${c.phone})`,
            subLabel:
              c.discount_percent > 0 ? `Знижка ${c.discount_percent}%` : undefined,
          })),
          { id: "__new__", label: "+ Новий клієнт" },
        ]}
        value={selectedCustomerId}
        onChange={onChange}
        placeholder="Не вказано"
      />

      {showNewCustomer && (
        <NewCustomerFields
          newCustName={newCustName}
          setNewCustName={setNewCustName}
          newCustPhone={newCustPhone}
          setNewCustPhone={setNewCustPhone}
          newCustEmail={newCustEmail}
          setNewCustEmail={setNewCustEmail}
          onCreateCustomer={onCreateCustomer}
          custError={custError}
        />
      )}
    </div>
  );
}

interface NewCustomerFieldsProps {
  newCustName: string;
  setNewCustName: (val: string) => void;
  newCustPhone: string;
  setNewCustPhone: (val: string) => void;
  newCustEmail: string;
  setNewCustEmail: (val: string) => void;
  onCreateCustomer: () => void;
  custError: string;
}

function NewCustomerFields({
  newCustName,
  setNewCustName,
  newCustPhone,
  setNewCustPhone,
  newCustEmail,
  setNewCustEmail,
  onCreateCustomer,
  custError,
}: NewCustomerFieldsProps) {
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  // Derived error states
  const nameError = nameTouched && !newCustName.trim() ? "Ім'я є обов'язковим" : null;
  const phoneError = phoneTouched ? validatePhone(newCustPhone) : null;
  const emailError = emailTouched ? validateEmail(newCustEmail) : null;

  const hasErrors =
    !newCustName.trim() ||
    !newCustPhone.trim() ||
    validatePhone(newCustPhone) !== null ||
    validateEmail(newCustEmail) !== null;

  return (
    <div className="mt-3 rounded-xl border border-violet/20 bg-violet/5 p-4 space-y-3">
      <p className="text-xs font-medium text-text-secondary">Новий клієнт</p>
      
      <div>
        <input
          value={newCustName}
          onChange={(e) => {
            setNewCustName(e.target.value);
            setNameTouched(true);
          }}
          onBlur={() => setNameTouched(true)}
          placeholder="Ім'я *"
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-text-primary outline-none transition-colors ${
            nameError ? "border-rose focus:border-rose" : "border-iris/20 focus:border-violet"
          }`}
        />
        {nameError && (
          <span className="text-xs text-rose mt-1 block">{nameError}</span>
        )}
      </div>

      <div>
        <input
          value={newCustPhone}
          onChange={(e) => {
            setNewCustPhone(e.target.value);
            setPhoneTouched(true);
          }}
          onBlur={() => setPhoneTouched(true)}
          placeholder="Телефон *"
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-text-primary outline-none transition-colors ${
            phoneError ? "border-rose focus:border-rose" : "border-iris/20 focus:border-violet"
          }`}
        />
        {phoneError && (
          <span className="text-xs text-rose mt-1 block">{phoneError}</span>
        )}
      </div>

      <div>
        <input
          value={newCustEmail}
          onChange={(e) => {
            setNewCustEmail(e.target.value);
            setEmailTouched(true);
          }}
          onBlur={() => setEmailTouched(true)}
          placeholder="Email (опціонально)"
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-text-primary outline-none transition-colors ${
            emailError ? "border-rose focus:border-rose" : "border-iris/20 focus:border-violet"
          }`}
        />
        {emailError && (
          <span className="text-xs text-rose mt-1 block">{emailError}</span>
        )}
      </div>

      {custError && (
        <div className="text-xs text-rose bg-rose/10 p-2.5 rounded-lg">
          {custError}
        </div>
      )}

      <button
        type="button"
        onClick={onCreateCustomer}
        disabled={hasErrors}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Створити клієнта
      </button>
    </div>
  );
}
