import { describe, it, expect } from "vitest";
import { phoneKey, samePhone } from "@/lib/utils/phone";

describe("phoneKey", () => {
  it("зводить різні записи одного номера до спільного хвоста", () => {
    const key = phoneKey("0982180430");
    expect(phoneKey("+380982180430")).toBe(key);
    expect(phoneKey("380982180430")).toBe(key);
    expect(phoneKey("38 (098) 218-04-30")).toBe(key);
    expect(key).toBe("982180430");
  });

  it("повертає порожнє для закоротких і порожніх значень", () => {
    expect(phoneKey("12345")).toBe("");
    expect(phoneKey("")).toBe("");
    expect(phoneKey(null)).toBe("");
    expect(phoneKey(undefined)).toBe("");
  });
});

describe("samePhone", () => {
  it("впізнає той самий номер у різних форматах", () => {
    expect(samePhone("0982180430", "+380982180430")).toBe(true);
    expect(samePhone("098 218 04 30", "380982180430")).toBe(true);
  });

  it("розрізняє різні номери", () => {
    expect(samePhone("0982180430", "0982180431")).toBe(false);
  });

  // Інакше двоє клієнтів без телефону злилися б в одного.
  it("порожні значення не збігаються ні з чим", () => {
    expect(samePhone("", "")).toBe(false);
    expect(samePhone(null, "0982180430")).toBe(false);
    expect(samePhone("123", "456")).toBe(false);
  });
});
