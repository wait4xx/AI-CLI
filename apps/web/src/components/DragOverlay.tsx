import { useState, useEffect, useRef, useCallback } from 'react'
import { useSessionStore } from '../store/sessionStore'
import type { SplitDirection } from '../lib/splitLayout'

type DropZone = 'top' | 'bottom' | 'left' | 'right' | 'center'

export function DragOverlay() {
  const dragState = useSessionStore((s) => s.dragState)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [targetPanelId, setTargetPanelId] = useState<string | null>(null)
  const [dropZone, setDropZone] = useState<DropZone | null>(null)
  const [panelRect, setPanelRect] = useState<DOMRect | null>(null)

  // Refs for latest values in mouseup handler
  const targetRef = useRef<string | null>(null)
  const zoneRef = useRef<DropZone | null>(null)
  const dragRef = useRef<typeof dragState>(null)

  useEffect(() => {
    targetRef.current = targetPanelId
  }, [targetPanelId])
  useEffect(() => {
    zoneRef.current = dropZone
  }, [dropZone])
  useEffect(() => {
    dragRef.current = dragState
  }, [dragState])

  // Phase 1: Detect drag start on elements with [data-drag-session] or [data-drag-file]
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Don't interfere with non-left clicks
      if (e.button !== 0) return

      const sessionTarget = (e.target as HTMLElement).closest('[data-drag-session]')
      const fileTarget = !sessionTarget
        ? (e.target as HTMLElement).closest('[data-drag-file]')
        : null

      if (!sessionTarget && !fileTarget) return

      const startX = e.clientX
      const startY = e.clientY
      let activated = false

      const handleMouseMove = (me: MouseEvent) => {
        if (!activated) {
          const dx = me.clientX - startX
          const dy = me.clientY - startY
          if (dx * dx + dy * dy < 64) return // 8px threshold
          activated = true
          if (sessionTarget) {
            const sessionId = sessionTarget.getAttribute('data-drag-session')!
            useSessionStore.getState().setDragState({ type: 'session', sessionId })
          } else if (fileTarget) {
            const filePath = fileTarget.getAttribute('data-drag-file')!
            const sourcePanelId = fileTarget.getAttribute('data-drag-source-panel')!
            useSessionStore
              .getState()
              .setDragState({ type: 'file', filePath, panelId: sourcePanelId })
          }
        }
        me.preventDefault()
      }

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    return () => document.removeEventListener('mousedown', handleMouseDown, true)
  }, [])

  // Phase 2: Track mouse and handle drop during active drag
  useEffect(() => {
    if (!dragState) {
      setMousePos(null)
      setTargetPanelId(null)
      setDropZone(null)
      setPanelRect(null)
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }

    const handleMouseUp = () => {
      const store = useSessionStore.getState()
      const currentDrag = dragRef.current
      const currentTarget = targetRef.current
      const currentZone = zoneRef.current

      store.setDragState(null)
      setTargetPanelId(null)
      setDropZone(null)
      setPanelRect(null)
      setMousePos(null)

      if (!currentDrag || !currentTarget || !currentZone) return

      // Drop on center = swap sessions/files between source and target panels
      if (currentZone === 'center') {
        if (currentDrag.type === 'session' && currentDrag.sessionId) {
          const ts = store.terminalSessions
          const sourceEntry = Object.entries(ts).find(([_, sid]) => sid === currentDrag.sessionId)
          const sourcePanelId = sourceEntry?.[0]
          if (sourcePanelId && sourcePanelId !== currentTarget) {
            const targetSessionId = ts[currentTarget]
            useSessionStore.setState({
              terminalSessions: {
                ...ts,
                [sourcePanelId]: targetSessionId ?? ts[sourcePanelId],
                [currentTarget]: currentDrag.sessionId,
              },
            })
          }
        } else if (currentDrag.type === 'file' && currentDrag.filePath && currentDrag.panelId) {
          const pf = store.panelFiles
          const sourcePf = pf[currentDrag.panelId]
          if (sourcePf && currentDrag.panelId !== currentTarget) {
            const targetPf = pf[currentTarget]
            const newPf = { ...pf }
            const newTargetFiles = targetPf ? [...targetPf.files] : []
            for (const f of sourcePf.files) {
              if (!newTargetFiles.find((t) => t.path === f.path)) {
                newTargetFiles.push(f)
              }
            }
            delete newPf[currentDrag.panelId]
            newPf[currentTarget] = { files: newTargetFiles, activeFilePath: currentDrag.filePath }
            useSessionStore.setState({ panelFiles: newPf })
            store.removePanel(currentDrag.panelId)
          }
        }
        return
      }

      // Drop on edge = move + split
      const direction: SplitDirection =
        currentZone === 'top' || currentZone === 'bottom' ? 'horizontal' : 'vertical'
      const insertBefore = currentZone === 'top' || currentZone === 'left'

      if (currentDrag.type === 'session' && currentDrag.sessionId) {
        store.splitPanelWithSession(currentTarget, direction, currentDrag.sessionId, insertBefore)
      } else if (currentDrag.type === 'file' && currentDrag.filePath && currentDrag.panelId) {
        store.splitPanelWithFile(
          currentDrag.panelId,
          currentTarget,
          direction,
          currentDrag.filePath,
          insertBefore,
        )
      } else if (currentDrag.type === 'panel' && currentDrag.panelId) {
        store.movePanelDrop(currentDrag.panelId, currentTarget, direction, insertBefore)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState])

  // Calculate target panel and drop zone from mouse position
  const computeZone = useCallback((pos: { x: number; y: number }) => {
    const ds = useSessionStore.getState().dragState
    if (!ds) return

    const panels = document.querySelectorAll('[data-panel-id]')
    let found: { id: string; rect: DOMRect } | null = null
    for (const panel of panels) {
      const rect = panel.getBoundingClientRect()
      if (pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom) {
        found = { id: panel.getAttribute('data-panel-id')!, rect }
        break
      }
    }

    // Resolve source panel ID for session/file drag types
    const sourcePanelId =
      ds.type === 'file'
        ? ds.panelId
        : ds.type === 'session'
          ? Object.entries(useSessionStore.getState().terminalSessions).find(
              ([_, sid]) => sid === ds.sessionId,
            )?.[0]
          : null

    if (!found) {
      setTargetPanelId(null)
      setDropZone(null)
      setPanelRect(null)
      return
    }

    // Compute zone first to determine if it's an edge drop
    const x = (pos.x - found.rect.left) / found.rect.width
    const y = (pos.y - found.rect.top) / found.rect.height
    const margin = 0.25

    let zone: DropZone | null = null
    if (y < margin) zone = 'top'
    else if (y > 1 - margin) zone = 'bottom'
    else if (x < margin) zone = 'left'
    else if (x > 1 - margin) zone = 'right'
    else zone = 'center'

    // Block same-panel center drops (no-op), but allow same-panel edge drops (split)
    if (found.id === sourcePanelId && zone === 'center') {
      setTargetPanelId(null)
      setDropZone(null)
      setPanelRect(null)
      return
    }

    setTargetPanelId(found.id)
    setPanelRect(found.rect)
    setDropZone(zone)
  }, [])

  useEffect(() => {
    if (mousePos) computeZone(mousePos)
  }, [mousePos, computeZone])

  if (!dragState) return null

  return (
    <>
      <style>{`* { cursor: grabbing !important; user-select: none !important; -webkit-user-select: none !important; }`}</style>

      {targetPanelId && dropZone && panelRect && (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 9999,
            left: panelRect.left,
            top: panelRect.top,
            width: panelRect.width,
            height: panelRect.height,
          }}
        >
          {dropZone === 'center' ? (
            <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-400 border-dashed rounded" />
          ) : (
            <div
              className="absolute bg-blue-500/30 border-2 border-blue-400 border-dashed rounded"
              style={
                dropZone === 'top'
                  ? { top: 0, left: 0, right: 0, height: '50%' }
                  : dropZone === 'bottom'
                    ? { bottom: 0, left: 0, right: 0, height: '50%' }
                    : dropZone === 'left'
                      ? { left: 0, top: 0, bottom: 0, width: '50%' }
                      : { right: 0, top: 0, bottom: 0, width: '50%' }
              }
            />
          )}
        </div>
      )}

      {!targetPanelId && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
            Drop on panel edge to split, center to swap
          </div>
        </div>
      )}
    </>
  )
}
