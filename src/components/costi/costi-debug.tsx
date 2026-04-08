"use client";

import { CostiMascot, type CostiState } from "./costi-mascot";

const STATES: { state: CostiState; label: string; description: string }[] = [
  { state: "greeting", label: "Salut / Bun venit", description: "Login, onboarding, primul acces" },
  { state: "thinking", label: "Analizez / Procesez", description: "Clasificare, sincronizare, generare rapoarte" },
  { state: "success", label: "Succes / Confirmat", description: "Clasificare completa, buget aprobat, export reusit" },
  { state: "alert", label: "Atentie / Alerta", description: "Depasire buget, tranzactii suspecte, termen fiscal" },
  { state: "error", label: "Eroare / Frustrare", description: "Eroare sincronizare, import esuat, 404" },
  { state: "working", label: "Lucreaza / Concentrat", description: "Import masiv, generare SAF-T, reconciliere" },
  { state: "celebrating", label: "Celebrare / Milestone", description: "Primul client, an fiscal inchis, obiectiv atins" },
  { state: "sleeping", label: "Liniste / Nimic de facut", description: "Stare goala, niciun rezultat, cont nou" },
  { state: "teaching", label: "Ghidare / Onboarding", description: "Tooltipuri, ghid pas cu pas, sectiuni de ajutor" },
];

const SIZES = [32, 48, 72, 120, 160];

export function CostiDebug() {
  return (
    <div className="p-8 space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Costi Debug</h1>
        <p className="text-sm text-gray mt-1">All mascot states and sizes.</p>
      </div>

      {/* All states grid */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">States (120px)</h2>
        <div className="grid grid-cols-3 gap-6">
          {STATES.map(({ state, label, description }) => (
            <div
              key={state}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dark-3 bg-dark-2 p-6 transition-all hover:border-primary/20"
            >
              <CostiMascot state={state} size={120} />
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-widest text-primary-light">{state}</div>
                <div className="text-sm font-bold text-white mt-1">{label}</div>
                <div className="text-xs text-gray mt-1">{description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Size comparison */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Sizes</h2>
        <div className="flex items-end gap-8 rounded-2xl border border-dark-3 bg-dark-2 p-8">
          {SIZES.map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <CostiMascot state="greeting" size={size} />
              <span className="text-xs text-gray">{size}px</span>
            </div>
          ))}
        </div>
      </div>

      {/* On different backgrounds */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Background Contrast</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { bg: "#0D1117", label: "Midnight" },
            { bg: "#161B22", label: "Surface 1" },
            { bg: "#F8FAFC", label: "Light" },
            { bg: "#FFFFFF", label: "White" },
          ].map(({ bg, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dark-3 p-6"
              style={{ backgroundColor: bg }}
            >
              <CostiMascot state="greeting" size={100} />
              <span className="text-xs font-mono" style={{ color: bg === "#FFFFFF" || bg === "#F8FAFC" ? "#334155" : "#8B949E" }}>
                {label} ({bg})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat bubble preview */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Chat Context</h2>
        <div className="max-w-xl space-y-3">
          <div className="flex gap-3 items-start">
            <CostiMascot state="thinking" size={32} />
            <div className="rounded-2xl rounded-bl-md bg-dark-3/40 px-4 py-3 text-sm text-gray-light">
              Analizez datele, un moment...
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <CostiMascot state="success" size={32} />
            <div className="rounded-2xl rounded-bl-md bg-dark-3/40 px-4 py-3 text-sm text-gray-light">
              TVA-ul standard in 2026 este 21%, conform art. 291 CF.
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <CostiMascot state="error" size={32} />
            <div className="rounded-2xl rounded-bl-md bg-dark-3/40 px-4 py-3 text-sm text-gray-light">
              Nu ma pot conecta la server. Verifica conexiunea.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
