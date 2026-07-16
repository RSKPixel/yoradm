import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './formatDate'
import { formatValue } from './formatNumber'
import {
  loadPdfCandaraFonts,
  PDF_CANDARA_FAMILY,
  registerPdfCandaraFonts,
  setPdfCandaraFont,
} from './pdfCandaraFont'
import {
  AGEING_BUCKETS,
  buildPartyAgeingSummary,
  formatAgeingAmount,
  sumAgeingRows,
} from './receivablesAgeingSummary'
import {
  addPdfReportTitle,
  drawCompanyLetterhead,
} from './pdfCompanyLetterhead'

const TABLE_FONT_SIZE = 8
const AGEING_TABLE_FONT_SIZE = 7.5
const AGEING_CELL_PADDING = 1.2
/** Max amount format used to size numeric ageing columns. */
const AGEING_MAX_AMOUNT_SAMPLE = '9,99,99,999.99'
const OVERDUE_FILL = [253, 232, 216]
const PARTY_FILL = [232, 232, 232]
const SUBTOTAL_FILL = [247, 247, 247]

function ageingAmountColumnWidth(doc) {
  setPdfCandaraFont(doc, 'normal')
  doc.setFontSize(AGEING_TABLE_FONT_SIZE)
  return doc.getTextWidth(AGEING_MAX_AMOUNT_SAMPLE) + AGEING_CELL_PADDING * 2
}

function ageingSummaryColumnStyles(doc, margin) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const usable = pageWidth - margin * 2
  const amountCols = AGEING_BUCKETS.length + 1
  const amountWidth = ageingAmountColumnWidth(doc)
  const partyWidth = Math.max(usable - amountWidth * amountCols, 24)

  const styles = {
    0: { cellWidth: partyWidth, halign: 'left' },
  }
  for (let i = 1; i <= amountCols; i += 1) {
    styles[i] = { cellWidth: amountWidth, halign: 'right' }
  }
  return styles
}

function todayStamp() {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return `${yyyy}${mm}${dd}`
}

export function getReceivablesAnalysisPdfFileName(asOfDate = new Date()) {
  const stamp = formatDate(asOfDate)?.replace(/-/g, '') || todayStamp()
  return `debtors-receivable-${stamp}.pdf`
}

function drawPartyWiseTable(doc, { partyGroups, startY, margin }) {
  const body = []
  const rowMeta = []

  for (const [index, group] of partyGroups.entries()) {
    body.push([group.ledgerName, '', '', ''])
    rowMeta.push({ kind: 'party' })

    for (const inv of group.invoices) {
      const days = inv.days
      body.push([
        inv.invoice_no ?? '',
        formatDate(inv.invoice_date) || '',
        formatValue(inv.amount),
        days == null ? '' : String(days),
      ])
      rowMeta.push({ kind: 'invoice', overdue: days != null && days > 30 })
    }

    body.push(['Sub total', '', formatValue(group.total), ''])
    rowMeta.push({ kind: 'subtotal' })

    if (index < partyGroups.length - 1) {
      body.push(['', '', '', ''])
      rowMeta.push({ kind: 'spacer' })
    }
  }

  if (body.length === 0) {
    body.push(['No receivables for this filter.', '', '', ''])
    rowMeta.push({ kind: 'empty' })
  }

  let grandTotal = 0
  for (const group of partyGroups) grandTotal += group.total

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [['Invoice No', 'Invoice Date', 'Amount', 'Age']],
    body,
    foot:
      partyGroups.length > 0
        ? [['Total', '', formatValue(grandTotal), '']]
        : undefined,
    theme: 'grid',
    styles: {
      font: PDF_CANDARA_FAMILY,
      fontSize: TABLE_FONT_SIZE,
      cellPadding: 1.4,
      textColor: [26, 26, 26],
      lineColor: [176, 176, 176],
      lineWidth: 0.2,
      valign: 'middle',
      halign: 'left',
    },
    headStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [242, 242, 242],
      textColor: [85, 85, 85],
    },
    footStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [236, 236, 236],
      textColor: [26, 26, 26],
    },
    columnStyles: {
      0: { cellWidth: 48, halign: 'left' },
      1: { cellWidth: 32, halign: 'left' },
      2: { cellWidth: 'auto', halign: 'right' },
      3: { cellWidth: 18, halign: 'right' },
    },
    didParseCell(data) {
      // Amount + Age always right-aligned (head / body / foot).
      if (data.column.index >= 2) {
        data.cell.styles.halign = 'right'
      } else {
        data.cell.styles.halign = 'left'
      }

      if (data.section !== 'body') return

      const meta = rowMeta[data.row.index]
      if (!meta) return

      if (meta.kind === 'party') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = PARTY_FILL
        data.cell.styles.halign = 'left'
        if (data.column.index === 0) {
          data.cell.colSpan = 4
        } else {
          data.cell.styles.cellWidth = 0
          data.cell.text = ['']
        }
      } else if (meta.kind === 'subtotal') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = SUBTOTAL_FILL
        data.cell.styles.lineColor = [176, 176, 176]
        data.cell.styles.lineWidth = { top: 0.2, right: 0.2, bottom: 0.4, left: 0.2 }
        if (data.column.index === 0) data.cell.styles.halign = 'left'
        if (data.column.index === 2) data.cell.styles.halign = 'right'
      } else if (meta.kind === 'spacer') {
        data.cell.styles.fillColor = [255, 255, 255]
        // Keep the horizontal separator thickness/color consistent with the grid,
        // but remove vertical separators for this blank row.
        data.cell.styles.lineColor = [176, 176, 176]
        data.cell.styles.lineWidth = { top: 0.2, right: 0, bottom: 0.2, left: 0 }
        data.cell.styles.minCellHeight = 4
        data.cell.text = ['']
      } else if (meta.kind === 'invoice') {
        if (meta.overdue) data.cell.styles.fillColor = OVERDUE_FILL
      } else if (meta.kind === 'empty' && data.column.index === 0) {
        data.cell.colSpan = 4
        data.cell.styles.halign = 'left'
      }
    },
  })
}

function drawAgeingSummaryTable(doc, {
  partyGroups,
  startY,
  margin,
  withTitle = false,
  newPage = true,
}) {
  const summaryRows = buildPartyAgeingSummary(partyGroups)
  const summaryTotals = sumAgeingRows(summaryRows)

  let y = startY
  if (newPage) {
    doc.addPage()
    y = 16
  }

  if (withTitle) {
    setPdfCandaraFont(doc, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.text('Ageing Summary', margin, y)
    y += 5
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Party', ...AGEING_BUCKETS.map((c) => c.label), 'Total']],
    body:
      summaryRows.length > 0
        ? summaryRows.map((row) => [
            row.ledgerName,
            ...AGEING_BUCKETS.map((c) => formatAgeingAmount(row[c.key])),
            formatValue(row.total),
          ])
        : [['No receivables for this filter.', '', '', '', '', '']],
    foot:
      summaryRows.length > 0
        ? [
            [
              'Total',
              ...AGEING_BUCKETS.map((c) => formatAgeingAmount(summaryTotals[c.key])),
              formatValue(summaryTotals.total),
            ],
          ]
        : undefined,
    theme: 'grid',
    styles: {
      font: PDF_CANDARA_FAMILY,
      fontSize: AGEING_TABLE_FONT_SIZE,
      cellPadding: AGEING_CELL_PADDING,
      textColor: [26, 26, 26],
      lineColor: [176, 176, 176],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [242, 242, 242],
      textColor: [85, 85, 85],
    },
    footStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [236, 236, 236],
      textColor: [26, 26, 26],
    },
    columnStyles: ageingSummaryColumnStyles(doc, margin),
    didParseCell(data) {
      if (data.column.index === 0) data.cell.styles.halign = 'left'
      else data.cell.styles.halign = 'right'
    },
  })
}

/**
 * @param {{
 *   company: object,
 *   partyGroups: Array<{ ledgerName: string, invoices: object[], total: number }>,
 *   asOfDate?: Date|string,
 *   representativeLabel?: string,
 *   viewMode?: 'party' | 'ageing',
 * }} params
 */
export async function buildReceivablesAnalysisPdf({
  company,
  partyGroups,
  asOfDate = new Date(),
  representativeLabel = '',
  viewMode = 'party',
}) {
  const fonts = await loadPdfCandaraFonts()
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  registerPdfCandaraFonts(doc, fonts)

  const { y: letterheadY, pageWidth, margin } = drawCompanyLetterhead(doc, company)
  const asOn = formatDate(asOfDate) || formatDate(new Date())
  let y = addPdfReportTitle(
    doc,
    pageWidth,
    `Debitors Receivable as on ${asOn}`,
    letterheadY,
  )

  if (representativeLabel) {
    setPdfCandaraFont(doc, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)
    doc.text(`Representative: ${representativeLabel}`, margin, y)
    doc.setTextColor(0, 0, 0)
    y += 5
  } else {
    y += 1
  }

  if (viewMode === 'ageing') {
    // Summary-only PDF: keep heading on the first content page (no blank cover page).
    let summaryY = y
    setPdfCandaraFont(doc, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.text('Ageing Summary', margin, summaryY)
    summaryY += 5
    drawAgeingSummaryTable(doc, {
      partyGroups,
      startY: summaryY,
      margin,
      withTitle: false,
      newPage: false,
    })
  } else {
    drawPartyWiseTable(doc, { partyGroups, startY: y, margin })
    drawAgeingSummaryTable(doc, {
      partyGroups,
      startY: 16,
      margin,
      withTitle: true,
      newPage: true,
    })
  }

  return doc
}

export async function createReceivablesAnalysisPdfBlob(params) {
  const doc = await buildReceivablesAnalysisPdf(params)
  const blob = doc.output('blob')
  const fileName = getReceivablesAnalysisPdfFileName(params.asOfDate)
  return { blob, fileName }
}
