import { type OracleValue } from "../scoring-rules";

export type AnyRow = {
  SOLID?: OracleValue;
  BRANCHID?: OracleValue;
  BRANCHNAME?: OracleValue;
  STATUS?: OracleValue;
  SUBID?: OracleValue;
  RESULT?: OracleValue;
  RESULT_TYPE?: OracleValue;
  sourceFetchedDate?: string;
};
