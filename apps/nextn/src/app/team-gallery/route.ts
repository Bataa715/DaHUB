import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getApiAuth, isSuperAdminPayload } from "@/lib/api-auth";
import {
  listTeamImages,
  teamDir,
  uniqueTeamPath,
  safeTeamFilename,
} from "@/lib/team-gallery-fs";

/** Жагсаалт — auth шаардахгүй, зураг `public/team`-аас. */
export async function GET() {
  const slides = await listTeamImages();
  if (slides.length === 0) {
    return NextResponse.json({
      slides: [
        { id: "Team1.png", src: "/team/Team1.png", alt: "Team 1" },
        { id: "Team2.png", src: "/team/Team2.png", alt: "Team 2" },
      ],
    });
  }
  return NextResponse.json({ slides });
}

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

/** Superadmin л `public/team` руу зураг оруулна. `/api` биш — prod proxy Nest руу явуулахгүй. */
export async function POST(req: NextRequest) {
  const payload = await getApiAuth(req);
  if (!isSuperAdminPayload(payload)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  }
  const mime = file.type || "";
  if (mime && !ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "unsupported type" }, { status: 400 });
  }

  const filename = await uniqueTeamPath(safeTeamFilename(file.name));
  const dir = teamDir();
  await fs.mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, filename), buf);

  const slides = await listTeamImages();
  return NextResponse.json({ ok: true, filename, slides });
}
