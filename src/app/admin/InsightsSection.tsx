"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { RangePreset } from "@/lib/profit";

interface Insight {
  type: string;
  title: string;
  description: string;
  action: string;
  impact: string;
}

type Status = "idle" | "loading" | "ready" | "empty";

const IMPACT_BORDER: Record<string, string> = {
  high: "border-l-danger",
  medium: "border-l-warning",
  low: "border-l-border",
};

function borderClass(impact: string): string {
  return IMPACT_BORDER[impact] ?? IMPACT_BORDER.low;
}

/**
 * On-demand AI read of the same numbers `MoneySection` renders — a Gemini
 * call costs seconds and money, so the dashboard never fetches this on its
 * own. The button is the fetch trigger, full stop.
 *
 * `{ insights: [] }` is a valid 200 from the endpoint (model/parse failure,
 * rate limit, or the model genuinely finding nothing) and a network
 * rejection both land in the same "empty" state — the visible message
 * doesn't distinguish "AI said nothing" from "AI unreachable", only the
 * retry button matters.
 *
 * Switching `preset` resets straight back to idle rather than refetching or
 * keeping stale cards: the loaded insights describe a period that no longer
 * matches the money block next to them, and an automatic refetch would be
 * exactly the auto-fetch-on-open this component exists to avoid.
 */
export function InsightsSection({ preset }: { preset: RangePreset }) {
  const [status, setStatus] = useState<Status>("idle");
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    setStatus("idle");
    setInsights([]);
  }, [preset]);

  async function load() {
    setStatus("loading");
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range: preset }),
      });
      const data = await res.json().catch(() => ({ insights: [] }));
      const list: Insight[] = Array.isArray(data?.insights) ? data.insights : [];
      setInsights(list);
      setStatus(list.length > 0 ? "ready" : "empty");
    } catch {
      setInsights([]);
      setStatus("empty");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted">AI-аналіз</h2>

      {status === "idle" && (
        <Button variant="secondary" onClick={load}>
          Показати аналіз
        </Button>
      )}

      {status === "loading" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="card h-32 animate-pulse border-l-4 border-l-border p-5"
            />
          ))}
        </div>
      )}

      {status === "empty" && (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-muted">Поки нема що сказати</p>
          <Button variant="secondary" size="sm" onClick={load}>
            Спробувати ще
          </Button>
        </div>
      )}

      {status === "ready" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={cn(
                "card space-y-2 border-l-4 p-5",
                borderClass(insight.impact),
              )}
            >
              <h3 className="text-sm font-semibold text-ink">{insight.title}</h3>
              <p className="text-sm text-muted">{insight.description}</p>
              {insight.action && (
                <p className="text-xs text-faint">{insight.action}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
