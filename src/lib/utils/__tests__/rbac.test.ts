import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole, checkRole } from "../rbac";

const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockGetUser = vi.fn();

const mockSupabase = {
  auth: {
    getUser: mockGetUser,
  },
  from: mockFrom,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe("RBAC Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ single: mockSingle });
  });

  describe("requireRole", () => {
    it("should not throw if user has required role", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "123" } },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: { role: "owner" },
        error: null,
      });

      await expect(requireRole(["owner"])).resolves.not.toThrow();
    });

    it("should throw an error if user lacks required role", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "123" } },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: { role: "technician" },
        error: null,
      });

      await expect(requireRole(["owner"])).rejects.toThrow("Доступ заборонено: потрібна роль [owner], ваша роль: technician");
    });
  });

  // checkRole існує саме тому, що Route Handler не може дозволити собі throw:
  // він перетворився б на 500 і став невідрізнимим від збою Gemini.
  describe("checkRole", () => {
    it("повертає ok з роллю, коли роль дозволена", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "123" } }, error: null });
      mockSingle.mockResolvedValue({ data: { role: "manager" }, error: null });

      const result = await checkRole(["owner", "manager"]);

      expect(result).toMatchObject({ ok: true, role: "manager" });
    });

    it("повертає 401 для неавтентифікованого", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const result = await checkRole(["owner"]);

      expect(result).toMatchObject({ ok: false, status: 401 });
    });

    it("повертає 403 і не кидає, коли роль чужа", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "123" } }, error: null });
      mockSingle.mockResolvedValue({ data: { role: "sales" }, error: null });

      const result = await checkRole(["owner", "manager"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(403);
        expect(result.error).toContain("sales");
      }
    });

    it("відмовляє, якщо профіль не прочитався — не падає у роль за замовчуванням", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "123" } }, error: null });
      mockSingle.mockResolvedValue({ data: null, error: { message: "RLS denied" } });

      const result = await checkRole(["sales"]);

      expect(result).toMatchObject({ ok: false, status: 403 });
    });
  });
});
