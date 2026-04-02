import { parseSchema } from '@/lib/schema-parser';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const MD_PATH = path.join(process.cwd(), '..', 'Database_Dictionary.md');

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
      return NextResponse.json({ error: 'table, column, and description are required' }, { status: 400 });
    }

    // Sanitise: disallow pipe characters which would break the MD table
    const safeDesc = String(description).replace(/\|/g, '/').trim() || '—';

    let content = fs.readFileSync(MD_PATH, 'utf8');

    // Locate the table section heading: ### 📋 `TABLE`
    const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headingRegex = new RegExp(`(^### [^\`\n]*\`${escapedTable}\`)`, 'm');
    const headingMatch = headingRegex.exec(content);
    if (!headingMatch) {
      return NextResponse.json({ error: `Table "${table}" not found in MD` }, { status: 404 });
    }

    const sectionStart = headingMatch.index;
    // Find the start of the next section (## or ###) to bound the replacement
    const afterHeading = content.slice(sectionStart + headingMatch[0].length);
    const nextSectionMatch = /^#{2,3} /m.exec(afterHeading);
    const sectionEnd = nextSectionMatch
      ? sectionStart + headingMatch[0].length + nextSectionMatch.index
      : content.length;

    const section = content.slice(sectionStart, sectionEnd);

    // Replace the description cell in the column row
    const escapedCol = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const colRegex = new RegExp(
      `(\\| \\*\\*${escapedCol}\\*\\* \\| \`[^|]+\` \\| )[^|\r\n]*(\\|)`,
    );
    if (!colRegex.test(section)) {
      return NextResponse.json({ error: `Column "${column}" not found in table "${table}"` }, { status: 404 });
    }

    const newSection = section.replace(colRegex, `$1${safeDesc} $2`);
    const newContent = content.slice(0, sectionStart) + newSection + content.slice(sectionEnd);
    fs.writeFileSync(MD_PATH, newContent, 'utf8');

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
