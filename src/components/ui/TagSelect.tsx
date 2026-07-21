"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  id: string;
  label: string;
  color: string;
}

interface TagSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  name?: string;
  required?: boolean;
}

const colorMap: Record<string, string> = {
  slate: "bg-hover text-ink border-border",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  rose: "bg-rose-100 text-rose-700 border-rose-200",
  amber: "bg-warning-subtle text-warning border-warning",
  emerald: "bg-success-subtle text-success border-success",
  sky: "bg-info-subtle text-info border-info",
};

export default function TagSelect({
  options,
  value,
  onChange,
  placeholder,
  name,
  required = false,
}: TagSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-lg border border-warm-border/60 bg-warm-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors cursor-pointer flex justify-between items-center focus-within:border-violet"
      >
        {selectedOption ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorMap[selectedOption.color] || colorMap.slate}`}>
            {selectedOption.label}
          </span>
        ) : (
          <span className="text-text-secondary">{placeholder}</span>
        )}
        <span className="text-text-secondary text-[10px]">▼</span>
      </div>

      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
        />
      )}

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl border border-warm-border bg-surface p-2 shadow-lg max-h-60 overflow-y-auto animate-entry">
          <div className="space-y-1">
            <div
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setIsOpen(false);
              }}
              className={`rounded-lg px-2 py-1.5 text-xs cursor-pointer transition-colors flex items-center ${
                !value ? "bg-violet/5" : "hover:bg-warm-hover"
              }`}
            >
              <span className="text-text-secondary font-medium">Без категорії</span>
            </div>
            
            {options.map((opt) => {
              const isSelected = value === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`rounded-lg px-2 py-1.5 text-xs cursor-pointer transition-colors flex items-center ${
                    isSelected ? "bg-violet/5" : "hover:bg-warm-hover"
                  }`}
                >
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colorMap[opt.color] || colorMap.slate}`}>
                    {opt.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
