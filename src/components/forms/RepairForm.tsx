"use client";

import { useActionState, useEffect, useState } from "react";
import { createRepair, searchCompletedRepairs } from "@/lib/actions/repairs";
import { createCustomer } from "@/lib/actions/customers";
import { validatePromoCode } from "@/lib/actions/partners";
import SearchSelect from "@/components/ui/SearchSelect";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import { IconEye, IconEyeOff, IconChevronDown } from "@/components/icons";
import { optionsOf, deviceCondition, repairSource } from "@/lib/domain-labels";
import { downscaleImages } from "@/lib/utils/image";
import { phoneKey } from "@/lib/utils/phone";
import { cn } from "@/lib/utils/cn";

interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string | null;
}

/** What `createRepair` hands back on success. */
interface CreatedRepair {
  id: string;
  tracking_token: string;
  public_token: string;
  issue: string;
  price: number;
}

/** A past repair offered as the one a warranty claim covers. */
interface PastRepair {
  id: string;
  device_name: string | null;
  device_imei: string | null;
  created_at: string | null;
  completed_at: string | null;
  customer?: { id: string } | null;
}

const ISSUE_NODES = [
  { value: "display", label: "Дисплей" },
  { value: "battery", label: "Акумулятор" },
  { value: "charging_port", label: "Порт зарядки" },
  { value: "speaker", label: "Динамік / Мікрофон" },
  { value: "camera", label: "Камера" },
  { value: "button", label: "Кнопки" },
  { value: "housing", label: "Корпус" },
  { value: "water_damage", label: "Волога" },
  { value: "software", label: "Прошивка / ПЗ" },
  { value: "other_node", label: "Інше" },
];

const ISSUE_DIAGNOSTICS = [
  { value: "no_power", label: "Не вмикається" },
  { value: "no_charge", label: "Не заряджається" },
  { value: "no_signal", label: "Не працює зв'язок" },
  { value: "cracked_screen", label: "Розбитий екран" },
  { value: "overheating", label: "Перегрів" },
  { value: "auto_restart", label: "Самостійно перезавантажується" },
  { value: "no_sound", label: "Немає звуку" },
  { value: "other_diag", label: "Інша проблема" },
];

/** Section heading. Space does the grouping; no nested cards. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "btn-press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent text-on-accent"
          : "border-border text-muted hover:border-border-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function RepairForm({
  customers,
  onSuccess,
}: {
  customers: Customer[];
  onSuccess: () => void;
}) {
  const initialState: { success: boolean; error: string; data?: CreatedRepair } = {
    success: false,
    error: "",
  };
  const [state, formAction, pending] = useActionState(action, initialState);

  const [custError, setCustError] = useState("");
  const [custNotice, setCustNotice] = useState("");
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);

  const [isWarranty, setIsWarranty] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [pastRepairs, setPastRepairs] = useState<PastRepair[]>([]);
  const [selectedPastRepairId, setSelectedPastRepairId] = useState("");
  const [pastRepairsLoading, setPastRepairsLoading] = useState(false);
  const [pastRepairsSearch, setPastRepairsSearch] = useState("");

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [deviceName, setDeviceName] = useState("");
  const [deviceImei, setDeviceImei] = useState("");

  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedDiagnostics, setSelectedDiagnostics] = useState<string[]>([]);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Derived, not mirrored into state through an effect. The action result
  // already holds it, and copying it across in a useEffect only adds a render
  // and a chance for the two to disagree.
  const createdData = state.success && state.data?.id ? state.data : null;

  // Every hook must run before the early return below. Four of these used to
  // sit after `if (createdData)`, so the moment a repair was created React
  // rendered fewer hooks than the previous pass and threw error #300 — the
  // repair saved, the form crashed.
  //
  // `source` starts at a value that actually exists in the list. It used to
  // start at "store", which is not one of the options, so the select submitted
  // an empty string and the action's `|| "walk_in"` fallback caught it — which
  // is why all 15 repairs on record read walk_in whatever really happened.
  const [source, setSource] = useState("walk_in");
  const [promoCode, setPromoCode] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [promoMessage, setPromoMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Fully controlled. It used to carry `value` and `defaultValue` at once,
  // both switched on `isWarranty`, so ticking the warranty box flipped the
  // input between controlled and uncontrolled and could drop what was typed.
  const [price, setPrice] = useState("0");

  useEffect(() => {
    if (!isWarranty) return;
    const fetchPastRepairs = async () => {
      setPastRepairsLoading(true);
      const data = await searchCompletedRepairs(selectedCustomerId || null, pastRepairsSearch);
      setPastRepairs(data);
      setPastRepairsLoading(false);
    };
    const timeoutId = setTimeout(fetchPastRepairs, 500);
    return () => clearTimeout(timeoutId);
  }, [isWarranty, selectedCustomerId, pastRepairsSearch]);

  if (createdData) {
    const customer = localCustomers.find((c) => c.id === selectedCustomerId);

    return (
      <div className="animate-entry flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle text-success">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink text-balance">
            Ремонт прийнято
          </h2>
          <p className="mt-1 text-xs text-muted">Пристрій узято в роботу</p>
        </div>

        <div className="w-full space-y-2.5 rounded-[var(--radius-lg)] border border-border bg-bg p-4 text-left text-xs">
          <div className="flex justify-between">
            <span className="text-muted">Клієнт:</span>
            <span className="font-medium text-ink">{customer?.name || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Пристрій:</span>
            <span className="max-w-[200px] truncate text-right font-medium text-ink">{deviceName}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-sm">
            <span className="font-semibold text-ink">Код відстеження:</span>
            <span className="tabular font-semibold tracking-widest text-accent-ink">
              {createdData.tracking_token}
            </span>
          </div>
        </div>

        <div className="w-full space-y-2.5 pt-2">
          <Button fullWidth onClick={() => setIsPrintModalOpen(true)}>
            Роздрукувати квитанцію
          </Button>
          <Button fullWidth variant="secondary" onClick={onSuccess}>
            Закрити
          </Button>
        </div>

        <ReceiptPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          type="repair_acceptance"
          data={{
            id: createdData.id,
            customer_name: customer?.name || "Клієнт",
            customer_phone: customer?.phone || "",
            seller_name: "Адміністратор",
            device_name: deviceName,
            device_imei: deviceImei,
            tracking_token: createdData.tracking_token,
            public_token: createdData.public_token,
            issue: createdData.issue || "Не вказано",
            price: createdData.price || 0,
          }}
        />
      </div>
    );
  }

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleCheckPromo() {
    if (!promoCode.trim()) return;
    setPromoMessage(null);
    const res = await validatePromoCode(promoCode.trim());
    if (res.success && res.partner) {
      setPartnerId(res.partner.id);
      setPromoMessage({
        text: `Знайдено партнера: ${res.partner.name}. Знижка ${res.partner.discount_percent}%`,
        type: "success",
      });
    } else {
      setPartnerId("");
      setPromoMessage({ text: res.error || "Промокод не знайдено", type: "error" });
    }
  }

  async function handleCreateCustomer() {
    if (!newCustName.trim() || !newCustPhone.trim()) return;
    setCustError("");
    setCustNotice("");

    /* Номер уже в базі — беремо наявного клієнта замість спроби створити
       другого. Без цього форма впиралась у глухий кут: телефон унікальний,
       вставка падала на `customers_phone_key`, клієнт не вибирався, і ремонт
       зберегти було неможливо. Найчастіший шлях сюди — коли клієнт у списку
       є, але його там не знайшли й почали заводити заново. */
    const key = phoneKey(newCustPhone);
    const existing = key ? localCustomers.find((c) => phoneKey(c.phone) === key) : undefined;
    if (existing) {
      setSelectedCustomerId(existing.id);
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
      setCustNotice(`Клієнт із цим номером уже є — вибрано «${existing.name}»`);
      return;
    }

    const formData = new FormData();
    formData.set("name", newCustName);
    formData.set("phone", newCustPhone);
    formData.set("email", newCustEmail);
    const res = await createCustomer({ success: false, error: "" }, formData);
    if (res.success && res.data) {
      const created = res.data as Customer;
      setLocalCustomers((prev) => [...prev, created]);
      setSelectedCustomerId(created.id);
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
    } else {
      setCustError(res.error || "Помилка створення клієнта");
    }
  }

  function handleCustomerSelect(id: string) {
    setCustNotice("");
    if (id === "__new__") {
      setShowNewCustomer(true);
      setSelectedCustomerId("");
      return;
    }
    setShowNewCustomer(false);
    setSelectedCustomerId(id);
  }

  function handleSelectPastRepair(e: React.ChangeEvent<HTMLSelectElement>) {
    const rId = e.target.value;
    setSelectedPastRepairId(rId);
    if (!rId) return;
    const r = pastRepairs.find((x) => x.id === rId);
    if (!r) return;
    setDeviceName(r.device_name || "");
    setDeviceImei(r.device_imei || "");
    if (!selectedCustomerId && r.customer?.id) setSelectedCustomerId(r.customer.id);
  }

  async function action(prevState: typeof initialState, formData: FormData) {
    formData.set("issue_nodes", JSON.stringify(selectedNodes));
    formData.set("issue_diagnostics", JSON.stringify(selectedDiagnostics));
    formData.set("device_name", deviceName);
    formData.set("device_imei", deviceImei);
    formData.set("customer_id", selectedCustomerId);
    formData.set("inventory_device_id", "");

    if (partnerId) {
      formData.set("partner_id", partnerId);
      formData.set("promo_code_used", promoCode.trim());
    }

    // Shrink before upload. uploadMediaFiles throws on failure and runs before
    // the insert, so a 5 MB frame over a shop connection could stop the intake
    // from being saved at all.
    const photos = formData
      .getAll("device_condition_photos")
      .filter((f) => f instanceof File && f.size > 0) as File[];
    if (photos.length > 0) {
      const smaller = await downscaleImages(photos);
      formData.delete("device_condition_photos");
      for (const f of smaller) formData.append("device_condition_photos", f);
    }

    const res = await createRepair(null, formData);
    if (res.success) return { success: true, error: "", data: res.data };
    return { success: false, error: res.error || "Сталася помилка" };
  }

  const customerOptions = [
    ...localCustomers.map((c) => ({ id: c.id, label: c.name, subLabel: c.phone })),
    { id: "__new__", label: "+ Новий клієнт" },
  ];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <InlineError message={state.error || custError} onClose={() => setCustError("")} />

      <Section title="Клієнт">
        <SearchSelect
          label="Хто здає пристрій"
          name="customer_id"
          options={customerOptions}
          value={selectedCustomerId}
          onChange={handleCustomerSelect}
          placeholder="Оберіть клієнта..."
          required
        />
        {custNotice && (
          <p className="text-xs text-muted" role="status">
            {custNotice}
          </p>
        )}
        {showNewCustomer && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-bg p-4">
            <p className="text-xs font-medium text-muted">Новий клієнт</p>
            <Input label="Ім'я" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} />
            <Input label="Телефон" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} />
            <Input label="Email" hint="Необов'язково" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} />
            <Button type="button" onClick={handleCreateCustomer} disabled={!newCustName.trim() || !newCustPhone.trim()}>
              Створити клієнта
            </Button>
          </div>
        )}
      </Section>

      <Section title="Пристрій і проблема">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Модель"
            name="device_name"
            required
            autoComplete="off"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Напр. iPhone 13 Pro"
          />
          <Input
            label="IMEI / серійний номер"
            name="device_imei"
            value={deviceImei}
            onChange={(e) => setDeviceImei(e.target.value)}
            placeholder="Необов'язково"
          />
        </div>

        <Textarea
          label="Що не так"
          name="issue"
          required
          rows={3}
          placeholder="Опис зі слів клієнта та що видно при огляді..."
        />

        <div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="btn-press flex items-center gap-1.5 text-xs font-medium text-accent-ink transition-colors hover:text-accent"
          >
            <IconChevronDown
              size={14}
              className={cn("transition-transform", showDetails && "rotate-180")}
            />
            Деталізувати вузол і симптоми
          </button>

          {showDetails && (
            <div className="animate-entry mt-4 flex flex-col gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Вузол</p>
                <div className="flex flex-wrap gap-2">
                  {ISSUE_NODES.map((n) => (
                    <Chip
                      key={n.value}
                      active={selectedNodes.includes(n.value)}
                      onClick={() => toggle(selectedNodes, setSelectedNodes, n.value)}
                    >
                      {n.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Симптоми</p>
                <div className="flex flex-wrap gap-2">
                  {ISSUE_DIAGNOSTICS.map((d) => (
                    <Chip
                      key={d.value}
                      active={selectedDiagnostics.includes(d.value)}
                      onClick={() => toggle(selectedDiagnostics, setSelectedDiagnostics, d.value)}
                    >
                      {d.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Стан при здачі"
        hint="Фіксує, яким апарат прийшов. Це те, чим ви доведете, що подряпина була до вас."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Грейд стану"
            name="device_condition"
            required
            placeholder="Оберіть стан..."
            options={optionsOf(deviceCondition)}
          />
          <Input
            label="Опис стану"
            name="device_condition_description"
            placeholder="Подряпини, сколи, сліди використання..."
          />
        </div>

        <div>
          <label htmlFor="device_condition_photos" className="mb-1.5 block text-xs font-medium text-muted">
            Фото стану
          </label>
          <input
            id="device_condition_photos"
            type="file"
            name="device_condition_photos"
            multiple
            accept="image/*"
            required
            className="w-full text-sm text-ink file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-medium file:text-on-accent"
          />
          <p className="mt-1.5 text-xs text-faint">
            Знімки зменшуються в браузері перед відправкою, тож розмір кадру не має значення.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="device_password" className="mb-1.5 block text-xs font-medium text-muted">
              Пароль пристрою
            </label>
            <div className="relative">
              <input
                id="device_password"
                name="device_password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Якщо потрібен для робіт"
                className="w-full rounded-[var(--radius-md)] border border-border bg-surface py-2.5 pl-3.5 pr-10 text-base text-ink outline-none transition-colors placeholder-faint hover:border-border-strong focus:border-accent md:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Сховати пароль" : "Показати пароль"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
              >
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </div>
          <Input
            label="Комплектація"
            name="device_accessories_included"
            placeholder="Зарядка, чохол, коробка..."
          />
        </div>
      </Section>

      <Section title="Ціна й строк">
        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-bg p-4">
          <Checkbox
            name="is_warranty"
            value="true"
            checked={isWarranty}
            onChange={(e) => {
              setIsWarranty(e.target.checked);
              if (e.target.checked) setPrice("0");
            }}
            className="mt-0.5"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-ink">Гарантійний випадок</span>
            <span className="text-xs text-muted">Вартість буде 0 ₴</span>
          </span>
        </label>

        {isWarranty && (
          <div className="animate-entry flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-bg p-4">
            <p className="text-xs font-medium text-muted">
              {selectedCustomerId ? "Попередній ремонт цього клієнта" : "Знайдіть попередній ремонт"}
            </p>
            {!selectedCustomerId && (
              <Input
                label="Пошук"
                value={pastRepairsSearch}
                onChange={(e) => setPastRepairsSearch(e.target.value)}
                placeholder="Модель, IMEI або проблема..."
              />
            )}
            {pastRepairsLoading ? (
              <p className="text-xs text-muted">Завантаження...</p>
            ) : (
              <Select
                label="Ремонт, який покриває гарантія"
                value={selectedPastRepairId}
                onChange={handleSelectPastRepair}
                placeholder="Оберіть ремонт..."
              >
                {pastRepairs.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.device_name} — {new Date(pr.completed_at || pr.created_at || "").toLocaleDateString("uk-UA")}
                  </option>
                ))}
              </Select>
            )}
            <input type="hidden" name="warranty_for_repair_id" value={selectedPastRepairId} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Орієнтовна вартість, ₴"
            name="price"
            type="number"
            inputMode="numeric"
            min={0}
            value={isWarranty ? "0" : price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={isWarranty}
            required={!isWarranty}
          />
          <Select label="Гарантія" name="warranty_months" defaultValue="3">
            <option value="3">3 місяці</option>
            <option value="6">6 місяців</option>
            <option value="12">12 місяців</option>
          </Select>
          <Input label="Готовність до" name="estimated_completion" type="date" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Звідки звернувся"
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            required
            options={optionsOf(repairSource)}
          />
          {source === "marketplace" && (
            <div className="flex flex-col gap-2">
              <Input
                label="Промокод партнера"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="VVC-XXXX"
                className="uppercase"
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={handleCheckPromo}>
                  Перевірити
                </Button>
                {promoMessage && (
                  <p className={cn("text-xs", promoMessage.type === "success" ? "text-success" : "text-danger")}>
                    {promoMessage.text}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <Textarea
          label="Примітки"
          name="notes"
          rows={2}
          placeholder="Домовленості з клієнтом, деталі, на що звернути увагу..."
        />
      </Section>

      <Button type="submit" size="lg" fullWidth isLoading={pending}>
        Прийняти в ремонт
      </Button>
    </form>
  );
}
