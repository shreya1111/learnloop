export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return "Duration unavailable";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`;
}
