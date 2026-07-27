import { Popover, type Anchor } from './Popover.tsx';

const EMOJI = [
  '📄','📝','📓','📔','📚','🗂️','📌','🔖',
  '🏠','🚀','💡','🎯','🔥','⭐','✨','🎨',
  '🧩','🔬','🔨','⚙️','🧠','💬','📥','🗓️',
  '✅','📊','📈','💰','🛒','🍜','☕','🍷',
  '✈️','🗺️','🏝️','🌿','🌊','⛰️','🚲','🎵',
  '🎬','🎮','🐙','🐝','🦊','🐳','🌙','☀️',
];

interface EmojiPickerProps {
  anchor: Anchor;
  onPick: (emoji: string | null) => void;
  onClose: () => void;
}

export function EmojiPicker({ anchor, onPick, onClose }: EmojiPickerProps) {
  return (
    <Popover anchor={anchor} onClose={onClose} role="dialog" label="Page icon">
      <div className="menu__label">Page icon</div>
      <div className="emoji-grid">
        {EMOJI.map((emoji) => (
          <button key={emoji} aria-label={`Icon ${emoji}`} onClick={() => onPick(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
      <div className="menu__sep" />
      <button className="menu__item" onClick={() => onPick(null)}>
        Remove icon
      </button>
    </Popover>
  );
}
