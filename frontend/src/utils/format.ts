// "742 km", or "850 m" for short distances
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${Math.round(meters / 1000)} km`
}

// "7 h 7 min", or "45 min" when under an hour
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${minutes} min`
}
