import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface OracleDashboardConfig {
  id: number;
  name: string;
  tableName: string;
  /** Optional JOIN expression that replaces `tableName` in FROM clauses.
   *  Example: "DATA_ANALYST.EAH_PHONE_MAIL M JOIN DATA_ANALYST.SUS_EMP_INFO E ON E.EMPLOYEE_CODE = M.MODIFIED_BY" */
  fromClause?: string;
  cifColumn: string;
  dateColumn: string | null;
  amountColumn: string | null;
  enabled: boolean;
}

export interface EventChainConfig {
  id: number;
  name: string;
  description: string;
  sourceLabel: string;
  targetLabel: string;
  sourceIds: number[];
  targetIds: number[];
  enabled: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data", "oracle");
const DASHBOARDS_PATH = path.join(DATA_DIR, "oracle-dashboards.json");
const CHAINS_PATH = path.join(DATA_DIR, "event-chains.json");

const IDENT_RE = /^[A-Z_][A-Z0-9_.]*$/i;

@Injectable()
export class OracleConfigService {
  private readonly logger = new Logger(OracleConfigService.name);

  loadDashboards(): OracleDashboardConfig[] {
    try {
      return JSON.parse(fs.readFileSync(DASHBOARDS_PATH, "utf-8"));
    } catch {
      this.logger.warn(
        `oracle-dashboards.json унших боломжгүй: ${DASHBOARDS_PATH}`,
      );
      return [];
    }
  }

  getEnabledDashboards(): OracleDashboardConfig[] {
    return this.loadDashboards().filter((d) => d.enabled);
  }

  loadChains(): EventChainConfig[] {
    try {
      return JSON.parse(fs.readFileSync(CHAINS_PATH, "utf-8"));
    } catch {
      this.logger.warn(`event-chains.json унших боломжгүй: ${CHAINS_PATH}`);
      return [];
    }
  }

  getEnabledChains(): EventChainConfig[] {
    return this.loadChains().filter((c) => c.enabled);
  }

  validateIdentifier(name: string, value: string) {
    if (!IDENT_RE.test(value)) {
      throw new Error(`${name} буруу формат. Зөвхөн [A-Z0-9_.] зөвшөөрнө`);
    }
  }
}
