/**
 * The one entry point the UI needs: hand it a receipt, it lands on paper.
 *
 * Everything below this — code pages, byte layout, USB endpoints — is an
 * implementation detail of "print this". Keeping the surface this narrow is
 * what makes the transport swappable: if WinUSB ever has to give way to a local
 * bridge service, only `transport-webusb` changes.
 */

export {
  DEFAULT_PRINTER_CONFIG,
  DEFAULT_PRINTER_SETTINGS,
  buildReceiptBytes,
  composeReceipt,
  renderBlocksAsText,
  toPrinterConfig,
} from "./receipt-escpos";
export type {
  Block,
  PrinterConfig,
  ReceiptCompany,
  ReceiptDevice,
  ReceiptLineItem,
  ResolvedReceipt,
  StoredPrinterSettings,
} from "./receipt-escpos";
export { PrinterError, isWebUsbSupported } from "./transport-webusb";
export type { ReceiptType } from "./receipt-content";

import { DEFAULT_PRINTER_CONFIG, buildReceiptBytes, type PrinterConfig, type ResolvedReceipt } from "./receipt-escpos";
import {
  PrinterError,
  getPairedDevice,
  isWebUsbSupported,
  requestDevice,
  sendToPrinter,
} from "./transport-webusb";

/**
 * Print over USB, pairing first if this browser profile has not been paired.
 *
 * Must be called from a user gesture: the picker shown on first use requires
 * one. After that the grant is remembered per origin and printing is silent,
 * which matters — a cashier should not click through a device dialog for every
 * receipt.
 *
 * The picker is unfiltered rather than restricted to USB class 7. Once WinUSB
 * is bound the device no longer presents as a printer to the OS, so a filtered
 * picker can come up empty on exactly the machine that is set up correctly.
 *
 * @returns the device label, for confirming to the operator what was used
 */
export async function printReceipt(
  receipt: ResolvedReceipt,
  config: PrinterConfig = DEFAULT_PRINTER_CONFIG,
): Promise<string> {
  if (!isWebUsbSupported()) {
    throw new PrinterError(
      "Цей браузер не підтримує прямий друк. Потрібен Chrome або Edge на комп'ютері — або скористайтеся друком через браузер.",
    );
  }

  const device = (await getPairedDevice()) ?? (await requestDevice(true));
  await sendToPrinter(device, buildReceiptBytes(receipt, config));
  return device.productName || "принтер";
}

/** Whether a printer is already paired, so the UI can label the button honestly. */
export async function hasPairedPrinter(): Promise<boolean> {
  if (!isWebUsbSupported()) return false;
  return (await getPairedDevice()) !== null;
}
