import { Extension } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const DragHandleExtension = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    const editor = this.editor
    let dragState: { from: number; to: number } | null = null

    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = []

            state.doc.descendants((node, pos) => {
              if (node.isInline) return false
              if (!node.type.name || node.type.name === 'doc') return true

              const handle = document.createElement('span')
              handle.className = 'drag-handle'
              handle.contentEditable = 'false'
              handle.setAttribute('aria-hidden', 'true')
              handle.innerHTML = '&#x2807;'

              handle.addEventListener('mousedown', (e) => {
                e.stopPropagation()
                const sel = NodeSelection.create(editor.state.doc, pos)
                const tr = editor.state.tr.setSelection(sel)
                editor.view.dispatch(tr)
              })

              handle.addEventListener('mouseenter', () => {
                handle.classList.add('drag-handle-visible')
              })
              handle.addEventListener('mouseleave', () => {
                handle.classList.remove('drag-handle-visible', 'dragging')
              })

              handle.addEventListener('dragstart', (e) => {
                e.dataTransfer?.setData('text/plain', '')
                e.dataTransfer!.effectAllowed = 'move'
                dragState = { from: pos, to: pos + node.nodeSize }
                handle.classList.add('dragging')
                const sel = NodeSelection.create(editor.state.doc, pos)
                const tr = editor.state.tr.setSelection(sel)
                editor.view.dispatch(tr)
              })

              handle.addEventListener('dragend', () => {
                handle.classList.remove('dragging', 'drag-handle-visible')
                dragState = null
              })

              const deco = Decoration.widget(pos, () => handle, {
                side: -1,
                key: `dh-${pos}`,
              })

              decorations.push(deco)
              return true
            })

            return DecorationSet.create(state.doc, decorations)
          },
          handleDOMEvents: {
            drop(view, event) {
              if (!dragState) return false
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (!coords) {
                dragState = null
                return true
              }
              const $pos = view.state.doc.resolve(coords.pos)
              const targetPos = $pos.before($pos.depth)
              if (targetPos < 0) {
                dragState = null
                return true
              }
              const { from } = dragState
              const draggedNode = view.state.doc.nodeAt(from)
              if (!draggedNode) {
                dragState = null
                return true
              }
              const nodeSize = draggedNode.nodeSize
              const tr = view.state.tr
              tr.delete(from, from + nodeSize)
              const adjustedPos = targetPos > from ? targetPos - nodeSize : targetPos
              const insertPos = adjustedPos < 0 ? 0 : adjustedPos
              tr.insert(insertPos, draggedNode)
              tr.scrollIntoView()
              view.dispatch(tr)
              dragState = null
              return true
            },
            dragend() {
              dragState = null
            },
          },
        },
      }),
    ]
  },
})