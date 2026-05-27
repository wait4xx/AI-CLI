/**
 * Shared dark theme color palette.
 * Used by TerminalContainer (xterm) and CodeEditor (CodeMirror).
 */

export const THEME_COLORS = {
  /** Primary background */
  bg: '#1a1b26',
  /** Primary foreground / cursor */
  foreground: '#c0caf5',
  /** Selection / matching bracket highlight */
  selection: '#33467c',
  /** Gutter / border accent */
  gutterBorder: '#292e42',
  /** Gutter text (dimmed) */
  gutterText: '#565f89',
  /** Subtle foreground */
  textMuted: '#a9b1d6',
} as const
