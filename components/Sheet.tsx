"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconClose } from "./icons";

type Props = {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  /** Höhe: "auto" (Inhalt) oder "full" */
  size?: "auto" | "full";
  z?: number;
};

/** iOS-artiges Bottom-Sheet mit Glas, Zieh-zum-Schließen und Animation */
export default function Sheet({ title, onClose, children, actions, size = "auto", z = 0 }: Props) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number; active: boolean } | null>(null);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 220);
  }, [closing, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Hintergrund nicht mitscrollen
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    const body = sheetRef.current?.querySelector(".sheet-body");
    const atTop = !body || body.scrollTop <= 0;
    const target = e.target as HTMLElement;
    if (!atTop && !target.closest(".grabber, .sheet-head")) return;
    if (target.closest("input, textarea, select, .cal-chips, .hscroll")) return;
    drag.current = { y: e.touches[0].clientY, dy: 0, active: true };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current?.active || !sheetRef.current) return;
    const dy = e.touches[0].clientY - drag.current.y;
    drag.current.dy = dy;
    if (dy > 0) {
      sheetRef.current.style.transition = "none";
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    const el = sheetRef.current;
    if (!d || !el) return;
    el.style.transition = "transform 0.28s cubic-bezier(.2,1,.3,1)";
    if (d.dy > 110) {
      el.style.transform = "translateY(105%)";
      setTimeout(onClose, 200);
    } else {
      el.style.transform = "";
    }
  };

  return (
    <>
      <div className={`scrim ${closing ? "closing" : ""}`} style={{ zIndex: 40 + z * 2 }} onClick={close} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={`sheet ${closing ? "closing" : ""}`}
        style={{ zIndex: 41 + z * 2, height: size === "full" ? "calc(100dvh - var(--safe-t) - 18px)" : undefined }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="grabber" />
        {(title || actions) && (
          <div className="sheet-head">
            <h2>{title}</h2>
            {actions}
            <button className="icon-btn glass" aria-label="Schließen" onClick={close} style={{ width: 36, height: 36 }}>
              <IconClose style={{ width: 17, height: 17 }} />
            </button>
          </div>
        )}
        <div className="sheet-body" style={{ flex: size === "full" ? 1 : undefined }}>{children}</div>
      </div>
    </>
  );
}
