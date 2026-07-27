interface IconProps {
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const ChevronRight = ({ size = 12 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

export const Plus = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const Dots = ({ size = 14 }: IconProps) => (
  <svg {...base(size)} strokeWidth={2.2}>
    <path d="M4 8h.01M8 8h.01M12 8h.01" />
  </svg>
);

export const Trash = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9h6.8L12 4" />
  </svg>
);

export const Pencil = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M11.2 2.3l2.5 2.5L5.4 13H2.9v-2.5z" />
  </svg>
);

export const Search = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="7" cy="7" r="4.2" />
    <path d="M10.2 10.2 14 14" />
  </svg>
);

export const Doc = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 2h5l3 3v9H4z" />
    <path d="M9 2v3h3" />
  </svg>
);

export const Table = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="2.2" y="3" width="11.6" height="10" rx="1.4" />
    <path d="M2.2 6.5h11.6M6.5 6.5V13" />
  </svg>
);

export const Board = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="2.2" y="3" width="4.2" height="10" rx="1.2" />
    <rect x="9.6" y="3" width="4.2" height="6.5" rx="1.2" />
  </svg>
);

export const ListIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 4.5h10M3 8h10M3 11.5h7" />
  </svg>
);

export const Sun = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1" />
  </svg>
);

export const Moon = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.7 5.7 0 1 0 6.8 6.8z" />
  </svg>
);

export const Grip = ({ size = 14 }: IconProps) => (
  <svg {...base(size)} strokeWidth={2.2}>
    <path d="M6 3h.01M10 3h.01M6 8h.01M10 8h.01M6 13h.01M10 13h.01" />
  </svg>
);

export const Close = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const Check = ({ size = 14 }: IconProps) => (
  <svg {...base(size)} strokeWidth={2.2}>
    <path d="M3.2 8.4 6.4 11.6 12.8 4.8" />
  </svg>
);

export const ArrowDown = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 3v10M4.5 9.5 8 13l3.5-3.5" />
  </svg>
);

export const ArrowUp = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 13V3M4.5 6.5 8 3l3.5 3.5" />
  </svg>
);

export const Filter = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.5 3.5h11L9.2 8.6V13L6.8 11.6V8.6z" />
  </svg>
);
