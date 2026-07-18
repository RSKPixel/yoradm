import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './formatDate'
import {
  loadPdfCandaraFonts,
  PDF_CANDARA_FAMILY,
  registerPdfCandaraFonts,
  setPdfCandaraFont,
} from './pdfCandaraFont'
import {
  addPdfReportTitle,
  drawCompanyLetterhead,
  LETTERHEAD_MARGIN,
} from './pdfCompanyLetterhead'

const TABLE_FONT_SIZE = 8.5
const SIGN_AREA = 32

function formatNum(value, digits = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function textOrDash(value) {
  const text = String(value ?? '').trim()
  return text || '—'
}

function drawSignatureBlock(doc, pageWidth, margin) {
  const pageHeight = doc.internal.pageSize.getHeight()
  const lineY = pageHeight - 16
  const labelY = lineY + 4.5
  const usableWidth = pageWidth - margin * 2
  const colWidth = usableWidth / 2
  const lineInset = 8
  const lineWidth = colWidth - lineInset * 2

  const leftX = margin + lineInset
  const rightX = margin + colWidth + lineInset

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.35)
  doc.line(leftX, lineY, leftX + lineWidth, lineY)
  doc.line(rightX, lineY, rightX + lineWidth, lineY)

  setPdfCandaraFont(doc, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text('Incharge', leftX + lineWidth / 2, labelY, { align: 'center' })
  doc.text('Purchase Manager', rightX + lineWidth / 2, labelY, { align: 'center' })
}

/** Mono-laser safe: solid black fill + white bold text. */
const SHORTAGE_CELL_STYLE = {
  fillColor: [0, 0, 0],
  textColor: [255, 255, 255],
  fontStyle: 'bold',
  lineWidth: 0.45,
  lineColor: [0, 0, 0],
  halign: 'right',
}

const LABEL_STYLE = {
  fontStyle: 'bold',
  fillColor: [230, 230, 230],
  textColor: [0, 0, 0],
}

const NUM_STYLE = { halign: 'right' }

function numCell(content, extraStyles = {}) {
  return { content, styles: { ...NUM_STYLE, ...extraStyles } }
}

function formatWeightWithShortage(weight, weightDiff) {
  const weightText = formatNum(weight, 0)
  const diff = Number(weightDiff)
  if (!Number.isFinite(diff) || diff >= 0) return weightText
  return `${weightText} (${formatNum(diff, 0)})`
}

export function getGoodsReceiptPdfFileName(receiptNo) {
  const slug = String(receiptNo || 'goods-receipt').replace(/[^\w.-]+/g, '_').slice(0, 40)
  return `goods-receipt-${slug}.pdf`
}

export async function buildGoodsReceiptPdf({
  company,
  receiptNo,
  receiptDate,
  vendor,
  stockItem,
  qty,
  weight,
  invoiceNo,
  invoiceDate,
  invoiceValue,
  invoicedWeight,
  weightDiff,
  tdsApplicable,
  tdsValue,
  unloadedAt,
  broker,
  receivedBy,
  vehicleNo,
  place,
  remarks,
}) {
  const fonts = await loadPdfCandaraFonts()
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })
  registerPdfCandaraFonts(doc, fonts)

  // Internal GR print: omit GSTIN/contact via optional letterhead flags (defaults stay on elsewhere)
  const { y: letterheadY, pageWidth, margin } = drawCompanyLetterhead(doc, company, {
    showGstin: false,
    showContact: false,
  })
  const y = addPdfReportTitle(doc, pageWidth, 'Goods Receipt', letterheadY, 5)

  const hasShortage = Number.isFinite(Number(weightDiff)) && Number(weightDiff) < 0
  const weightCell = numCell(
    formatWeightWithShortage(weight, weightDiff),
    hasShortage ? SHORTAGE_CELL_STYLE : {},
  )

  const rows = [
    [
      { content: 'Receipt No.', styles: LABEL_STYLE },
      textOrDash(receiptNo),
      { content: 'Receipt Date', styles: LABEL_STYLE },
      textOrDash(formatDate(receiptDate) || receiptDate),
    ],
    [
      { content: 'Vendor', styles: LABEL_STYLE },
      { content: textOrDash(vendor), colSpan: 3 },
    ],
    [
      { content: 'Stock Item', styles: LABEL_STYLE },
      { content: textOrDash(stockItem), colSpan: 3 },
    ],
    [
      { content: 'Qty', styles: LABEL_STYLE },
      numCell(formatNum(qty, 0)),
      { content: 'Weight (Shortage)', styles: LABEL_STYLE },
      weightCell,
    ],
    [
      { content: 'Invoice No.', styles: LABEL_STYLE },
      textOrDash(invoiceNo),
      { content: 'Invoice Date', styles: LABEL_STYLE },
      textOrDash(formatDate(invoiceDate) || invoiceDate),
    ],
    [
      { content: 'Invoice Value', styles: LABEL_STYLE },
      numCell(formatNum(invoiceValue, 2)),
      { content: 'Invoiced Weight', styles: LABEL_STYLE },
      numCell(formatNum(invoicedWeight, 0)),
    ],
    [
      { content: 'TDS Value', styles: LABEL_STYLE },
      numCell(tdsApplicable ? formatNum(tdsValue, 2) : '—'),
      { content: 'Unloaded At', styles: LABEL_STYLE },
      textOrDash(unloadedAt),
    ],
    [
      { content: 'Vehicle No.', styles: LABEL_STYLE },
      textOrDash(vehicleNo),
      { content: 'Received By', styles: LABEL_STYLE },
      textOrDash(receivedBy),
    ],
    [
      { content: 'Broker', styles: LABEL_STYLE },
      { content: textOrDash(broker), colSpan: 3 },
    ],
    [
      { content: 'Place', styles: LABEL_STYLE },
      { content: textOrDash(place), colSpan: 3 },
    ],
    [
      { content: 'Remarks', styles: LABEL_STYLE },
      { content: textOrDash(remarks) === '—' ? ' ' : textOrDash(remarks), colSpan: 3 },
    ],
    [
      { content: 'Tally Voucher No.', styles: LABEL_STYLE },
      { content: ' ', colSpan: 3 },
    ],
  ]

  const pageHeight = doc.internal.pageSize.getHeight()
  const availableHeight = Math.max(pageHeight - SIGN_AREA - y - 2, 50)
  const rowHeight = Math.min(availableHeight / rows.length, 8.2)
  const tableWidth = pageWidth - margin * 2
  const labelWidth = 32
  const valueWidth = (tableWidth - labelWidth * 2) / 2

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: 'grid',
    tableWidth,
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    showHead: 'never',
    styles: {
      font: PDF_CANDARA_FAMILY,
      fontSize: TABLE_FONT_SIZE,
      cellPadding: { top: 0.4, right: 1, bottom: 0.4, left: 1 },
      valign: 'middle',
      overflow: 'linebreak',
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      minCellHeight: rowHeight,
    },
    columnStyles: {
      0: { cellWidth: labelWidth },
      1: { cellWidth: valueWidth },
      2: { cellWidth: labelWidth },
      3: { cellWidth: valueWidth },
    },
    margin: { left: margin, right: margin, bottom: SIGN_AREA },
  })

  doc.setPage(1)
  drawSignatureBlock(doc, pageWidth, margin ?? LETTERHEAD_MARGIN)

  return {
    doc,
    fileName: getGoodsReceiptPdfFileName(receiptNo),
  }
}

export async function createGoodsReceiptPdfBlob(params) {
  const { doc, fileName } = await buildGoodsReceiptPdf(params)
  return {
    blob: doc.output('blob'),
    fileName,
  }
}
