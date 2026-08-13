// Minimal ambient declaration for `compression` (avoids @types/compression dep).
declare module "compression" {
  import { RequestHandler } from "express";

  interface CompressionOptions {
    threshold?: number | string;
    level?: number;
    filter?: (req: unknown, res: unknown) => boolean;
  }

  function compression(options?: CompressionOptions): RequestHandler;
  export = compression;
}
