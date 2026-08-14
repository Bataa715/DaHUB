import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getApiAuth, isSuperAdminPayload } from "@/lib/api-auth";
import {
  isAllowedImageName,
  listTeamImages,
  teamDir,
} from "@/lib/team-gallery-fs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const payload = await getApiAuth(req);
  if (!isSuperAdminPayload(payload)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { filename: raw } = await params;
  const filename = decodeURIComponent(raw);
  if (!isAllowedImageName(filename)) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  try {
    await fs.unlink(path.join(teamDir(), filename));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const slides = await listTeamImages();
  return NextResponse.json({ ok: true, slides });
}
