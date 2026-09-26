/**
 * Formats a duration in milliseconds into MM:SS format.
 */
export function formatTime(ms: number): string {
  if (!ms || ms <= 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Formats total duration in milliseconds into human readable format,
 * e.g. "45 min 20 sec" or "1 hr 14 min".
 */
export function formatTotalDuration(ms: number): string {
  if (!ms || ms <= 0) return '0 min'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`
  }
  return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} min`
}
