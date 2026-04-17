import { IsString, IsIn, IsOptional, IsNotEmpty } from "class-validator";

export class CreatePythonToolDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /** URL slug — /python-api/run/:apiPath дээр ашиглагдана */
  @IsString()
  @IsNotEmpty()
  apiPath: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  pythonCode: string;

  @IsIn(["clickhouse", "oracle", "mssql", "none"])
  @IsOptional()
  connectionType?: "clickhouse" | "oracle" | "mssql" | "none";

  /** JSON string — { host, port, user, password, database, dsn, serviceName, ... } */
  @IsString()
  @IsOptional()
  connectionConfig?: string;

  @IsIn(["excel", "csv"])
  @IsOptional()
  outputFormat?: "excel" | "csv";

  @IsIn(["none", "single", "range"])
  @IsOptional()
  dateMode?: "none" | "single" | "range";

  @IsString()
  @IsOptional()
  color?: string;

  /** JSON string of FilterDef[] */
  @IsString()
  @IsOptional()
  filters?: string;
}

export class UpdatePythonToolDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  apiPath?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  pythonCode?: string;

  @IsIn(["clickhouse", "oracle", "mssql", "none"])
  @IsOptional()
  connectionType?: "clickhouse" | "oracle" | "mssql" | "none";

  @IsString()
  @IsOptional()
  connectionConfig?: string;

  @IsIn(["excel", "csv"])
  @IsOptional()
  outputFormat?: "excel" | "csv";

  @IsIn(["none", "single", "range"])
  @IsOptional()
  dateMode?: "none" | "single" | "range";

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  filters?: string;
}

export class RunToolDto {
  @IsString()
  @IsNotEmpty()
  toolId: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  filters?: Record<string, string>;
}
