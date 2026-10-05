import React from 'react';

// ============================================================
// Icon – yagona SVG ikonkalar to'plami (emoji o'rniga).
// Hamma qurilmada bir xil ko'rinadi, rangi `color` yoki matn rangidan olinadi.
// Ishlatish:  <Icon name="coin" />   <Icon name="trophy" color="#fbbf24" size={24} />
// ============================================================
const P = {
  coin: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8m0 8v1.5" /></>,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />,
  chart: <path d="M4 20h16M7 20v-6M12 20V6M17 20v-10" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />,
  swords: <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" />,
  bot: <><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V5M8 14h.01M16 14h.01M9 17h6" /><circle cx="12" cy="4" r="1" /></>,
  wallet: <path d="M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01" />,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  zap: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.2 1 2 2 2.5C11.5 8 11 5.5 12 3z" />,
  rock: <path d="M4.5 13.5L7 7l5-2.5 5.5 3L20 14l-4 5-6 1-5.5-3.5zM7 7l3.5 5L12 4.5M10.5 12L10 20M10.5 12l9.5 2" />,
  paper: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  scissors: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M7.5 16L17 3M16.5 16L7 3" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  xcircle: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  alert: <path d="M12 3L2 20h20L12 3zM12 10v5M12 18h.01" />,
  refresh: <path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4" />,
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></>,
  share: <path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />,
  inbox: <path d="M3 13l3-8h12l3 8v6H3v-6zM3 13h5l1 3h6l1-3h5" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  dot: <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
  gamepad: <><rect x="2" y="7" width="20" height="11" rx="4" /><path d="M7 10v5M4.5 12.5h5M15.5 11h.01M18 14h.01" /></>,
  medal: <><circle cx="12" cy="15" r="6" /><path d="M8.5 10L6 3h4l2 4 2-4h4l-2.5 7" /></>,
  history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />,
  repeat: <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />,
  trendDown: <path d="M22 17l-8.5-8.5-5 5L2 7M16 17h6v-6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3 8 4.5 9 8 12 8zm0 0s1.5-5 4-3.5S15 8 12 8z" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  equal: <path d="M5 9h14M5 15h14" />,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.6-.6-2.6 2.6-2.5z" />,
  plug: <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8zM12 18v4" />,
  door: <path d="M6 21V3h10v18M4 21h16M13 12h.01" />,
  hourglass: <path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" /></>,
  flask: <path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7.5 14h9" />,
};

// Ba'zi ikonkalarning standart rangi (aks holda matn rangidan olinadi)
const DEFAULT_COLOR = {
  coin: '#fbbf24', trophy: '#fbbf24', star: '#fbbf24', alert: '#fbbf24', bulb: '#fbbf24',
  flame: '#fb923c', check: '#34d399', xcircle: '#fb7185'
};

function Icon({ name, size = '1em', color, strokeWidth = 2, className = '', style }) {
  const body = P[name] || P.help;
  const c = color || DEFAULT_COLOR[name];
  return (
    <svg
      className={`ico ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={c ? { color: c, ...style } : style}
    >
      {body}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(P);
export default Icon;
