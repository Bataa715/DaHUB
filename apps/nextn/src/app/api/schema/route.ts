import { parseSchema, getMdPath } from "@/lib/schema-parser";
import { NextResponse } from "next/server";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const schema = parseSchema();
    return NextResponse.json(schema);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { table, column, description } = body as {
      table: string;
      column: string;
      description: string;
    };

    if (!table || !column || description === undefined) {
      return NextResponse.json(
        { error: "table, column, description шаардлагатай" },
        { status: 400 },
      );
    }

    const safeDesc = String(description).replace(/\|/g, "/").trim() || "—";
    const mdPath = getMdPath();

    let content: string;
    try {
      content = fs.readFileSync(mdPath, "utf8");
    } catch {
      return NextResponse.json({ error: "MD файл олдсонгүй" }, { status: 404 });
    }

    const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const headingRegex = new RegExp(`(^### [^\`\n]*\`${escapedTable}\`)`, "m");
    const headingMatch = headingRegex.exec(content);
    if (!headingMatch) {
      return NextResponse.json(
        { error: `"${table}" хүснэгт MD файлд олдсонгүй` },
        { status: 404 },
      );
    }

    const sectionStart = headingMatch.index;
    const afterHeading = content.slice(sectionStart + headingMatch[0].length);
    const nextSectionMatch = /^#{2,3} /m.exec(afterHeading);
    const sectionEnd = nextSectionMatch
      ? sectionStart + headingMatch[0].length + nextSectionMatch.index
      : content.length;

    const section = content.slice(sectionStart, sectionEnd);

    const escapedCol = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const colRegex = new RegExp(
      `(\\| \\*\\*${escapedCol}\\*\\* \\| \`[^|]+\` \\| )[^|\r\n]*(\\|)`,
    );
    if (!colRegex.test(section)) {
      return NextResponse.json(
        { error: `"${column}" багана "${table}" хүснэгтэд олдсонгүй` },
        { status: 404 },
      );
    }

    const newSection = section.replace(colRegex, `$1${safeDesc} $2`);
    const newContent = content.slice(0, sectionStart) + newSection + content.slice(sectionEnd);
    fs.writeFileSync(mdPath, newContent, "utf8");

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
