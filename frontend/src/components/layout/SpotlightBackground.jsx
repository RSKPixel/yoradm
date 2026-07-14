import { useMemo } from 'react'
import { generateStars } from '../../utils/generateStars'

const STAR_COUNT = 110
const STAR_BRIGHTNESS = 46

export function SpotlightBackground({ className = '' }) {
  const stars = useMemo(() => generateStars(STAR_COUNT, STAR_BRIGHTNESS), [])

  return (
    <div
      className={`spotlight-bg pointer-events-none absolute inset-0 overflow-hidden ${className}`.trim()}
      aria-hidden="true"
    >
      <div className="spotlight-bg__glow" />
      <div className="spotlight-bg__stars">
        {stars.map((star) => (
          <span
            key={star.id}
            className={`spotlight-star spotlight-star--${star.size}${
              star.twinkle ? ' spotlight-star--twinkle' : ''
            }`}
            style={{
              left: star.left,
              top: star.top,
              opacity: star.opacity,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
          />
        ))}
      </div>
    </div>
  )
}
