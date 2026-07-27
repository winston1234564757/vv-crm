"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRepairsByPhone, type TrackerRepair } from "@/lib/actions/tracker";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

const Search = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const Loader2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const Phone = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const CheckCircle2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>;
const Wrench = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
const PackageSearch = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>;
const Clock = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const PackageCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m16 16 2 2 4-4"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>;


/* Кроки збігаються зі статусами ремонту. Останній крок — `handed_over`: раніше
   тут стояв `completed` з підписом «Видано», хоча на сторінці /track той самий
   статус підписувався «Виконано (чекає видачі)». Клієнт бачив два протилежні
   слова про один стан свого ремонту. */
const STATUS_STEPS = [
  { id: 'received', label: 'Прийнято', icon: PackageSearch },
  { id: 'diagnostics', label: 'Діагностика', icon: Search },
  { id: 'in_progress', label: 'В процесі', icon: Wrench },
  { id: 'awaiting_parts', label: 'Очікуємо деталі', icon: Clock },
  { id: 'ready', label: 'Готово', icon: CheckCircle2 },
  { id: 'handed_over', label: 'Видано', icon: PackageCheck },
];

function getStatusIndex(status: string) {
  if (['cancelled'].includes(status)) return -1;
  // Архівний `completed` — це теж завершений ремонт, останній крок.
  if (status === 'completed') return STATUS_STEPS.length - 1;
  return STATUS_STEPS.findIndex(s => s.id === status);
}

function RepairCard({ repair }: { repair: TrackerRepair }) {
  const currentIndex = getStatusIndex(repair.status);
  const isCancelled = repair.status === 'cancelled';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
    >
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-semibold text-lg text-slate-900">{repair.device_name}</h3>
            {repair.tracking_token && (
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                № {repair.tracking_token}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {format(new Date(repair.created_at), "d MMMM yyyy", { locale: uk })}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-slate-500 mb-1">Вартість ремонту</p>
          <p className="font-semibold text-lg text-slate-900">
            {repair.price > 0 ? `${repair.price} ₴` : "За результатами діагностики"}
          </p>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Заявлена несправність</h4>
          <p className="text-slate-600 bg-slate-50 p-3 rounded-lg text-sm">{repair.issue}</p>
        </div>

        {isCancelled ? (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Ремонт скасовано</span>
          </div>
        ) : (
          <div className="relative pt-8 pb-4">
            {/* Прогрес бар лінія */}
            <div className="absolute top-12 left-0 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-600"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.max(0, currentIndex) * (100 / (STATUS_STEPS.length - 1))}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>

            {/* Кроки */}
            <div className="relative flex justify-between">
              {STATUS_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isCompleted = idx <= currentIndex;
                const isCurrent = idx === currentIndex;
                
                return (
                  <div key={step.id} className="flex flex-col items-center gap-2 relative z-10 w-16">
                    <motion.div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300 bg-white
                        ${isCompleted ? 'border-blue-600 text-blue-600' : 'border-slate-200 text-slate-400'}
                        ${isCurrent ? 'ring-4 ring-blue-100' : ''}
                      `}
                      whileHover={{ scale: 1.1 }}
                    >
                      <Icon className="w-5 h-5" />
                    </motion.div>
                    <span className={`text-[11px] font-medium text-center leading-tight
                      ${isCurrent ? 'text-blue-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'}
                    `}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {repair.estimated_completion && !isCancelled && currentIndex < STATUS_STEPS.length - 1 && (
          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
            <Clock className="w-4 h-4" />
            <span>Орієнтовна дата готовності: <strong className="font-medium">{format(new Date(repair.estimated_completion), "d MMMM", { locale: uk })}</strong></span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function TrackerForm() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repairs, setRepairs] = useState<TrackerRepair[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    setLoading(true);
    setError("");
    
    const result = await getRepairsByPhone(phone);
    
    if (result.success) {
      setRepairs(result.data || []);
      setHasSearched(true);
    } else {
      setError(result.error || "Сталася помилка при пошуку");
      setRepairs([]);
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 p-8 sm:p-12 mb-8 text-center"
      >
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Search className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Статус ремонту</h1>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
          Введіть ваш номер телефону, щоб переглянути поточний статус всіх ваших пристроїв у сервісному центрі.
        </p>

        <form onSubmit={handleSubmit} className="max-w-md mx-auto">
          <div className="relative flex items-center">
            <div className="absolute left-4 text-slate-400">
              <Phone className="w-5 h-5" />
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+380 (XX) XXX-XX-XX"
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
              disabled={loading}
            />
          </div>
          
          {error && (
            <motion.p 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="text-red-500 text-sm mt-3 text-left font-medium"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading || phone.length < 9}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Перевірити статус"
            )}
          </button>
        </form>
      </motion.div>

      <AnimatePresence mode="popLayout">
        {hasSearched && repairs.length === 0 && !loading && !error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-12 bg-white rounded-3xl border border-slate-100"
          >
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PackageSearch className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Ремонтів не знайдено</h3>
            <p className="text-slate-500">За цим номером телефону немає активних або минулих ремонтів.</p>
          </motion.div>
        )}

        {repairs.length > 0 && (
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {repairs.map((repair) => (
              <RepairCard key={repair.id} repair={repair} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
