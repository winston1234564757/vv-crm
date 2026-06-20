import { describe, it, expect } from "vitest";
import { 
  validatePhone, 
  validateEmail, 
  validatePrice, 
  validateDiscount, 
  validatePromoCode 
} from "./validation";

describe("Validation Utilities", () => {
  describe("validatePhone", () => {
    it("should accept valid Ukrainian phone formats", () => {
      expect(validatePhone("+380991234567")).toBeNull();
      expect(validatePhone("0991234567")).toBeNull();
      expect(validatePhone("380991234567")).toBeNull();
    });

    it("should reject invalid phone formats", () => {
      expect(validatePhone("")).toBe("Телефон є обов'язковим полем");
      expect(validatePhone("12345")).toContain("Некоректний формат");
      expect(validatePhone("+3809912345")).toContain("Некоректний формат"); // Too short
      expect(validatePhone("09912345678")).toContain("Некоректний формат"); // Too long
      expect(validatePhone("abc1234567")).toContain("Некоректний формат");
    });
  });

  describe("validateEmail", () => {
    it("should accept empty string as valid (optional)", () => {
      expect(validateEmail("")).toBeNull();
      expect(validateEmail("   ")).toBeNull();
    });

    it("should accept valid emails", () => {
      expect(validateEmail("test@example.com")).toBeNull();
      expect(validateEmail("user.name+label@domain.co.uk")).toBeNull();
    });

    it("should reject invalid emails", () => {
      expect(validateEmail("invalid-email")).toContain("Некоректний формат");
      expect(validateEmail("test@domain")).toContain("Некоректний формат");
      expect(validateEmail("@domain.com")).toContain("Некоректний формат");
    });
  });

  describe("validatePrice", () => {
    it("should accept non-negative numbers", () => {
      expect(validatePrice(0)).toBeNull();
      expect(validatePrice(150.5)).toBeNull();
      expect(validatePrice("500")).toBeNull();
    });

    it("should reject negative numbers or non-numeric strings", () => {
      expect(validatePrice(-10)).toContain("невід'ємним числом");
      expect(validatePrice("abc")).toContain("невід'ємним числом");
    });
  });

  describe("validateDiscount", () => {
    it("should accept numbers between 0 and 100", () => {
      expect(validateDiscount(0)).toBeNull();
      expect(validateDiscount(15)).toBeNull();
      expect(validateDiscount(100)).toBeNull();
      expect(validateDiscount("50")).toBeNull();
    });

    it("should reject numbers outside 0-100 or non-numeric values", () => {
      expect(validateDiscount(-5)).toContain("від 0 до 100%");
      expect(validateDiscount(105)).toContain("від 0 до 100%");
      expect(validateDiscount("abc")).toContain("від 0 до 100%");
    });
  });

  describe("validatePromoCode", () => {
    it("should accept empty string (optional)", () => {
      expect(validatePromoCode("")).toBeNull();
    });

    it("should accept valid VVC codes", () => {
      expect(validatePromoCode("VVC-ABCD")).toBeNull();
      expect(validatePromoCode("vvc-1234")).toBeNull(); // converted to uppercase
    });

    it("should reject invalid formats", () => {
      expect(validatePromoCode("VV-ABCD")).toContain("VVC-XXXX");
      expect(validatePromoCode("VVC-12")).toContain("VVC-XXXX"); // Too short (min 4 chars after dash)
      expect(validatePromoCode("ABCD")).toContain("VVC-XXXX");
    });
  });
});
