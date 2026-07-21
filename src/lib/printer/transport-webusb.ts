/**
 * WebUSB transport — pushes raw ESC/POS bytes at the printer's bulk endpoint,
 * with no operating-system print driver in the path.
 *
 * The Windows caveat, stated plainly because it decides whether any of this
 * runs: `usbprint.sys` claims USB printers by default, and while it holds the
 * interface `claimInterface()` fails with a NetworkError no amount of retrying
 * fixes. Binding WinUSB to the device (via Zadig) is what frees it — and doing
 * so removes the printer from "Devices and Printers", which also disables the
 * browser-print fallback. That trade is the reason the failure paths here
 * report the actual DOMException instead of a generic "could not connect":
 * distinguishing "not plugged in" from "driver holds it" is the entire question.
 *
 * Transport is deliberately isolated behind {@link PrinterTransport} so that
 * swapping in a local bridge service later touches only this file.
 */

import type { Bytes } from "./codec";

/** USB device class 7 — printers. */
const USB_CLASS_PRINTER = 0x07;

/**
 * Bytes per `transferOut`. The XP-58's input buffer is small; handing it the
 * whole receipt in one transfer can overrun it and produce truncated output,
 * so the stream is fed in pieces the buffer can drain.
 */
const CHUNK_SIZE = 4096;

export interface PrinterTransport {
  readonly name: string;
  write(data: Bytes): Promise<void>;
  close(): Promise<void>;
}

export class PrinterError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PrinterError";
  }
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

/**
 * A device the user has already granted this origin access to. Permission is
 * remembered per origin, so after the first pairing this returns the printer
 * without showing a picker — printing must not require a click-through every
 * time a cashier prints a receipt.
 */
export async function getPairedDevice(): Promise<USBDevice | null> {
  if (!isWebUsbSupported()) return null;
  const devices = await navigator.usb.getDevices();
  return devices.find(isPrinterDevice) ?? devices[0] ?? null;
}

/**
 * Show the browser's device picker. Must be called from a user gesture.
 *
 * @param anyDevice list every USB device rather than only printer-class ones.
 *   Some clones misdeclare their interface class and never appear in a filtered
 *   picker; without this escape hatch they would look like missing hardware.
 */
export async function requestDevice(anyDevice = false): Promise<USBDevice> {
  if (!isWebUsbSupported()) {
    throw new PrinterError(
      "Цей браузер не підтримує WebUSB. Потрібен Chrome або Edge на десктопі.",
    );
  }

  try {
    return await navigator.usb.requestDevice({
      filters: anyDevice ? [] : [{ classCode: USB_CLASS_PRINTER }],
    });
  } catch (err) {
    // A cancelled picker is a NotFoundError too, and is not an error worth
    // dressing up as one.
    throw new PrinterError(
      anyDevice
        ? "Пристрій не вибрано."
        : "Принтер не вибрано. Якщо списку немає — спробуйте «показати всі пристрої»: деякі клони не оголошують клас 7.",
      err,
    );
  }
}

function isPrinterDevice(device: USBDevice): boolean {
  if (device.deviceClass === USB_CLASS_PRINTER) return true;
  return (device.configurations ?? []).some((configuration) =>
    configuration.interfaces.some((iface) =>
      iface.alternates.some((alt) => alt.interfaceClass === USB_CLASS_PRINTER),
    ),
  );
}

interface ClaimedEndpoint {
  interfaceNumber: number;
  endpointNumber: number;
}

/**
 * Find the printer interface and its bulk OUT endpoint. Prefers a class-7
 * interface but falls back to any interface exposing a bulk OUT endpoint,
 * because that is what a misdeclaring clone still needs.
 */
function findBulkOut(device: USBDevice): ClaimedEndpoint {
  const configuration = device.configuration;
  if (!configuration) {
    throw new PrinterError("USB-конфігурація не вибрана.");
  }

  const candidates = configuration.interfaces.flatMap((iface) =>
    iface.alternates.map((alt) => ({ iface, alt })),
  );

  const withBulkOut = candidates.filter(({ alt }) =>
    alt.endpoints.some((ep) => ep.direction === "out" && ep.type === "bulk"),
  );

  const chosen =
    withBulkOut.find(({ alt }) => alt.interfaceClass === USB_CLASS_PRINTER) ??
    withBulkOut[0];

  if (!chosen) {
    throw new PrinterError(
      "У пристрою немає bulk OUT-ендпоінта — це не схоже на чековий принтер.",
    );
  }

  const endpoint = chosen.alt.endpoints.find(
    (ep) => ep.direction === "out" && ep.type === "bulk",
  )!;

  return {
    interfaceNumber: chosen.iface.interfaceNumber,
    endpointNumber: endpoint.endpointNumber,
  };
}

/**
 * Open, configure and claim the device, returning a transport ready for bytes.
 * On Windows this is where `usbprint.sys` makes itself known.
 */
export async function openTransport(device: USBDevice): Promise<PrinterTransport> {
  try {
    if (!device.opened) await device.open();
  } catch (err) {
    throw new PrinterError(
      `Не вдалося відкрити пристрій: ${describe(err)}. На Windows це майже завжди означає, що драйвер usbprint.sys тримає принтер — потрібна підміна на WinUSB через Zadig.`,
      err,
    );
  }

  try {
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
  } catch (err) {
    throw new PrinterError(`Не вдалося вибрати USB-конфігурацію: ${describe(err)}`, err);
  }

  const { interfaceNumber, endpointNumber } = findBulkOut(device);

  try {
    await device.claimInterface(interfaceNumber);
  } catch (err) {
    throw new PrinterError(
      `Не вдалося захопити інтерфейс ${interfaceNumber}: ${describe(err)}. Інтерфейс зайнятий системним драйвером — див. Zadig / WinUSB.`,
      err,
    );
  }

  const label = device.productName || `USB ${hex(device.vendorId)}:${hex(device.productId)}`;

  return {
    name: label,

    async write(data: Bytes) {
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.subarray(offset, offset + CHUNK_SIZE);
        const result = await device.transferOut(endpointNumber, chunk);
        if (result.status !== "ok") {
          throw new PrinterError(`Передача обірвалася зі статусом «${result.status}».`);
        }
      }
    },

    async close() {
      // Best-effort teardown: a printer that already went away must not turn a
      // successful print into a thrown error.
      try {
        await device.releaseInterface(interfaceNumber);
      } catch {
        /* device already gone */
      }
      try {
        await device.close();
      } catch {
        /* device already gone */
      }
    },
  };
}

/** Open, write, close. The usual one-shot path. */
export async function sendToPrinter(device: USBDevice, data: Bytes): Promise<void> {
  const transport = await openTransport(device);
  try {
    await transport.write(data);
  } finally {
    await transport.close();
  }
}

export function describe(err: unknown): string {
  if (err instanceof DOMException) return `${err.name}: ${err.message}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function hex(value: number): string {
  return `0x${value.toString(16).padStart(4, "0")}`;
}
