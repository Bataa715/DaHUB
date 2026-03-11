import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { DepartmentsService } from "../src/departments/departments.service";
import { ClickHouseService } from "../src/clickhouse/clickhouse.service";

function makeClickhouse() {
  return {
    query: jest.fn(),
    insert: jest.fn().mockResolvedValue(undefined),
    exec: jest.fn().mockResolvedValue(undefined),
  };
}

const JPEG_B64 = `data:image/jpeg;base64,${Buffer.from("fakeimage").toString("base64")}`;
const PNG_B64 = `data:image/png;base64,${Buffer.from("fakeimage").toString("base64")}`;
const SVG_B64 = `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`;
const HTML_B64 = `data:text/html;base64,${Buffer.from("<script>").toString("base64")}`;

describe("DepartmentsService", () => {
  let service: DepartmentsService;
  let ch: ReturnType<typeof makeClickhouse>;

  beforeEach(async () => {
    ch = makeClickhouse();
    // ensurePhotosTable runs in constructor — let exec always resolve
    ch.exec.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: ClickHouseService, useValue: ch },
      ],
    }).compile();
    service = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── uploadPhoto ──────────────────────────────────────────────────────────

  describe("uploadPhoto", () => {
    it("throws BadRequestException for SVG MIME type", async () => {
      await expect(
        service.uploadPhoto("dept-1", "Тест", "user-1", "Нямаа", SVG_B64),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for HTML MIME type", async () => {
      await expect(
        service.uploadPhoto("dept-1", "Тест", "user-1", "Нямаа", HTML_B64),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for missing data URL format", async () => {
      await expect(
        service.uploadPhoto("dept-1", "Тест", "user-1", "Нямаа", "notaurl"),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for image > 7MB", async () => {
      const bigData = `data:image/jpeg;base64,${"A".repeat(7_100_000)}`;
      await expect(
        service.uploadPhoto("dept-1", "Тест", "user-1", "Нямаа", bigData),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts JPEG image", async () => {
      const result = await service.uploadPhoto(
        "dept-1",
        "Тест",
        "user-1",
        "Нямаа",
        JPEG_B64,
      );
      expect(result).toHaveProperty("id");
      expect(result.message).toContain("амжилттай");
      expect(ch.insert).toHaveBeenCalledWith(
        "department_photos",
        expect.arrayContaining([
          expect.objectContaining({ departmentId: "dept-1" }),
        ]),
      );
    });

    it("accepts PNG image", async () => {
      const result = await service.uploadPhoto(
        "dept-1",
        "Тест",
        "user-1",
        "Нямаа",
        PNG_B64,
      );
      expect(result).toHaveProperty("id");
    });
  });

  // ── getPhotoData ──────────────────────────────────────────────────────────

  describe("getPhotoData", () => {
    it("throws NotFoundException when photo not found", async () => {
      ch.query.mockResolvedValueOnce([]);
      await expect(service.getPhotoData("missing")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns photo data when found", async () => {
      ch.query.mockResolvedValueOnce([{ imageData: JPEG_B64 }]);
      const result = await service.getPhotoData("photo-1");
      expect(result.imageData).toBe(JPEG_B64);
    });
  });

  // ── getPhotos ─────────────────────────────────────────────────────────────

  describe("getPhotos", () => {
    it("returns list of photos for department", async () => {
      ch.query.mockResolvedValueOnce([{ id: "photo-1" }, { id: "photo-2" }]);
      const result = await service.getPhotos("dept-1");
      expect(result).toHaveLength(2);
    });
  });

  // ── deletePhoto ───────────────────────────────────────────────────────────

  describe("deletePhoto", () => {
    it("calls exec with correct DELETE statement", async () => {
      await service.deletePhoto("photo-1");
      expect(ch.exec).toHaveBeenCalledWith(
        expect.stringContaining("DELETE"),
        expect.objectContaining({ id: "photo-1" }),
      );
    });
  });

  // ── create department ─────────────────────────────────────────────────────

  describe("create", () => {
    it("throws ConflictException when department already exists", async () => {
      ch.query.mockResolvedValueOnce([{ id: "dept-1" }]);
      await expect(
        service.create({ name: "Дата анализын алба" }),
      ).rejects.toThrow(ConflictException);
    });

    it("creates department when name is unique", async () => {
      ch.query.mockResolvedValueOnce([]); // no existing
      ch.query.mockResolvedValueOnce([{ id: "new-id", name: "Шинэ хэлтэс" }]); // re-fetch after insert
      const result = await service.create({ name: "Шинэ хэлтэс" });
      expect(result).toHaveProperty("id");
      expect(ch.insert).toHaveBeenCalledWith(
        "departments",
        expect.arrayContaining([
          expect.objectContaining({ name: "Шинэ хэлтэс" }),
        ]),
      );
    });
  });
});
