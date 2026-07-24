/**
 * Turns a receipt into ESC/POS bytes for the XP-58.
 *
 * Split in two on purpose. `composeReceipt` arranges the document into blocks
 * of plain text and returns them; `renderBlocks` turns blocks into bytes. The
 * arrangement is where the mistakes live — a line one character too wide, a
 * total that lost its label, a device taken in without its IMEI on the slip —
 * and keeping it as strings means those are asserted directly in tests rather
 * than inferred from a byte stream.
 *
 * The values here are the ones the operator sees and can edit in the print
 * dialog, not the raw database row. Whatever the preview shows is what prints.
 */

import { type Bytes, type Codepage } from "./codec";
import {
  Receipt,
  align as alignCmd,
  bold as boldCmd,
  concat,
  feed as feedCmd,
  cut as cutCmd,
  line as lineCmd,
  qr as qrCmd,
  size as sizeCmd,
  type Align,
} from "./escpos";
import { DEFAULT_WIDTH, alignRight, divider, itemLines, labelValue, money, wrap } from "./layout";
import {
  getCounterpartyLabel,
  getPartyLabel,
  getSignatureLabels,
  getWarrantyHeading,
  type ReceiptType,
} from "./receipt-content";

export interface ReceiptCompany {
  name: string;
  subtitle: string;
  address: string;
  phone: string;
}

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptDevice {
  name: string;
  imei?: string;
  accessories?: string;
  condition?: string;
}

/** A receipt after the operator's edits, ready to print. */
export interface ResolvedReceipt {
  type: ReceiptType;
  /** Full id; only the first eight characters are printed. */
  id: string;
  /** Already formatted for display — this module does no date handling. */
  date: string;
  company: ReceiptCompany;
  title: string;
  footerText: string;

  showSeller: boolean;
  showBuyer: boolean;
  showQr: boolean;
  qrData: string;

  customerName: string;
  customerPhone?: string;
  employeeName: string;
  registerName?: string;

  warrantyText: string;

  items?: ReceiptLineItem[];
  totalAmount?: number;
  discount?: number;

  device?: ReceiptDevice;
  issue?: string;
  repairItems?: ReceiptLineItem[];
  price?: number;

  /** Present only for `type: "order"`. Labels are pre-resolved by the caller. */
  order?: ReceiptOrder;
}

export interface ReceiptOrder {
  /** Human number, e.g. "0001". Printed instead of the uuid prefix. */
  orderNo: string;
  itemTypeLabel: string;
  itemName: string;
  agreedPrice: number;
  deposit: number;
  remaining: number;
  /** Already formatted, e.g. "31.07.2026". */
  deadline?: string;
  statusLabel: string;
}

export type Block =
  | { kind: "text"; text: string; align?: Align; bold?: boolean; doubleHeight?: boolean }
  | { kind: "divider" }
  | { kind: "blank" }
  | { kind: "qr"; data: string };

export interface PrinterConfig {
  codepage: Codepage;
  /** `ESC t n`. 23 selects CP1251 on this XP-58 — established by the probe. */
  codepageIndex: number;
  columns: number;
  qrModuleSize: number;
  /** Blank lines fed at the end so the text clears the tear bar. */
  feedLines: number;
  /** The base XP-58 has no cutter; only enable where one exists. */
  cut: boolean;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  codepage: "cp1251",
  codepageIndex: 23,
  columns: DEFAULT_WIDTH,
  qrModuleSize: 5,
  feedLines: 4,
  cut: false,
};

/**
 * Stored settings use snake_case like their siblings in the settings row.
 *
 * This shape lives here rather than in `data-settings.ts` on purpose: that
 * module imports the Supabase server client, so a client component reaching for
 * the default value there would drag server-only code into the browser bundle
 * and fail the build. Everything under `lib/printer` is pure and safe on both
 * sides.
 */
export interface StoredPrinterSettings {
  codepage_index: number;
  codepage: Codepage;
  columns: number;
  qr_module_size: number;
  feed_lines: number;
  cut: boolean;
}

export const DEFAULT_PRINTER_SETTINGS: StoredPrinterSettings = {
  codepage_index: 23,
  codepage: "cp1251",
  columns: 32,
  qr_module_size: 5,
  feed_lines: 4,
  cut: false,
};

/**
 * Bridge the stored shape to the runtime one. Kept here so callers never
 * assemble a config by hand and quietly omit a field.
 */
export function toPrinterConfig(stored: Partial<StoredPrinterSettings> | undefined): PrinterConfig {
  if (!stored) return DEFAULT_PRINTER_CONFIG;
  return {
    codepage: stored.codepage ?? DEFAULT_PRINTER_CONFIG.codepage,
    codepageIndex: stored.codepage_index ?? DEFAULT_PRINTER_CONFIG.codepageIndex,
    columns: stored.columns ?? DEFAULT_PRINTER_CONFIG.columns,
    qrModuleSize: stored.qr_module_size ?? DEFAULT_PRINTER_CONFIG.qrModuleSize,
    feedLines: stored.feed_lines ?? DEFAULT_PRINTER_CONFIG.feedLines,
    cut: stored.cut ?? DEFAULT_PRINTER_CONFIG.cut,
  };
}

/* ---------- composition ---------- */

function text(
  value: string,
  options: { align?: Align; bold?: boolean; doubleHeight?: boolean } = {},
): Block {
  return { kind: "text", text: value, ...options };
}

/** Wrapped body text, one block per printed line. */
function body(value: string, columns: number, options: { bold?: boolean } = {}): Block[] {
  return wrap(value, columns).map((l) => text(l, options));
}

/** A bold, full-width section heading. */
function heading(value: string): Block {
  return text(value, { bold: true });
}

export function composeReceipt(receipt: ResolvedReceipt, columns = DEFAULT_WIDTH): Block[] {
  const blocks: Block[] = [];
  const { type } = receipt;

  // Header — the shop, centred. Double height on the name only: it is the one
  // thing a customer needs to identify at a glance in a drawer of receipts.
  blocks.push(text(receipt.company.name, { align: "center", bold: true, doubleHeight: true }));
  for (const value of [
    receipt.company.subtitle,
    receipt.company.address,
    receipt.company.phone,
  ]) {
    if (value) blocks.push(...wrap(value, columns).map((l) => text(l, { align: "center" })));
  }

  blocks.push({ kind: "divider" });

  // Document meta — an order shows its human number, others the uuid prefix.
  const docNo =
    type === "order" && receipt.order ? receipt.order.orderNo : receipt.id.substring(0, 8);
  blocks.push(...body(`${receipt.title} №${docNo}`, columns, { bold: true }));
  blocks.push(...body(`Дата: ${receipt.date}`, columns));
  if (type === "sale" && receipt.registerName) {
    blocks.push(...body(`Каса: ${receipt.registerName}`, columns));
  }
  if (receipt.showSeller) {
    blocks.push(...body(`${getPartyLabel(type)}: ${receipt.employeeName}`, columns));
  }

  if (receipt.showBuyer) {
    blocks.push({ kind: "divider" });
    blocks.push(heading(getCounterpartyLabel(type)));
    blocks.push(...body(receipt.customerName, columns));
    if (receipt.customerPhone) blocks.push(...body(receipt.customerPhone, columns));
  }

  if (type === "sale") {
    blocks.push(...composeSaleBody(receipt, columns));
  } else if (type === "order") {
    blocks.push(...composeOrderBody(receipt, columns));
  } else {
    blocks.push(...composeRepairBody(receipt, columns));
  }

  if (receipt.warrantyText) {
    blocks.push({ kind: "divider" });
    blocks.push(heading(getWarrantyHeading(type)));
    blocks.push(...body(receipt.warrantyText, columns));
  }

  const signatures = getSignatureLabels(type);
  if (signatures.length > 0) {
    blocks.push({ kind: "divider" });
    for (const label of signatures) {
      blocks.push(text(label));
      blocks.push({ kind: "blank" });
      // Short of the full width so the rule cannot wrap to a second line.
      blocks.push(text("_".repeat(Math.min(24, columns))));
      blocks.push({ kind: "blank" });
    }
  }

  if (receipt.showQr && receipt.qrData) {
    blocks.push({ kind: "blank" });
    blocks.push({ kind: "qr", data: receipt.qrData });
  }

  if (receipt.footerText) {
    blocks.push({ kind: "blank" });
    for (const l of wrap(receipt.footerText, columns)) {
      blocks.push(text(l, { align: "center" }));
    }
  }

  return blocks;
}

function composeSaleBody(receipt: ResolvedReceipt, columns: number): Block[] {
  const blocks: Block[] = [{ kind: "divider" }, heading("ПЕРЕЛІК ТОВАРІВ")];

  const items = receipt.items ?? [];
  if (items.length === 0) {
    // Mirrors the preview's placeholder: a sale with no itemisation still has
    // to show what was paid.
    blocks.push(
      ...itemLines("Товар / послуга", 1, receipt.totalAmount ?? 0, receipt.totalAmount ?? 0, columns).map(
        (l) => text(l),
      ),
    );
  } else {
    for (const item of items) {
      blocks.push(
        ...itemLines(item.name, item.quantity, item.unitPrice, item.totalPrice, columns).map((l) =>
          text(l),
        ),
      );
    }
  }

  blocks.push({ kind: "divider" });

  if (receipt.discount && receipt.discount > 0) {
    blocks.push(...labelValue("Знижка:", `${receipt.discount}%`, columns).map((l) => text(l)));
  }

  blocks.push(
    ...labelValue("ДО СПЛАТИ:", `${money(receipt.totalAmount ?? 0)} грн`, columns).map((l) =>
      text(l, { bold: true }),
    ),
  );

  return blocks;
}

function composeOrderBody(receipt: ResolvedReceipt, columns: number): Block[] {
  const order = receipt.order;
  const blocks: Block[] = [{ kind: "divider" }, heading("ЗАМОВЛЕННЯ")];
  if (!order) return blocks;

  blocks.push(...body(`Категорія: ${order.itemTypeLabel}`, columns));
  blocks.push(...body(`Товар: ${order.itemName}`, columns));
  if (order.deadline) blocks.push(...body(`Термін: ${order.deadline}`, columns));
  blocks.push(...body(`Статус: ${order.statusLabel}`, columns));

  blocks.push({ kind: "divider" });
  blocks.push(...labelValue("Ціна:", `${money(order.agreedPrice)} грн`, columns).map((l) => text(l)));

  if (order.deposit > 0) {
    blocks.push(...labelValue("Аванс:", `${money(order.deposit)} грн`, columns).map((l) => text(l)));
    blocks.push(
      ...labelValue("ЗАЛИШОК:", `${money(order.remaining)} грн`, columns).map((l) =>
        text(l, { bold: true }),
      ),
    );
  } else {
    blocks.push(
      ...labelValue("ДО СПЛАТИ:", `${money(order.agreedPrice)} грн`, columns).map((l) =>
        text(l, { bold: true }),
      ),
    );
  }

  return blocks;
}

function composeRepairBody(receipt: ResolvedReceipt, columns: number): Block[] {
  const blocks: Block[] = [{ kind: "divider" }];
  const device = receipt.device;
  const isAcceptance = receipt.type === "repair_acceptance";

  blocks.push(heading(isAcceptance ? "ІНФОРМАЦІЯ ПРО ПРИСТРІЙ" : "ДЕТАЛІ РЕМОНТУ"));

  if (device) {
    blocks.push(...body(`Модель: ${device.name}`, columns));
    if (device.imei) blocks.push(...body(`IMEI/SN: ${device.imei}`, columns));
    if (isAcceptance) {
      if (device.accessories) blocks.push(...body(`Комплект: ${device.accessories}`, columns));
      if (device.condition) blocks.push(...body(`Стан: ${device.condition}`, columns));
    }
  }

  if (receipt.issue) {
    blocks.push({ kind: "divider" });
    blocks.push(heading(isAcceptance ? "ЗАЯВЛЕНА НЕСПРАВНІСТЬ" : "ВИКОНАНІ РОБОТИ"));
    blocks.push(...body(receipt.issue, columns, { bold: true }));
  }

  if (isAcceptance) return blocks;

  const repairItems = receipt.repairItems ?? [];
  if (repairItems.length > 0) {
    blocks.push({ kind: "divider" });
    blocks.push(heading("ДЕТАЛІ ТА РОБОТИ"));
    let total = 0;
    for (const item of repairItems) {
      const lineTotal = item.unitPrice * item.quantity;
      total += lineTotal;
      blocks.push(
        ...itemLines(item.name, item.quantity, item.unitPrice, lineTotal, columns).map((l) =>
          text(l),
        ),
      );
    }
    blocks.push({ kind: "divider" });
    blocks.push(
      ...labelValue("РАЗОМ:", `${money(total)} грн`, columns).map((l) => text(l, { bold: true })),
    );
    blocks.push(text(alignRight("(сплачено)", columns)));
  } else {
    blocks.push({ kind: "divider" });
    blocks.push(
      ...labelValue("ДО СПЛАТИ:", `${money(receipt.price ?? 0)} грн`, columns).map((l) =>
        text(l, { bold: true }),
      ),
    );
    blocks.push(text(alignRight("(сплачено)", columns)));
  }

  return blocks;
}

/* ---------- rendering ---------- */

/** Plain-text rendering of the blocks. Used by tests and for debugging. */
export function renderBlocksAsText(blocks: readonly Block[], columns = DEFAULT_WIDTH): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.kind === "divider") out.push(divider(columns));
    else if (block.kind === "blank") out.push("");
    else if (block.kind === "qr") out.push("[QR]");
    else out.push(block.text);
  }
  return out;
}

export function renderBlocks(blocks: readonly Block[], config: PrinterConfig): Bytes {
  const receipt = new Receipt(config.codepage);
  receipt.init(config.codepageIndex);

  let currentAlign: Align = "left";
  let currentBold = false;
  let currentDouble = false;

  const setAlign = (next: Align) => {
    if (next === currentAlign) return;
    receipt.raw(alignCmd(next));
    currentAlign = next;
  };
  const setBold = (next: boolean) => {
    if (next === currentBold) return;
    receipt.raw(boldCmd(next));
    currentBold = next;
  };
  const setDouble = (next: boolean) => {
    if (next === currentDouble) return;
    receipt.raw(sizeCmd(1, next ? 2 : 1));
    currentDouble = next;
  };

  for (const block of blocks) {
    switch (block.kind) {
      case "divider":
        setAlign("left");
        setBold(false);
        setDouble(false);
        receipt.raw(lineCmd(divider(config.columns), config.codepage));
        break;

      case "blank":
        receipt.raw(lineCmd("", config.codepage));
        break;

      case "qr":
        // Centring is the printer's job here: we do not know the symbol's
        // module count, so padding it by hand would be a guess.
        setAlign("center");
        setBold(false);
        setDouble(false);
        receipt.raw(qrCmd(block.data, config.qrModuleSize));
        receipt.raw(lineCmd("", config.codepage));
        break;

      case "text":
        // Pre-aligned text (from labelValue / alignRight) is already padded to
        // the full width, so it must be sent left-aligned or the printer would
        // align the padding too.
        setAlign(block.align ?? "left");
        setBold(block.bold ?? false);
        setDouble(block.doubleHeight ?? false);
        receipt.raw(lineCmd(block.text, config.codepage));
        break;
    }
  }

  setBold(false);
  setDouble(false);
  setAlign("left");

  const tail: Bytes[] = [receipt.build(), feedCmd(config.feedLines)];
  if (config.cut) tail.push(cutCmd(0));
  return concat(tail);
}

/** Compose and render in one step. */
export function buildReceiptBytes(
  receipt: ResolvedReceipt,
  config: PrinterConfig = DEFAULT_PRINTER_CONFIG,
): Bytes {
  return renderBlocks(composeReceipt(receipt, config.columns), config);
}
