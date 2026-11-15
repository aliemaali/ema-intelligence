"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { swipeAxis, swipeRelease } from "@/lib/mail/swipe";
import s from "./mail.module.css";
type Gesture = {
  id: number;
  x: number;
  y: number;
  start: number;
  width: number;
  axis: "horizontal" | "vertical" | null;
};
export function MailSwipeRow({
  children,
  subject,
  disabled,
  open,
  onOpenChange,
  onDelete,
  deleteLabel,
}: {
  children: ReactNode;
  subject: string;
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => Promise<void>;
  deleteLabel?: string;
}) {
  const [offset, setOffset] = useState(0),
    [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null),
    position = useRef(0),
    suppressClick = useRef(false),
    pending = useRef(false);
  function move(value: number) {
    position.current = value;
    setOffset(value);
  }
  useEffect(() => {
    position.current = disabled ? 0 : open ? -88 : 0;
    setOffset(position.current);
  }, [open, disabled]);
  async function remove() {
    if (disabled || pending.current) return;
    pending.current = true;
    onOpenChange(false);
    move(0);
    try {
      await onDelete();
    } finally {
      pending.current = false;
    }
  }
  const revealed = !disabled && offset < 0;
  return (
    <div className={s.swipeRow}>
      <div
        className={s.swipeContent}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : undefined,
        }}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0 || !e.isPrimary) return;
          suppressClick.current = false;
          gesture.current = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            start: position.current,
            width: e.currentTarget.getBoundingClientRect().width,
            axis: null,
          };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId || disabled) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (!g.axis) {
            g.axis = swipeAxis(dx, dy);
            if (g.axis === "horizontal") {
              suppressClick.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
            }
          }
          if (g.axis === "horizontal")
            move(Math.max(-g.width, Math.min(0, g.start + dx)));
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          gesture.current = null;
          setDragging(false);
          if (g.axis !== "horizontal") return;
          const action = swipeRelease(position.current, g.width);
          if (action === "delete") void remove();
          else {
            onOpenChange(action === "reveal");
            move(action === "reveal" ? -88 : 0);
          }
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setDragging(false);
          move(open ? -88 : 0);
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          } else if (open) {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(false);
            move(0);
          }
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onOpenChange(true);
            move(-88);
          } else if (e.key === "Escape" || e.key === "ArrowRight") {
            e.preventDefault();
            onOpenChange(false);
            move(0);
          }
        }}
      >
        {children}
      </div>
      <button
        type="button"
        className={s.swipeDelete}
        style={{ visibility: revealed ? "visible" : "hidden" }}
        disabled={disabled}
        tabIndex={revealed ? 0 : -1}
        aria-hidden={!revealed}
        aria-label={deleteLabel || `${subject} in den Papierkorb verschieben`}
        onClick={() => void remove()}
      >
        <Trash2 size={21} />
        <span>Löschen</span>
      </button>
    </div>
  );
}
