// Split pane layout tree — recursive data model + pure tree operations

export type PanelType = 'editor' | 'terminal'
export type SplitDirection = 'horizontal' | 'vertical'

export interface SplitPanel {
  id: string
  type: PanelType
}

export interface SplitContainer {
  id: string
  direction: SplitDirection
  children: SplitNode[]
  ratios: number[] // size ratios, sum = 1
}

export type SplitNode = SplitPanel | SplitContainer

export interface FileEntry {
  path: string
  content: string
  language: string
}

export interface PanelFileState {
  files: FileEntry[]
  activeFilePath: string | null
}

// Type guards

export function isContainer(node: SplitNode): node is SplitContainer {
  return 'children' in node
}

// Find a node by id

export function findNode(root: SplitNode, id: string): SplitNode | null {
  if (root.id === id) return root
  if (isContainer(root)) {
    for (const child of root.children) {
      const found = findNode(child, id)
      if (found) return found
    }
  }
  return null
}

// Find parent container — returns the parent and the index of the child

export function findParentWithIndex(
  root: SplitNode,
  childId: string,
): { parent: SplitContainer; index: number } | null {
  if (!isContainer(root)) return null
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === childId) return { parent: root, index: i }
    if (isContainer(root.children[i])) {
      const found = findParentWithIndex(root.children[i], childId)
      if (found) return found
    }
  }
  return null
}

// ID generation

let _idCounter = 0
export function genId(): string {
  return `p-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`
}

export function createDefaultLayout(): SplitPanel {
  return { id: 'terminal-main', type: 'terminal' }
}

// Split a panel in a given direction, inserting a new panel

export function splitNode(
  root: SplitNode,
  targetId: string,
  direction: SplitDirection,
  newPanel: SplitPanel,
  insertBefore?: boolean,
): SplitNode {
  if (root.id === targetId) {
    const existing = root
    const container: SplitContainer = {
      id: genId(),
      direction,
      children: insertBefore ? [newPanel, existing] : [existing, newPanel],
      ratios: [0.5, 0.5],
    }
    return container
  }

  if (isContainer(root)) {
    return {
      ...root,
      children: root.children.map((child) =>
        splitNode(child, targetId, direction, newPanel, insertBefore),
      ),
    }
  }

  return root
}

// Remove a panel from the tree
// Returns new root. If root itself is removed, returns null.

export function removeNode(root: SplitNode, targetId: string): SplitNode | null {
  if (root.id === targetId) return null

  if (isContainer(root)) {
    const newChildren = root.children.filter((c) => c.id !== targetId)

    // If only one child remains, promote it
    if (newChildren.length === 1) {
      return removeNode(newChildren[0], targetId) ?? newChildren[0]
    }

    if (newChildren.length === 0) return null

    // Rebalance ratios
    const totalOld = newChildren.reduce((sum, child) => {
      const idx = root.children.indexOf(child)
      return sum + (root.ratios[idx] ?? 1 / root.children.length)
    }, 0)
    const newRatios = newChildren.map((child) => {
      const idx = root.children.indexOf(child)
      return (root.ratios[idx] ?? 1 / root.children.length) / totalOld
    })

    // Recurse into remaining children
    const recursedChildren = newChildren.map((child) => {
      const result = removeNode(child, targetId)
      return result ?? child
    })

    return {
      ...root,
      children: recursedChildren,
      ratios: newRatios,
    }
  }

  return root
}

// Update ratios for a container

export function updateRatios(root: SplitNode, containerId: string, newRatios: number[]): SplitNode {
  if (root.id === containerId && isContainer(root)) {
    return { ...root, ratios: newRatios }
  }
  if (isContainer(root)) {
    return {
      ...root,
      children: root.children.map((child) => updateRatios(child, containerId, newRatios)),
    }
  }
  return root
}

// Move a panel: remove from old position, split into new position

export function movePanel(
  root: SplitNode,
  sourceId: string,
  targetId: string,
  direction: SplitDirection,
  insertBefore?: boolean,
): SplitNode {
  const sourcePanel = findNode(root, sourceId)
  if (!sourcePanel) return root

  const afterRemove = removeNode(root, sourceId)
  if (!afterRemove) return createDefaultLayout()

  const movedPanel: SplitPanel = {
    id: sourcePanel.id,
    type: (sourcePanel as SplitPanel).type,
  }

  return splitNode(afterRemove, targetId, direction, movedPanel, insertBefore)
}

// Collect all panels

export function collectPanels(root: SplitNode): SplitPanel[] {
  if (!isContainer(root)) return [root as SplitPanel]
  return root.children.flatMap(collectPanels)
}
