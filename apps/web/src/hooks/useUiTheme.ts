import { useSessionStore } from '../store/sessionStore'

export function useUiTheme() {
  const uiTheme = useSessionStore((s) => s.uiTheme)
  const dark = uiTheme === 'dark'
  return {
    dark,
    bg: dark ? 'bg-[#0f0f1a]' : 'bg-[#fafafa]',
    surface: dark ? 'bg-[#1a1a2e]' : 'bg-white',
    panel: dark ? 'bg-[#16161e]' : 'bg-[#f5f5f5]',
    border: dark ? 'border-[#292e42]' : 'border-[#e0e0e0]',
    text: dark ? 'text-gray-200' : 'text-gray-800',
    textMuted: dark ? 'text-gray-400' : 'text-gray-500',
    textDim: dark ? 'text-gray-500' : 'text-gray-500',
    hover: dark ? 'hover:bg-white/10' : 'hover:bg-black/5',
    active: dark ? 'active:bg-white/15' : 'active:bg-black/10',
  }
}
