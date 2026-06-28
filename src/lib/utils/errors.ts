import { ZodError } from "zod";

function handleForeignKeyError(message: string, code?: string): string | null {
  const isFk = code === "23503" || message.includes("violates foreign key constraint");
  if (!isFk) return null;

  if (message.includes("repair_parts_part_id_fkey")) {
    return "Неможливо видалити деталь, оскільки вона вже використана у виконаних чи поточних ремонтах. Спробуйте оновити її кількість або змінити назву.";
  }
  if (message.includes("repairs_customer_id_fkey")) {
    return "Неможливо видалити клієнта, оскільки він має пов'язані ремонти. Спочатку видаліть або перепризначте ремонти цього клієнта.";
  }
  if (message.includes("expenses_category_id_fkey")) {
    return "Неможливо видалити категорію витрат, оскільки вона містить записані витрати. Переведіть витрати на іншу категорію перед видаленням.";
  }
  if (message.includes("expenses_paid_from_safe_id_fkey")) {
    return "Неможливо видалити цей сейф, оскільки з нього здійснювалися витрати. Спершу видаліть або перепризначте пов'язані витрати.";
  }
  return "Неможливо видалити цей запис, оскільки він пов'язаний з іншими даними в системі.";
}

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
    
    // Check for DB foreign key violations first
    const fkMsg = handleForeignKeyError(msg);
    if (fkMsg) return fkMsg;

    // Map known Supabase Auth errors to Ukrainian
    if (msg === "Invalid login credentials") return "Невірний email або пароль";
    if (msg === "Email rate limit exceeded") return "Забагато спроб. Зачекайте хвилину";
    if (msg.includes("User already registered")) return "Користувач з таким email вже існує";
    return msg;
  }
  
  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    const msg = typeof errObj.message === "string" ? errObj.message : "";
    const code = typeof errObj.code === "string" ? errObj.code : undefined;
    
    if (msg) {
      const fkMsg = handleForeignKeyError(msg, code);
      if (fkMsg) return fkMsg;
      return msg;
    }
  }

  return "Сталася невідома помилка. Спробуйте пізніше.";
}
