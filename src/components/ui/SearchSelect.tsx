"use client";

import { useState, useRef, useEffect } from "react";
import { IconSearch } from "@/components/icons";

interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  name: string;
  required?: boolean;
}

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  label,
  name,
  required = false,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((opt) => {
    const term = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(term))
    );
  });

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </label>
      
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-iris/20 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors cursor-pointer flex justify-between items-center focus-within:border-violet"
      >
        <span className={selectedOption ? "text-text-primary" : "text-iris/30"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-text-secondary text-[10px]">▼</span>
      </div>

      <input
        type="hidden"
        name={name}
        value={value}
        required={required}
      />

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl border border-iris/10 bg-white p-2 shadow-lg max-h-60 overflow-y-auto animate-entry">
          <div className="relative mb-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
              <IconSearch size={14} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук..."
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-iris/20 bg-warm-surface pl-8 pr-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
            />
          </div>
          <div className="space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-text-secondary p-2 text-center">
                Нічого не знайдено
              </p>
            ) : (
              filtered.map((opt) => {
                const isSelected = value === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`rounded-lg px-3 py-2 text-xs cursor-pointer transition-colors flex flex-col ${
                      isSelected
                        ? "bg-violet text-white"
                        : "text-text-primary hover:bg-violet/5"
                    }`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    {opt.subLabel && (
                      <span
                        className={`text-[10px] mt-0.5 ${
                          isSelected ? "text-white/80" : "text-text-secondary"
                        }`}
                      >
                        {opt.subLabel}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
