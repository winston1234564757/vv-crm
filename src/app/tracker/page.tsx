import TrackerForm from "./TrackerForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Трекер Ремонтів | ВВ Смартфон",
  description: "Перевірте статус вашого ремонту за номером телефону",
};

export default function TrackerPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-100 selection:text-blue-900">
      <TrackerForm />
    </div>
  );
}
