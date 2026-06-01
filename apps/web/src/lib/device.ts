export function isMobile(): boolean {
  return 'ontouchstart' in window && window.innerWidth < 1024
}
