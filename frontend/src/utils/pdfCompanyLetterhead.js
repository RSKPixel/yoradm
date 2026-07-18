import { setPdfCandaraFont } from './pdfCandaraFont'

export const LETTERHEAD_MARGIN = 14
export const LETTERHEAD_START_Y = 16
export const LETTERHEAD_COMPANY_NAME_FONT_SIZE = 19
export const LETTERHEAD_ADDRESS_FONT_SIZE = 9
export const LETTERHEAD_CONTACT_FONT_SIZE = 9
export const LETTERHEAD_MIDDLE_BLOCK_HEIGHT = 11
export const LETTERHEAD_REPORT_TITLE_FONT_SIZE = 12

const joinParts = (parts, separator = ', ') =>
  parts.filter((part) => part?.trim()).join(separator)

export const toPdfTitleCase = (value) =>
  String(value || '')
    .trim()
    .replace(
      /\w\S*/g,
      (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )

const addCenteredLine = (
  doc,
  pageWidth,
  text,
  y,
  { fontSize = 9, fontStyle = 'normal', lineHeight = 5 } = {},
) => {
  if (!text?.trim()) return y
  setPdfCandaraFont(doc, fontStyle)
  doc.setFontSize(fontSize)
  doc.text(text, pageWidth / 2, y, { align: 'center' })
  return y + lineHeight
}

const addSeparatorLine = (doc, pageWidth, y, margin, spacingAfter = 0) => {
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageWidth - margin, y)
  return y + spacingAfter
}

const getGstin = (company) => String(company?.gstin || '').trim()

const buildLocationLine = (company) => {
  const cityState = joinParts([company?.city, company?.state])
  const parts = [company?.address, company?.area, cityState].filter((part) => part?.trim())
  const pincode = company?.pincode?.trim()
  let line = joinParts(parts)

  if (pincode) {
    line = line ? `${line} - ${pincode}` : pincode
  }

  return line
}

const addCenteredContactLine = (doc, pageWidth, y, phone, email) => {
  const items = []
  if (phone?.trim()) {
    items.push({ label: 'Phone: ', value: phone.trim() })
  }
  if (email?.trim()) {
    items.push({ label: 'Email: ', value: email.trim() })
  }
  if (items.length === 0) return y

  const separator = '    '
  doc.setFontSize(LETTERHEAD_CONTACT_FONT_SIZE)

  let totalWidth = 0
  const measured = items.map((item) => {
    setPdfCandaraFont(doc, 'normal')
    const labelWidth = doc.getTextWidth(item.label)
    setPdfCandaraFont(doc, 'bold')
    const valueWidth = doc.getTextWidth(item.value)
    totalWidth += labelWidth + valueWidth
    return { ...item, labelWidth, valueWidth }
  })

  if (items.length > 1) {
    setPdfCandaraFont(doc, 'normal')
    totalWidth += doc.getTextWidth(separator) * (items.length - 1)
  }

  let x = (pageWidth - totalWidth) / 2
  items.forEach((item, index) => {
    const sizes = measured[index]
    setPdfCandaraFont(doc, 'normal')
    doc.text(item.label, x, y)
    x += sizes.labelWidth
    setPdfCandaraFont(doc, 'bold')
    doc.text(item.value, x, y)
    x += sizes.valueWidth

    if (index < items.length - 1) {
      setPdfCandaraFont(doc, 'normal')
      doc.text(separator, x, y)
      x += doc.getTextWidth(separator)
    }
  })

  return y + 6
}

/**
 * Standard company letterhead (same design as YORA).
 * Returns the Y position after the header block.
 *
 * Options (all default to true so existing callers are unchanged):
 * - showGstin: include GSTIN line when present on company
 * - showContact: include phone/email contact line
 */
export function drawCompanyLetterhead(doc, company, options = {}) {
  const showGstin = options.showGstin !== false
  const showContact = options.showContact !== false
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = LETTERHEAD_MARGIN
  let y = LETTERHEAD_START_Y

  y = addCenteredLine(
    doc,
    pageWidth,
    toPdfTitleCase(company?.company_name || 'Company'),
    y,
    {
      fontSize: LETTERHEAD_COMPANY_NAME_FONT_SIZE,
      fontStyle: 'bold',
      lineHeight: 2,
    },
  )

  y = addSeparatorLine(doc, pageWidth, y + 1, margin)

  const locationLine = buildLocationLine(company)
  const gstin = showGstin ? getGstin(company) : ''
  const middleLines = []
  if (locationLine) {
    middleLines.push({ text: locationLine, fontStyle: 'normal' })
  }
  if (gstin) {
    middleLines.push({ text: `GSTIN: ${gstin}`, fontStyle: 'bold' })
  }

  const blockTop = y
  const lineSpacing = 4
  // Keep full middle-block height when GSTIN is shown; compact only when omitted
  const middleBlockHeight =
    showGstin || middleLines.length > 1
      ? LETTERHEAD_MIDDLE_BLOCK_HEIGHT
      : Math.min(LETTERHEAD_MIDDLE_BLOCK_HEIGHT, 7)
  const contentHeight = Math.max(lineSpacing, middleLines.length * lineSpacing)
  const startY = blockTop + (middleBlockHeight - contentHeight) / 2 + 2.5

  middleLines.forEach((line, index) => {
    addCenteredLine(doc, pageWidth, line.text, startY + index * lineSpacing, {
      fontSize: LETTERHEAD_ADDRESS_FONT_SIZE,
      fontStyle: line.fontStyle,
      lineHeight: lineSpacing,
    })
  })

  y = blockTop + middleBlockHeight
  y = addSeparatorLine(doc, pageWidth, y, margin, showContact ? 3 : 2)
  if (showContact) {
    const phone = company?.mobile || company?.phone || ''
    y = addCenteredContactLine(doc, pageWidth, y, phone, company?.email)
  }

  return {
    y: y + (showContact ? 4 : 3),
    pageWidth,
    margin,
  }
}

/**
 * @param {number} [topGap=0] Extra space above the title (mm), useful after a compact letterhead.
 * @param {number} [fontSize] Defaults to letterhead report title size (12).
 */
export function addPdfReportTitle(doc, pageWidth, title, y, topGap = 0, fontSize = LETTERHEAD_REPORT_TITLE_FONT_SIZE) {
  return addCenteredLine(doc, pageWidth, toPdfTitleCase(title), y + topGap, {
    fontSize,
    fontStyle: 'bold',
    lineHeight: 10,
  })
}
