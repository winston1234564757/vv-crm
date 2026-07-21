"use client";

type Category = "device" | "accessory" | "service";

interface SaleFormCategorySelectorProps {
  category: Category;
  onChange: (cat: Category) => void;
}

export default function SaleFormCategorySelector({
  category,
  onChange,
}: SaleFormCategorySelectorProps) {
  return (
    <div className="flex gap-2 p-1 bg-iris/5 rounded-xl border border-iris/10">
      <label
        className={`flex-1 text-center py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
          category === "accessory"
            ? "bg-surface text-text-primary shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        <input
          type="radio"
          name="item_category"
          value="accessory"
          checked={category === "accessory"}
          onChange={() => onChange("accessory")}
          className="hidden"
        />
        Аксесуар
      </label>
      <label
        className={`flex-1 text-center py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
          category === "device"
            ? "bg-surface text-text-primary shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        <input
          type="radio"
          name="item_category"
          value="device"
          checked={category === "device"}
          onChange={() => onChange("device")}
          className="hidden"
        />
        Техніка
      </label>
      <label
        className={`flex-1 text-center py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
          category === "service"
            ? "bg-surface text-text-primary shadow-sm"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        <input
          type="radio"
          name="item_category"
          value="service"
          checked={category === "service"}
          onChange={() => onChange("service")}
          className="hidden"
        />
        Послуга
      </label>
    </div>
  );
}
