import { useMemo, useRef, useEffect } from 'react'
import { EditorView, Decoration } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { go } from '@codemirror/lang-go'
import { rust } from '@codemirror/lang-rust'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { php } from '@codemirror/lang-php'
import { sql } from '@codemirror/lang-sql'
import { markdown } from '@codemirror/lang-markdown'
import { X } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

interface DiffViewerProps {
  path: string
  oldContent: string
  newContent: string
  onClose: () => void
}

function getLangExt(p: string): Extension {
  const ext = '.' + p.split('.').pop()?.toLowerCase()
  switch (ext) {
    case '.ts':
    case '.tsx':
      return javascript({ typescript: true })
    case '.js':
    case '.jsx':
      return javascript()
    case '.py':
      return python()
    case '.json':
      return json()
    case '.css':
      return css()
    case '.html':
      return html()
    case '.go':
      return go()
    case '.rs':
      return rust()
    case '.java':
      return java()
    case '.c':
    case '.cpp':
    case '.h':
      return cpp()
    case '.php':
      return php()
    case '.sql':
      return sql()
    case '.md':
      return markdown()
    default:
      return []
  }
}

function computeDiffRanges(oldText: string, newText: string) {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  type Range = { from: number; to: number }
  const deleted: Range[] = []
  const inserted: Range[] = []

  // Simple LCS-based diff via line comparison
  let oi = 0,
    ni = 0
  while (oi < oldLines.length && ni < newLines.length) {
    if (oldLines[oi] === newLines[ni]) {
      oi++
      ni++
      continue
    }

    // Lines differ — scan ahead to find next match
    let nextMatchOld = -1,
      nextMatchNew = -1
    for (let a = oi; a < Math.min(oi + 30, oldLines.length); a++) {
      for (let b = ni; b < Math.min(ni + 30, newLines.length); b++) {
        if (oldLines[a] === newLines[b]) {
          nextMatchOld = a
          nextMatchNew = b
          a = 999
          break
        }
      }
    }

    if (nextMatchOld === -1) {
      // No match found — rest is all diff
      break
    }

    // Mark lines from oi→nextMatchOld as deleted, ni→nextMatchNew as inserted
    if (oi < nextMatchOld) {
      const from = oldLines.slice(0, oi).join('\n').length + (oi > 0 ? 1 : 0)
      const to = oldLines.slice(0, nextMatchOld).join('\n').length
      deleted.push({ from, to })
    }
    if (ni < nextMatchNew) {
      const from = newLines.slice(0, ni).join('\n').length + (ni > 0 ? 1 : 0)
      const to = newLines.slice(0, nextMatchNew).join('\n').length
      inserted.push({ from, to })
    }

    oi = nextMatchOld
    ni = nextMatchNew
  }

  // Remaining lines
  if (oi < oldLines.length) {
    const from = oldLines.slice(0, oi).join('\n').length + (oi > 0 ? 1 : 0)
    const to = oldText.length
    if (from < to) deleted.push({ from, to })
  }
  if (ni < newLines.length) {
    const from = newLines.slice(0, ni).join('\n').length + (ni > 0 ? 1 : 0)
    const to = newText.length
    if (from < to) inserted.push({ from, to })
  }

  return { deleted, inserted }
}

function makeHighlightPlugin(ranges: { from: number; to: number }[], className: string): Extension {
  const decos = ranges
    .filter((r) => r.from < r.to)
    .map((r) => Decoration.mark({ class: className }).range(r.from, r.to))
  if (decos.length === 0) return []
  const set = Decoration.set(decos, true)
  return EditorView.decorations.of(set)
}

function ReadOnlyEditor({
  content,
  path,
  highlightRanges,
  highlightClass,
}: {
  content: string
  path: string
  highlightRanges: { from: number; to: number }[]
  highlightClass: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!ref.current) return
    if (viewRef.current) {
      viewRef.current.destroy()
    }
    viewRef.current = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          getLangExt(path),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          makeHighlightPlugin(highlightRanges, highlightClass),
          EditorView.theme({
            '&': { fontSize: '13px' },
            '.cm-content': {
              fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
            },
            '.cm-gutters': { display: 'none' },
            '.cm-deletedHighlight': { backgroundColor: '#f7768e20', color: '#f7768e' },
            '.cm-insertedHighlight': { backgroundColor: '#9ece6a20', color: '#9ece6a' },
          }),
        ],
      }),
      parent: ref.current,
    })
    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [content, path, highlightRanges, highlightClass])

  return (
    <div
      ref={ref}
      className="h-full overflow-auto [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
    />
  )
}

export function DiffViewer({ path, oldContent, newContent, onClose }: DiffViewerProps) {
  const isDark = useSessionStore((s) => s.uiTheme) === 'dark'

  const fileName = path.split('/').pop() || path

  const { deleted, inserted } = useMemo(
    () => computeDiffRanges(oldContent, newContent),
    [oldContent, newContent],
  )

  const bg = isDark ? 'bg-[#1a1b26]' : 'bg-[#fafafa]'
  const border = isDark ? 'border-[#292e42]' : 'border-[#e0e0e0]'
  const text = isDark ? 'text-gray-200' : 'text-gray-800'
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500'
  const hoverBg = isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'

  return (
    <div className={`${bg} flex flex-col h-full`}>
      <div className={`flex items-center gap-2 px-3 h-[36px] border-b ${border} shrink-0`}>
        <span className={`text-xs font-medium ${text} truncate flex-1`}>Diff: {fileName}</span>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-red-400">- removed</span>
          <span className="text-green-400">+ added</span>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded ${hoverBg} transition-colors`}
          aria-label="Close diff"
        >
          <X className={`w-4 h-4 ${textMuted}`} />
        </button>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 flex flex-col overflow-hidden border-r ${border}`}>
          <div
            className={`px-3 py-1 text-[10px] ${textMuted} uppercase tracking-wider border-b ${border} shrink-0`}
          >
            Original
          </div>
          <ReadOnlyEditor
            content={oldContent}
            path={path}
            highlightRanges={deleted}
            highlightClass="cm-deletedHighlight"
          />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            className={`px-3 py-1 text-[10px] ${textMuted} uppercase tracking-wider border-b ${border} shrink-0`}
          >
            Modified
          </div>
          <ReadOnlyEditor
            content={newContent}
            path={path}
            highlightRanges={inserted}
            highlightClass="cm-insertedHighlight"
          />
        </div>
      </div>
    </div>
  )
}
