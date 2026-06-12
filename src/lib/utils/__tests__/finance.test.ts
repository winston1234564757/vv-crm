import { describe, it, expect } from "vitest";
import { calculateDiscountedPrice, calculateRemainingSplit } from "../finance";

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
});
