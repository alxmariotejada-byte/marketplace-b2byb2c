"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { setMode } from "@/app/actions";
import type { Channel } from "@/lib/shared";

export function ModeToggle({ mode }: { mode: Channel }) {
  const path = usePathname();
  const sp = useSearchParams();
  const back = path + (sp.size ? `?${sp.toString()}` : "");
  return (
    <form action={setMode} className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold" aria-label="Tipo de cliente">
      <input type="hidden" name="back" value={back} />
      {(["B2C", "B2B"] as const).map((m) => (
        <button
          key={m}
          name="modo"
          value={m}
          className={`rounded-full px-3 py-1.5 transition ${mode === m ? "bg-blue-700 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}
          aria-pressed={mode === m}
        >
          {m === "B2C" ? "Personas" : "Empresas B2B"}
        </button>
      ))}
    </form>
  );
}
