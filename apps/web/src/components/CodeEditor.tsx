import { useCallback, useState, useMemo, useRef, useEffect } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { ViewUpdate } from '@codemirror/view'
import { keymap } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { go } from '@codemirror/lang-go'
import { rust } from '@codemirror/lang-rust'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { php } from '@codemirror/lang-php'
import { sql } from '@codemirror/lang-sql'
import {
  StreamLanguage,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { ruby as rubyMode } from '@codemirror/legacy-modes/mode/ruby'
import { swift as swiftMode } from '@codemirror/legacy-modes/mode/swift'
import { shell as shellMode } from '@codemirror/legacy-modes/mode/shell'
import { yaml as yamlMode } from '@codemirror/legacy-modes/mode/yaml'
import { toml as tomlMode } from '@codemirror/legacy-modes/mode/toml'
import { dockerFile as dockerfileMode } from '@codemirror/legacy-modes/mode/dockerfile'
import { xml as xmlMode } from '@codemirror/legacy-modes/mode/xml'
import { protobuf as protobufMode } from '@codemirror/legacy-modes/mode/protobuf'
import { diff as diffMode } from '@codemirror/legacy-modes/mode/diff'
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  X,
  Terminal,
  Save,
  Eye,
  PenLine,
  Loader2,
  Columns2,
  PanelLeftClose,
  PanelLeftOpen,
  Folder,
  File,
  List,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Download,
  MoreVertical,
  Check,
  FolderPlus,
  ArrowLeft,
} from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

interface CodeEditorProps {
  filePath: string
  content: string
  language: string
  onClose: () => void
  onInjectCode: (code: string) => void
  onOpenFile?: (path: string, content: string, language: string, replace?: boolean) => void
}

// ---- helpers ----

const EXT_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.html': 'html',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.sql': 'sql',
  '.kt': 'kotlin',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.svg': 'xml',
  '.proto': 'protobuf',
  '.diff': 'diff',
  '.patch': 'diff',
}

function getLanguageFromPath(p: string): string {
  const ext = '.' + p.split('.').pop()?.toLowerCase()
  return EXT_LANGUAGE_MAP[ext] || 'text'
}

function getLanguageExtension(lang: string) {
  switch (lang) {
    case 'typescript':
    case 'javascript':
      return javascript({ typescript: lang === 'typescript' })
    case 'python':
      return python()
    case 'json':
      return json()
    case 'markdown':
      return markdown()
    case 'css':
      return css()
    case 'html':
      return html()
    case 'go':
      return go()
    case 'rust':
      return rust()
    case 'java':
      return java()
    case 'c':
    case 'cpp':
      return cpp()
    case 'php':
      return php()
    case 'ruby':
      return StreamLanguage.define(rubyMode)
    case 'swift':
      return StreamLanguage.define(swiftMode)
    case 'sql':
      return sql()
    case 'shell':
      return StreamLanguage.define(shellMode)
    case 'yaml':
      return StreamLanguage.define(yamlMode)
    case 'toml':
      return StreamLanguage.define(tomlMode)
    case 'dockerfile':
      return StreamLanguage.define(dockerfileMode)
    case 'xml':
      return StreamLanguage.define(xmlMode)
    case 'protobuf':
      return StreamLanguage.define(protobufMode)
    case 'diff':
      return StreamLanguage.define(diffMode)
    default:
      return []
  }
}

const fileName = (filePath: string) => {
  const parts = filePath.split('/')
  return parts[parts.length - 1] || filePath
}

const dirName = (filePath: string) => {
  const parts = filePath.split('/')
  parts.pop()
  return parts.join('/')
}

function hasPreview(language: string) {
  return language === 'markdown' || language === 'html'
}

// ---- sidebar tree types ----

interface TreeEntry {
  name: string
  path: string
  type: 'directory' | 'file'
}

interface Heading {
  level: number
  text: string
  line: number
  id: string
}

function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  const lines = content.split('\n')
  let counter = 0
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/)
    if (m) {
      counter++
      headings.push({
        level: m[1].length,
        text: m[2].replace(/[*_`#[\]()!]/g, '').trim(),
        line: i,
        id: `heading-${counter}`,
      })
    }
  }
  return headings
}

// ---- editor themes ----

const FONT_FAMILY = '"JetBrains Mono", "Smiley Sans", "Fira Code", Menlo, Monaco, monospace'

interface EditorThemeDef {
  cmTheme: ReturnType<typeof EditorView.theme>
  highlightExt: ReturnType<typeof syntaxHighlighting>
  bg: string
  bgPanel: string
  border: string
  textPrimary: string
  textMuted: string
  textDim: string
  hoverBg: string
  activeBg: string
  swatch: string[]
}

function makeCmTheme(c: {
  bg: string
  fg: string
  cursor: string
  sel: string
  gutterBg: string
  gutterBorder: string
  gutterText: string
  activeLine: string
  tooltipBg: string
  tooltipBorder: string
  tooltipFg: string
  accent: string
  comment: string
}) {
  return EditorView.theme({
    '&': { backgroundColor: c.bg, color: c.fg },
    '.cm-content': {
      caretColor: c.cursor,
      fontFamily: FONT_FAMILY,
      lineHeight: '1.5',
      fontSize: 'var(--editor-font-size)',
    },
    '.cm-cursor': { borderLeftColor: c.cursor },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: c.sel,
    },
    '.cm-gutters': {
      backgroundColor: c.gutterBg,
      borderRight: `1px solid ${c.gutterBorder}`,
      color: c.gutterText,
    },
    '.cm-activeLineGutter': { backgroundColor: c.gutterBorder },
    '.cm-activeLine': { backgroundColor: c.activeLine },
    '.cm-matchingBracket': { backgroundColor: c.sel, color: `${c.fg} !important` },
    '.cm-tooltip': {
      backgroundColor: c.tooltipBg,
      border: `1px solid ${c.tooltipBorder}`,
      color: c.tooltipFg,
    },
    '.cm-tooltip-autocomplete > ul > li': { padding: '2px 8px', color: c.tooltipFg },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: c.gutterBorder,
      color: c.accent,
    },
    '.cm-completionLabel': { color: c.tooltipFg },
    '.cm-completionDetail': { color: c.comment, fontStyle: 'italic' },
    '.cm-tooltip-arrow::after': { borderBottomColor: c.tooltipBg },
    '.cm-tooltip-arrow::before': { borderBottomColor: c.tooltipBorder },
  })
}

type SyntaxColors = {
  keyword: string
  string: string
  number: string
  comment: string
  function_: string
  variable: string
  type: string
  operator: string
  property: string
  regexp: string
  bool: string
  null_: string
  className: string
  definition: string
  labelName: string
  namespace: string
}

function makeHighlightStyle(c: SyntaxColors) {
  return syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: c.keyword },
      { tag: tags.string, color: c.string },
      { tag: tags.number, color: c.number },
      { tag: tags.comment, color: c.comment, fontStyle: 'italic' },
      { tag: tags.variableName, color: c.variable },
      { tag: tags.typeName, color: c.type },
      { tag: tags.operator, color: c.operator },
      { tag: tags.propertyName, color: c.property },
      { tag: tags.regexp, color: c.regexp },
      { tag: tags.bool, color: c.bool },
      { tag: tags.null, color: c.null_ },
      { tag: tags.className, color: c.className },
      { tag: tags.labelName, color: c.labelName },
      { tag: tags.namespace, color: c.namespace },
      { tag: tags.separator, color: c.comment },
      { tag: tags.meta, color: c.comment },
      { tag: tags.angleBracket, color: c.operator },
      { tag: tags.attributeName, color: c.property },
      { tag: tags.tagName, color: c.keyword },
      { tag: tags.heading, color: c.keyword, fontWeight: 'bold' },
      { tag: tags.emphasis, fontStyle: 'italic' },
      { tag: tags.strong, fontWeight: 'bold' },
      { tag: tags.link, color: c.string, textDecoration: 'underline' },
      { tag: tags.url, color: c.string },
      { tag: tags.monospace, color: c.string },
    ]),
  )
}

const EDITOR_THEMES: Record<string, EditorThemeDef> = {
  'tokyo-night': {
    cmTheme: makeCmTheme({
      bg: '#1a1b26',
      fg: '#a9b1d6',
      cursor: '#c0caf5',
      sel: '#33467c',
      gutterBg: '#1a1b26',
      gutterBorder: '#292e42',
      gutterText: '#565f89',
      activeLine: '#292e4280',
      tooltipBg: '#1a1b2e',
      tooltipBorder: '#292e42',
      tooltipFg: '#c0caf5',
      accent: '#7aa2f7',
      comment: '#565f89',
    }),
    highlightExt: makeHighlightStyle({
      keyword: '#bb9af7',
      string: '#9ece6a',
      number: '#ff9e64',
      comment: '#565f89',
      function_: '#7aa2f7',
      variable: '#c0caf5',
      type: '#2ac3de',
      operator: '#89ddff',
      property: '#73daca',
      regexp: '#b4f9f8',
      bool: '#ff9e64',
      null_: '#ff9e64',
      className: '#2ac3de',
      definition: '#7aa2f7',
      labelName: '#ff9e64',
      namespace: '#bb9af7',
    }),
    bg: 'bg-[#1a1b26]',
    bgPanel: 'bg-[#16161e]',
    border: 'border-[#292e42]',
    textPrimary: 'text-gray-200',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    hoverBg: 'hover:bg-white/10',
    activeBg: 'active:bg-white/15',
    swatch: ['#1a1b26', '#7aa2f7', '#c0caf5'],
  },
  'one-dark': {
    cmTheme: makeCmTheme({
      bg: '#282c34',
      fg: '#abb2bf',
      cursor: '#528bff',
      sel: '#3e4451',
      gutterBg: '#282c34',
      gutterBorder: '#3e4451',
      gutterText: '#636d83',
      activeLine: '#2c313c',
      tooltipBg: '#21252b',
      tooltipBorder: '#3e4451',
      tooltipFg: '#abb2bf',
      accent: '#61afef',
      comment: '#636d83',
    }),
    highlightExt: makeHighlightStyle({
      keyword: '#c678dd',
      string: '#98c379',
      number: '#d19a66',
      comment: '#636d83',
      function_: '#61afef',
      variable: '#e06c75',
      type: '#e5c07b',
      operator: '#56b6c2',
      property: '#e06c75',
      regexp: '#98c379',
      bool: '#d19a66',
      null_: '#d19a66',
      className: '#e5c07b',
      definition: '#e06c75',
      labelName: '#c678dd',
      namespace: '#61afef',
    }),
    bg: 'bg-[#282c34]',
    bgPanel: 'bg-[#21252b]',
    border: 'border-[#3e4451]',
    textPrimary: 'text-gray-200',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    hoverBg: 'hover:bg-white/10',
    activeBg: 'active:bg-white/15',
    swatch: ['#282c34', '#61afef', '#e06c75'],
  },
  monokai: {
    cmTheme: makeCmTheme({
      bg: '#272822',
      fg: '#f8f8f2',
      cursor: '#f8f8f0',
      sel: '#49483e',
      gutterBg: '#272822',
      gutterBorder: '#3e3d32',
      gutterText: '#75715e',
      activeLine: '#3e3d3260',
      tooltipBg: '#1e1f1c',
      tooltipBorder: '#3e3d32',
      tooltipFg: '#f8f8f2',
      accent: '#a6e22e',
      comment: '#75715e',
    }),
    highlightExt: makeHighlightStyle({
      keyword: '#f92672',
      string: '#e6db74',
      number: '#ae81ff',
      comment: '#75715e',
      function_: '#a6e22e',
      variable: '#f8f8f2',
      type: '#66d9ef',
      operator: '#f92672',
      property: '#a6e22e',
      regexp: '#e6db74',
      bool: '#ae81ff',
      null_: '#ae81ff',
      className: '#66d9ef',
      definition: '#fd971f',
      labelName: '#ae81ff',
      namespace: '#a6e22e',
    }),
    bg: 'bg-[#272822]',
    bgPanel: 'bg-[#1e1f1c]',
    border: 'border-[#3e3d32]',
    textPrimary: 'text-gray-100',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    hoverBg: 'hover:bg-white/10',
    activeBg: 'active:bg-white/15',
    swatch: ['#272822', '#a6e22e', '#f92672'],
  },
  dracula: {
    cmTheme: makeCmTheme({
      bg: '#282a36',
      fg: '#f8f8f2',
      cursor: '#f8f8f2',
      sel: '#44475a',
      gutterBg: '#282a36',
      gutterBorder: '#44475a',
      gutterText: '#6272a4',
      activeLine: '#44475a60',
      tooltipBg: '#21222c',
      tooltipBorder: '#44475a',
      tooltipFg: '#f8f8f2',
      accent: '#bd93f9',
      comment: '#6272a4',
    }),
    highlightExt: makeHighlightStyle({
      keyword: '#ff79c6',
      string: '#f1fa8c',
      number: '#bd93f9',
      comment: '#6272a4',
      function_: '#50fa7b',
      variable: '#f8f8f2',
      type: '#8be9fd',
      operator: '#ff79c6',
      property: '#50fa7b',
      regexp: '#f1fa8c',
      bool: '#bd93f9',
      null_: '#bd93f9',
      className: '#8be9fd',
      definition: '#50fa7b',
      labelName: '#bd93f9',
      namespace: '#ff79c6',
    }),
    bg: 'bg-[#282a36]',
    bgPanel: 'bg-[#21222c]',
    border: 'border-[#44475a]',
    textPrimary: 'text-gray-100',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    hoverBg: 'hover:bg-white/10',
    activeBg: 'active:bg-white/15',
    swatch: ['#282a36', '#bd93f9', '#ff79c6'],
  },
  'solarized-dark': {
    cmTheme: makeCmTheme({
      bg: '#002b36',
      fg: '#839496',
      cursor: '#93a1a1',
      sel: '#073642',
      gutterBg: '#002b36',
      gutterBorder: '#073642',
      gutterText: '#586e75',
      activeLine: '#07364260',
      tooltipBg: '#002b36',
      tooltipBorder: '#073642',
      tooltipFg: '#93a1a1',
      accent: '#268bd2',
      comment: '#586e75',
    }),
    highlightExt: makeHighlightStyle({
      keyword: '#859900',
      string: '#2aa198',
      number: '#d33682',
      comment: '#586e75',
      function_: '#268bd2',
      variable: '#839496',
      type: '#b58900',
      operator: '#859900',
      property: '#268bd2',
      regexp: '#dc322f',
      bool: '#cb4b16',
      null_: '#cb4b16',
      className: '#b58900',
      definition: '#268bd2',
      labelName: '#cb4b16',
      namespace: '#859900',
    }),
    bg: 'bg-[#002b36]',
    bgPanel: 'bg-[#073642]',
    border: 'border-[#073642]',
    textPrimary: 'text-gray-300',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    hoverBg: 'hover:bg-white/10',
    activeBg: 'active:bg-white/15',
    swatch: ['#002b36', '#268bd2', '#b58900'],
  },
  'github-light': {
    cmTheme: makeCmTheme({
      bg: '#ffffff',
      fg: '#24292e',
      cursor: '#044289',
      sel: '#0366d620',
      gutterBg: '#f6f8fa',
      gutterBorder: '#e1e4e8',
      gutterText: '#959da5',
      activeLine: '#f6f8fa',
      tooltipBg: '#ffffff',
      tooltipBorder: '#e1e4e8',
      tooltipFg: '#24292e',
      accent: '#0366d6',
      comment: '#6a737d',
    }),
    highlightExt: makeHighlightStyle({
      keyword: '#d73a49',
      string: '#032f62',
      number: '#005cc5',
      comment: '#6a737d',
      function_: '#6f42c1',
      variable: '#e36209',
      type: '#005cc5',
      operator: '#d73a49',
      property: '#005cc5',
      regexp: '#032f62',
      bool: '#005cc5',
      null_: '#005cc5',
      className: '#6f42c1',
      definition: '#e36209',
      labelName: '#005cc5',
      namespace: '#6f42c1',
    }),
    bg: 'bg-[#ffffff]',
    bgPanel: 'bg-[#f6f8fa]',
    border: 'border-[#e1e4e8]',
    textPrimary: 'text-gray-800',
    textMuted: 'text-gray-500',
    textDim: 'text-gray-400',
    hoverBg: 'hover:bg-black/5',
    activeBg: 'active:bg-black/10',
    swatch: ['#ffffff', '#0366d6', '#e36209'],
  },
  'solarized-light': {
    cmTheme: makeCmTheme({
      bg: '#fdf6e3',
      fg: '#657b83',
      cursor: '#586e75',
      sel: '#eee8d5',
      gutterBg: '#fdf6e3',
      gutterBorder: '#eee8d5',
      gutterText: '#93a1a1',
      activeLine: '#eee8d560',
      tooltipBg: '#fdf6e3',
      tooltipBorder: '#eee8d5',
      tooltipFg: '#586e75',
      accent: '#268bd2',
      comment: '#93a1a1',
    }),
    highlightExt: makeHighlightStyle({
      keyword: '#859900',
      string: '#2aa198',
      number: '#d33682',
      comment: '#93a1a1',
      function_: '#268bd2',
      variable: '#657b83',
      type: '#b58900',
      operator: '#859900',
      property: '#268bd2',
      regexp: '#dc322f',
      bool: '#cb4b16',
      null_: '#cb4b16',
      className: '#b58900',
      definition: '#268bd2',
      labelName: '#cb4b16',
      namespace: '#859900',
    }),
    bg: 'bg-[#fdf6e3]',
    bgPanel: 'bg-[#eee8d5]',
    border: 'border-[#eee8d5]',
    textPrimary: 'text-gray-700',
    textMuted: 'text-gray-500',
    textDim: 'text-gray-400',
    hoverBg: 'hover:bg-black/5',
    activeBg: 'active:bg-black/10',
    swatch: ['#fdf6e3', '#268bd2', '#b58900'],
  },
}

export const EDITOR_THEME_LIST = Object.entries(EDITOR_THEMES).map(([id, t]) => ({
  id,
  name: id
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' '),
  swatch: t.swatch,
}))

// ---- component ----

export function CodeEditor({
  filePath,
  content,
  language,
  onClose,
  onInjectCode,
  onOpenFile,
}: CodeEditorProps) {
  const baseEditorThemeId = useSessionStore((s) => s.editorTheme)
  const fontSize = useSessionStore((s) => s.editorFontSize)
  const accessToken = useSessionStore((s) => s.accessToken)

  // file state
  const [currentFile, setCurrentFile] = useState({ path: filePath, content, language })

  // Auto-switch to solarized-light for markdown files
  const editorThemeId = currentFile.language === 'markdown' ? 'solarized-light' : baseEditorThemeId
  const themeDef = EDITOR_THEMES[editorThemeId] || EDITOR_THEMES['tokyo-night']

  const bg = themeDef.bg
  const bgPanel = themeDef.bgPanel
  const border = themeDef.border
  const textPrimary = themeDef.textPrimary
  const textMuted = themeDef.textMuted
  const textDim = themeDef.textDim
  const hoverBg = themeDef.hoverBg
  const activeBg = themeDef.activeBg
  const isEditorDark = !['github-light', 'solarized-light'].includes(editorThemeId)
  const [editedContent, setEditedContent] = useState(content)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>(() =>
    hasPreview(language) ? 'preview' : 'edit',
  )

  // sidebar state (persisted via zustand store)
  const sidebarOpen = useSessionStore((s) => s.sidebarOpen)
  const setSidebarOpen = useSessionStore((s) => s.setSidebarOpen)
  const sidebarWidth = useSessionStore((s) => s.sidebarWidth)
  const setSidebarWidth = useSessionStore((s) => s.setSidebarWidth)
  const resizingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const delta = e.clientX - startXRef.current
      setSidebarWidth(Math.max(140, Math.min(500, startWidthRef.current + delta)))
    }
    const onMouseUp = () => {
      resizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!resizingRef.current) return
      const delta = e.touches[0].clientX - startXRef.current
      setSidebarWidth(Math.max(140, Math.min(500, startWidthRef.current + delta)))
    }
    const onTouchEnd = () => {
      resizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])
  const [treeEntries, setTreeEntries] = useState<TreeEntry[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [subDirEntries, setSubDirEntries] = useState<Record<string, TreeEntry[]>>({})
  const [sidebarAction, setSidebarAction] = useState<{ path: string; x: number; y: number } | null>(
    null,
  )
  const [sidebarNewFile, setSidebarNewFile] = useState(false)
  const [sidebarNewFolder, setSidebarNewFolder] = useState(false)
  const [sidebarNewName, setSidebarNewName] = useState('')
  // Single source of truth: the directory currently displayed in sidebar
  const [sidebarDir, setSidebarDir] = useState(() => dirName(filePath))
  const [pathEditValue, setPathEditValue] = useState(() => dirName(filePath))

  // outline state
  const [outlineOpen, setOutlineOpen] = useState(false)
  const outlineHeadings = useMemo(() => {
    if (currentFile.language !== 'markdown') return []
    return extractHeadings(editedContent)
  }, [editedContent, currentFile.language])

  const editorRef = useRef<HTMLDivElement>(null)
  const cmViewRef = useRef<EditorView | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const treeClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- file switching ----

  const loadFile = useCallback(
    async (path: string) => {
      const token = useSessionStore.getState().accessToken
      if (!token) return
      try {
        const res = await fetch(`${API_BASE}/api/fs/file?path=${encodeURIComponent(path)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const lang = getLanguageFromPath(path)
        setCurrentFile({ path, content: data.content, language: lang })
        setEditedContent(data.content)
        setDirty(false)
        setSelectedText('')
        setMode(hasPreview(lang) ? 'preview' : 'edit')
        // Update parent tab — sidebar single click replaces current tab
        onOpenFile?.(path, data.content, lang, true)
      } catch {
        /* ignore */
      }
    },
    [onOpenFile],
  )

  // ---- sidebar tree ----

  const fetchTree = useCallback(async (dirPath: string): Promise<TreeEntry[]> => {
    const token = useSessionStore.getState().accessToken
    if (!token) {
      console.warn('[CodeEditor] fetchTree: no token available')
      return []
    }
    try {
      const res = await fetch(`${API_BASE}/api/fs/tree?path=${encodeURIComponent(dirPath)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        console.warn('[CodeEditor] fetchTree: HTTP', res.status)
        return []
      }
      const data = await res.json()
      return (data.entries || []) as TreeEntry[]
    } catch (err) {
      console.warn('[CodeEditor] fetchTree error:', err)
      return []
    }
  }, [])

  // Navigate sidebar to a directory and load its entries
  const navigateToDir = useCallback(
    async (dirPath: string) => {
      const normalized = dirPath || ''
      setSidebarDir(normalized)
      setPathEditValue(normalized)
      setTreeLoading(true)
      const entries = await fetchTree(normalized)
      setTreeEntries(entries)
      setTreeLoading(false)
    },
    [fetchTree],
  )

  const toggleDir = useCallback(
    async (dirPath: string) => {
      setExpandedDirs((prev) => {
        const next = new Set(prev)
        if (next.has(dirPath)) next.delete(dirPath)
        else next.add(dirPath)
        return next
      })
      if (!subDirEntries[dirPath]) {
        const entries = await fetchTree(dirPath)
        setSubDirEntries((prev) => ({ ...prev, [dirPath]: entries }))
      }
    },
    [fetchTree, subDirEntries],
  )

  // ---- sidebar actions ----

  // Load sidebar tree on mount and when token/file changes
  useEffect(() => {
    if (!accessToken) return
    const initialDir = dirName(filePath) || '/'
    setTreeLoading(true)
    setSidebarDir(initialDir)
    setPathEditValue(initialDir)
    fetchTree(initialDir).then((entries) => {
      setTreeEntries(entries)
      setTreeLoading(false)
    })
  }, [accessToken, filePath, fetchTree])

  const createFileInSidebar = useCallback(
    async (type: 'file' | 'folder') => {
      const name = sidebarNewName.trim()
      if (!name) {
        setSidebarNewFile(false)
        return
      }
      const token = useSessionStore.getState().accessToken
      if (!token) return
      const dir = sidebarDir
      const newPath = dir ? `${dir}/${name}` : name
      try {
        await fetch(`${API_BASE}/api/fs/${type === 'folder' ? 'mkdir' : 'new-file'}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: newPath }),
        })
        navigateToDir(dir)
      } catch {
        /* ignore */
      }
      setSidebarNewFile(false)
      setSidebarNewFolder(false)
      setSidebarNewName('')
    },
    [sidebarNewName, sidebarDir, fetchTree, navigateToDir],
  )

  const deleteFromSidebar = useCallback(
    async (entryPath: string) => {
      const token = useSessionStore.getState().accessToken
      if (!token) return
      try {
        await fetch(`${API_BASE}/api/fs/file`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: entryPath }),
        })
        if (entryPath === currentFile.path) onClose()
        else navigateToDir(sidebarDir)
      } catch {
        /* ignore */
      }
      setSidebarAction(null)
    },
    [currentFile.path, sidebarDir, fetchTree, onClose, navigateToDir],
  )

  const downloadFromSidebar = useCallback((entryPath: string) => {
    const token = useSessionStore.getState().accessToken
    if (!token) return
    const name = entryPath.split('/').pop() || 'download'
    fetch(`${API_BASE}/api/fs/download?path=${encodeURIComponent(entryPath)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = name
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(() => {})
    setSidebarAction(null)
  }, [])

  // ---- save ----

  const handleSave = useCallback(async () => {
    const token = useSessionStore.getState().accessToken
    if (!token) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/fs/file`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentFile.path, content: editedContent }),
      })
      if (res.ok) setDirty(false)
    } catch {
      /* ignore */
    }
    setSaving(false)
  }, [currentFile.path, editedContent])

  // ---- codemirror extensions ----

  const extensions = useMemo(() => {
    const selectionChangeExt = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.selectionSet || update.docChanged) {
        const sel = update.state.selection.main
        if (!sel.empty) setSelectedText(update.state.sliceDoc(sel.from, sel.to))
        else setSelectedText('')
      }
      if (update.docChanged) {
        setDirty(true)
        setEditedContent(update.state.doc.toString())
      }
      if (update.view) cmViewRef.current = update.view
    })
    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          handleSave()
          return true
        },
      },
    ])
    return [
      getLanguageExtension(currentFile.language),
      themeDef.highlightExt,
      indentOnInput(),
      autocompletion(),
      closeBrackets(),
      keymap.of(closeBracketsKeymap),
      EditorView.lineWrapping,
      selectionChangeExt,
      saveKeymap,
    ]
  }, [currentFile.language, themeDef, handleSave])

  const handleInject = useCallback(() => {
    if (selectedText) onInjectCode(selectedText)
  }, [selectedText, onInjectCode])

  const isPreviewable = hasPreview(currentFile.language)

  // ---- outline click ----

  const handleOutlineClick = useCallback(
    (heading: Heading) => {
      if (mode === 'preview' && previewRef.current) {
        const el = document.getElementById(heading.id)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (cmViewRef.current) {
        const line = cmViewRef.current.state.doc.line(heading.line + 1)
        cmViewRef.current.dispatch({
          selection: { anchor: line.from },
          scrollIntoView: true,
        })
        cmViewRef.current.focus()
      }
    },
    [mode],
  )

  // ---- render tree entry ----

  const renderTreeEntry = (entry: TreeEntry, depth: number) => {
    const isActive = entry.path === currentFile.path
    const isExpanded = expandedDirs.has(entry.path)

    const handleClick = () => {
      if (entry.type === 'directory') {
        toggleDir(entry.path)
        return
      }
      if (treeClickTimerRef.current) {
        clearTimeout(treeClickTimerRef.current)
        treeClickTimerRef.current = null
        if (onOpenFile) {
          const token = useSessionStore.getState().accessToken
          if (!token) return
          const controller = new AbortController()
          fetch(`${API_BASE}/api/fs/file?path=${encodeURIComponent(entry.path)}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.content)
                onOpenFile(
                  entry.path,
                  data.content,
                  data.language || getLanguageFromPath(entry.path),
                )
            })
            .catch((err) => {
              if (err.name !== 'AbortError') {
                /* ignore */
              }
            })
        }
        return
      }
      treeClickTimerRef.current = setTimeout(() => {
        treeClickTimerRef.current = null
        loadFile(entry.path)
      }, 250)
    }

    return (
      <div key={entry.path} className="relative group">
        <div className="flex items-center">
          <button
            onClick={handleClick}
            className={`flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1 text-left text-xs ${hoverBg} transition-colors rounded
              ${isActive ? 'bg-blue-500/15 text-blue-400' : textPrimary}`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {entry.type === 'directory' ? (
              isExpanded ? (
                <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
              )
            ) : (
              <span className="w-3 shrink-0" />
            )}
            {entry.type === 'directory' ? (
              <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            ) : (
              <File className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            )}
            <span className="truncate">{entry.name}</span>
          </button>
          {entry.type === 'file' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const r = (e.target as HTMLElement).getBoundingClientRect()
                setSidebarAction({ path: entry.path, x: r.left, y: r.bottom })
              }}
              className="p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 shrink-0 mr-1"
            >
              <MoreVertical className="w-3 h-3 text-gray-500" />
            </button>
          )}
        </div>
        {entry.type === 'directory' &&
          isExpanded &&
          subDirEntries[entry.path]?.map((sub) => renderTreeEntry(sub, depth + 1))}
      </div>
    )
  }

  return (
    <div
      className={`${bg} flex flex-col h-full`}
      style={{ '--editor-font-size': `${fontSize}px` } as React.CSSProperties}
    >
      {/* Header */}
      <div className={`flex items-center gap-1.5 px-2 h-[44px] border-b ${border} shrink-0`}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`p-1.5 rounded-lg ${hoverBg} ${activeBg} transition-colors`}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? (
            <PanelLeftClose className={`w-4 h-4 ${textMuted}`} />
          ) : (
            <PanelLeftOpen className={`w-4 h-4 ${textMuted}`} />
          )}
        </button>
        <span
          className={`text-sm ${textPrimary} font-medium truncate flex-1 flex items-center gap-1.5`}
        >
          {dirty && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
          {fileName(currentFile.path)}
        </span>
        <span className={`text-[10px] ${textDim} uppercase tracking-wider`}>
          {currentFile.language}
        </span>

        <button
          onClick={() => {
            const ids = Object.keys(EDITOR_THEMES)
            const idx = ids.indexOf(editorThemeId)
            useSessionStore.getState().setEditorTheme(ids[(idx + 1) % ids.length])
          }}
          className={`px-1.5 py-0.5 rounded text-[10px] ${textMuted} ${hoverBg} transition-colors`}
          aria-label="Cycle editor theme"
        >
          {editorThemeId
            .split('-')
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(' ')}
        </button>

        {currentFile.language === 'markdown' && (
          <button
            onClick={() => setOutlineOpen(!outlineOpen)}
            className={`p-1.5 rounded-lg ${hoverBg} ${activeBg} transition-colors ${outlineOpen ? activeBg : ''}`}
            aria-label="Toggle outline"
          >
            <List className={`w-4 h-4 ${textMuted}`} />
          </button>
        )}

        {isPreviewable && (
          <button
            onClick={() =>
              setMode(mode === 'edit' ? 'split' : mode === 'split' ? 'preview' : 'edit')
            }
            className={`p-1.5 rounded-lg ${hoverBg} ${activeBg} transition-colors`}
            aria-label={mode === 'edit' ? 'Split view' : mode === 'split' ? 'Preview' : 'Edit'}
          >
            {mode === 'edit' ? (
              <Columns2 className={`w-4 h-4 ${textMuted}`} />
            ) : mode === 'split' ? (
              <Eye className={`w-4 h-4 ${textMuted}`} />
            ) : (
              <PenLine className={`w-4 h-4 ${textMuted}`} />
            )}
          </button>
        )}
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`p-1.5 rounded-lg ${hoverBg} ${activeBg} transition-colors`}
            aria-label="Save file"
          >
            {saving ? (
              <Loader2 className={`w-4 h-4 ${textMuted} animate-spin`} />
            ) : (
              <Save className="w-4 h-4 text-blue-400" />
            )}
          </button>
        )}
        <button
          onClick={onClose}
          className={`p-1.5 rounded-lg ${hoverBg} ${activeBg} transition-colors`}
          aria-label="Close editor"
        >
          <X className={`w-4 h-4 ${textMuted}`} />
        </button>
      </div>

      {/* Body: sidebar + content + outline */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="shrink-0 flex">
            <div
              style={{ width: sidebarWidth }}
              className={`border-r ${border} flex flex-col ${bgPanel} overflow-hidden`}
            >
              <div
                className={`px-2 py-1.5 flex items-center justify-between border-b ${border} shrink-0`}
              >
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  {sidebarDir && (
                    <button
                      onClick={() => {
                        const isAbs = sidebarDir.startsWith('/')
                        const parentParts = sidebarDir.split('/').filter(Boolean)
                        parentParts.pop()
                        navigateToDir((isAbs ? '/' : '') + parentParts.join('/'))
                      }}
                      className={`p-0.5 rounded ${hoverBg} shrink-0`}
                      aria-label="Go up"
                    >
                      <ArrowLeft className={`w-3 h-3 ${textMuted}`} />
                    </button>
                  )}
                  <input
                    value={pathEditValue || '/'}
                    onChange={(e) => setPathEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        navigateToDir(e.currentTarget.value)
                      }
                    }}
                    onBlur={() => setPathEditValue(sidebarDir)}
                    className={`text-[10px] ${textDim} tracking-wider truncate bg-transparent border-none outline-none w-full focus:text-gray-300`}
                  />
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => {
                      setSidebarNewFile(true)
                      setSidebarNewName('')
                    }}
                    className={`p-0.5 rounded ${hoverBg}`}
                    aria-label="New file"
                  >
                    <Plus className={`w-3 h-3 ${textMuted}`} />
                  </button>
                  <button
                    onClick={() => {
                      setSidebarNewFolder(true)
                      setSidebarNewName('')
                    }}
                    className={`p-0.5 rounded ${hoverBg}`}
                    aria-label="New folder"
                  >
                    <FolderPlus className={`w-3 h-3 ${textMuted}`} />
                  </button>
                </div>
              </div>
              <div
                className="flex-1 overflow-y-auto py-1 auto-hide-scrollbar"
                onClick={() => setSidebarAction(null)}
              >
                {(sidebarNewFile || sidebarNewFolder) && (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      type="text"
                      value={sidebarNewName}
                      onChange={(e) => setSidebarNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          createFileInSidebar(sidebarNewFile ? 'file' : 'folder')
                        if (e.key === 'Escape') {
                          setSidebarNewFile(false)
                          setSidebarNewFolder(false)
                        }
                      }}
                      placeholder={sidebarNewFile ? 'filename' : 'folder name'}
                      autoFocus
                      className={`flex-1 ${isEditorDark ? 'bg-white/5 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} border rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-blue-500`}
                    />
                    <button
                      onClick={() => createFileInSidebar(sidebarNewFile ? 'file' : 'folder')}
                      className="p-0.5"
                    >
                      <Check className="w-3 h-3 text-green-400" />
                    </button>
                  </div>
                )}
                {treeLoading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className={`w-4 h-4 ${textMuted} animate-spin`} />
                  </div>
                )}
                {!treeLoading && treeEntries.map((entry) => renderTreeEntry(entry, 0))}
                {!treeLoading &&
                  treeEntries.length === 0 &&
                  !sidebarNewFile &&
                  !sidebarNewFolder && (
                    <p className={`${textDim} text-xs text-center py-4`}>Empty</p>
                  )}
              </div>
              {/* Context menu */}
              {sidebarAction && (
                <div
                  className={`absolute ${isEditorDark ? 'bg-[#24283b] border-gray-700' : 'bg-white border-gray-300'} border rounded-lg shadow-xl py-1 min-w-[100px] z-50`}
                  style={{ left: sidebarAction.x, top: sidebarAction.y }}
                >
                  <button
                    onClick={() => downloadFromSidebar(sidebarAction.path)}
                    className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] ${textPrimary} ${hoverBg}`}
                  >
                    <Download className="w-3 h-3" /> Download
                  </button>
                  <button
                    onClick={() => deleteFromSidebar(sidebarAction.path)}
                    className={`flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] text-red-400 ${hoverBg}`}
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </div>
            {/* Resize handle */}
            <div
              className="w-1.5 shrink-0 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors"
              onMouseDown={(e) => {
                resizingRef.current = true
                startXRef.current = e.clientX
                startWidthRef.current = sidebarWidth
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'
              }}
              onTouchStart={(e) => {
                resizingRef.current = true
                startXRef.current = e.touches[0].clientX
                startWidthRef.current = sidebarWidth
                document.body.style.userSelect = 'none'
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor pane */}
          {mode !== 'preview' && (
            <div
              className={`${mode === 'split' && isPreviewable ? 'w-1/2 border-r' : 'flex-1'} flex flex-col overflow-hidden ${border}`}
            >
              <div className="flex-1 overflow-hidden" ref={editorRef}>
                <CodeMirror
                  value={editedContent}
                  extensions={extensions}
                  theme={themeDef.cmTheme}
                  className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightActiveLine: true,
                    foldGutter: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    indentOnInput: true,
                  }}
                />
              </div>
              {selectedText && mode !== 'split' && (
                <div className={`shrink-0 px-3 py-3 border-t ${border} ${bg}`}>
                  <button
                    onClick={handleInject}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium transition-colors"
                  >
                    <Terminal className="w-4 h-4" />
                    Inject to Terminal
                  </button>
                  <p className={`text-[11px] ${textDim} mt-1.5 text-center truncate px-2`}>
                    {selectedText.length > 80 ? `${selectedText.slice(0, 80)}...` : selectedText}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Preview pane */}
          {(mode === 'preview' || mode === 'split') && isPreviewable && (
            <div
              ref={previewRef}
              className={`${mode === 'split' ? 'w-1/2' : 'flex-1'} overflow-y-auto px-4 py-3`}
            >
              {currentFile.language === 'markdown' ? (
                <div
                  className={`prose ${isEditorDark ? 'prose-invert' : ''} prose-sm max-w-none
                  [font-family:'Inter','Smiley Sans','PingFang SC',sans-serif]
                  [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:mt-4
                  [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-1.5 [&_h2]:mt-3
                  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2
                  [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2
                  [&_a]:text-blue-500 [&_a]:underline
                  [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                  [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-3
                  [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:text-xs
                  [&_ul]:text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
                  [&_ol]:text-sm [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
                  [&_li]:mb-0.5
                  [&_blockquote]:border-l-2 [&_blockquote]:border-blue-500/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:mb-2
                  [&_table]:w-full [&_table]:text-sm [&_table]:mb-3
                  [&_th]:text-left [&_th]:px-2 [&_th]:py-1 [&_th]:border
                  [&_td]:px-2 [&_td]:py-1 [&_td]:border
                  [&_hr]:my-3
                  [&_img]:max-w-full [&_img]:rounded
                  [&_strong]:font-semibold
                `}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children, ...props }) => (
                        <h1
                          id={
                            outlineHeadings.find(
                              (h) => h.level === 1 && h.text === String(children),
                            )?.id
                          }
                          {...props}
                        >
                          {children}
                        </h1>
                      ),
                      h2: ({ children, ...props }) => (
                        <h2
                          id={
                            outlineHeadings.find(
                              (h) => h.level === 2 && h.text === String(children),
                            )?.id
                          }
                          {...props}
                        >
                          {children}
                        </h2>
                      ),
                      h3: ({ children, ...props }) => (
                        <h3
                          id={
                            outlineHeadings.find(
                              (h) => h.level === 3 && h.text === String(children),
                            )?.id
                          }
                          {...props}
                        >
                          {children}
                        </h3>
                      ),
                    }}
                  >
                    {editedContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <iframe
                  srcDoc={editedContent}
                  sandbox=""
                  className="w-full h-full border-0 bg-white rounded"
                  title="HTML Preview"
                />
              )}
            </div>
          )}
        </div>

        {/* Outline panel */}
        {outlineOpen && currentFile.language === 'markdown' && outlineHeadings.length > 0 && (
          <div
            className={`w-[180px] shrink-0 border-l ${border} flex flex-col ${bgPanel} overflow-hidden`}
          >
            <div
              className={`px-2 py-1.5 text-[10px] ${textDim} uppercase tracking-wider border-b ${border} shrink-0`}
            >
              Outline
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {outlineHeadings.map((h) => (
                <button
                  key={h.id}
                  onClick={() => handleOutlineClick(h)}
                  className={`block w-full text-left text-xs ${textMuted} ${hoverBg} px-2 py-1 transition-colors truncate`}
                  style={{ paddingLeft: `${(h.level - 1) * 10 + 8}px` }}
                  title={h.text}
                >
                  {h.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
