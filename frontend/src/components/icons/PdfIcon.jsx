/** Compact PDF file glyph (document + PDF mark). */
export function PdfIcon({ className = '', ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="16.25"
        textAnchor="middle"
        fill="currentColor"
        fontSize="6"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="700"
        letterSpacing="0.4"
      >
        PDF
      </text>
    </svg>
  )
}
