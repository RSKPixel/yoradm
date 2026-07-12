import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './formatDate'
import {
  buildDeliverySummary,
  formatPackingHeader,
  formatSummaryQty,
} from './deliveryChallanSummary'
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

function addMetaLine(doc, label, value, x, y, labelWidth = 22) {
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

export function getDeliveryChallanPdfFileName(challanNo) {
  const slug = String(challanNo || 'delivery-challan').replace(/[^\w.-]+/g, '_').slice(0, 40)
  return `delivery-challan-${slug}.pdf`
}

export async function buildDeliveryChallanPdf({
  company,
  challanNo,
  date,
  vehicleNo,
  driverName,
  batchNo,
  lines,
}) {
  const fonts = await loadPdfCandaraFonts()
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })
  registerPdfCandaraFonts(doc, fonts)

  const { y: letterheadY, pageWidth, margin } = drawCompanyLetterhead(doc, company)
  let y = addPdfReportTitle(doc, pageWidth, 'Delivery Challan', letterheadY)

  const col1 = margin
  const col2 = pageWidth / 2 + 2
  let leftY = y
  let rightY = y

  leftY = addMetaLine(doc, 'DC No.', challanNo, col1, leftY)
  leftY = addMetaLine(doc, 'Vehicle', vehicleNo, col1, leftY)
  leftY = addMetaLine(doc, 'Batch', batchNo || '—', col1, leftY)

  rightY = addMetaLine(doc, 'Date', formatDate(date) || date, col2, rightY)
  rightY = addMetaLine(doc, 'Driver', driverName, col2, rightY)

  y = Math.max(leftY, rightY) + 2

  setPdfCandaraFont(doc, 'bold')
  doc.setFontSize(11)
  doc.text('Delivery Summary', margin, y)
  y += 3

  const { packings, rows, columnTotals, grandTotal } = buildDeliverySummary(lines || [])
  const head = [
    'Stock Item',
    'Brand',
    ...packings.map((packing) => formatPackingHeader(packing)),
    'Total',
  ]
  const body =
    rows.length > 0
      ? rows.map((row) => [
          row.stockItem,
          row.brand,
          ...packings.map((packing) => formatSummaryQty(row.byPacking[packing])),
          formatSummaryQty(row.total),
        ])
      : [['No delivery items to summarize.', '', ...packings.map(() => ''), '']]

  const foot =
    rows.length > 0
      ? [
          [
            'Total',
            '',
            ...packings.map((packing) => formatSummaryQty(columnTotals[packing])),
            formatSummaryQty(grandTotal),
          ],
        ]
      : undefined

  const numericStartIndex = 2
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    foot,
    styles: {
      font: PDF_CANDARA_FAMILY,
      fontSize: TABLE_FONT_SIZE,
      cellPadding: 1.6,
      valign: 'middle',
    },
    headStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [30, 41, 59],
      textColor: 255,
    },
    footStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'left' },
    },
    didParseCell: (data) => {
      if (data.column.index >= numericStartIndex) {
        data.cell.styles.halign = 'right'
      }
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages()
      const footerY = doc.internal.pageSize.getHeight() - 6
      setPdfCandaraFont(doc, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth / 2, footerY, {
        align: 'center',
      })
      doc.setTextColor(0, 0, 0)
    },
  })

  return {
    doc,
    fileName: getDeliveryChallanPdfFileName(challanNo),
  }
}

export async function createDeliveryChallanPdfBlob(params) {
  const { doc, fileName } = await buildDeliveryChallanPdf(params)
  return {
    blob: doc.output('blob'),
    fileName,
  }
}

export async function generateDeliveryChallanPdf(params) {
  const { doc, fileName } = await buildDeliveryChallanPdf(params)
  doc.save(fileName)
}
