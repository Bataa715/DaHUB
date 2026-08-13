/**
 * WordPreview HTML-ийг жинхэнэ .docx болгон татна.
 * OOXML altChunk ашиглана — Microsoft Word нээхэд preview-тэй ижил өнгө/хүснэгт харагдана.
 */
import JSZip from "jszip";

const EXPORT_ROOT_ID = "dept-word-preview-export";

export function getDeptWordPreviewExportRoot(): HTMLElement | null {
  return document.getElementById(EXPORT_ROOT_ID);
}

export { EXPORT_ROOT_ID };

function cleanupClone(root: HTMLElement) {
  root.querySelectorAll("[contenteditable]").forEach((el) => {
    el.removeAttribute("contenteditable");
  });
  root
    .querySelectorAll("button, [data-no-export]")
    .forEach((el) => el.remove());
}

function buildHtmlDocument(innerHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    color: #000;
  }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 0.5pt solid #000; }
  img { max-width: 100%; }
  [data-page-break] { page-break-before: always; }
</style>
</head>
<body>
${innerHtml}
</body>
</html>`;
}

/** HTML → valid .docx (Word altChunk). Returns Blob. */
async function htmlToDocxBlob(html: string): Promise<Blob> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="html" ContentType="text/html"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/afchunk.html" ContentType="text/html"/>
</Types>`,
  );

  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  const word = zip.folder("word")!;
  word.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="htmlChunk"/>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="907" w:right="1020" w:bottom="794" w:left="1020"/>
    </w:sectPr>
  </w:body>
</w:document>`,
  );

  word.folder("_rels")!.file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="htmlChunk" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/>
</Relationships>`,
  );

  word.file("afchunk.html", html);

  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function downloadDeptWordFromPreview(
  year: number,
  quarter: number,
): Promise<void> {
  const source = getDeptWordPreviewExportRoot();
  if (!source) {
    throw new Error("Word preview олдсонгүй");
  }

  const clone = source.cloneNode(true) as HTMLElement;
  cleanupClone(clone);

  const html = buildHtmlDocument(clone.innerHTML);
  const blob = await htmlToDocxBlob(html);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tailan_${year}_Q${quarter}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
