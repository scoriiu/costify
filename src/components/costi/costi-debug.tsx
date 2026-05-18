"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { CostiMascot, type CostiState, type CostiLookAt, type CostiReacting } from "./costi-mascot";

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

const LOOK_AT_OPTIONS: { value: CostiLookAt; label: string }[] = [
  { value: "off", label: "Centru" },
  { value: "cursor", label: "Cursor" },
  { value: "user", label: "User" },
  { value: "down", label: "Jos" },
];

const REACT_OPTIONS: { value: NonNullable<CostiReacting>; label: string }[] = [
  { value: "pop", label: "Pop" },
  { value: "nod", label: "Nod" },
  { value: "bounce", label: "Bounce" },
];

interface LabState {
  state: CostiState;
  size: number;
  lookAt: CostiLookAt;
  animated: boolean;
}

export function CostiDebug() {
  return (
    <div className="p-8 space-y-12">
      <div>
        <h1 className="text-2xl font-bold text-white">Costi Debug</h1>
        <p className="text-sm text-gray mt-1">Toate starile, dimensiunile si animatia.</p>
      </div>

      {/* ------------ NEW: Liveliness Lab ------------ */}
      <LivelinessLab />

      {/* All states grid */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">States (120px)</h2>
        <div className="grid grid-cols-3 gap-6">
          {STATES.map(({ state, label, description }) => (
            <div
              key={state}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dark-3 bg-dark-2 p-6 transition-all hover:border-primary/20"
            >
              <CostiMascot state={state} size={120} lookAt="cursor" />
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-widest text-primary-light">{state}</div>
                <div className="text-sm font-bold text-white mt-1">{label}</div>
                <div className="text-xs text-gray mt-1">{description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

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

      <div>
        <h2 className="text-lg font-bold text-white mb-4">Crop modes</h2>
        <div className="grid grid-cols-3 gap-4 rounded-2xl border border-dark-3 bg-dark-2 p-8">
          {(["full", "bust", "head"] as const).map((mode) => (
            <div key={mode} className="flex flex-col items-center gap-3">
              <CostiMascot state="greeting" size={120} mode={mode} />
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-widest text-primary-light">{mode}</div>
                <div className="text-xs text-gray mt-1">
                  {mode === "full" ? "Intregul corp" : mode === "bust" ? "Cap + umeri + sacou" : "Doar capul"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-4">Chat bubble corner</h2>
        <div className="rounded-2xl border border-dark-3 bg-dark-2 p-8">
          <p className="text-sm text-gray mb-4">
            Cum apare Costi in coltul de chat din dreapta-jos. Bust mode,
            64px, cerc rotunjit, bordura discreta. Starea
            implicita este <code className="font-mono text-xs text-primary-light">success</code> —
            ochi inchisi in zambet, calm si primitor.
          </p>
          <div className="relative h-[180px] rounded-xl border border-dark-3 bg-dark p-4">
            {/* Mock app surface */}
            <div className="absolute inset-4 flex flex-col gap-2 opacity-30">
              <div className="h-3 w-32 rounded bg-dark-3" />
              <div className="h-3 w-48 rounded bg-dark-3" />
              <div className="h-3 w-40 rounded bg-dark-3" />
            </div>
            {/* The actual bubble in the corner */}
            <button
              className="absolute bottom-4 right-4 rounded-full bg-dark-2 border border-dark-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden flex items-center justify-center hover:shadow-[0_12px_32px_rgba(13,107,94,0.4)] transition-shadow"
              style={{ width: 64, height: 64 }}
              aria-label="Deschide chatul cu Costi"
            >
              <CostiMascot state="success" size={64} mode="bust" lookAt="cursor" />
            </button>
          </div>
          <p className="text-xs text-gray mt-4">
            Mai jos: cum arata fiecare stare in cerc, pentru cand chatul comuta
            tonul (succes / atentie / eroare).
          </p>
          <div className="flex items-end gap-6 flex-wrap mt-4">
            {(["teaching", "thinking", "success", "alert", "error"] as const).map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <div className="rounded-full bg-dark border border-dark-3 overflow-hidden flex items-center justify-center" style={{ width: 64, height: 64 }}>
                  <CostiMascot state={s} size={64} mode="bust" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-gray">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-4">Background Contrast</h2>
        <p className="text-sm text-gray mb-4">
          Suprafetele reale ale aplicatiei — surface-0/1/2/3 din temele dark
          si light (vezi <code className="font-mono text-xs">globals.css</code>).
          Pe suprafetele dark, Costi primeste o aura discreta in spatele capului
          (prop <code className="font-mono text-xs">surface=&quot;dark&quot;</code>).
        </p>
        <div className="grid grid-cols-4 gap-4">
          {([
            { bg: "#0B1514", label: "Dark · surface-0", surface: "dark" as const },
            { bg: "#111F1E", label: "Dark · surface-1", surface: "dark" as const },
            { bg: "#182A28", label: "Dark · surface-2", surface: "dark" as const },
            { bg: "#223633", label: "Dark · surface-3", surface: "dark" as const },
            { bg: "#F0EFEA", label: "Light · surface-0", surface: "light" as const },
            { bg: "#F7F6F2", label: "Light · surface-1", surface: "light" as const },
            { bg: "#E6E4DE", label: "Light · surface-2", surface: "light" as const },
            { bg: "#D9D7D0", label: "Light · surface-3", surface: "light" as const },
          ]).map(({ bg, label, surface }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dark-3 p-6"
              style={{ backgroundColor: bg }}
            >
              <CostiMascot state="greeting" size={100} surface={surface} />
              <span
                className="text-xs font-mono text-center"
                style={{ color: surface === "light" ? "#44413C" : "#8A877F" }}
              >
                {label}
                <br />
                <span style={{ opacity: 0.7 }}>{bg}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-4">Chat Context</h2>
        <div className="max-w-xl space-y-3">
          <div className="flex gap-3 items-start">
            <CostiMascot state="thinking" size={36} mode="head" />
            <div className="rounded-2xl rounded-bl-md bg-dark-3/40 px-4 py-3 text-sm text-gray-light">
              Analizez datele, un moment...
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <CostiMascot state="success" size={36} mode="head" />
            <div className="rounded-2xl rounded-bl-md bg-dark-3/40 px-4 py-3 text-sm text-gray-light">
              TVA-ul standard in 2026 este 21%, conform art. 291 CF.
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <CostiMascot state="error" size={36} mode="head" />
            <div className="rounded-2xl rounded-bl-md bg-dark-3/40 px-4 py-3 text-sm text-gray-light">
              Nu ma pot conecta la server. Verifica conexiunea.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Live tuning surface for the SMIL + CSS animation layer.
 *  Mirrors how Boris's /admin/boris-lab works: pick a state, pick gaze
 *  target, fire reactions, scrub through sizes. Live preview rerenders
 *  the mascot with the chosen knobs. */
function LivelinessLab() {
  const [lab, setLab] = useState<LabState>({
    state: "greeting",
    size: 160,
    lookAt: "cursor",
    animated: true,
  });
  const [reacting, setReacting] = useState<CostiReacting>(null);
  // Auto-cycle through states for the "alive demo" lane on the right.
  const [demoState, setDemoState] = useState<CostiState>("greeting");
  useEffect(() => {
    const order: CostiState[] = ["greeting", "thinking", "working", "success", "celebrating", "alert", "error", "teaching", "sleeping"];
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % order.length;
      setDemoState(order[i]);
    }, 3600);
    return () => clearInterval(id);
  }, []);

  function fireReaction(r: NonNullable<CostiReacting>) {
    setReacting(r);
    window.setTimeout(() => setReacting(null), 800);
  }

  return (
    <section className="rounded-2xl border border-primary/20 bg-dark-2 p-6">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-lg font-bold text-white">Liveliness Lab</h2>
        <span className="font-mono text-[11px] uppercase tracking-widest text-primary-light">animatie costi</span>
      </div>
      <p className="text-sm text-gray mb-6">
        Blink + saccade + breath + head drift + gaze tracking + one-shot reactions.
        Toate animatiile respecta <code className="font-mono text-xs">prefers-reduced-motion</code>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
        {/* Left — interactive preview */}
        <div className="rounded-xl border border-dark-3 bg-dark p-6 flex flex-col items-center justify-center min-h-[320px]">
          <CostiMascot
            state={lab.state}
            size={lab.size}
            animated={lab.animated}
            lookAt={lab.lookAt}
            reacting={reacting}
          />
          <div className="mt-4 font-mono text-[11px] uppercase tracking-widest text-gray">
            {lab.state} · {lab.size}px · gaze:{lab.lookAt} · {lab.animated ? "animated" : "static"}
          </div>
        </div>

        {/* Right — auto-demo lane proves "alive at rest" */}
        <div className="rounded-xl border border-dark-3 bg-dark p-6 flex flex-col items-center justify-between min-h-[320px]">
          <div className="font-mono text-[11px] uppercase tracking-widest text-gray self-start">
            ciclu automat · 3.6s/stare
          </div>
          <CostiMascot state={demoState} size={140} lookAt="cursor" />
          <div className="text-sm text-white font-semibold">{demoState}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 space-y-4">
        <ControlRow label="Stare">
          <div className="flex flex-wrap gap-2">
            {STATES.map(({ state }) => (
              <button
                key={state}
                onClick={() => setLab((l) => ({ ...l, state }))}
                className={`font-mono text-xs uppercase tracking-widest rounded-[10px] px-3 py-2 transition-colors ${
                  lab.state === state
                    ? "bg-primary text-[#E9E8E3]"
                    : "bg-dark-2 text-gray hover:text-white border border-dark-3"
                }`}
              >
                {state}
              </button>
            ))}
          </div>
        </ControlRow>

        <ControlRow label="Privire">
          <ToggleGroup
            value={lab.lookAt}
            options={LOOK_AT_OPTIONS}
            onChange={(v) => setLab((l) => ({ ...l, lookAt: v }))}
          />
        </ControlRow>

        <ControlRow label="Dimensiune">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={48}
              max={240}
              step={4}
              value={lab.size}
              onChange={(e) => setLab((l) => ({ ...l, size: Number(e.target.value) }))}
              className="w-full accent-primary"
            />
            <span className="font-mono text-xs text-gray-light w-12 text-right">{lab.size}px</span>
          </div>
        </ControlRow>

        <ControlRow label="Animat">
          <ToggleGroup
            value={lab.animated ? "on" : "off"}
            options={[
              { value: "on", label: "Pornit" },
              { value: "off", label: "Oprit" },
            ]}
            onChange={(v) => setLab((l) => ({ ...l, animated: v === "on" }))}
          />
        </ControlRow>

        <ControlRow label="Reactie">
          <div className="flex gap-2">
            {REACT_OPTIONS.map((opt) => (
              <Button key={opt.value} variant="ghost" onClick={() => fireReaction(opt.value)}>
                {opt.label}
              </Button>
            ))}
          </div>
        </ControlRow>
      </div>

      {/* Cheatsheet of what each primitive does */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <Primitive
          name="Blink"
          tech="SMIL <animate ry>"
          detail="Per-state durate (4.2-5.4s) + offset-uri decalate. Ochii nu clipesc sincron."
        />
        <Primitive
          name="Saccade"
          tech="SMIL <animate cx>"
          detail="Pupilele stau ~80%, flick ~5%, hold, return. Dezactivat la thinking/working/alert/sleeping."
        />
        <Primitive
          name="Breath"
          tech="SMIL animateTransform scale"
          detail="Corpul respira la 4.3s — scala 1.012, additive cu transformarile capului."
        />
        <Primitive
          name="Head drift"
          tech="SMIL animateTransform rotate+translate"
          detail="Rotatie 11s + translatie 7.3s, additive — capul nu pare blocat in pozitie."
        />
        <Primitive
          name="Gaze"
          tech="useCostiGaze + transform translate"
          detail="Pupilele urmaresc cursorul cu tranzitie CSS 90ms. Clamp ±1.6 unitati SVG."
        />
        <Primitive
          name="Reaction"
          tech="CSS keyframe + key-bump"
          detail="pop / nod / bounce. React re-keaza wrapper-ul ca animatia sa reporneasca."
        />
        <Primitive
          name="State morphology"
          tech="path swap per state"
          detail="Sprancene, gura, ochi inchisi (success/celebrating) sunt forme diferite — nu doar animatii."
        />
        <Primitive
          name="prefers-reduced-motion"
          tech="usePrefersReducedMotion + @media"
          detail="Gateaza fiecare animatie atat in SMIL (prin prop) cat si in CSS. Accesibilitate fara compromis."
        />
      </div>
    </section>
  );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-widest text-gray">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Primitive({ name, tech, detail }: { name: string; tech: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dark-3 bg-dark p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-white">{name}</span>
        <code className="font-mono text-[10px] text-primary-light truncate">{tech}</code>
      </div>
      <p className="text-xs text-gray mt-1.5 leading-relaxed">{detail}</p>
    </div>
  );
}
