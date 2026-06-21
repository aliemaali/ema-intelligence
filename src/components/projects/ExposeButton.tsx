"use client";

/**
 * ExposeButton
 * --------------------------------------------------------------------------
 * Button für Projekt-Detailseiten, der per Klick ein PDF-Exposé generiert
 * und im Browser herunterlädt. Die eigentliche PDF-Erzeugung liegt in
 * `src/lib/pdf/expose.ts` (Trennung von UI und PDF-Logik).
 *
 * Verwendung:
 *   <ExposeButton project={project} />
 *
 * Hinweis zu Typen:
 * `project` ist bewusst als `any` typisiert, da das Projekt-Interface in
 * EMA Intelligence an dieser Stelle nicht bekannt ist. Sobald ein echtes
 * `Project`-Interface existiert, sollte dies hier und in `expose.ts`
 * nachgezogen werden.
 */

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { generateExposePdf, type ExposeProjectInput } from "@/lib/pdf/expose";

interface ExposeButtonProps {
  project: ExposeProjectInput;
  className?: string;
}

export default function ExposeButton({
  project,
  className,
}: ExposeButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isGenerating) return;

    setError(null);
    setIsGenerating(true);

    try {
      // Kleines Timeout, damit der Loading-State sicher gerendert wird,
      // bevor die (synchrone, potenziell etwas rechenintensive) PDF-
      // Erzeugung den Main-Thread kurz blockiert.
      await new Promise((resolve) => setTimeout(resolve, 0));
      generateExposePdf(project);
    } catch (err) {
      console.error("Fehler bei der Exposé-Erzeugung:", err);
      setError(
        "Das Exposé konnte nicht erstellt werden. Bitte versuche es erneut."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isGenerating}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-lg bg-[#5CB800] px-4 py-2.5 " +
            "text-sm font-semibold text-white shadow-sm transition-colors " +
            "hover:bg-[#4FA000] focus:outline-none focus:ring-2 " +
            "focus:ring-[#5CB800] focus:ring-offset-2 disabled:cursor-not-allowed " +
            "disabled:opacity-60"
        }
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Exposé wird erstellt …
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Exposé als PDF
          </>
        )}
      </button>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
