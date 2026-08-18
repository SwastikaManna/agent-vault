// Office document engine — free generation of editable Microsoft formats
// (.pptx / .docx / .xlsx) from an LLM outline, with a no-LLM fallback.
// Outputs are real Office files: openable and editable in PowerPoint,
// Word, Excel, LibreOffice, or Google Docs.

import pptxgen from "pptxgenjs";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import ExcelJS from "exceljs";

export type OfficeKind = "pptx" | "docx" | "xlsx";

export interface DeckSlide {
  title: string;
  bullets: string[];
}

export interface DocSection {
  heading: string;
  body: string;
}

export async function buildPptx(slides: DeckSlide[]): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Agent Vault";
  pptx.title = slides[0]?.title ?? "Agent Vault Deck";

  slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: "08090A" };
    slide.addText(s.title, {
      x: 0.6, y: 0.5, w: 12.3, h: 1.0,
      fontSize: 30, color: "F7F8F8", bold: true, fontFace: "Inter",
    });
    slide.addShape(pptx.ShapeType.line, { x: 0.6, y: 1.55, w: 3.0, h: 0, line: { color: "5E6AD2", width: 2 } });
    slide.addText(
      s.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022" }, color: "D0D6E0", fontSize: 18, breakLine: true, paraSpaceAfter: 10 } })),
      { x: 0.6, y: 1.9, w: 11.8, h: 4.6, valign: "top" }
    );
    slide.addText(`${i + 1} / ${slides.length}`, { x: 11.6, y: 6.9, w: 1.4, h: 0.4, fontSize: 11, color: "62666D", align: "right", fontFace: "Consolas" });
  });

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(out as Uint8Array);
}

export async function buildDocx(sections: DocSection[]): Promise<Buffer> {
  const children = sections.flatMap((s) => [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: s.heading, bold: true })] }),
    ...s.body.split("\n").filter(Boolean).map((p) => new Paragraph({ children: [new TextRun(p)] })),
    new Paragraph({ children: [new TextRun("")] }),
  ]);
  const doc = new Document({
    title: sections[0]?.heading ?? "Agent Vault Document",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

export async function buildXlsx(rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  rows.forEach((r, i) => {
    ws.addRow(r);
    if (i === 0) {
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5E6AD2" } };
    }
  });
  ws.columns.forEach((c) => { c.width = 22; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Naive no-LLM fallback: turn raw idea text into an outline. */
export function fallbackOutline(kind: OfficeKind, idea: string): { slides?: DeckSlide[]; sections?: DocSection[]; rows?: string[][] } {
  const sentences = idea.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
  if (kind === "pptx") {
    const slides: DeckSlide[] = [{ title: idea.split(".")[0].slice(0, 60), bullets: sentences.slice(0, 5) }];
    sentences.slice(5, 12).forEach((s, i) => slides.push({ title: `Key point ${i + 1}`, bullets: [s] }));
    return { slides };
  }
  if (kind === "docx") {
    return { sections: [{ heading: idea.slice(0, 60), body: idea }] };
  }
  return { rows: [["Topic", "Detail"], [idea.slice(0, 60), idea]] };
}
