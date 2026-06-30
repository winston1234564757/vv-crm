export const typeLabels: Record<string, string> = { 
  phone: "Телефон", 
  tablet: "Планшет", 
  laptop: "Ноутбук", 
  watch: "Годинник", 
  other: "Інше" 
};

export const sourceLabels: Record<string, string> = {
  supplier: "Постачальник", 
  trade_in: "Trade-In", 
  buyout: "Викуп",
  olx: "OLX", 
  marketplace: "Маркетплейс", 
  customer_return: "Повернення", 
  other: "Інше",
};

export const conditionLabels: Record<string, string> = {
  perfect: "Grade A (Ідеальний)", 
  good: "Grade B (Хороший)", 
  fair: "Grade C (Середній)", 
  poor: "Поганий",
  damaged: "Під ремонт / Пошкоджений",
};

export const conditionColors: Record<string, string> = {
  perfect: "text-cyan bg-cyan/10", 
  good: "text-violet bg-violet/10", 
  fair: "text-amber bg-amber/10", 
  poor: "text-rose bg-rose/10",
  damaged: "text-rose bg-rose/10",
};

export const statusColors: Record<string, string> = { 
  in_stock: "var(--color-cyan)", 
  transit: "var(--color-violet)",
  sold: "var(--color-iris)", 
  service: "var(--color-amber)", 
  returned: "var(--color-rose)", 
  archived: "var(--color-iris)" 
};

export const statusLabels: Record<string, string> = { 
  in_stock: "В наявності", 
  transit: "В дорозі",
  sold: "Продано", 
  service: "В ремонті", 
  returned: "Повернення", 
  archived: "Архів" 
};
