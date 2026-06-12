/**
 * FormulaBlock — the one way we explain a number, everywhere.
 *
 * Three layers, so the value is never a black box:
 *   1. "Cum se calculeaza" + the formula in words (no jargon on owner surfaces)
 *   2. the substituted calculation, one step per line, with the result of
 *      each step emphasized after "="
 *
 * The `calculation` string convention (produced by the KPI registry and
 * computeRatios): steps separated by "; ", result after the last " = ".
 */

interface FormulaBlockProps {
  /** Formula in words: "Profitul impartit la venituri". Rendered as a sentence. */
  formula: string;
  /** Substituted calculation: "382.743 − 58.363 − 248.675 = 75.706 lei". */
  calculation?: string | null;
}

export function FormulaBlock({ formula, calculation }: FormulaBlockProps) {
  const steps = calculation
    ? calculation.split("; ").filter((s) => s.trim().length > 0)
    : [];

  return (
    <div className="space-y-1.5">
      <p className="text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
        <span
          className="font-mono text-[10px] font-medium uppercase text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          Cum se calculeaza:
        </span>{" "}
        <span className="text-gray-light">{formula.replace(/\.$/, "")}.</span>
      </p>
      {steps.length > 0 && <EquationSteps calculation={calculation!} />}
    </div>
  );
}

/** Just the boxed equation steps, for surfaces that render their own formula
 *  label (e.g. the accountant KPI tab). */
export function EquationSteps({ calculation }: { calculation: string }) {
  const steps = calculation.split("; ").filter((s) => s.trim().length > 0);
  if (steps.length === 0) return null;
  return (
    <div className="rounded-md border border-dark-3/80 bg-dark/40 px-3 py-2 space-y-1">
      {steps.map((step, i) => (
        <EquationLine key={i} step={step} />
      ))}
    </div>
  );
}

function EquationLine({ step }: { step: string }) {
  const idx = step.lastIndexOf(" = ");
  const lhs = idx >= 0 ? step.slice(0, idx) : step;
  const rhs = idx >= 0 ? step.slice(idx + 3) : null;

  return (
    <p className="font-mono text-[11.5px] leading-relaxed tabular-nums">
      <span className="text-gray">{lhs}</span>
      {rhs !== null && (
        <>
          <span className="text-gray"> = </span>
          <span className="font-semibold text-white">{rhs}</span>
        </>
      )}
    </p>
  );
}
