"use client";

import { useState } from "react";
import {
  CODEPAGES,
  canEncode,
  encode,
  type Bytes,
  type Codepage,
} from "@/lib/printer/codec";
import {
  Receipt,
  ascii,
  bold,
  cancelKanjiMode,
  concat,
  feed,
  init,
  qr,
  selectCodepage,
} from "@/lib/printer/escpos";
import {
  PrinterError,
  describe,
  getPairedDevice,
  isWebUsbSupported,
  requestDevice,
  sendToPrinter,
} from "@/lib/printer/transport-webusb";

/**
 * One-off diagnostic page. It answers the two questions that decide whether
 * ESC/POS printing is possible at all, and neither can be answered by reading
 * code or documentation — both have to be printed and looked at:
 *
 *   1. Can WebUSB claim the printer on this machine, or does the Windows
 *      driver hold it?
 *   2. Which `ESC t n` number selects a code page that can render Ukrainian,
 *      and is that page CP1251 or CP1125?
 *
 * Nothing here is wired into the receipt flow. Once the answers are known this
 * page has served its purpose.
 */

/** The letters that separate a Ukrainian-capable page from a Russian one. */
const UKRAINIAN_PROBE = "іІїЇєҐ";

/** `ESC t n` values worth sweeping. Beyond ~47 the tables are vendor-specific junk. */
const DEFAULT_RANGE = { from: 0, to: 47 };

type LogKind = "info" | "ok" | "error";
interface LogEntry {
  kind: LogKind;
  text: string;
}

export default function PrinterProbeClient() {
  const [device, setDevice] = useState<USBDevice | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(DEFAULT_RANGE.from);
  const [to, setTo] = useState(DEFAULT_RANGE.to);
  const [singleN, setSingleN] = useState(0);
  const [singlePage, setSinglePage] = useState<Codepage>("cp1251");

  function say(kind: LogKind, text: string) {
    setLog((prev) => [...prev, { kind, text }]);
  }

  /** Wraps an action so every failure lands in the log instead of the console. */
  async function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    say("info", `→ ${label}`);
    try {
      await action();
    } catch (err) {
      const message = err instanceof PrinterError ? err.message : describe(err);
      say("error", message);
      if (err instanceof PrinterError && err.cause) {
        say("error", `   причина: ${describe(err.cause)}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function connect(anyDevice: boolean) {
    await run(anyDevice ? "вибір будь-якого USB-пристрою" : "вибір принтера", async () => {
      const picked = await requestDevice(anyDevice);
      setDevice(picked);
      say("ok", `Обрано: ${describeDevice(picked)}`);
      for (const detail of describeInterfaces(picked)) say("info", `   ${detail}`);
      say(
        "info",
        "Пристрій обрано, але це ще не доступ. Спробуйте друк — саме там стане видно, чи драйвер відпускає інтерфейс.",
      );
    });
  }

  async function reconnect() {
    await run("пошук раніше спареного пристрою", async () => {
      const paired = await getPairedDevice();
      if (!paired) {
        say("info", "Раніше спарених пристроїв немає — натисніть «Підключити принтер».");
        return;
      }
      setDevice(paired);
      say("ok", `Знайдено: ${describeDevice(paired)}`);
    });
  }

  function requireDevice(): USBDevice {
    if (!device) throw new PrinterError("Спершу підключіть принтер.");
    return device;
  }

  async function printSweep() {
    await run(`друк проби кодових сторінок ${from}–${to}`, async () => {
      const target = requireDevice();
      const payload = buildSweep(from, to);
      await sendToPrinter(target, payload);
      say("ok", "Надіслано. Сфотографуйте стрічку — потрібен рядок, де обидві колонки читаються.");
    });
  }

  async function printSingle() {
    await run(`друк зразка: ESC t ${singleN}, ${singlePage}`, async () => {
      const target = requireDevice();
      await sendToPrinter(target, buildSample(singleN, singlePage));
      say("ok", "Надіслано.");
    });
  }

  async function printFeatures() {
    await run("друк перевірки QR і жирного", async () => {
      const target = requireDevice();
      await sendToPrinter(target, buildFeatureCheck());
      say("ok", "Надіслано. QR має скануватися телефоном.");
    });
  }

  const supported = isWebUsbSupported();

  return (
    <div className="space-y-6">
      {!supported && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          Цей браузер не підтримує WebUSB. Потрібен Chrome або Edge на десктопі — не
          мобільний браузер і не Firefox/Safari.
        </div>
      )}

      <div className="rounded-xl border border-warm-border bg-warm-surface p-4 text-xs text-text-secondary space-y-2">
        <p className="font-bold text-text-primary">Що робить ця сторінка</p>
        <p>
          Перевіряє дві речі, які неможливо дізнатися з коду: чи Chrome взагалі може
          захопити принтер на цій машині, і під яким номером у ньому лежить кодова
          сторінка з українськими літерами.
        </p>
        <p>
          На Windows USB-принтер зазвичай тримає драйвер <code>usbprint.sys</code>. Поки
          він його тримає, друк звідси падатиме з помилкою захоплення інтерфейсу — це
          очікувано, і саме це треба підтвердити.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Action onClick={() => connect(false)} disabled={busy || !supported} primary>
          Підключити принтер
        </Action>
        <Action onClick={() => connect(true)} disabled={busy || !supported}>
          Показати всі пристрої
        </Action>
        <Action onClick={reconnect} disabled={busy || !supported}>
          Знайти спарений
        </Action>
      </div>

      <div className="rounded-xl border border-warm-border p-4 space-y-3">
        <p className="text-xs font-bold text-text-primary">
          Проба кодових сторінок {device ? "" : "— спершу підключіть принтер"}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <NumberField label="від n" value={from} onChange={setFrom} />
          <NumberField label="до n" value={to} onChange={setTo} />
          <Action onClick={printSweep} disabled={busy || !device} primary>
            Друкувати пробу
          </Action>
        </div>
        <p className="text-[11px] text-text-secondary">
          Друкує по рядку на кожне значення <code>ESC t n</code>. У кожному рядку два
          варіанти тих самих літер: <code>A</code> — байти CP1251, <code>B</code> — байти
          CP1125. Потрібен рядок, де хоча б одна колонка читається як{" "}
          <span className="font-bold">{UKRAINIAN_PROBE}</span>. Діапазон 0–47 — це приблизно
          пів метра стрічки.
        </p>
      </div>

      <div className="rounded-xl border border-warm-border p-4 space-y-3">
        <p className="text-xs font-bold text-text-primary">Зразок одного варіанта</p>
        <div className="flex flex-wrap items-end gap-3">
          <NumberField label="ESC t n" value={singleN} onChange={setSingleN} />
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-text-secondary">кодування</span>
            <select
              value={singlePage}
              onChange={(e) => setSinglePage(e.target.value as Codepage)}
              className="rounded-lg border border-warm-border bg-transparent px-3 py-2 text-xs"
            >
              {CODEPAGES.map((page) => (
                <option key={page} value={page}>
                  {page}
                  {canEncode(UKRAINIAN_PROBE, page) ? "" : " (без і/І)"}
                </option>
              ))}
            </select>
          </label>
          <Action onClick={printSingle} disabled={busy || !device}>
            Друкувати зразок
          </Action>
          <Action onClick={printFeatures} disabled={busy || !device}>
            Перевірка QR і жирного
          </Action>
        </div>
        <p className="text-[11px] text-text-secondary">
          Друкує повноцінний рядок української тексту обраним кодуванням — щоб
          переконатися, що читаються не тільки шість тестових літер, а весь алфавіт.
        </p>
      </div>

      <div className="rounded-xl border border-warm-border bg-black/90 p-4 font-mono text-[11px] leading-relaxed text-green-300 max-h-96 overflow-y-auto">
        {log.length === 0 ? (
          <p className="text-white/40">Журнал порожній.</p>
        ) : (
          log.map((entry, i) => (
            <p
              key={i}
              className={
                entry.kind === "error"
                  ? "text-red-400"
                  : entry.kind === "ok"
                    ? "text-green-300"
                    : "text-white/70"
              }
            >
              {entry.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------- payload construction ---------- */

/**
 * One line per `ESC t n`, each carrying the same Ukrainian letters twice: once
 * as CP1251 bytes, once as CP1125 bytes. Whichever column comes out legible
 * identifies both the number and the page family in a single pass.
 *
 * CP866 is not given a column of its own on purpose: it cannot represent і/І at
 * all, so its column would be `?` marks at every n. It stays distinguishable
 * anyway — CP866 and CP1125 differ only at 0xF0..0xF7, so on a CP866 printer
 * the B column renders as Ў/ў where І/і belong. Legible but visibly wrong.
 */
function buildSweep(from: number, to: number): Bytes {
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(255, Math.max(from, to));

  const parts: Bytes[] = [
    init(),
    // Without this every n prints identical CJK and the sweep is meaningless.
    cancelKanjiMode(),
    selectCodepage(0),
    bold(true),
    ascii("== PROBA KODOVYH STORINOK ==\n"),
    bold(false),
    ascii("A = CP1251   B = CP1125\n"),
    ascii("shukajemo: i I ji JI je G\n"),
    ascii("--------------------------------\n"),
  ];

  for (let n = lo; n <= hi; n++) {
    parts.push(
      selectCodepage(n),
      ascii(String(n).padStart(2, "0") + " A "),
      encode(UKRAINIAN_PROBE, "cp1251"),
      ascii(" B "),
      encode(UKRAINIAN_PROBE, "cp1125"),
      ascii("\n"),
    );
  }

  parts.push(
    selectCodepage(0),
    ascii("--------------------------------\n"),
    ascii("kinec probi\n"),
    feed(4),
  );

  return concat(parts);
}

/** A full Ukrainian line in one specific page, to check the whole alphabet. */
function buildSample(n: number, page: Codepage): Bytes {
  const receipt = new Receipt(page);
  receipt
    .init(n)
    .raw(ascii(`ESC t ${n} / ${page}\n`))
    .raw(ascii("--------------------------------\n"))
    .lines([
      "АБВГҐДЕЄЖЗИІЇЙКЛМНОП",
      "РСТУФХЦЧШЩЬЮЯ",
      "абвгґдеєжзиіїйклмноп",
      "рстуфхцчшщьюя",
      "Квитанція приймання №726e411f",
      "Не заряджається. Ціна: 450 грн",
      "Пристрій приймається без",
      "гарантії на інші несправності.",
    ])
    .raw(ascii("--------------------------------\n"))
    .feed(4);
  return receipt.build();
}

/**
 * Native QR plus the emphasis modes the receipt will use. The QR matters most:
 * if `GS ( k` works, the receipt never transfers an image and every module
 * lands on an exact dot boundary.
 */
function buildFeatureCheck(): Bytes {
  return concat([
    init(),
    cancelKanjiMode(),
    selectCodepage(0),
    bold(true),
    ascii("BOLD TEXT SAMPLE\n"),
    bold(false),
    ascii("normal text sample\n"),
    ascii("QR (module size 5):\n"),
    qr("https://example.com/track/probe", 5, "M"),
    ascii("\nQR (module size 3):\n"),
    qr("https://example.com/track/probe", 3, "M"),
    ascii("\n"),
    feed(4),
  ]);
}


/* ---------- diagnostics ---------- */

function describeDevice(device: USBDevice): string {
  const id = `${hex(device.vendorId)}:${hex(device.productId)}`;
  const name = [device.manufacturerName, device.productName].filter(Boolean).join(" ");
  return name ? `${name} (${id})` : id;
}

/** Interface classes matter: class 7 is what a printer should declare. */
function describeInterfaces(device: USBDevice): string[] {
  const out: string[] = [];
  for (const configuration of device.configurations ?? []) {
    for (const iface of configuration.interfaces) {
      for (const alt of iface.alternates) {
        const endpoints = alt.endpoints
          .map((ep) => `${ep.direction}/${ep.type}#${ep.endpointNumber}`)
          .join(", ");
        out.push(
          `iface ${iface.interfaceNumber} class ${alt.interfaceClass}` +
            (alt.interfaceClass === 7 ? " (printer)" : "") +
            ` — [${endpoints || "без ендпоінтів"}]`,
        );
      }
    }
  }
  return out.length ? out : ["дескриптори інтерфейсів недоступні"];
}

function hex(value: number): string {
  return `0x${value.toString(16).padStart(4, "0")}`;
}

/* ---------- small local UI bits ---------- */

function Action({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "btn-press rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed " +
        (primary
          ? "bg-violet text-white hover:bg-violet-hover"
          : "bg-violet/10 text-violet hover:bg-violet/20")
      }
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-text-secondary">{label}</span>
      <input
        type="number"
        min={0}
        max={255}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-lg border border-warm-border bg-transparent px-3 py-2 text-xs"
      />
    </label>
  );
}
