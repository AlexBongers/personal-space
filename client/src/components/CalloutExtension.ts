import { Node, mergeAttributes } from '@tiptap/core';

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType;
      toggleCallout: () => ReturnType;
    };
  }
}

export const CalloutExtension = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'inline*',

  defining: true,

  addAttributes() {
    return {
      color: {
        default: 'blue',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', style: 'padding:12px 16px;border-radius:6px;background:var(--bg-hover);border-left:3px solid var(--accent-blue);margin:4px 0' }), 0];
  },

  addCommands() {
    return {
      setCallout: () => ({ commands }) => {
        return commands.setNode(this.name);
      },
      toggleCallout: () => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph');
      },
    };
  },
});