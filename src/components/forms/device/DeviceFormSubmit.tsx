"use client";

import { DeviceFormData } from "@/lib/types/device.types";

interface DeviceFormSubmitProps {
  pending: boolean;
  device?: DeviceFormData;
}

export function DeviceFormSubmit({ pending, device }: DeviceFormSubmitProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer"
    >
      {pending ? "Збереження..." : device ? "Зберегти зміни" : "Додати пристрій"}
    </button>
  );
}

export default DeviceFormSubmit;