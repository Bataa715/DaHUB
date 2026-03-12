import { Test, TestingModule } from "@nestjs/testing";
import { TailanService } from "../src/tailan/tailan.service";
import { ClickHouseService } from "../src/clickhouse/clickhouse.service";

function makeClickhouse() {
  return {
    query: jest.fn(),
    insert: jest.fn().mockResolvedValue(undefined),
    exec: jest.fn().mockResolvedValue(undefined),
  };
}

const BASE_USER = {
  id: "user-1",
  name: "Болд",
  position: "Ахлах аудитор",
  department: "Дата анализын алба",
  departmentId: "dept-1",
  isAdmin: false,
  isSuperAdmin: false,
  allowedTools: [] as string[],
};

const SAVE_DTO = {
  year: 2024,
  quarter: 1,
  plannedTasks: [],
  dynamicSections: [],
  teamActivities: [],
};

describe("TailanService", () => {
  let service: TailanService;
  let ch: ReturnType<typeof makeClickhouse>;

  beforeEach(async () => {
    ch = makeClickhouse();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TailanService,
        { provide: ClickHouseService, useValue: ch },
      ],
    }).compile();
    service = module.get<TailanService>(TailanService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── isDeptHead ─────────────────────────────────────────────────────────────

  describe("isDeptHead", () => {
    it("returns true for admin user", () => {
      expect(service.isDeptHead({ ...BASE_USER, isAdmin: true })).toBe(true);
    });

    it("returns true for superAdmin user", () => {
      expect(service.isDeptHead({ ...BASE_USER, isSuperAdmin: true })).toBe(true);
    });

    it("returns true when user has tailan_dept_head tool", () => {
      expect(
        service.isDeptHead({
          ...BASE_USER,
          allowedTools: ["tailan_dept_head"],
        }),
      ).toBe(true);
    });

    it("returns false for regular user without tailan_dept_head tool", () => {
      expect(service.isDeptHead({ ...BASE_USER, allowedTools: [] })).toBe(false);
    });

    it("returns false when user only has unrelated tools", () => {
      expect(
        service.isDeptHead({
          ...BASE_USER,
          allowedTools: ["tailan"],
        }),
      ).toBe(false);
    });
  });

  // ── saveDraft ─────────────────────────────────────────────────────────────

  describe("saveDraft", () => {
    it("creates a new draft when none exists", async () => {
      ch.query.mockResolvedValueOnce([]); // no existing draft
      await service.saveDraft(BASE_USER, SAVE_DTO);
      expect(ch.insert).toHaveBeenCalledWith(
        "tailan_reports",
        expect.arrayContaining([
          expect.objectContaining({
            userId: "user-1",
            year: 2024,
            quarter: 1,
          }),
        ]),
      );
    });

    it("updates existing draft with same id", async () => {
      ch.query.mockResolvedValueOnce([{ id: "existing-draft-id" }]);
      await service.saveDraft(BASE_USER, SAVE_DTO);
      const inserted = ch.insert.mock.calls[0][1][0];
      expect(inserted.id).toBe("existing-draft-id");
    });

    it("returns id and message", async () => {
      ch.query.mockResolvedValueOnce([]);
      const result = await service.saveDraft(BASE_USER, SAVE_DTO);
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("message");
    });
  });

  // ── getMyReport ───────────────────────────────────────────────────────────

  describe("getMyReport", () => {
    it("returns null when report not found", async () => {
      ch.query.mockResolvedValueOnce([]);
      const result = await service.getMyReport(BASE_USER.id, 2024, 1);
      expect(result).toBeNull();
    });
    });

    it("returns report when found", async () => {
      const mockReport = {
        id: "draft-1",
        userId: "user-1",
        year: 2024,
        quarter: 1,
        plannedTasks: "[]",
        dynamicSections: "[]",
        teamActivities: "[]",
      };
      ch.query.mockResolvedValueOnce([mockReport]);
      const result = await service.getMyReport(BASE_USER.id, 2024, 1);
      expect(result.id).toBe("draft-1");
    });
  });
