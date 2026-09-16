import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OracleConfigService } from "./oracle-config.service";

/**
 * [SEC] Alert Box-ийн хүснэгт/баганын нэр Oracle SQL-д шууд залгагддаг тул
 * хадгалахаас өмнө шалгалт заавал ажиллах ёстой — DB рүү огт бичихгүй.
 */
function makeService() {
  const clickhouse = {
    query: vi.fn().mockResolvedValue([{ maxId: 0 }]),
    exec: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockResolvedValue(undefined),
  };
  return {
    svc: new OracleConfigService(clickhouse as never),
    clickhouse,
  };
}

const base = {
  name: "Test",
  tableName: "AML.TXN",
  cifColumn: "CIF_ID",
};

describe("OracleConfigService — SQL нэрийн шалгалт", () => {
  it.each([
    ["системийн хүснэгт ($)", "AML.TXN T JOIN SYS.USER$ U ON T.X = U.Y"],
    ["тэмдэгт мөр", "AML.TXN WHERE X = 'a'"],
    ["subquery", "AML.TXN WHERE X IN (SELECT 1 FROM DUAL)"],
    ["тайлбар", "AML.TXN --"],
    ["цэгтэй таслал", "AML.TXN; DROP TABLE X"],
    ["#", "AML.TXN#"],
  ])("fromClause-д %s зөвшөөрөхгүй", async (_label, fromClause) => {
    const { svc, clickhouse } = makeService();
    await expect(
      svc.createDashboard({ ...base, fromClause }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(clickhouse.insert).not.toHaveBeenCalled();
  });

  it("энгийн JOIN ... ON нөхцөлийг зөвшөөрнө", async () => {
    const { svc, clickhouse } = makeService();
    await svc.createDashboard({
      ...base,
      fromClause: "AML.TXN T LEFT JOIN AML.CUST C ON T.CIF_ID = C.CIF_ID",
    });
    expect(clickhouse.insert).toHaveBeenCalled();
  });

  it.each(["CIF ID", "CIF;", "A.B.C"])(
    "буруу баганын нэр %s-г зөвшөөрөхгүй",
    async (cifColumn) => {
      const { svc } = makeService();
      await expect(
        svc.createDashboard({ ...base, cifColumn }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
