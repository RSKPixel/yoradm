import { formatDate } from './formatDate'
import { formatValue } from './formatNumber'

const PAD_X = 16
const PAD_Y = 14
const ROW_H = 22
const COMPANY_H = 30
const SUBTITLE_H = 20
const COLS = [
  { key: 'invoice', width: 118, align: 'left' },
  { key: 'date', width: 108, align: 'left' },
  { key: 'amount', width: 118, align: 'right' },
  { key: 'age', width: 52, align: 'right' },
]

const COLORS = {
  bg: '#ffffff',
  ink: '#1a1a1a',
  muted: '#555555',
  line: '#b0b0b0',
  partyBg: '#e8e8e8',
  subtotalBg: '#f7f7f7',
  overdueBg: '#fde8d8',
}

function tableWidth() {
  return COLS.reduce((sum, col) => sum + col.width, 0)
}

function buildRows(partyGroups) {
  const rows = []

  for (const group of partyGroups) {
    rows.push({ type: 'party', text: group.ledgerName })
    for (const inv of group.invoices) {
      const days = inv.days
      rows.push({
        type: 'invoice',
        overdue: days != null && days > 30,
        cells: [
          inv.invoice_no ?? '',
          formatDate(inv.invoice_date) || '',
          formatValue(inv.amount),
          days == null ? '' : String(days),
        ],
      })
    }
    rows.push({
      type: 'subtotal',
      cells: ['Sub total', '', formatValue(group.total), ''],
    })
  }

  return rows
}

function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

function strokeHLine(ctx, x, y, w, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y + 0.5)
  ctx.lineTo(x + w, y + 0.5)
  ctx.stroke()
  ctx.restore()
}

function drawText(ctx, text, x, y, { align = 'left', bold = false, color = COLORS.ink, fontSize = 12, maxWidth } = {}) {
  ctx.fillStyle = color
  ctx.font = `${bold ? '600' : '400'} ${fontSize}px "IBM Plex Mono", ui-monospace, Menlo, monospace`
  ctx.textBaseline = 'middle'
  ctx.textAlign = align
  let out = String(text ?? '')
  if (maxWidth != null && maxWidth > 0) {
    if (ctx.measureText(out).width > maxWidth) {
      const ellipsis = '…'
      let lo = 0
      let hi = out.length
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        const candidate = `${out.slice(0, mid)}${ellipsis}`
        if (ctx.measureText(candidate).width <= maxWidth) lo = mid
        else hi = mid - 1
      }
      out = `${out.slice(0, lo)}${ellipsis}`
    }
  }
  ctx.fillText(out, x, y)
}

/**
 * Render filtered receivables as a light Excel-style PNG (for WhatsApp paste).
 * @returns {Promise<Blob>}
 */
export async function buildReceivablesImageBlob(
  partyGroups,
  { companyName = '', asOfDate = new Date() } = {},
) {
  const rows = buildRows(partyGroups)
  const contentW = tableWidth()
  const company = String(companyName || '').trim()
  const asOnLabel = `Debitors Receivable as on ${formatDate(asOfDate)}`
  const titleBlock = company ? COMPANY_H + SUBTITLE_H + 8 : SUBTITLE_H + 8
  const contentH = rows.length * ROW_H
  const width = contentW + PAD_X * 2
  const height = contentH + PAD_Y * 2 + titleBlock

  const scale = Math.max(2, Math.min(3, window.devicePixelRatio || 2))
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create image canvas')

  ctx.scale(scale, scale)
  fillRect(ctx, 0, 0, width, height, COLORS.bg)

  let y = PAD_Y
  const x0 = PAD_X

  if (company) {
    drawText(ctx, company, x0 + contentW / 2, y + COMPANY_H / 2, {
      align: 'center',
      bold: true,
      fontSize: 17,
      maxWidth: contentW,
    })
    y += COMPANY_H
  }

  drawText(ctx, asOnLabel, x0 + contentW / 2, y + SUBTITLE_H / 2, {
    align: 'center',
    bold: false,
    color: COLORS.muted,
    fontSize: 12,
    maxWidth: contentW,
  })
  y += SUBTITLE_H + 8

  const tableTop = y

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const h = ROW_H
    const midY = y + h / 2

    if (row.type === 'party') {
      fillRect(ctx, x0, y, contentW, h, COLORS.partyBg)
      drawText(ctx, row.text, x0 + 8, midY, {
        bold: true,
        fontSize: 12,
        maxWidth: contentW - 16,
      })
    } else if (row.type === 'subtotal') {
      fillRect(ctx, x0, y, contentW, h, COLORS.subtotalBg)
      drawText(ctx, row.cells[0], x0 + 8, midY, { bold: true, fontSize: 12 })
      const amountX = x0 + COLS[0].width + COLS[1].width
      drawText(ctx, row.cells[2], amountX + COLS[2].width - 8, midY, {
        align: 'right',
        bold: true,
        fontSize: 12,
      })
    } else {
      if (row.overdue) {
        fillRect(ctx, x0, y, contentW, h, COLORS.overdueBg)
      }
      let x = x0
      COLS.forEach((col, idx) => {
        const tx = col.align === 'right' ? x + col.width - 8 : x + 8
        drawText(ctx, row.cells[idx], tx, midY, {
          align: col.align,
          fontSize: 12,
        })
        x += col.width
      })
    }

    // Bottom border under every row (drawn after fills so it stays visible).
    strokeHLine(ctx, x0, y + h - 1, contentW, COLORS.line)
    y += h
  }

  ctx.strokeStyle = COLORS.line
  ctx.lineWidth = 1
  ctx.strokeRect(x0 + 0.5, tableTop + 0.5, contentW - 1, contentH - 1)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not create image'))
      },
      'image/png',
      1,
    )
  })
}

export async function copyImageBlobToClipboard(blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Image clipboard is not supported in this browser')
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      'image/png': Promise.resolve(blob),
    }),
  ])
}
