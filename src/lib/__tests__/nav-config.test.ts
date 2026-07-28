import { describe, it, expect } from "vitest";
import { visibleGroups, visibleItems, NAV_GROUPS } from "@/lib/nav-config";

const ids = (role: string | null) => visibleGroups(role).map((g) => g.id);

const hrefs = (role: string | null, groupId: string) =>
  visibleGroups(role)
    .find((g) => g.id === groupId)
    ?.items.map((i) => i.href) ?? [];

describe("visibleGroups", () => {
  it("власник бачить усі групи", () => {
    expect(visibleGroups("owner")).toHaveLength(NAV_GROUPS.length);
  });

  it("менеджер бачить фінанси, але не власницькі розділи", () => {
    const visible = ids("manager");
    expect(visible).toContain("finance");
    expect(visible).not.toContain("analytics");
    expect(visible).not.toContain("store-launch");
    expect(visible).not.toContain("settings");
  });

  it("продавець не бачить фінансів", () => {
    expect(ids("sales")).not.toContain("finance");
  });

  it("технік не бачить фінансів, але бачить роботу і склад", () => {
    const visible = ids("technician");
    expect(visible).not.toContain("finance");
    expect(visible).toEqual(expect.arrayContaining(["work", "inventory"]));
  });

  // Роль тягнеться useEffect-ом уже після першого рендера. Якби фільтр падав
  // відкрито, посилання на фінанси блимало б у всіх до її приходу.
  it("падає закрито, поки роль ще не завантажилась", () => {
    expect(ids(null)).not.toContain("finance");
    expect(ids(undefined as unknown as null)).not.toContain("finance");
  });

  it("групи без обмежень лишаються видимими будь-кому", () => {
    expect(ids(null)).toEqual(expect.arrayContaining(["dashboard", "work"]));
  });
});

// «Закупівлі» — обмежений пункт усередині відкритої групи «Склад». Групового
// фільтра тут мало: техніку потрібні техніка й запчастини з тієї ж групи.
describe("visibleItems", () => {
  it("технік бачить склад, але без закупівель", () => {
    const items = hrefs("technician", "inventory");
    expect(items).toEqual(
      expect.arrayContaining(["/admin/devices", "/admin/accessories", "/admin/suppliers"]),
    );
    expect(items).not.toContain("/admin/purchases");
  });

  it("менеджер бачить закупівлі", () => {
    expect(hrefs("manager", "inventory")).toContain("/admin/purchases");
  });

  it("невідома роль не бачить закупівель", () => {
    expect(hrefs(null, "inventory")).not.toContain("/admin/purchases");
  });

  it("група лишається видимою, коли обмежений лише один її пункт", () => {
    expect(ids("technician")).toContain("inventory");
  });

  it("visibleItems фільтрує ту саму групу напряму", () => {
    const inventory = NAV_GROUPS.find((g) => g.id === "inventory")!;
    expect(visibleItems(inventory, "sales").map((i) => i.href)).not.toContain(
      "/admin/purchases",
    );
    expect(visibleItems(inventory, "owner").map((i) => i.href)).toContain(
      "/admin/purchases",
    );
  });
});
