"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseError } from "@/lib/utils/errors";
import { IconLogo } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "signin") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(parseError(authError));
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } else {
      const { data, error: authError } = await supabase.auth.signUp({ email, password });

      if (authError) {
        setError(parseError(authError));
        setLoading(false);
        return;
      }

      if (data?.session) {
        router.push("/admin");
        router.refresh();
      } else {
        setMode("signin");
        setError("Акаунт створено. Підтвердьте email");
        setLoading(false);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm rounded-xl p-8">
        <div className="flex flex-col items-center text-center">
          <span className="text-violet"><IconLogo size={32} /></span>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-text-primary">VV CRM</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {mode === "signin" ? "Увійдіть у систему" : "Створіть акаунт"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-xs font-medium text-text-secondary">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-warm-border bg-warm-surface px-4 py-3 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
              placeholder="vlasnyk@vv-crm.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-medium text-text-secondary">Пароль</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-warm-border bg-warm-surface px-4 py-3 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
              placeholder="••••••"
            />
          </div>

          {error && (
            <p className={`text-center text-sm ${error === "Акаунт створено. Увійдіть зі своїм паролем" ? "text-cyan" : "text-rose"}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-press w-full rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
          >
            {loading ? "Зачекайте..." : mode === "signin" ? "Увійти" : "Створити акаунт"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-text-secondary">
          {mode === "signin" ? (
            <>
              Немає акаунту?{" "}
              <button onClick={() => { setMode("signup"); setError(""); }} className="text-violet underline underline-offset-2 hover:text-violet-hover">
                Створити
              </button>
            </>
          ) : (
            <>
              Вже є акаунт?{" "}
              <button onClick={() => { setMode("signin"); setError(""); }} className="text-violet underline underline-offset-2 hover:text-violet-hover">
                Увійти
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
