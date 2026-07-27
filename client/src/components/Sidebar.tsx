import { useState } from 'react';
import type { PageKind, PageNode } from '@shared';
import { MenuItem, Popover, type Anchor } from './Popover.tsx';
import { TreeRow } from './TreeRow.tsx';
import { Pencil, Plus, Table, Trash } from './icons.tsx';

interface SidebarProps {
  tree: PageNode[];
  activeId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onCreate: (parentId: string | null, kind: PageKind) => void;
  onRename: (id: string, title: string) => void;
  onRequestDelete: (node: PageNode) => void;
  tools?: React.ReactNode;
}

function findNode(nodes: PageNode[], id: string): PageNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children, id);
    if (hit) return hit;
  }
  return null;
}

export function Sidebar(props: SidebarProps) {
  const [menu, setMenu] = useState<{ id: string; anchor: Anchor } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const menuNode = menu ? findNode(props.tree, menu.id) : null;

  return (
    <nav className="sidebar" aria-label="Workspace">
      <div className="sidebar__brand">
        <div className="brand__mark" aria-hidden>
          <span />
        </div>
        <div>
          <div className="brand__name">Personal Space</div>
          <div className="brand__sub">Your workspace</div>
        </div>
      </div>

      <div className="sidebar__tools">{props.tools}</div>

      <div className="sidebar__section">
        <span>Pages</span>
        <button
          className="row__action"
          aria-label="New top-level page"
          onClick={() => props.onCreate(null, 'page')}
        >
          <Plus />
        </button>
      </div>

      <div className="sidebar__tree" data-testid="page-tree">
        {props.tree.length === 0 && <div className="tree__empty">No pages yet.</div>}
        {props.tree.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            activeId={props.activeId}
            expanded={props.expanded}
            renamingId={renamingId}
            menuOpenId={menu?.id ?? null}
            onToggle={props.onToggle}
            onSelect={props.onSelect}
            onAddChild={(id) => props.onCreate(id, 'page')}
            onMenu={(id, anchor) => setMenu({ id, anchor })}
            onRenameCommit={(id, title) => {
              setRenamingId(null);
              props.onRename(id, title);
            }}
            onRenameCancel={() => setRenamingId(null)}
          />
        ))}
      </div>

      <div className="sidebar__footer">
        <button className="btn btn--primary btn--wide" onClick={() => props.onCreate(null, 'page')}>
          <Plus /> New page
        </button>
        <button
          className="btn btn--purple btn--wide"
          onClick={() => props.onCreate(null, 'database')}
        >
          <Table /> New database
        </button>
      </div>

      {menu && menuNode && (
        <Popover anchor={menu.anchor} onClose={() => setMenu(null)} label={`${menuNode.title} actions`}>
          <MenuItem
            label="Rename"
            onClick={() => {
              setMenu(null);
              setRenamingId(menuNode.id);
              if (!props.expanded.has(menuNode.id)) props.onToggle(menuNode.id);
            }}
          >
            <Pencil /> Rename
          </MenuItem>
          <MenuItem
            label="Add page inside"
            onClick={() => {
              setMenu(null);
              props.onCreate(menuNode.id, 'page');
            }}
          >
            <Plus /> Add page inside
          </MenuItem>
          <MenuItem
            label="Add database inside"
            onClick={() => {
              setMenu(null);
              props.onCreate(menuNode.id, 'database');
            }}
          >
            <Table /> Add database inside
          </MenuItem>
          <div className="menu__sep" />
          <MenuItem
            label="Delete"
            danger
            onClick={() => {
              setMenu(null);
              props.onRequestDelete(menuNode);
            }}
          >
            <Trash /> Delete
          </MenuItem>
        </Popover>
      )}
    </nav>
  );
}
