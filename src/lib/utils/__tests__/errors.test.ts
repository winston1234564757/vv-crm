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
});
