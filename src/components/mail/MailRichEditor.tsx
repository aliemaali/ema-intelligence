"use client";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Table2,
  Undo2,
  Redo2,
} from "lucide-react";
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
      <div
        className={s.richToolbar}
        role="toolbar"
        aria-label="Text formatieren"
      >
        {(
          [
            { name: "bold", label: "Fett", icon: Bold },
            { name: "italic", label: "Kursiv", icon: Italic },
            { name: "underline", label: "Unterstrichen", icon: Underline },
            { name: "insertUnorderedList", label: "Aufzählung", icon: List },
            {
              name: "insertOrderedList",
              label: "Nummerierung",
              icon: ListOrdered,
            },
            { name: "undo", label: "Rückgängig", icon: Undo2 },
            { name: "redo", label: "Wiederholen", icon: Redo2 },
          ] as const
        ).map((t) => (
          <button
            key={t.name}
            disabled={disabled}
            type="button"
            aria-label={t.label}
            title={t.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command(t.name)}
          >
            <t.icon size={16} />
          </button>
        ))}
        <select
          aria-label="Schriftart"
          disabled={disabled}
          defaultValue="Arial"
          onChange={(e) => command("fontName", e.target.value)}
        >
          {["Arial", "Calibri", "Georgia", "Verdana"].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select
          aria-label="Schriftgröße"
          disabled={disabled}
          defaultValue="3"
          onChange={(e) => command("fontSize", e.target.value)}
        >
          {[
            ["2", "Klein"],
            ["3", "Normal"],
            ["4", "Groß"],
            ["5", "Sehr groß"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="color"
          aria-label="Schriftfarbe"
          disabled={disabled}
          defaultValue="#182c3b"
          onChange={(e) => command("foreColor", e.target.value)}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label="Tabelle einfügen"
          title="Tabelle mit zwei Zeilen und zwei Spalten einfügen"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            command(
              "insertHTML",
              '<table border="1" cellpadding="6" cellspacing="0"><tbody><tr><td>Spalte 1</td><td>Spalte 2</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p><br></p>',
            )
          }
        >
          <Table2 size={17} />
        </button>
      </div>
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
