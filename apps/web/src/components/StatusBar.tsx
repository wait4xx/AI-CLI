import { memo, useState, useEffect } from 'react'
import {
  Loader2,
  Sun,
  Moon,
  Minus,
  Plus,
  Monitor,
  User,
  Smartphone,
  Tablet,
  TabletSmartphone,
} from 'lucide-react'
import {
  SiApple,
  SiUbuntu,
  SiArchlinux,
  SiDebian,
  SiFedora,
  SiLinux,
  SiHuawei,
  SiCentos,
  SiRedhat,
  SiSuse,
  SiLinuxmint,
  SiManjaro,
} from 'react-icons/si'
import { useSessionStore } from '../store/sessionStore'
import { useUiTheme } from '../hooks/useUiTheme'
import type { AgentStatus } from '@ai-cli/shared'

/** Device icon component — distinct branded icon per OS/device */
function DeviceIcon({ name, className }: { name: string; className?: string }) {
  const cls = className || 'w-3 h-3'
  if (/^macOS/.test(name)) return <SiApple className={cls} />
  if (/^Windows/.test(name))
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
      </svg>
    )
  if (/Ubuntu/.test(name)) return <SiUbuntu className={cls} />
  if (/Arch/.test(name)) return <SiArchlinux className={cls} />
  if (/Debian/.test(name)) return <SiDebian className={cls} />
  if (/Fedora/.test(name)) return <SiFedora className={cls} />
  if (/CentOS/.test(name)) return <SiCentos className={cls} />
  if (/Red Hat/.test(name)) return <SiRedhat className={cls} />
  if (/SUSE/.test(name)) return <SiSuse className={cls} />
  if (/Mint/.test(name)) return <SiLinuxmint className={cls} />
  if (/Manjaro/.test(name)) return <SiManjaro className={cls} />
  if (/^Linux/.test(name)) return <SiLinux className={cls} />
  if (/HarmonyOS|Harmony/.test(name)) return <SiHuawei className={cls} />
  if (/^iPhone/.test(name)) return <Smartphone className={cls} />
  if (/^iPad/.test(name)) return <Tablet className={cls} />
  if (/^Android/.test(name)) return <TabletSmartphone className={cls} />
  return <Monitor className={cls} />
}

/** Compact device label for medium-width screens */
function getShortDeviceName(name: string): string {
  if (/^macOS/.test(name)) return 'macOS'
  if (/^Windows 11/.test(name)) return 'Win11'
  if (/^Windows/.test(name)) return 'Win10'
  if (/^iPhone/.test(name)) return 'iPhone'
  if (/^iPad/.test(name)) return 'iPad'
  if (/HarmonyOS|Harmony/.test(name)) return 'Harmony'
  if (/^Linux/.test(name)) return 'Linux'
  if (/^Android/.test(name) || /Android/.test(navigator.userAgent)) return 'Android'
  return name.split(/[\s·(]/)[0] || 'Device'
}

function resolveDeviceName(): string {
  const ua = navigator.userAgent
  const cores = navigator.hardwareConcurrency ?? 0
  // iPhone
  const iphoneMatch = ua.match(/iPhone; CPU iPhone OS [\d_]+ like Mac OS X/)
  if (iphoneMatch) {
    const m = ua.match(/\(([^)]+)\)/)
    const hw = m ? m[1].split(';')[0].trim() : 'iPhone'
    return hw.replace(/^(CPU |iPhone )/, '') || 'iPhone'
  }
  // iPad
  if (/iPad/.test(ua)) {
    const m = ua.match(/\(([^)]+)\)/)
    const hw = m ? m[1].split(';')[0].trim() : 'iPad'
    return hw.replace(/^iPad /, '') || 'iPad'
  }
  // Android
  const androidMatch = ua.match(/Android [\d.]+; ([^;)]+)/)
  if (androidMatch) {
    const model = androidMatch[1].trim().replace(/ Build\/.*$/, '')
    // HarmonyOS detection (Huawei devices running Harmony)
    if (/HarmonyOS/i.test(ua)) return `HarmonyOS ${model}`
    return model
  }
  // macOS
  const macMatch = ua.match(/Mac OS X (\d+[_.]\d+[_.]?\d*)/)
  if (macMatch) {
    const ver = macMatch[1].replace(/_/g, '.')
    const arm = /arm/.test(ua) ? ' Apple Silicon' : ''
    return `macOS ${ver}${arm}${cores > 0 ? ` · ${cores}C` : ''}`
  }
  // Windows — cannot distinguish 10 vs 11 without async Client Hints
  if (/Windows/.test(ua)) return `Windows 10/11${cores > 0 ? ` · ${cores}C` : ''}`
  // Linux
  if (/Linux/.test(ua)) {
    const distro = ua.match(/(Ubuntu|Fedora|Debian|Arch|CentOS|Red Hat|SUSE)/)
    return `${distro ? `Linux/${distro[1]}` : 'Linux'}${cores > 0 ? ` · ${cores}C` : ''}`
  }
  return 'Device'
}

async function resolveDeviceNameAsync(): Promise<string> {
  const ua = navigator.userAgent
  const cores = navigator.hardwareConcurrency ?? 0
  // Mobile — same as sync
  if (/iPhone|iPad|Android/.test(ua)) return resolveDeviceName()
  // Try Client Hints for desktop details
  const uad = (
    navigator as unknown as {
      userAgentData?: {
        getHighEntropyValues: (
          hints: string[],
        ) => Promise<Record<string, string | number | boolean>>
      }
    }
  ).userAgentData
  if (!uad) return resolveDeviceName()
  try {
    const h = await uad.getHighEntropyValues([
      'architecture',
      'bitness',
      'platformVersion',
      'platform',
    ])
    const arch = h.architecture ? ` (${h.architecture}${h.bitness ? ` ${h.bitness}-bit` : ''})` : ''
    const coreStr = cores > 0 ? ` · ${cores}C` : ''
    if (h.platform === 'Windows') {
      const major = parseInt(String(h.platformVersion ?? '0'))
      return `Windows ${major >= 13 ? '11' : '10'}${arch}${coreStr}`
    }
    if (h.platform === 'macOS') {
      const chip = h.architecture === 'arm' ? ' Apple Silicon' : ''
      return `macOS ${String(h.platformVersion ?? '')}${chip}${coreStr}`
    }
    if (h.platform === 'Linux') {
      return `Linux${arch}${coreStr}`
    }
    return resolveDeviceName()
  } catch {
    return resolveDeviceName()
  }
}

function useDeviceName(): string {
  const [name, setName] = useState(resolveDeviceName)
  useEffect(() => {
    resolveDeviceNameAsync().then(setName)
  }, [])
  return name
}

const agentStatusConfig: Record<
  AgentStatus,
  { label: string; className: string; icon?: 'spin' | 'blink' }
> = {
  IDLE: { label: 'IDLE', className: 'bg-gray-600 text-gray-300' },
  RUNNING: { label: 'RUNNING', className: 'bg-blue-600 text-blue-100', icon: 'spin' },
  WAITING_APPROVAL: {
    label: 'APPROVAL',
    className: 'bg-orange-500 text-orange-100',
    icon: 'blink',
  },
  ERROR: { label: 'ERROR', className: 'bg-red-600 text-red-100' },
}

export const StatusBar = memo(function StatusBar({
  actionsSlot,
}: {
  actionsSlot?: React.ReactNode
}) {
  const {
    connectionPhase,
    agentStatus,
    sessions,
    activeSessionIndex,
    uiTheme,
    setUiTheme,
    fontSize,
    editorFontSize,
    setFontSize,
    setEditorFontSize,
    currentUser,
  } = useSessionStore()
  const ui = useUiTheme()
  const deviceName = useDeviceName()

  const dotColor =
    connectionPhase === 'CONNECTED'
      ? 'bg-green-500'
      : connectionPhase === 'DISCONNECTED'
        ? 'bg-red-500'
        : 'bg-yellow-500'

  const config = agentStatusConfig[agentStatus]

  return (
    <div
      className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-[40px] ${ui.surface} border-b ${ui.border} text-xs ${ui.text} shrink-0 overflow-hidden`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${config.className}`}
      >
        {config.icon === 'spin' && <Loader2 className="w-3 h-3 animate-spin" />}
        {config.icon === 'blink' && (
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        )}
        {config.label}
      </span>
      <span className="flex-1 min-w-0" />
      {/* User info — always visible, responsive sizing */}
      {currentUser && (
        <div className={`flex items-center gap-1 ${ui.textDim}`}>
          <User className="w-3 h-3 shrink-0" />
          <span className="text-[10px] sm:text-[11px] truncate max-w-[60px] sm:max-w-[80px]">
            {currentUser.username}
          </span>
          {currentUser.role === 'admin' && (
            <span className="text-[8px] sm:text-[9px] px-1 py-0 rounded bg-orange-500/20 text-orange-400 shrink-0">
              admin
            </span>
          )}
          <span className="text-[10px] opacity-40 mx-0.5">·</span>
          {/* Device icon — same brand icon on all sizes */}
          <DeviceIcon name={deviceName} className={`w-3 h-3 shrink-0 ${ui.textMuted}`} />
          <span className="hidden sm:inline text-[10px] sm:text-[11px] truncate max-w-[100px]">
            {getShortDeviceName(deviceName)}
          </span>
        </div>
      )}
      {/* Session label — hidden on small screens */}
      {sessions[activeSessionIndex] && (
        <span className={`hidden sm:block ${ui.textDim} truncate max-w-[120px] text-[11px]`}>
          {sessions[activeSessionIndex].label}
        </span>
      )}
      <button
        onClick={() => setUiTheme(uiTheme === 'dark' ? 'light' : 'dark')}
        className={`p-1.5 rounded-lg ${ui.hover} ${ui.active} transition-colors shrink-0`}
        aria-label="Toggle theme"
      >
        {uiTheme === 'dark' ? (
          <Sun className="w-4 h-4 text-yellow-400" />
        ) : (
          <Moon className="w-4 h-4 text-gray-600" />
        )}
      </button>
      {/* Font size controls — compact on small screens */}
      <div
        className={`hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded ${ui.surface} border ${ui.border}`}
      >
        <span className={`text-[9px] ${ui.textMuted}`}>T</span>
        <button
          onClick={() => setFontSize(Math.max(10, fontSize - 1))}
          disabled={fontSize <= 10}
          className={`p-0.5 rounded ${ui.hover} disabled:opacity-30 transition-colors`}
          aria-label="Terminal zoom out"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className={`w-5 text-center text-[10px] tabular-nums ${ui.text}`}>{fontSize}</span>
        <button
          onClick={() => setFontSize(Math.min(32, fontSize + 1))}
          disabled={fontSize >= 32}
          className={`p-0.5 rounded ${ui.hover} disabled:opacity-30 transition-colors`}
          aria-label="Terminal zoom in"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      <div
        className={`hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded ${ui.surface} border ${ui.border}`}
      >
        <span className={`text-[9px] ${ui.textMuted}`}>E</span>
        <button
          onClick={() => setEditorFontSize(Math.max(10, editorFontSize - 1))}
          disabled={editorFontSize <= 10}
          className={`p-0.5 rounded ${ui.hover} disabled:opacity-30 transition-colors`}
          aria-label="Editor zoom out"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className={`w-5 text-center text-[10px] tabular-nums ${ui.text}`}>
          {editorFontSize}
        </span>
        <button
          onClick={() => setEditorFontSize(Math.min(32, editorFontSize + 1))}
          disabled={editorFontSize >= 32}
          className={`p-0.5 rounded ${ui.hover} disabled:opacity-30 transition-colors`}
          aria-label="Editor zoom in"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      {actionsSlot}
    </div>
  )
})
