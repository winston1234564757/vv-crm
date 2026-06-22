"use client";

import { useState, useRef, useEffect } from "react";
import Drawer from "@/components/ui/Drawer";
import { IconSpinner } from "@/components/icons";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
}

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: "customer" | "repair" | "finance";
  entityId: string;
  entityName: string;
}

const customerChips = [
  "Який психотип цього клієнта?",
  "Дай 3 поради для успішного продажу",
  "Які товари йому порекомендувати?",
  "Оціни ризик того, що клієнт піде"
];

const repairChips = [
  "Які можливі причини поломки?",
  "Склади покроковий план діагностики",
  "Скільки часу займе цей ремонт?",
  "Які деталі знадобляться майстру?"
];

const financeChips = [
  "Проаналізуй рентабельність та прибуток",
  "Чи є ризик касового розриву?",
  "Дай поради щодо оптимізації витрат (OPEX)",
  "Який баланс ліквідності у касах та сейфах?"
];

export default function AICopilotDrawer({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName
}: AICopilotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chips = entityType === "customer" 
    ? customerChips 
    : entityType === "repair" 
      ? repairChips 
      : financeChips;

  // Clear chat when entity changes
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "model",
        content: `Привіт! Я твій AI-копілот VV CRM. Я готовий допомогти тобі у контексті ${
          entityType === "customer" ? `клієнта **${entityName}**` : `ремонту пристрою **${entityName}**`
        }. Про що ти хочеш дізнатися?`
      }
    ]);
    setInput("");
    setLoading(false);
  }, [entityId, entityType, entityName]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(textToSend: string) {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      content: textToSend
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build payload matching API expectations
      const chatHistory = messages
        .filter((m) => m.id !== "welcome")
        .concat(userMsg)
        .map((m) => ({
          role: m.role,
          content: m.content
        }));

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          entityType,
          entityId
        })
      });

      if (!res.ok) throw new Error("Помилка зв'язку з ШІ");

      const data = await res.json();
      const modelMsg: Message = {
        id: Math.random().toString(),
        role: "model",
        content: data.reply || "Не вдалося отримати відповідь від ШІ."
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "model",
          content: `❌ Помилка: ${errMessage || "Не вдалося підключитися до ШІ-помічника. Спробуйте пізніше."}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`AI Копілот: ${entityName}`}
      size="default"
    >
      <div className="flex flex-col h-[calc(100vh-140px)]">
        {/* Chat message logs */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-violet text-white rounded-tr-none"
                    : "bg-white border border-warm-border text-text-primary rounded-tl-none"
                }`}
              >
                {/* Parse basic markdown (bold text) */}
                {msg.content.split("\n").map((line, idx) => (
                  <p key={idx} className={idx > 0 ? "mt-1.5" : ""}>
                    {line.split("**").map((part, pIdx) => 
                      pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold">{part}</strong> : part
                    )}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-warm-border text-text-secondary rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                <IconSpinner size={16} className="animate-spin text-violet" />
                <span className="text-[10px] font-medium">ШІ обмірковує відповідь...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length === 1 && !loading && (
          <div className="py-3 border-t border-warm-border/50">
            <p className="text-[10px] text-text-secondary font-medium uppercase mb-2 tracking-wider">Швидкі питання:</p>
            <div className="flex flex-wrap gap-2">
              {chips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip)}
                  className="rounded-xl border border-violet/15 bg-violet/[0.02] hover:bg-violet/5 hover:border-violet/30 px-3 py-2 text-[11px] text-violet font-medium cursor-pointer transition-colors text-left"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="pt-4 border-t border-warm-border/50 flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={
              entityType === "customer" 
                ? "Запитайте про вподобання клієнта..." 
                : "Запитайте про деталі ремонту або сумісність..."
            }
            className="flex-1 rounded-xl border border-warm-border bg-warm-surface px-4 py-3 text-xs text-text-primary placeholder-iris/40 outline-none transition-colors focus:border-violet/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-violet hover:bg-violet-hover text-white text-xs font-semibold px-5 py-3 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Надіслати
          </button>
        </form>
      </div>
    </Drawer>
  );
}
