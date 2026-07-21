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
import { addPdfReportTitle, drawCompanyLetterhead } from './pdfCompanyLetterhead'
import { formatFinancialYearLabel } from './financialYear'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function exportRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row?.status !== 'deleted')
}

function quarterTitle(fyStart, quarter) {
  const fy = formatFinancialYearLabel(fyStart)
  return `TDS Return — Q${quarter} FY ${fy}`
}

export function getTdsWorkingsPdfFileName({ fyStart, quarter }) {
  const fy = formatFinancialYearLabel(fyStart).replace(/-/g, '')
  return `tds-return-Q${quarter}-FY${fy}.pdf`
}

export function getTdsWorkingsExcelFileName({ fyStart, quarter }) {
  const fy = formatFinancialYearLabel(fyStart).replace(/-/g, '')
  return `tds-return-Q${quarter}-FY${fy}.xls`
}

function tableBody(rows) {
  return rows.map((row) => [
    row.voucher_date ? formatDate(row.voucher_date) : '',
    row.party || '',
    row.pan || '',
    row.tds_head || '(Blank)',
    row.expenses_date ? formatDate(row.expenses_date) : '',
    row.expenses_amount != null && Number.isFinite(Number(row.expenses_amount))
      ? formatValue(row.expenses_amount)
      : '',
    formatValue(row.amount),
  ])
}

export async function buildTdsWorkingsPdf({
  company,
  rows,
  fyStart,
  quarter,
  dateFrom,
  dateTo,
}) {
  const fonts = await loadPdfCandaraFonts()
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  registerPdfCandaraFonts(doc, fonts)

  const { y: letterheadY, pageWidth, margin } = drawCompanyLetterhead(doc, company)
  const title = quarterTitle(fyStart, quarter)
  let y = addPdfReportTitle(doc, pageWidth, title, letterheadY)

  const period =
    dateFrom && dateTo
      ? `Period: ${formatDate(dateFrom) || dateFrom} to ${formatDate(dateTo) || dateTo}`
      : ''
  if (period) {
    setPdfCandaraFont(doc, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)
    doc.text(period, margin, y)
    doc.setTextColor(0, 0, 0)
    y += 5
  } else {
    y += 1
  }

  const data = exportRows(rows)
  const totalAmount = data.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const totalExpenses = data.reduce((sum, row) => {
    const value = Number(row.expenses_amount)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)

  autoTable(doc, {
    startY: y,
    head: [
      [
        'Date',
        'Party',
        'PAN',
        'TDS Head',
        'Expenses Date',
        'Expenses Amount',
        'Amount',
      ],
    ],
    body: tableBody(data),
    foot: [
      [
        '',
        '',
        '',
        '',
        'Total',
        formatValue(totalExpenses),
        formatValue(totalAmount),
      ],
    ],
    styles: {
      font: PDF_CANDARA_FAMILY,
      fontSize: 8,
      cellPadding: 1.4,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [240, 240, 240],
      textColor: [40, 40, 40],
      fontSize: 7.5,
    },
    footStyles: {
      font: PDF_CANDARA_FAMILY,
      fontStyle: 'bold',
      fillColor: [247, 247, 247],
      textColor: [20, 20, 20],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 42 },
      2: { cellWidth: 24 },
      3: { cellWidth: 36 },
      4: { cellWidth: 24 },
      5: { cellWidth: 28,halign: 'right' },
      6: { cellWidth: 26,halign: 'right' },
    },
    margin: { left: margin, right: margin },
    showHead: 'everyPage',
    showFoot: 'lastPage',
  })

  return doc
}

export async function createTdsWorkingsPdfBlob(params) {
  const doc = await buildTdsWorkingsPdf(params)
  const blob = doc.output('blob')
  const fileName = getTdsWorkingsPdfFileName(params)
  return { blob, fileName }
}

export function buildTdsWorkingsExcelHtml({
  company,
  rows,
  fyStart,
  quarter,
  dateFrom,
  dateTo,
}) {
  const data = exportRows(rows)
  const totalAmount = data.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const totalExpenses = data.reduce((sum, row) => {
    const value = Number(row.expenses_amount)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)
  const companyName = String(company?.name || company?.company_name || '').trim()
  const title = quarterTitle(fyStart, quarter)
  const period =
    dateFrom && dateTo
      ? `Period: ${formatDate(dateFrom) || dateFrom} to ${formatDate(dateTo) || dateTo}`
      : ''

  const bodyRows = data
    .map((row) => {
      const cells = tableBody([row])[0]
      return `<tr>${cells.map((cell, index) => {
        const align = index === 5 || index === 6 ? 'right' : 'left'
        return `<td style="text-align:${align}">${escapeHtml(cell)}</td>`
      }).join('')}</tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; margin: 16px; }
    .company { font-size: 18px; font-weight: 700; margin: 0 0 4px; text-align: center; }
    h1 { font-size: 16px; margin: 0 0 6px; text-align: center; }
    p { margin: 0 0 12px; color: #555; text-align: center; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #bbb; padding: 4px 6px; vertical-align: middle; }
    th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
    tfoot td { font-weight: 700; background: #f7f7f7; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  ${companyName ? `<p class="company">${escapeHtml(companyName)}</p>` : ''}
  <h1>${escapeHtml(title)}</h1>
  ${period ? `<p>${escapeHtml(period)}</p>` : ''}
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Party</th>
        <th>PAN</th>
        <th>TDS Head</th>
        <th>Expenses Date</th>
        <th>Expenses Amount</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="7">No lines</td></tr>`}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4"></td>
        <td>Total</td>
        <td class="num">${escapeHtml(formatValue(totalExpenses))}</td>
        <td class="num">${escapeHtml(formatValue(totalAmount))}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`
}

export function createTdsWorkingsExcelBlob(params) {
  const html = buildTdsWorkingsExcelHtml(params)
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const fileName = getTdsWorkingsExcelFileName(params)
  return { blob, fileName, html }
}
