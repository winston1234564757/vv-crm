"use client";

import { useState } from "react";

interface SaleFormDeliveryFieldsProps {
  deliveryNeeded: boolean;
  setDeliveryNeeded: (val: boolean) => void;
  deliveryAddress: string;
  setDeliveryAddress: (val: string) => void;
  deliveryTracking: string;
  setDeliveryTracking: (val: string) => void;
}

export default function SaleFormDeliveryFields({
  deliveryNeeded,
  setDeliveryNeeded,
  deliveryAddress,
  setDeliveryAddress,
  deliveryTracking,
  setDeliveryTracking,
}: SaleFormDeliveryFieldsProps) {
  return (
    <div className="border-t border-warm-border/50 pt-4">
      <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">
        Доставка
      </h3>
      <div className="flex items-center gap-2">
        <input
          id="delivery_needed"
          name="delivery_needed"
          type="checkbox"
          checked={deliveryNeeded}
          onChange={(e) => setDeliveryNeeded(e.target.checked)}
          value="true"
          className="h-5 w-5 rounded border-iris/20 text-violet focus:ring-violet cursor-pointer"
        />
        <label
          htmlFor="delivery_needed"
          className="text-sm font-medium text-text-primary cursor-pointer"
        >
          Потрібна доставка
        </label>
      </div>

      {deliveryNeeded && (
        <DeliveryInputs
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          deliveryTracking={deliveryTracking}
          setDeliveryTracking={setDeliveryTracking}
        />
      )}
    </div>
  );
}

interface DeliveryInputsProps {
  deliveryAddress: string;
  setDeliveryAddress: (val: string) => void;
  deliveryTracking: string;
  setDeliveryTracking: (val: string) => void;
}

function DeliveryInputs({
  deliveryAddress,
  setDeliveryAddress,
  deliveryTracking,
  setDeliveryTracking,
}: DeliveryInputsProps) {
  const [addressTouched, setAddressTouched] = useState(false);

  // Derived error
  const addressError = addressTouched && !deliveryAddress.trim() ? "Адреса доставки є обов'язковою" : null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-4 animate-entry">
      <div>
        <label
          htmlFor="delivery_address"
          className="mb-1.5 block text-xs font-medium text-text-secondary"
        >
          Адреса доставки *
        </label>
        <input
          id="delivery_address"
          name="delivery_address"
          type="text"
          value={deliveryAddress}
          onChange={(e) => {
            setDeliveryAddress(e.target.value);
            setAddressTouched(true);
          }}
          onBlur={() => setAddressTouched(true)}
          placeholder="Місто, відділення НП..."
          className={`w-full rounded-xl border bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors ${
            addressError ? "border-rose focus:border-rose" : "border-iris/20 focus:border-violet"
          }`}
          required
        />
        {addressError && (
          <span className="text-xs text-rose mt-1 block">{addressError}</span>
        )}
      </div>
      <div>
        <label
          htmlFor="delivery_tracking"
          className="mb-1.5 block text-xs font-medium text-text-secondary"
        >
          ТТН доставки
        </label>
        <input
          id="delivery_tracking"
          name="delivery_tracking"
          type="text"
          value={deliveryTracking}
          onChange={(e) => setDeliveryTracking(e.target.value)}
          placeholder="номер ТТН"
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet"
        />
      </div>
    </div>
  );
}
