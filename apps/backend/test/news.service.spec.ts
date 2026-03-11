import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { NewsService } from "../src/news/news.service";
import { ClickHouseService } from "../src/clickhouse/clickhouse.service";

function makeClickhouse() {
  return {
    query: jest.fn(),
    insert: jest.fn().mockResolvedValue(undefined),
    exec: jest.fn().mockResolvedValue(undefined),
  };
}

const BASE_NEWS = {
  id: "news-1",
  title: "Тест мэдээ",
  content: "Тест контент",
  category: "Ерөнхий",
  hasImage: 0,
  authorId: "user-1",
  authorName: "Болд",
  isPublished: 1,
  views: 5,
  imageMime: "",
  imageUrl: "",
  createdAt: "2024-01-01 00:00:00",
  updatedAt: "2024-01-01 00:00:00",
};

describe("NewsService", () => {
  let service: NewsService;
  let ch: ReturnType<typeof makeClickhouse>;

  beforeEach(async () => {
    ch = makeClickhouse();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: ClickHouseService, useValue: ch },
      ],
    }).compile();
    service = module.get<NewsService>(NewsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    it("inserts record and returns id", async () => {
      const result = await service.create(
        { title: "Тест", content: "Тест контент" },
        "user-1",
      );
      expect(result).toHaveProperty("id");
      expect(result.message).toContain("амжилттай");
      expect(ch.insert).toHaveBeenCalledWith(
        "news",
        expect.arrayContaining([
          expect.objectContaining({ title: "Тест" }),
        ]),
      );
    });

    it("parses base64 data URL into imageData + imageMime", async () => {
      const b64 = Buffer.from("fake").toString("base64");
      await service.create(
        {
          title: "img",
          content: "c",
          imageUrl: `data:image/jpeg;base64,${b64}`,
        },
        "user-1",
      );
      const inserted = ch.insert.mock.calls[0][1][0];
      expect(inserted.imageMime).toBe("image/jpeg");
      expect(inserted.imageUrl).toBe(b64);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns news with image URL rewritten", async () => {
      ch.query.mockResolvedValueOnce([{ ...BASE_NEWS, hasImage: 1 }]);
      const result = await service.findAll(true);
      expect(result[0].imageUrl).toBe(`/news/${BASE_NEWS.id}/image`);
    });

    it("returns news with empty imageUrl when no image", async () => {
      ch.query.mockResolvedValueOnce([BASE_NEWS]);
      const result = await service.findAll(true);
      expect(result[0].imageUrl).toBe("");
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("throws NotFoundException when news not found", async () => {
      ch.query.mockResolvedValueOnce([]);
      await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns news and increments views", async () => {
      ch.query.mockResolvedValueOnce([BASE_NEWS]);
      const result = await service.findOne("news-1");
      expect(result.id).toBe("news-1");
      expect(ch.exec).toHaveBeenCalled(); // view increment
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("throws NotFoundException when news not found", async () => {
      ch.query.mockResolvedValueOnce([]);
      await expect(service.remove("missing")).rejects.toThrow(NotFoundException);
    });

    it("deletes news record", async () => {
      ch.query.mockResolvedValueOnce([BASE_NEWS]);
      await service.remove("news-1");
      expect(ch.exec).toHaveBeenCalled();
    });
  });

  // ── getNewsImage ──────────────────────────────────────────────────────────

  describe("getNewsImage", () => {
    it("returns null when no imageUrl", async () => {
      ch.query.mockResolvedValueOnce([{ imageUrl: "", imageMime: "" }]);
      expect(await service.getNewsImage("news-1")).toBeNull();
    });

    it("falls back to image/jpeg for unknown MIME type", async () => {
      const b64 = Buffer.from("fake").toString("base64");
      ch.query.mockResolvedValueOnce([
        { imageUrl: b64, imageMime: "image/svg+xml" },
      ]);
      const result = await service.getNewsImage("news-1");
      expect(result!.mimeType).toBe("image/jpeg");
    });

    it("returns correct MIME for allowed types", async () => {
      const b64 = Buffer.from("fake").toString("base64");
      ch.query.mockResolvedValueOnce([
        { imageUrl: b64, imageMime: "image/png" },
      ]);
      const result = await service.getNewsImage("news-1");
      expect(result!.mimeType).toBe("image/png");
    });
  });

  // ── update (MIME whitelist) ───────────────────────────────────────────────

  describe("update image MIME validation", () => {
    it("skips storing image when MIME is not whitelisted (SVG)", async () => {
      ch.query.mockResolvedValueOnce([BASE_NEWS]); // news exists
      const svgB64 = Buffer.from("<svg/>").toString("base64");
      await service.update("news-1", {
        imageUrl: `data:image/svg+xml;base64,${svgB64}`,
      });
      // exec should NOT have been called for imageUrl update
      const imageUpdateCall = ch.exec.mock.calls.find(
        ([sql]: [string]) => sql.includes("imageMime"),
      );
      expect(imageUpdateCall).toBeUndefined();
    });

    it("stores image when MIME is whitelisted (JPEG)", async () => {
      ch.query.mockResolvedValueOnce([BASE_NEWS]);
      ch.query.mockResolvedValueOnce([BASE_NEWS]); // re-fetch
      const jpegB64 = Buffer.from("fakeimage").toString("base64");
      await service.update("news-1", {
        imageUrl: `data:image/jpeg;base64,${jpegB64}`,
      });
      const imageUpdateCall = ch.exec.mock.calls.find(
        ([sql]: [string]) => sql.includes("imageMime"),
      );
      expect(imageUpdateCall).toBeDefined();
    });
  });
});
