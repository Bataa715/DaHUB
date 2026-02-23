import { Injectable } from "@nestjs/common";
import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  HeadingLevel,
  WidthType,
  BorderStyle,
  Packer,
  ShadingType,
  PageNumber,
  Footer,
  Header,
} from "docx";
import { GenerateReportDto } from "./dto/report.dto";

@Injectable()
export class ReportService {
  // Нүдний border
  private cellBorder(color = "CCCCCC") {
    return {
      top: { style: BorderStyle.SINGLE, size: 1, color },
      bottom: { style: BorderStyle.SINGLE, size: 1, color },
      left: { style: BorderStyle.SINGLE, size: 1, color },
      right: { style: BorderStyle.SINGLE, size: 1, color },
    };
  }

  // Гарчиг paragraph
  private heading(
    text: string,
    level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2,
  ) {
    return new Paragraph({
      text,
      heading: level,
      spacing: { before: 300, after: 120 },
    });
  }

  // Энгийн paragraph
  private para(
    text: string,
    options: Partial<{
      bold: boolean;
      center: boolean;
      size: number;
      color: string;
      spacing_before: number;
    }> = {},
  ) {
    return new Paragraph({
      alignment: options.center
        ? AlignmentType.CENTER
        : AlignmentType.JUSTIFIED,
      spacing: { before: options.spacing_before ?? 0, after: 100, line: 276 },
      children: [
        new TextRun({
          text,
          bold: options.bold,
          size: options.size ?? 22,
          color: options.color,
          font: "Times New Roman",
        }),
      ],
    });
  }

  // Мэдээллийн 2-баганат мөр
  private infoRow(label: string, value: string) {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          borders: this.cellBorder(),
          shading: { type: ShadingType.SOLID, color: "F5F5F5" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  size: 20,
                  font: "Times New Roman",
                }),
              ],
              spacing: { before: 60, after: 60 },
              indent: { left: 100 },
            }),
          ],
        }),
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          borders: this.cellBorder(),
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: value || "—",
                  size: 20,
                  font: "Times New Roman",
                }),
              ],
              spacing: { before: 60, after: 60 },
              indent: { left: 100 },
            }),
          ],
        }),
      ],
    });
  }

  // Эрсдлийн өнгө
  private riskColor(level: string): string {
    if (level === "Өндөр") return "C0392B";
    if (level === "Дунд") return "E67E22";
    return "27AE60";
  }

  async generate(dto: GenerateReportDto): Promise<Buffer> {
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Times New Roman", size: 22 },
            paragraph: { spacing: { line: 276 } },
          },
        },
        paragraphStyles: [
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            run: {
              size: 28,
              bold: true,
              color: "1B4F72",
              font: "Times New Roman",
            },
            paragraph: { spacing: { before: 400, after: 200 } },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            run: {
              size: 24,
              bold: true,
              color: "1F618D",
              font: "Times New Roman",
            },
            paragraph: { spacing: { before: 300, after: 120 } },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1800, right: 1134 },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 6,
                      color: "1B4F72",
                    },
                    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    right: {
                      style: BorderStyle.NONE,
                      size: 0,
                      color: "FFFFFF",
                    },
                    insideHorizontal: {
                      style: BorderStyle.NONE,
                      size: 0,
                      color: "FFFFFF",
                    },
                    insideVertical: {
                      style: BorderStyle.NONE,
                      size: 0,
                      color: "FFFFFF",
                    },
                  },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          borders: {
                            top: {
                              style: BorderStyle.NONE,
                              size: 0,
                              color: "FFFFFF",
                            },
                            bottom: {
                              style: BorderStyle.NONE,
                              size: 0,
                              color: "FFFFFF",
                            },
                            left: {
                              style: BorderStyle.NONE,
                              size: 0,
                              color: "FFFFFF",
                            },
                            right: {
                              style: BorderStyle.NONE,
                              size: 0,
                              color: "FFFFFF",
                            },
                          },
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: "Голомт Банк ХК — Дотоод Аудитын Газар",
                                  bold: true,
                                  size: 18,
                                  color: "1B4F72",
                                  font: "Times New Roman",
                                }),
                              ],
                              spacing: { before: 80, after: 80 },
                            }),
                          ],
                        }),
                        new TableCell({
                          borders: {
                            top: {
                              style: BorderStyle.NONE,
                              size: 0,
                              color: "FFFFFF",
                            },
                            bottom: {
                              style: BorderStyle.NONE,
                              size: 0,
                              color: "FFFFFF",
                            },
                            left: {
                              style: BorderStyle.NONE,
                              size: 0,
                              color: "FFFFFF",
                            },
                            right: {
                              style: BorderStyle.NONE,
                              size: 0,
                              color: "FFFFFF",
                            },
                          },
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.RIGHT,
                              children: [
                                new TextRun({
                                  text: dto.referenceNumber
                                    ? `Дугаар: ${dto.referenceNumber}`
                                    : "",
                                  size: 18,
                                  color: "666666",
                                  font: "Times New Roman",
                                }),
                              ],
                              spacing: { before: 80, after: 80 },
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text:
                        "Тайлан гаргасан огноо: " +
                        dto.reportDate +
                        "   |   Хуудас: ",
                      size: 18,
                      color: "888888",
                      font: "Times New Roman",
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 18,
                      color: "888888",
                      font: "Times New Roman",
                    }),
                    new TextRun({
                      text: " / ",
                      size: 18,
                      color: "888888",
                      font: "Times New Roman",
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 18,
                      color: "888888",
                      font: "Times New Roman",
                    }),
                  ],
                  border: {
                    top: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: "CCCCCC",
                    },
                  },
                  spacing: { before: 100 },
                }),
              ],
            }),
          },
          children: [
            // ── ГАРЧИГ ──────────────────────────────────────────────
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 100 },
              children: [
                new TextRun({
                  text: "ДОТООД АУДИТЫН ТАЙЛАН",
                  bold: true,
                  size: 36,
                  color: "1B4F72",
                  font: "Times New Roman",
                  allCaps: true,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 60 },
              children: [
                new TextRun({
                  text: dto.auditTitle,
                  bold: true,
                  size: 28,
                  color: "1F618D",
                  font: "Times New Roman",
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 500 },
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 8, color: "1B4F72" },
              },
              children: [
                new TextRun({
                  text: dto.auditType,
                  size: 22,
                  color: "666666",
                  italics: true,
                  font: "Times New Roman",
                }),
              ],
            }),

            // ── ҮНДСЭН МЭДЭЭЛЭЛ ─────────────────────────────────────
            this.heading("1. ЕРӨНХИЙ МЭДЭЭЛЭЛ", HeadingLevel.HEADING_1),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                this.infoRow("Аудит хийсэн нэгж:", dto.department),
                this.infoRow(
                  "Аудитын хугацаа:",
                  `${dto.auditStartDate} — ${dto.auditEndDate}`,
                ),
                this.infoRow("Аудиторын нэр:", dto.auditorNames),
                ...(dto.supervisorName
                  ? [this.infoRow("Удирдагч:", dto.supervisorName)]
                  : []),
                this.infoRow("Тайлан гаргасан огноо:", dto.reportDate),
                ...(dto.referenceNumber
                  ? [this.infoRow("Тайлангийн дугаар:", dto.referenceNumber)]
                  : []),
              ],
            }),

            // ── ЗОРИЛГО ─────────────────────────────────────────────
            this.heading("2. АУДИТЫН ЗОРИЛГО", HeadingLevel.HEADING_1),
            this.para(dto.objective),

            // ── ХАМРАХ ХҮРЭЭ ─────────────────────────────────────────
            this.heading("3. ХАМРАХ ХҮРЭЭ", HeadingLevel.HEADING_1),
            this.para(dto.scope),

            // ── АРГА ЗҮЙ ────────────────────────────────────────────
            ...(dto.methodology
              ? [
                  this.heading("4. АУДИТЫН АРГА ЗҮЙ", HeadingLevel.HEADING_1),
                  this.para(dto.methodology),
                ]
              : []),

            // ── ДҮГНЭЛТ / ОЛДВОРУУД ─────────────────────────────────
            this.heading(
              dto.methodology ? "5. АУДИТЫН ОЛДВОРУУД" : "4. АУДИТЫН ОЛДВОРУУД",
              HeadingLevel.HEADING_1,
            ),

            ...(dto.findings.length === 0
              ? [
                  this.para(
                    "Аудитын хугацаанд онцлох зөрчил, дутагдал илрээгүй болно.",
                  ),
                ]
              : [
                  // Findings хүснэгтийн header
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                      // Header мөр
                      new TableRow({
                        tableHeader: true,
                        children: [
                          new TableCell({
                            width: { size: 5, type: WidthType.PERCENTAGE },
                            borders: this.cellBorder("1B4F72"),
                            shading: {
                              type: ShadingType.SOLID,
                              color: "1B4F72",
                            },
                            children: [
                              new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                  new TextRun({
                                    text: "№",
                                    bold: true,
                                    size: 20,
                                    color: "FFFFFF",
                                    font: "Times New Roman",
                                  }),
                                ],
                                spacing: { before: 80, after: 80 },
                              }),
                            ],
                          }),
                          new TableCell({
                            width: { size: 25, type: WidthType.PERCENTAGE },
                            borders: this.cellBorder("1B4F72"),
                            shading: {
                              type: ShadingType.SOLID,
                              color: "1B4F72",
                            },
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: "Олдворын гарчиг",
                                    bold: true,
                                    size: 20,
                                    color: "FFFFFF",
                                    font: "Times New Roman",
                                  }),
                                ],
                                spacing: { before: 80, after: 80 },
                                indent: { left: 100 },
                              }),
                            ],
                          }),
                          new TableCell({
                            width: { size: 40, type: WidthType.PERCENTAGE },
                            borders: this.cellBorder("1B4F72"),
                            shading: {
                              type: ShadingType.SOLID,
                              color: "1B4F72",
                            },
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: "Тайлбар",
                                    bold: true,
                                    size: 20,
                                    color: "FFFFFF",
                                    font: "Times New Roman",
                                  }),
                                ],
                                spacing: { before: 80, after: 80 },
                                indent: { left: 100 },
                              }),
                            ],
                          }),
                          new TableCell({
                            width: { size: 15, type: WidthType.PERCENTAGE },
                            borders: this.cellBorder("1B4F72"),
                            shading: {
                              type: ShadingType.SOLID,
                              color: "1B4F72",
                            },
                            children: [
                              new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                  new TextRun({
                                    text: "Эрсдэл",
                                    bold: true,
                                    size: 20,
                                    color: "FFFFFF",
                                    font: "Times New Roman",
                                  }),
                                ],
                                spacing: { before: 80, after: 80 },
                              }),
                            ],
                          }),
                          new TableCell({
                            width: { size: 15, type: WidthType.PERCENTAGE },
                            borders: this.cellBorder("1B4F72"),
                            shading: {
                              type: ShadingType.SOLID,
                              color: "1B4F72",
                            },
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: "Зөвлөмж",
                                    bold: true,
                                    size: 20,
                                    color: "FFFFFF",
                                    font: "Times New Roman",
                                  }),
                                ],
                                spacing: { before: 80, after: 80 },
                                indent: { left: 100 },
                              }),
                            ],
                          }),
                        ],
                      }),
                      // Data мөрүүд
                      ...dto.findings.map(
                        (f, i) =>
                          new TableRow({
                            children: [
                              new TableCell({
                                width: { size: 5, type: WidthType.PERCENTAGE },
                                borders: this.cellBorder(),
                                shading:
                                  i % 2 === 0
                                    ? undefined
                                    : {
                                        type: ShadingType.SOLID,
                                        color: "F8F9FA",
                                      },
                                children: [
                                  new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [
                                      new TextRun({
                                        text: f.number,
                                        size: 20,
                                        font: "Times New Roman",
                                      }),
                                    ],
                                    spacing: { before: 80, after: 80 },
                                  }),
                                ],
                              }),
                              new TableCell({
                                width: { size: 25, type: WidthType.PERCENTAGE },
                                borders: this.cellBorder(),
                                shading:
                                  i % 2 === 0
                                    ? undefined
                                    : {
                                        type: ShadingType.SOLID,
                                        color: "F8F9FA",
                                      },
                                children: [
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: f.title,
                                        bold: true,
                                        size: 20,
                                        font: "Times New Roman",
                                      }),
                                    ],
                                    spacing: { before: 80, after: 80 },
                                    indent: { left: 100 },
                                  }),
                                ],
                              }),
                              new TableCell({
                                width: { size: 40, type: WidthType.PERCENTAGE },
                                borders: this.cellBorder(),
                                shading:
                                  i % 2 === 0
                                    ? undefined
                                    : {
                                        type: ShadingType.SOLID,
                                        color: "F8F9FA",
                                      },
                                children: [
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: f.description,
                                        size: 20,
                                        font: "Times New Roman",
                                      }),
                                    ],
                                    spacing: { before: 80, after: 80 },
                                    indent: { left: 100 },
                                  }),
                                ],
                              }),
                              new TableCell({
                                width: { size: 15, type: WidthType.PERCENTAGE },
                                borders: this.cellBorder(),
                                shading:
                                  i % 2 === 0
                                    ? undefined
                                    : {
                                        type: ShadingType.SOLID,
                                        color: "F8F9FA",
                                      },
                                children: [
                                  new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [
                                      new TextRun({
                                        text: f.riskLevel,
                                        bold: true,
                                        size: 20,
                                        color: this.riskColor(f.riskLevel),
                                        font: "Times New Roman",
                                      }),
                                    ],
                                    spacing: { before: 80, after: 80 },
                                  }),
                                ],
                              }),
                              new TableCell({
                                width: { size: 15, type: WidthType.PERCENTAGE },
                                borders: this.cellBorder(),
                                shading:
                                  i % 2 === 0
                                    ? undefined
                                    : {
                                        type: ShadingType.SOLID,
                                        color: "F8F9FA",
                                      },
                                children: [
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: f.recommendation,
                                        size: 20,
                                        font: "Times New Roman",
                                      }),
                                    ],
                                    spacing: { before: 80, after: 80 },
                                    indent: { left: 100 },
                                  }),
                                ],
                              }),
                            ],
                          }),
                      ),
                    ],
                  }),
                ]),

            // ── ДҮГНЭЛТ ──────────────────────────────────────────────
            this.heading(
              dto.methodology ? "6. ДҮГНЭЛТ" : "5. ДҮГНЭЛТ",
              HeadingLevel.HEADING_1,
            ),
            this.para(dto.conclusion),

            // ── ГАРЫН ҮСЭГ ───────────────────────────────────────────
            new Paragraph({ spacing: { before: 600 }, children: [] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                insideHorizontal: {
                  style: BorderStyle.NONE,
                  size: 0,
                  color: "FFFFFF",
                },
                insideVertical: {
                  style: BorderStyle.NONE,
                  size: 0,
                  color: "FFFFFF",
                },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: {
                        top: {
                          style: BorderStyle.NONE,
                          size: 0,
                          color: "FFFFFF",
                        },
                        bottom: {
                          style: BorderStyle.NONE,
                          size: 0,
                          color: "FFFFFF",
                        },
                        left: {
                          style: BorderStyle.NONE,
                          size: 0,
                          color: "FFFFFF",
                        },
                        right: {
                          style: BorderStyle.NONE,
                          size: 0,
                          color: "FFFFFF",
                        },
                      },
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "Аудитор:",
                              bold: true,
                              size: 20,
                              font: "Times New Roman",
                            }),
                          ],
                          spacing: { after: 60 },
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: dto.auditorNames,
                              size: 20,
                              font: "Times New Roman",
                            }),
                          ],
                          spacing: { after: 200 },
                        }),
                        new Paragraph({
                          border: {
                            top: {
                              style: BorderStyle.SINGLE,
                              size: 4,
                              color: "000000",
                            },
                          },
                          children: [
                            new TextRun({
                              text: " Гарын үсэг / огноо",
                              size: 18,
                              color: "888888",
                              font: "Times New Roman",
                            }),
                          ],
                          spacing: { before: 20 },
                        }),
                      ],
                    }),
                    new TableCell({
                      borders: {
                        top: {
                          style: BorderStyle.NONE,
                          size: 0,
                          color: "FFFFFF",
                        },
                        bottom: {
                          style: BorderStyle.NONE,
                          size: 0,
                          color: "FFFFFF",
                        },
                        left: {
                          style: BorderStyle.NONE,
                          size: 0,
                          color: "FFFFFF",
                        },
                        right: {
                          style: BorderStyle.NONE,
                          size: 0,
                          color: "FFFFFF",
                        },
                      },
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        ...(dto.supervisorName
                          ? [
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: "Удирдагч:",
                                    bold: true,
                                    size: 20,
                                    font: "Times New Roman",
                                  }),
                                ],
                                spacing: { after: 60 },
                              }),
                              new Paragraph({
                                children: [
                                  new TextRun({
                                    text: dto.supervisorName,
                                    size: 20,
                                    font: "Times New Roman",
                                  }),
                                ],
                                spacing: { after: 200 },
                              }),
                              new Paragraph({
                                border: {
                                  top: {
                                    style: BorderStyle.SINGLE,
                                    size: 4,
                                    color: "000000",
                                  },
                                },
                                children: [
                                  new TextRun({
                                    text: " Гарын үсэг / огноо",
                                    size: 18,
                                    color: "888888",
                                    font: "Times New Roman",
                                  }),
                                ],
                                spacing: { before: 20 },
                              }),
                            ]
                          : [new Paragraph({ children: [] })]),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }
}
