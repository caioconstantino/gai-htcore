import PDFDocument from "pdfkit";

const BRAND_BLUE  = "#1e3a5f";
const ACCENT_BLUE = "#3b82f6";
const GRAY        = "#6b7280";
const LIGHT_GRAY  = "#f3f4f6";

const PERIOD_LABELS: Record<number, string> = {
  1: "Diária",   2: "2 dias",  3: "3 dias",  4: "4 dias",  5: "5 dias",
  6: "6 dias",   7: "7 dias",  8: "8 dias",  9: "9 dias",  10: "10 dias",
  11: "11 dias", 12: "12 dias",13: "13 dias", 14: "14 dias",15: "15 dias",
  16: "16 dias", 17: "17 dias",18: "18 dias", 19: "19 dias",21: "21 dias",
  22: "22 dias", 23: "23 dias",24: "24 dias", 25: "25 dias",26: "26 dias",
  27: "27 dias", 28: "28 dias",29: "29 dias", 30: "30 dias",365: "365 dias",
};

function fmtBRL(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export interface QuoteItem {
  productName:  string;
  description?: string;
  quantity:     number;
  periodDays:   number;
  unitPrice:    number;
}

export interface QuotePDFInput {
  quoteNumber:       string;
  companyName:       string;
  companyPhone?:     string;
  companyAddress?:   string;
  companyWebsite?:   string;
  clientName?:       string;
  clientPhone?:      string;
  items:             QuoteItem[];
  deliveryLocation?: string;
  notes?:            string;
  validDays?:        number;
  discountPercent?:  number;
}

export function generateQuotePDF(input: QuotePDFInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { quoteNumber, companyName, items, validDays = 15 } = input;
    const now       = new Date();
    const validUntil = new Date(now.getTime() + validDays * 86_400_000);
    const PAGE_W    = doc.page.width;
    const MARGIN    = 50;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    // ── Header ───────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 90).fill(BRAND_BLUE);

    doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
       .text(companyName, MARGIN, 22, { width: CONTENT_W * 0.58 });
    doc.fillColor("#93c5fd").fontSize(9).font("Helvetica")
       .text("ORÇAMENTO COMERCIAL", MARGIN, 52, { width: CONTENT_W * 0.58 });

    // Quote badge (top right)
    doc.rect(PAGE_W - 210, 12, 165, 66).fill("#ffffff18");
    doc.fillColor("#bfdbfe").fontSize(7).font("Helvetica")
       .text("Nº DO ORÇAMENTO", PAGE_W - 202, 20);
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold")
       .text(`#${quoteNumber}`, PAGE_W - 202, 32);
    doc.fillColor("#93c5fd").fontSize(7).font("Helvetica")
       .text(`Emitido: ${fmtDate(now)}`, PAGE_W - 202, 57)
       .text(`Válido até: ${fmtDate(validUntil)}`, PAGE_W - 202, 67);

    let y = 108;

    // ── Info columns ─────────────────────────────────────────────────
    const COL_W = (CONTENT_W - 16) / 2;
    const ROW_H = 78;

    function infoBox(x: number, label: string, title: string, line1?: string, line2?: string) {
      doc.rect(x, y, COL_W, ROW_H).fillAndStroke(LIGHT_GRAY, "#d1d5db");
      doc.fillColor(GRAY).fontSize(7).font("Helvetica-Bold").text(label, x + 10, y + 9);
      doc.fillColor(BRAND_BLUE).fontSize(11).font("Helvetica-Bold").text(title, x + 10, y + 22, { width: COL_W - 20 });
      if (line1) doc.fillColor("#374151").fontSize(8).font("Helvetica").text(line1, x + 10, y + 40, { width: COL_W - 20 });
      if (line2) doc.fillColor("#374151").fontSize(8).font("Helvetica").text(line2, x + 10, y + 52, { width: COL_W - 20 });
    }

    infoBox(
      MARGIN, "EMPRESA", companyName,
      input.companyPhone ? `Tel: ${input.companyPhone}` : undefined,
      input.companyAddress,
    );
    infoBox(
      MARGIN + COL_W + 16, "CLIENTE", input.clientName || "—",
      input.clientPhone ? `Tel: ${input.clientPhone}` : undefined,
      input.deliveryLocation ? `Local: ${input.deliveryLocation}` : undefined,
    );

    y += ROW_H + 16;

    // ── Table header ─────────────────────────────────────────────────
    const C = {
      num:     MARGIN,
      produto: MARGIN + 22,
      qtd:     MARGIN + CONTENT_W * 0.46,
      periodo: MARGIN + CONTENT_W * 0.54,
      unit:    MARGIN + CONTENT_W * 0.70,
      total:   MARGIN + CONTENT_W * 0.84,
    };

    doc.rect(MARGIN, y, CONTENT_W, 20).fill(BRAND_BLUE);
    doc.fillColor("white").fontSize(7).font("Helvetica-Bold");
    const th = y + 7;
    doc.text("#",           C.num + 3, th);
    doc.text("PRODUTO / EQUIPAMENTO", C.produto, th, { width: C.qtd - C.produto - 4 });
    doc.text("QTD",         C.qtd,     th, { width: 28, align: "center" });
    doc.text("PERÍODO",     C.periodo, th, { width: 75 });
    doc.text("VALOR UNIT.", C.unit,    th, { width: 75, align: "right" });
    doc.text("TOTAL",       C.total,   th, { width: MARGIN + CONTENT_W - C.total, align: "right" });
    y += 20;

    let grandTotal = 0;

    items.forEach((item, idx) => {
      const lineTotal = item.quantity * item.unitPrice;
      grandTotal += lineTotal;
      const hasDesc = !!item.description;
      const rowH    = hasDesc ? 32 : 22;
      const bg      = idx % 2 === 0 ? "white" : LIGHT_GRAY;

      doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);
      doc.rect(MARGIN, y, CONTENT_W, rowH).stroke("#e5e7eb");

      const ty = y + (hasDesc ? 5 : 8);
      doc.fillColor("#374151").fontSize(8);
      doc.font("Helvetica").text(`${idx + 1}`, C.num + 3, ty);
      doc.font("Helvetica-Bold").text(item.productName, C.produto, ty, { width: C.qtd - C.produto - 4 });
      if (hasDesc) {
        doc.font("Helvetica").fillColor(GRAY).fontSize(7)
           .text(item.description!, C.produto, ty + 13, { width: C.qtd - C.produto - 4 });
      }
      doc.fillColor("#374151").fontSize(8).font("Helvetica");
      doc.text(`${item.quantity}x`,
        C.qtd, ty, { width: 28, align: "center" });
      doc.text(PERIOD_LABELS[item.periodDays] ?? `${item.periodDays} dias`,
        C.periodo, ty, { width: 75 });
      doc.text(fmtBRL(item.unitPrice),  C.unit,  ty, { width: 75, align: "right" });
      doc.font("Helvetica-Bold")
         .text(fmtBRL(lineTotal), C.total, ty,
           { width: MARGIN + CONTENT_W - C.total, align: "right" });

      y += rowH;
    });

    y += 12;

    // ── Totals ───────────────────────────────────────────────────────
    const discPct = input.discountPercent ?? 0;
    const discVal = grandTotal * (discPct / 100);
    const finalTotal = grandTotal - discVal;

    const TX = MARGIN + CONTENT_W * 0.52;
    const TW = CONTENT_W * 0.48;

    if (discPct > 0) {
      doc.fillColor(GRAY).fontSize(9).font("Helvetica")
         .text("Subtotal:", TX, y, { continued: true })
         .text(fmtBRL(grandTotal), { align: "right", lineBreak: false });
      y += 16;
      doc.fillColor("#dc2626").fontSize(9)
         .text(`Desconto (${discPct}%):`, TX, y, { continued: true })
         .text(`- ${fmtBRL(discVal)}`, { align: "right", lineBreak: false });
      y += 16;
    }

    doc.rect(TX - 6, y - 4, TW + 6, 34).fill(BRAND_BLUE);
    doc.fillColor("white").fontSize(11).font("Helvetica-Bold")
       .text("TOTAL:", TX + 4, y + 7);
    doc.fontSize(15).text(fmtBRL(finalTotal), TX + 4, y + 3, { width: TW - 8, align: "right" });

    y += 48;

    // ── Notes ─────────────────────────────────────────────────────────
    if (input.notes) {
      doc.rect(MARGIN, y, CONTENT_W, 54).fillAndStroke(LIGHT_GRAY, "#d1d5db");
      doc.fillColor(GRAY).fontSize(7).font("Helvetica-Bold").text("OBSERVAÇÕES", MARGIN + 10, y + 8);
      doc.fillColor("#374151").fontSize(8).font("Helvetica")
         .text(input.notes, MARGIN + 10, y + 20, { width: CONTENT_W - 20 });
      y += 64;
    }

    // ── Validity notice ───────────────────────────────────────────────
    doc.fillColor(ACCENT_BLUE).fontSize(8).font("Helvetica")
       .text(
         `Este orçamento é válido por ${validDays} dias (até ${fmtDate(validUntil)}). Após este prazo os preços poderão ser revisados.`,
         MARGIN, y, { width: CONTENT_W },
       );

    // ── Footer ────────────────────────────────────────────────────────
    const FY = doc.page.height - 45;
    doc.rect(0, FY, PAGE_W, 45).fill(LIGHT_GRAY);
    doc.moveTo(0, FY).lineTo(PAGE_W, FY).stroke("#d1d5db");
    const footerTxt = [
      companyName,
      input.companyPhone ? `Tel: ${input.companyPhone}` : null,
      input.companyWebsite ?? null,
    ].filter(Boolean).join("  ·  ");
    doc.fillColor(GRAY).fontSize(7.5).font("Helvetica")
       .text(footerTxt, MARGIN, FY + 10, { width: CONTENT_W, align: "center" });
    doc.fillColor("#9ca3af").fontSize(7)
       .text("Gerado por G.AI — Assistente Comercial Inteligente", MARGIN, FY + 26, { width: CONTENT_W, align: "center" });

    doc.end();
  });
}
