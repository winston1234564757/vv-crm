/**
 * Валідує телефон за українським форматом.
 * Дозволені формати: +380XXXXXXXXX, 380XXXXXXXXX, 0XXXXXXXXX.
 */
export function validatePhone(phone: string): string | null {
  const clean = phone.trim();
  if (!clean) return "Телефон є обов'язковим полем";
  
  // Регулярний вираз для форматів +380 або 0 з 9 цифрами після цього
  const phoneRegex = /^(?:\+?38)?(?:0\d{9})$/;
  if (!phoneRegex.test(clean)) {
    return "Некоректний формат телефону. Приклад: +380991234567 або 0991234567";
  }
  return null;
}

/**
 * Валідує електронну пошту.
 * Пошта є опціональною, тому порожній рядок є валідним.
 */
export function validateEmail(email: string): string | null {
  const clean = email.trim();
  if (!clean) return null; // Опціональне поле

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) {
    return "Некоректний формат email. Приклад: alex@example.com";
  }
  return null;
}

/**
 * Валідує ціну товару або послуги.
 * Має бути невід'ємним числом.
 */
export function validatePrice(price: number | string): string | null {
  const num = Number(price);
  if (isNaN(num) || num < 0) {
    return "Ціна має бути невід'ємним числом";
  }
  return null;
}

/**
 * Валідує знижку.
 * Має бути числом від 0 до 100.
 */
export function validateDiscount(discount: number | string): string | null {
  const num = Number(discount);
  if (isNaN(num) || num < 0 || num > 100) {
    return "Знижка має бути числом від 0 до 100%";
  }
  return null;
}

/**
 * Валідує промокод партнера.
 * Опціональний, але якщо введений, має починатись з VVC- та мати від 4 символів.
 */
export function validatePromoCode(promo: string): string | null {
  const clean = promo.trim().toUpperCase();
  if (!clean) return null; // Опціональне поле

  const promoRegex = /^VVC-[A-Z0-9]{4,}$/;
  if (!promoRegex.test(clean)) {
    return "Некоректний формат промокоду. Має бути у форматі VVC-XXXX";
  }
  return null;
}
