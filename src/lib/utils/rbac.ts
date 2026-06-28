import { createClient } from "@/lib/supabase/server";

export type UserRole = "owner" | "manager" | "technician" | "sales";

/**
 * Перевіряє, чи має поточний користувач одну з дозволених ролей.
 * Якщо користувач не автентифікований або його роль не в списку дозволених,
 * функція викидає помилку (throw new Error), що автоматично перериває виконання Server Action.
 * 
 * @param allowedRoles Масив дозволених ролей
 * @returns об'єкт користувача та його роль, якщо перевірка пройшла успішно
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: " + (authError?.message || "User not found"));
  }

  // Отримуємо роль користувача з таблиці profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error("Не вдалося перевірити профіль користувача: " + profileError.message);
  }

  const userRole = (profile?.role || "sales") as UserRole;

  if (!allowedRoles.includes(userRole)) {
    throw new Error(`Доступ заборонено: потрібна роль [${allowedRoles.join(", ")}], ваша роль: ${userRole}`);
  }

  return { user, role: userRole };
}
