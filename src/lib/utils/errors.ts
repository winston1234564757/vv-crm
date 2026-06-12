import { ZodError } from "zod";

export function parseError(error: unknown): string {
  if (typeof error === "string") return error;
  
  if (error instanceof ZodError) {
    return error.issues.map(e => e.message).join("; ");
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ZodError" &&
    "issues" in error &&
    Array.isArray((error as any).issues)
  ) {
    return (error as any).issues.map((e: any) => e.message).join("; ");
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
    if ("message" in error && typeof (error as any).message === "string") {
      return (error as any).message;
    }
  }

  return "Сталася невідома помилка. Спробуйте пізніше.";
}
