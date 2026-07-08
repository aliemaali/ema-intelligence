"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { generateExposePdf, type ExposeProjectInput } from "@/lib/pdf/expose";

interface ExposeButtonProps {
  project: ExposeProjectInput;
  className?: string;
}

export default function ExposeButton({ project, className }: ExposeButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isGenerating) return;

    setError(null);
    setIsGenerating(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      generateExposePdf(project);
    } catch (err) {
      console.error("Fehler bei der Exposé-Erzeugung:", err);
      setError("Das Exposé konnte nicht erstellt werden. Bitte versuche es erneut.");
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
          "inline-flex items-center gap-2 rounded-full bg-[#5CB800] px-5 py-3 " +
            "text-sm font-extrabold text-white shadow-lg shadow-[#5CB800]/20 transition-colors " +
            "hover:bg-[#4FA000] focus:outline-none focus:ring-2 " +
            "focus:ring-[#5CB800] focus:ring-offset-2 disabled:cursor-not-allowed " +
            "disabled:opacity-60"
        }
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Neues Exposé wird erstellt …
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Neues Exposé als PDF
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
