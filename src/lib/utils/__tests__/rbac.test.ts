import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole } from "../rbac";
import * as serverModule from "@/lib/supabase/server";

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
});
