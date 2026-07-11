"use client";

import { useRouter } from "next/navigation";
import { FileDown } from "lucide-react";
import type { ExposeProjectInput } from "@/lib/pdf/exposeV2";

interface ExposeButtonProps {
  project: ExposeProjectInput & { id?: string | null };
  className?: string;
}

export default function ExposeButton({ project, className }: ExposeButtonProps) {
  const router = useRouter();

  function handleClick() {
    const projectId = project?.id;
    router.push(projectId ? `/expose/${projectId}` : "/expose");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full bg-[#07142F] px-5 py-3 text-sm font-extrabold text-white shadow-lg transition-colors hover:bg-[#132060] focus:outline-none focus:ring-2 focus:ring-[#5CB800] focus:ring-offset-2"
      }
    >
      <FileDown className="h-4 w-4" aria-hidden="true" />
      Investment Memorandum
    </button>
  );
}
