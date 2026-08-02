import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatFinancialYearLabel, FY_MONTHS } from './financialYear'
import { formatQty, formatValue } from './formatNumber'
import {
  loadPdfCandaraFonts,
  PDF_CANDARA_FAMILY,
  registerPdfCandaraFonts,
  setPdfCandaraFont,
} from './pdfCandaraFont'
import {
  addPdfReportTitle,
  drawCompanyLetterhead,
} from './pdfCompanyLetterhead'

const META_FONT_SIZE = 9
const TABLE_FONT_SIZE = 8

function monthLabel(month) {
  const found = FY_MONTHS.find((m) => m.value === Number(month))
  return found?.label || String(month)
}

function addMetaLine(doc, label, value, x, y, labelWidth = 18) {
  const text = String(value ?? '').trim()
  setPdfCandaraFont(doc, 'normal')
  doc.setFontSize(META_FONT_SIZE)
  doc.setTextColor(90, 90, 90)
  doc.text(label, x, y)
  setPdfCandaraFont(doc, 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(text || '—', x + labelWidth, y)
  return y + 5
}

function formatPdfQty(value) {
  const formatted = formatQty(value)
  return formatted === '' ? '0' : formatted
}

function formatPdfValue(value) {
  const formatted = formatValue(value)
  return formatted === '' ? '0.00' : formatted
}

function formatPdfRate(value) {
  if (value == null || !Number.isFinite(Number(value))) return ''
  return formatPdfValue(value)
}

export function getBrokeragePdfFileName({ broker, fyStart, month }) {
  const brokerSlug = String(broker || 'broker')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 40)
  const monthSlug = String(monthLabel(month) || month).replace(/\s+/g, '')
  const fySlug = formatFinancialYearLabel(fyStart)
  return `brokerage-${brokerSlug}-${monthSlug}-FY${fySlug}.pdf`
}

/**
 * @param {object} params
 * @param {object} params.company
 * @param {string} params.broker
 * @param {number} params.fyStart
 * @param {number} params.month
 * @param {Array<{
 *   sideLabel: string,
 *   stockItem: string,
 *   adjustedQty: number,
 *   quintals: number,
 *   rate: number|null,
 *   brokerage: number,
 * }>} params.rows
 * @param {number} params.totalAdjustedQty
 * @param {number} params.totalQuintals
 * @param {number} params.totalBrokerage
 * @param {number|null} params.tdsPercent
 * @param {number} params.tdsAmount
 * @param {number} params.netBrokerage
 */
export async function buildBrokeragePdf({
  company,
  broker,
  fyStart,
  month,
  rows,
  totalAdjustedQty,
  totalQuintals,
  totalBrokerage,
  tdsPercent,
  tdsAmount,
  netBrokerage,
}) {
  const fonts = await loadPdfCandaraFonts()
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })
  registerPdfCandaraFonts(doc, fonts)

  const { y: letterheadY, pageWidth, margin } = drawCompanyLetterhead(doc, company, {
    showGstin: false,
    showContact: false,
  })
  let y = addPdfReportTitle(doc, pageWidth, 'Brokerage', letterheadY)

  const contentWidth = pageWidth - margin * 2
  const metaColWidth = contentWidth / 3
  addMetaLine(doc, 'Broker', broker, margin, y, 14)
  addMetaLine(doc, 'FY', formatFinancialYearLabel(fyStart), margin + metaColWidth, y, 8)
  addMetaLine(doc, 'Month', monthLabel(month), margin + metaColWidth * 2, y, 14)
  y += 7

  const head = ['Type', 'Stock Item', 'Qty', 'Quintals', 'Rate', 'Brokerage']
  const body =
    rows.length > 0
      ? rows.map((row) => [
          row.sideLabel,
          row.stockItem,
          formatPdfQty(row.adjustedQty),
          formatPdfValue(row.quintals),
          formatPdfRate(row.rate),
          formatPdfValue(row.brokerage),
        ])
      : [['', 'No brokerage lines.', '', '', '', '']]

  const tdsPercentLabel =
    tdsPercent == null || !Number.isFinite(tdsPercent)
      ? 'TDS'
      : `TDS ${formatPdfValue(tdsPercent)}%`
  const tdsDisplay =
    tdsAmount > 0 ? `-${formatPdfValue(tdsAmount)}` : formatPdfValue(0)

  const foot = [
    [
      '',
      'Total',
      formatPdfQty(totalAdjustedQty),
      formatPdfValue(totalQuintals),
      '',
      formatPdfValue(totalBrokerage),
    ],
    ['', tdsPercentLabel, '', '', '', tdsDisplay],
    ['', 'Net', '', '', '', formatPdfValue(netBrokerage)],
  ]

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    foot,
    theme: 'grid',
    styles: {
      font: PDF_CANDARA_FAMILY,
      fontSize: TABLE_FONT_SIZE,
      cellPadding: 1.4,
      valign: 'middle',
      overflow: 'ellipsize',
      lineWidth: 0.25,
      lineColor: [30, 41, 59],
    },
    headStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [30, 41, 59],
      textColor: 255,
      lineWidth: 0.25,
      lineColor: [30, 41, 59],
    },
    footStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      lineWidth: 0.25,
      lineColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 16 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 14 },
      3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 14 },
      5: { halign: 'right', cellWidth: 18 },
    },
    didParseCell: (data) => {
      if (data.column.index >= 2) {
        data.cell.styles.halign = 'right'
      }
    },
    margin: { left: margin, right: margin },
  })

  return {
    doc,
    fileName: getBrokeragePdfFileName({ broker, fyStart, month }),
  }
}

export async function createBrokeragePdfBlob(params) {
  const { doc, fileName } = await buildBrokeragePdf(params)
  return {
    blob: doc.output('blob'),
    fileName,
  }
}
