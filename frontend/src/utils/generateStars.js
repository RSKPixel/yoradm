export function generateStars(count = 110, brightnessPct = 35) {
  const factor = Math.min(100, Math.max(0, brightnessPct)) / 100
  const opacityMin = 0.08 + factor * 0.12
  const opacityRange = 0.1 + factor * 0.45

  return Array.from({ length: count }, (_, index) => {
    const roll = Math.random()
    let size = 'sm'
    if (roll > 0.92) size = 'lg'
    else if (roll > 0.72) size = 'md'

    return {
      id: index,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size,
      twinkle: Math.random() > 0.88,
      delay: `${Math.random() * 6}s`,
      duration: `${3 + Math.random() * 4}s`,
      opacity: opacityMin + Math.random() * opacityRange,
    }
  })
}
