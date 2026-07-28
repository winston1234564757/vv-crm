import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/roles";

// Тип живе в `@/lib/roles` (без серверних залежностей), але реекспортується
// звідси — на `rbac` зав'язані два десятки імпортів.
export type { UserRole };

const ALL_ROLES: UserRole[] = ["owner", "manager", "technician", "sales"];

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

export type RoleCheck =
  | { ok: true; user: User; role: UserRole }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Route-варіант `requireRole`: не кидає помилку, а повертає результат зі статусом.
 *
 * Server Action може дозволити собі throw — його ловить обгортка дії. У Route
 * Handler throw провалюється в загальний catch і перетворюється на 500, тобто
 * «доступ заборонено» стає невідрізнимим від «зламався Gemini». Тут статус
 * повертається явно: 401 для неавтентифікованого, 403 для чужої ролі.
 *
 * Сам виклик `getUser()` уже всередині — роут не має робити його вдруге.
 */
export async function checkRole(allowedRoles: UserRole[]): Promise<RoleCheck> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Профіль недоступний — вважаємо доступ незакритим і відмовляємо. Мовчазний
  // fallback на роль за замовчуванням тут відкрив би саме те, що ми закриваємо.
  if (profileError) {
    return { ok: false, status: 403, error: "Не вдалося перевірити роль користувача" };
  }

  const userRole = (profile?.role || "sales") as UserRole;

  if (!allowedRoles.includes(userRole)) {
    return {
      ok: false,
      status: 403,
      error: `Доступ заборонено: потрібна роль [${allowedRoles.join(", ")}], ваша роль: ${userRole}`,
    };
  }

  return { ok: true, user, role: userRole };
}

/**
 * Поточний користувач разом із роллю, або `null` якщо сесії немає.
 *
 * Для сторінок, які видимі всім, але показують різне залежно від ролі —
 * там доречна не відмова, а розгалуження.
 */
export async function getCurrentUserRole(): Promise<{ user: User; role: UserRole } | null> {
  const access = await checkRole(ALL_ROLES);
  return access.ok ? { user: access.user, role: access.role } : null;
}

/**
 * Гард для сторінки (Server Component). Заборонений доступ — не помилка, а
 * редірект: `requireRole` тут кинув би throw, який ловить `admin/error.tsx` і
 * показує «Помилка завантаження» з кнопкою «Спробувати знову», що ніколи не
 * спрацює. Роль не полагодиться повтором запиту.
 *
 * Перевірка йде в БД на самій сторінці, а не в `proxy.ts`: proxy виконується
 * на кожному маршруті, включно з prefetch, і за рекомендацією Next там
 * доречні лише оптимістичні перевірки кукі, без звернень до бази.
 */
export async function requirePageRole(
  allowedRoles: UserRole[],
): Promise<{ user: User; role: UserRole }> {
  const access = await checkRole(allowedRoles);

  if (!access.ok) {
    redirect(access.status === 401 ? "/login" : "/admin");
  }

  return { user: access.user, role: access.role };
}
