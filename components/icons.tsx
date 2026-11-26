import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" } as const;

export const IconPlus = (p: P) => (<svg {...base} strokeWidth={2.4} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IconSearch = (p: P) => (<svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>);
export const IconGear = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>);
export const IconLayers = (p: P) => (<svg {...base} {...p}><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></svg>);
export const IconMonth = (p: P) => (<svg {...base} {...p}><rect x="3.5" y="4.5" width="17" height="16" rx="3.5" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" strokeWidth={2.6} /></svg>);
export const IconList = (p: P) => (<svg {...base} {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" fill="currentColor" /><circle cx="4.5" cy="12" r="1.2" fill="currentColor" /><circle cx="4.5" cy="18" r="1.2" fill="currentColor" /></svg>);
export const IconYear = (p: P) => (<svg {...base} {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></svg>);
export const IconClose = (p: P) => (<svg {...base} strokeWidth={2.2} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconChevronL = (p: P) => (<svg {...base} strokeWidth={2.2} {...p}><path d="m15 5-7 7 7 7" /></svg>);
export const IconChevronR = (p: P) => (<svg {...base} strokeWidth={2.2} {...p}><path d="m9 5 7 7-7 7" /></svg>);
export const IconClock = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>);
export const IconPin = (p: P) => (<svg {...base} {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg>);
export const IconPerson = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3" /></svg>);
export const IconNote = (p: P) => (<svg {...base} {...p}><path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20z" /><path d="M14.5 3.5V8H19M9 12.5h7M9 16h5" /></svg>);
export const IconTrash = (p: P) => (<svg {...base} {...p}><path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" /></svg>);
export const IconEdit = (p: P) => (<svg {...base} {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>);
export const IconCopy = (p: P) => (<svg {...base} {...p}><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" /></svg>);
export const IconShare = (p: P) => (<svg {...base} {...p}><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" /><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" /></svg>);
export const IconLink = (p: P) => (<svg {...base} {...p}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>);
export const IconSync = (p: P) => (<svg {...base} {...p}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" /></svg>);
export const IconMerge = (p: P) => (<svg {...base} {...p}><path d="M7 4v4a5 5 0 0 0 5 5 5 5 0 0 1 5 5v2M17 4v4a5 5 0 0 1-2.2 4.1M7 20v-2a5 5 0 0 1 2.2-4.1" /></svg>);
export const IconEye = (p: P) => (<svg {...base} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>);
export const IconEyeOff = (p: P) => (<svg {...base} {...p}><path d="M10.6 5.6A10 10 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-2.9 3.7M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>);
export const IconCheck = (p: P) => (<svg {...base} strokeWidth={2.4} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconPhone = (p: P) => (<svg {...base} {...p}><path d="M5 4h3.5l1.8 4.6-2.3 1.4a11 11 0 0 0 6 6l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" /></svg>);
export const IconSparkle = (p: P) => (<svg {...base} {...p}><path d="M12 3.5 13.8 9a2 2 0 0 0 1.2 1.2l5.5 1.8-5.5 1.8a2 2 0 0 0-1.2 1.2L12 20.5 10.2 15a2 2 0 0 0-1.2-1.2L3.5 12 9 10.2A2 2 0 0 0 10.2 9z" /></svg>);
export const IconCalendarToday = ({ day, ...p }: P & { day: number }) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.9" />
    <path d="M3.5 9h17M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    <text x="12" y="17.6" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="currentColor" fontFamily="-apple-system, system-ui, sans-serif">{day}</text>
  </svg>
);
