"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { sanitizeRichHtml, textHtml } from "@/lib/mail/rich-text";
import s from "./mail.module.css";
export function MailRichEditor({
  body,
  html,
  disabled,
  onChange,
  options,
}: {
  body: string;
  html?: string;
  disabled: boolean;
  onChange: (body: string, html: string) => void;
  options?: ReactNode;
}) {
  const editor = useRef<HTMLDivElement>(null),
    selection = useRef<Range | null>(null);
  useEffect(() => {
    const value = html || textHtml(body);
    if (editor.current && sanitizeRichHtml(editor.current.innerHTML) !== value)
      editor.current.innerHTML = value;
  }, [body, html]);
  const publish = () => {
    if (editor.current)
      onChange(
        editor.current.innerText,
        sanitizeRichHtml(editor.current.innerHTML),
      );
  };
  function remember() {
    const sel = window.getSelection();
    if (sel?.rangeCount && editor.current?.contains(sel.anchorNode))
      selection.current = sel.getRangeAt(0).cloneRange();
  }
  function command(name: string, value?: string) {
    if (disabled) return;
    editor.current?.focus();
    if (
      selection.current &&
      editor.current?.contains(selection.current.commonAncestorContainer)
    ) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(selection.current);
    }
    document.execCommand(name, false, value);
    publish();
    remember();
  }
  return (
    <div className={s.richEditor}>
      {options}
      <div
        ref={editor}
        className={s.richBody}
        role="textbox"
        aria-label="Nachricht"
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={publish}
        onKeyUp={remember}
        onMouseUp={remember}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) {
            e.preventDefault();
            command("insertText", e.dataTransfer.getData("text/plain"));
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          command("insertText", e.clipboardData.getData("text/plain"));
        }}
      />
    </div>
  );
}
