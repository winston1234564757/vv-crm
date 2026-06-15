import { ZodError } from "zod";

export function parseError(error: unknown): string {
  if (typeof error === "string") return error;
  
  if (error instanceof ZodError) {
    return error.issues.map(e => e.message).join("; ");
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error
  ) {
    const errObj = error as Record<string, unknown>;
    if (Array.isArray(errObj.issues)) {
      return errObj.issues.map((e: unknown) => {
        if (typeof e === "object" && e !== null && "message" in e && typeof (e as Record<string, unknown>).message === "string") {
          return (e as Record<string, unknown>).message;
        }
        return "Невідома помилка валідації";
      }).join("; ");
    }
  }
  
  if (error instanceof Error) {
    const msg = error.message;
    // Map known Supabase Auth errors to Ukrainian
    if (msg === "Invalid login credentials") return "Невірний email або пароль";
    if (msg === "Email rate limit exceeded") return "Забагато спроб. Зачекайте хвилину";
    if (msg.includes("User already registered")) return "Користувач з таким email вже існує";
    return msg;
  }
  
  if (typeof error === "object" && error !== null) {
    // Simple Zod/Postgres error extraction
    const errObj = error as Record<string, unknown>;
    if ("message" in errObj && typeof errObj.message === "string") {
      return errObj.message;
    }
  }

  return "Сталася невідома помилка. Спробуйте пізніше.";
}
