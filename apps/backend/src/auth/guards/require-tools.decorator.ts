import { SetMetadata } from "@nestjs/common";

export const REQUIRE_TOOLS_KEY = "require_tools";

/** JWT хэрэглэгчийн allowedTools-д аль нэг нь байх ёстой (admin bypass). */
export const RequireTools = (...tools: string[]) =>
  SetMetadata(REQUIRE_TOOLS_KEY, tools);
