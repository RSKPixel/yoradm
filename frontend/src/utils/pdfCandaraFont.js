const FONT_REGULAR_PATH = '/fonts/Candara-Regular.ttf'
const FONT_BOLD_PATH = '/fonts/Candara-Bold.ttf'
const FONT_FAMILY = 'Candara'

let fontCachePromise = null

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function loadFontBase64(path) {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Unable to load PDF font: ${path}`)
  }
  const buffer = await response.arrayBuffer()
  return arrayBufferToBase64(buffer)
}

export async function loadPdfCandaraFonts() {
  if (!fontCachePromise) {
    fontCachePromise = Promise.all([
      loadFontBase64(FONT_REGULAR_PATH),
      loadFontBase64(FONT_BOLD_PATH),
    ]).then(([regular, bold]) => ({ regular, bold }))
  }
  return fontCachePromise
}

export function registerPdfCandaraFonts(doc, fonts) {
  doc.addFileToVFS('Candara-Regular.ttf', fonts.regular)
  doc.addFileToVFS('Candara-Bold.ttf', fonts.bold)
  doc.addFont('Candara-Regular.ttf', FONT_FAMILY, 'normal')
  doc.addFont('Candara-Bold.ttf', FONT_FAMILY, 'bold')
}

export function setPdfCandaraFont(doc, style = 'normal') {
  doc.setFont(FONT_FAMILY, style === 'bold' ? 'bold' : 'normal')
}

export const PDF_CANDARA_FAMILY = FONT_FAMILY
