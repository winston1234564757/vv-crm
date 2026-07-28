import { describe, it, expect } from "vitest";
import { parseError } from "../errors";
import { ZodError, z } from "zod";

describe("Error Parser", () => {
  it("should return string as is", () => {
    expect(parseError("Тестова помилка")).toBe("Тестова помилка");
  });

  it("should parse standard Error and translate known auth messages", () => {
    expect(parseError(new Error("Some generic error"))).toBe("Some generic error");
    expect(parseError(new Error("Invalid login credentials"))).toBe("Невірний email або пароль");
    expect(parseError(new Error("Email rate limit exceeded"))).toBe("Забагато спроб. Зачекайте хвилину");
    expect(parseError(new Error("User already registered in the system"))).toBe("Користувач з таким email вже існує");
  });

  it("should extract message from generic objects", () => {
    expect(parseError({ message: "Object error message" })).toBe("Object error message");
    expect(parseError({ other: "field" })).toBe("Сталася невідома помилка. Спробуйте пізніше.");
  });

  it("should parse ZodError objects into readable format", () => {
    const schema = z.object({
      name: z.string().min(2, "Ім'я закоротке"),
      age: z.number().min(18, "Тільки повнолітні"),
    });

    const result = schema.safeParse({ name: "A", age: 15 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const parsedMsg = parseError(result.error);
      expect(parsedMsg).toContain("Ім'я закоротке");
      expect(parsedMsg).toContain("Тільки повнолітні");
      expect(parsedMsg).toContain("; ");
    }
  });

  it("should parse plain serialized Zod-like error objects", () => {
    const serializedZodError = {
      name: "ZodError",
      issues: [
        { message: "Невалідний email", path: ["email"] },
        { message: "Обов'язкове поле", path: ["password"] }
      ]
    };
    
    expect(parseError(serializedZodError)).toBe("Невалідний email; Обов'язкове поле");
  });

  it("should parse and translate PostgreSQL foreign key constraints", () => {
    // 1. As standard Error objects
    const errPart = new Error('update or delete on table "parts" violates foreign key constraint "repair_parts_part_id_fkey" on table "repair_parts"');
    expect(parseError(errPart)).toContain("Неможливо видалити деталь, оскільки вона вже використана у виконаних чи поточних ремонтах");

    const errCustomer = new Error('update or delete on table "customers" violates foreign key constraint "repairs_customer_id_fkey" on table "repairs"');
    expect(parseError(errCustomer)).toContain("Неможливо видалити клієнта, оскільки він має пов'язані ремонти");

    // 2. As plain database/Supabase error objects with code or message
    const dbErrExpenseCat = {
      code: "23503",
      message: 'update or delete on table "expense_categories" violates foreign key constraint "expenses_category_id_fkey" on table "expenses"'
    };
    expect(parseError(dbErrExpenseCat)).toContain("Неможливо видалити категорію витрат, оскільки вона містить записані витрати");

    const dbErrSafe = {
      code: "23503",
      message: 'update or delete on table "safes" violates foreign key constraint "expenses_paid_from_safe_id_fkey" on table "expenses"'
    };
    expect(parseError(dbErrSafe)).toContain("Неможливо видалити цей сейф, оскільки з нього здійснювалися витрати");

    const genericFkErr = {
      code: "23503",
      message: 'some generic foreign key violation'
    };
    expect(parseError(genericFkErr)).toBe("Неможливо видалити цей запис, оскільки він пов'язаний з іншими даними в системі.");
  });

  // Порушення унікальності доходило до користувача сирим текстом Postgres:
  // саме його бачили у формі ремонту, коли телефон уже був у базі.
  it("should translate unique-constraint violations", () => {
    const dupPhone = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "customers_phone_key"',
    };
    expect(parseError(dupPhone)).toContain("Клієнт із таким номером телефону вже є в базі");
    expect(parseError(dupPhone)).not.toContain("duplicate key");

    // Той самий випадок, але як Error — саме так він приходить із `throw error`.
    expect(
      parseError(new Error('duplicate key value violates unique constraint "customers_phone_key"')),
    ).toContain("Клієнт із таким номером телефону вже є в базі");

    const genericDup = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "something_else_key"',
    };
    expect(parseError(genericDup)).toBe("Запис із такими даними вже існує.");
  });
});
