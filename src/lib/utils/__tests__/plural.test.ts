import { describe, it, expect } from "vitest";
import { pluralUk } from "../plural";

describe("Plural Utils", () => {
  it("should return the correct form for 1", () => {
    expect(pluralUk(1, "день", "дні", "днів")).toBe("день");
    expect(pluralUk(21, "день", "дні", "днів")).toBe("день");
    expect(pluralUk(101, "день", "дні", "днів")).toBe("день");
  });

  it("should return the correct form for 2-4", () => {
    expect(pluralUk(2, "день", "дні", "днів")).toBe("дні");
    expect(pluralUk(3, "день", "дні", "днів")).toBe("дні");
    expect(pluralUk(4, "день", "дні", "днів")).toBe("дні");
    expect(pluralUk(22, "день", "дні", "днів")).toBe("дні");
    expect(pluralUk(104, "день", "дні", "днів")).toBe("дні");
  });

  it("should return the correct form for 5-20 and 0", () => {
    expect(pluralUk(0, "день", "дні", "днів")).toBe("днів");
    expect(pluralUk(5, "день", "дні", "днів")).toBe("днів");
    expect(pluralUk(11, "день", "дні", "днів")).toBe("днів");
    expect(pluralUk(19, "день", "дні", "днів")).toBe("днів");
    expect(pluralUk(20, "день", "дні", "днів")).toBe("днів");
    expect(pluralUk(111, "день", "дні", "днів")).toBe("днів");
  });
});
