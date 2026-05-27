import { useCallback, useState, useMemo } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { ViewUpdate } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { X, Terminal } from 'lucide-react'
import { THEME_COLORS } from '../lib/theme'

interface CodeEditorProps {
  filePath: string
  content: string
  language: string
  onClose: () => void
  onInjectCode: (code: string) => void
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
    default:
      return []
  }
}

const fileName = (filePath: string) => {
  const parts = filePath.split('/')
  return parts[parts.length - 1] || filePath
}

const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: THEME_COLORS.bg,
    color: THEME_COLORS.textMuted,
    fontSize: '13px',
  },
  '.cm-content': {
    caretColor: THEME_COLORS.foreground,
    fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
    lineHeight: '1.5',
  },
  '.cm-cursor': {
    borderLeftColor: THEME_COLORS.foreground,
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: THEME_COLORS.selection,
  },
  '.cm-gutters': {
    backgroundColor: THEME_COLORS.bg,
    borderRight: `1px solid ${THEME_COLORS.gutterBorder}`,
    color: THEME_COLORS.gutterText,
  },
  '.cm-activeLineGutter': {
    backgroundColor: THEME_COLORS.gutterBorder,
  },
  '.cm-activeLine': {
    backgroundColor: `${THEME_COLORS.gutterBorder}80`,
  },
  '.cm-matchingBracket': {
    backgroundColor: THEME_COLORS.selection,
    color: `${THEME_COLORS.foreground} !important`,
  },
})

export function CodeEditor({ filePath, content, language, onClose, onInjectCode }: CodeEditorProps) {
  const [selectedText, setSelectedText] = useState('')
  const extensions = useMemo(() => {
    const selectionChangeExt = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.selectionSet || update.docChanged) {
        const sel = update.state.selection.main
        if (!sel.empty) {
          setSelectedText(update.state.sliceDoc(sel.from, sel.to))
        } else {
          setSelectedText('')
        }
      }
    })
    return [
      getLanguageExtension(language),
      EditorView.lineWrapping,
      selectionChangeExt,
    ]
  }, [language])

  const handleInject = useCallback(() => {
    if (selectedText) {
      onInjectCode(selectedText)
    }
  }, [selectedText, onInjectCode])

  return (
    <div className="fixed inset-0 z-30 bg-[#1a1b26] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-[44px] border-b border-[#292e42] shrink-0">
        <span className="text-sm text-gray-300 font-medium truncate flex-1">
          {fileName(filePath)}
        </span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 active:bg-white/15 transition-colors"
          aria-label="Close editor"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          extensions={extensions}
          theme={darkTheme}
          editable={false}
          readOnly={true}
          className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: false,
            bracketMatching: true,
          }}
        />
      </div>

      {/* Inject button */}
      {selectedText && (
        <div className="shrink-0 px-3 py-3 border-t border-[#292e42] bg-[#1a1b26]">
          <button
            onClick={handleInject}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Terminal className="w-4 h-4" />
            Inject to Terminal
          </button>
          <p className="text-[11px] text-gray-500 mt-1.5 text-center truncate px-2">
            {selectedText.length > 80
              ? `${selectedText.slice(0, 80)}...`
              : selectedText}
          </p>
        </div>
      )}
    </div>
  )
}
