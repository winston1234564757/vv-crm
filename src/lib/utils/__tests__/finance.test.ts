import { describe, it, expect } from "vitest";
import { 
  calculateDiscountedPrice, calculateRemainingSplit, validatePrice, validateStock, 
  validatePhotoUrl, validatePart, validateWarehousePart, validateDiscount, validateSplitPayment 
} from "../finance";

describe("Finance Utils", () => {
  describe("calculateDiscountedPrice", () => {
    it("should calculate price with discount correctly", () => {
      expect(calculateDiscountedPrice(1000, 10)).toBe(900);
      expect(calculateDiscountedPrice(150, 15)).toBe(128); // 150 * 0.85 = 127.5 -> rounded to 128
      expect(calculateDiscountedPrice(100, 0)).toBe(100);
      expect(calculateDiscountedPrice(100, 100)).toBe(0);
    });

    it("should handle boundary conditions and invalid inputs", () => {
      expect(calculateDiscountedPrice(-50, 10)).toBe(0);
      expect(calculateDiscountedPrice(100, -10)).toBe(100);
      expect(calculateDiscountedPrice(100, 150)).toBe(0);
    });
  });

  describe("calculateRemainingSplit", () => {
    it("should calculate remaining split sum correctly", () => {
      expect(calculateRemainingSplit(1000, 500, 500)).toBe(0);
      expect(calculateRemainingSplit(1000, 400, 300)).toBe(300);
      expect(calculateRemainingSplit(1000, 700, 400)).toBe(-100);
    });

    it("should handle edge cases with zero and negative numbers", () => {
      expect(calculateRemainingSplit(0, 0, 0)).toBe(0);
      expect(calculateRemainingSplit(100, -50, 0)).toBe(150); // 100 - (-50) = 150
      expect(calculateRemainingSplit(-100, -50, -50)).toBe(0); // -100 - (-50) - (-50) = 0
    });
  });

  describe("validatePrice", () => {
    it("should validate correct price", () => {
      expect(validatePrice(100)).toBe(100);
      expect(validatePrice("100")).toBe(100);
      expect(validatePrice(0)).toBe(0);
    });
    it("should throw on invalid price", () => {
      expect(() => validatePrice(-10)).toThrow();
      expect(() => validatePrice("abc")).toThrow();
    });
  });

  describe("validateStock", () => {
    it("should validate correct stock", () => {
      expect(validateStock(5)).toBe(5);
      expect(validateStock("5")).toBe(5);
      expect(validateStock(0)).toBe(0);
    });
    it("should throw on invalid stock", () => {
      expect(() => validateStock(-1)).toThrow();
      expect(() => validateStock(1.5)).toThrow();
      expect(() => validateStock("abc")).toThrow();
    });
  });

  describe("validatePhotoUrl", () => {
    it("should validate correct url", () => {
      expect(validatePhotoUrl("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
    });
    it("should throw on invalid url", () => {
      expect(() => validatePhotoUrl(123)).toThrow();
      expect(() => validatePhotoUrl("not-a-url")).toThrow();
    });
  });

  describe("validatePart", () => {
    it("should validate correct part", () => {
      expect(validatePart({ name: "Battery", cost: 100, origin: "supplier" })).toEqual({ name: "Battery", cost: 100, origin: "supplier" });
    });
    it("should throw on invalid part", () => {
      expect(() => validatePart(null)).toThrow();
      expect(() => validatePart({ cost: 100, origin: "supplier" })).toThrow();
      expect(() => validatePart({ name: "Battery", cost: -10, origin: "supplier" })).toThrow();
      expect(() => validatePart({ name: "Battery", cost: 100 })).toThrow();
    });
  });

  describe("validateWarehousePart", () => {
    it("should validate correct warehouse part", () => {
      const part = { id: "123", name: "Screen", cost_price: 50, origin_type: "supplier", stock: 10 };
      expect(validateWarehousePart(part)).toEqual(part);
    });
    it("should throw on invalid warehouse part", () => {
      expect(() => validateWarehousePart(null)).toThrow();
      expect(() => validateWarehousePart({ name: "Screen", cost_price: 50, origin_type: "supplier", stock: 10 })).toThrow();
      expect(() => validateWarehousePart({ id: "123", name: "Screen", cost_price: -50, origin_type: "supplier", stock: 10 })).toThrow();
      expect(() => validateWarehousePart({ id: "123", name: "Screen", cost_price: 50, origin_type: "supplier", stock: -10 })).toThrow();
    });
  });

  describe("validateDiscount", () => {
    it("should validate correct discount", () => {
      expect(validateDiscount(10)).toBe(10);
      expect(validateDiscount(0)).toBe(0);
      expect(validateDiscount(100)).toBe(100);
    });
    it("should throw on invalid discount", () => {
      expect(() => validateDiscount(-10)).toThrow();
      expect(() => validateDiscount(101)).toThrow();
      expect(() => validateDiscount("abc")).toThrow();
    });
  });

  describe("validateSplitPayment", () => {
    it("should validate correct split payment", () => {
      expect(validateSplitPayment(1000, 400, 600)).toEqual({ cash: 400, card: 600 });
      expect(validateSplitPayment(1000, 0, 1000)).toEqual({ cash: 0, card: 1000 });
    });
    it("should throw on invalid split payment", () => {
      expect(() => validateSplitPayment(1000, -100, 1100)).toThrow();
      expect(() => validateSplitPayment(1000, 600, 600)).toThrow(); // exceeds total
      expect(() => validateSplitPayment(1000, "abc", 1000)).toThrow();
    });
  });
});
