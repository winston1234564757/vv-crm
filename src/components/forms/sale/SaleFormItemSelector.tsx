"use client";

import SearchSelect from "@/components/ui/SearchSelect";

interface Accessory {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface Device {
  id: string;
  brand: string | null;
  model: string | null;
  price: number;
  imei: string | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

interface SaleFormItemSelectorProps {
  category: "device" | "accessory" | "service";
  itemId: string;
  handleItemSelect: (id: string) => void;
  activeAccessories: Accessory[];
  inStockDevices: Device[];
  activeServices: Service[];
}

export default function SaleFormItemSelector({
  category,
  itemId,
  handleItemSelect,
  activeAccessories,
  inStockDevices,
  activeServices,
}: SaleFormItemSelectorProps) {
  return (
    <>
      {category === "accessory" && (
        <SearchSelect
          label="Виберіть аксесуар"
          name="item_id"
          options={activeAccessories.map((a) => ({
            id: a.id,
            label: `${a.name} (${a.price} грн)`,
            subLabel: `Залишок: ${a.stock} шт`,
          }))}
          value={itemId}
          onChange={handleItemSelect}
          placeholder="Оберіть зі списку..."
          required
        />
      )}

      {category === "device" && (
        <SearchSelect
          label="Виберіть техніку"
          name="item_id"
          options={inStockDevices.map((d) => ({
            id: d.id,
            label: `${d.brand} ${d.model} (${d.price} грн)`,
            subLabel: d.imei ? `IMEI: ${d.imei}` : undefined,
          }))}
          value={itemId}
          onChange={handleItemSelect}
          placeholder="Оберіть зі списку..."
          required
        />
      )}

      {category === "service" && (
        <div className="space-y-4">
          <SearchSelect
            label="Виберіть послугу"
            name="item_id"
            options={[
              ...activeServices.map((s) => ({ id: s.id, label: `${s.name} (${s.price} грн)` })),
              { id: "__custom__", label: "Інша послуга (ввести вручну)" },
            ]}
            value={itemId}
            onChange={handleItemSelect}
            placeholder="Оберіть зі списку..."
            required
          />
          {itemId === "__custom__" && (
            <div className="animate-entry">
              <label htmlFor="item_name" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Введіть назву вручну
              </label>
              <input
                id="item_name"
                name="item_name"
                type="text"
                placeholder="Напр. Поклейка скла..."
                className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
                required
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
