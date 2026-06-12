import Link from "next/link";
import { IconRepair, IconLogo } from "@/components/icons";

export default function TrackNotFound() {
  return (
    <div className="min-h-screen bg-warm-bg flex flex-col justify-between">
      <header className="border-b border-warm-border/50 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/shop" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary">
            <span className="text-violet"><IconLogo /></span> VV CRM
          </Link>
          <Link href="/track" className="text-sm text-violet hover:underline">Інша заявка</Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center p-6 w-full">
        <div className="card w-full rounded-xl p-8 text-center space-y-6">
          <div className="flex justify-center text-rose">
            <IconRepair size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Заявку не знайдено</h1>
            <p className="text-sm text-text-secondary">
              На жаль, ми не змогли знайти ремонт за вказаним номером. Будь ласка, перевірте правильність номеру та спробуйте ще раз.
            </p>
          </div>
          <Link
            href="/track"
            className="btn-press flex w-full items-center justify-center rounded-xl bg-violet px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
          >
            Повернутися до пошуку
          </Link>
        </div>
      </main>

      <footer className="py-4 text-center text-[10px] text-text-secondary/50">
        © {new Date().getFullYear()} VV CRM. Всі права захищені.
      </footer>
    </div>
  );
}
