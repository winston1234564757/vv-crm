"use client";

import { useState, useEffect, useLayoutEffect } from "react";

export function CurrentTime() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    // Set time on mount asynchronously to avoid synchronous setState warnings
    setTimeout(() => {
      setTime(new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 0);
    
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!time) return null; // Prevent flash of unstyled/incorrect time

  return (
    <span className="text-violet font-semibold ml-2 text-sm tracking-wide bg-violet/5 px-2.5 py-1 rounded-lg border border-violet/10">
      {time}
    </span>
  );
}
