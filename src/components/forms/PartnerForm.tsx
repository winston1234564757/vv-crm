"use client";

import { useActionState, useEffect, useState } from "react";
import { createPartner, updatePartner } from "@/lib/actions/partners";

interface PartnerData {
  id?: string;
  name: string;
  phone: string;
  promo_code: string;
  discount_percent: number;
  reward_percent: number;
  status: "active" | "inactive";
}

export function PartnerForm({ partner, onSuccess }: { partner?: PartnerData; onSuccess: () => void }) {
  const isEditing = !!partner?.id;
  const initialState = { success: false, error: "" };
  
  // Прив'язка action до update або create
  const formActionFn = isEditing ? updatePartner.bind(null, partner.id!) : createPartner;
  const [state, formAction, pending] = useActionState(formActionFn, initialState);

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const [promoCode, setPromoCode] = useState(partner?.promo_code || "");

  function generatePromo() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "VVC-";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPromoCode(code);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-text-secondary">Назва магазину або ПІБ</label>
        <input 
          id="name" 
          name="name" 
          required 
          defaultValue={partner?.name} 
          placeholder="Наприклад: ITech Store" 
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet" 
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-xs font-medium text-text-secondary">Номер телефону</label>
        <input 
          id="phone" 
          name="phone" 
          required 
          defaultValue={partner?.phone} 
          placeholder="+380..." 
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet" 
        />
      </div>

      <div>
        <label htmlFor="promo_code" className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-secondary">
          Промокод
          <button type="button" onClick={generatePromo} className="text-violet hover:underline cursor-pointer">
            Згенерувати
          </button>
        </label>
        <input 
          id="promo_code" 
          name="promo_code" 
          required 
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          placeholder="STORE-10" 
          className="w-full uppercase font-mono rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet" 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="discount_percent" className="mb-1.5 block text-xs font-medium text-text-secondary">Знижка клієнту (%)</label>
          <input 
            id="discount_percent" 
            name="discount_percent" 
            type="number" 
            min="0" 
            max="100" 
            required 
            defaultValue={partner?.discount_percent ?? 5} 
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet" 
          />
        </div>
        <div>
          <label htmlFor="reward_percent" className="mb-1.5 block text-xs font-medium text-text-secondary">Відкат партнеру (%)</label>
          <input 
            id="reward_percent" 
            name="reward_percent" 
            type="number" 
            min="0" 
            max="100" 
            required 
            defaultValue={partner?.reward_percent ?? 10} 
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet" 
          />
        </div>
      </div>

      <div>
        <label htmlFor="status" className="mb-1.5 block text-xs font-medium text-text-secondary">Статус</label>
        <select 
          id="status" 
          name="status" 
          defaultValue={partner?.status ?? "active"} 
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet cursor-pointer"
        >
          <option value="active">Активний</option>
          <option value="inactive">Заблокований</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
      >
        {pending ? <span className="animate-pulse opacity-60">Збереження...</span> : (isEditing ? "Зберегти зміни" : "Створити партнера")}
      </button>
    </form>
  );
}
