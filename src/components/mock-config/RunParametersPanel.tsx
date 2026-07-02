"use client";

import { usePipelineStore } from "@/store/pipeline.store";
import type { ParameterDeclaration } from "@/lib/template";

function currentValue(decl: ParameterDeclaration, provided: Record<string, unknown>): unknown {
  return Object.prototype.hasOwnProperty.call(provided, decl.name) ? provided[decl.name] : decl.default;
}

function ParameterControl({ decl }: { readonly decl: ParameterDeclaration }) {
  const parameters = usePipelineStore((s) => s.parameters);
  const setParameter = usePipelineStore((s) => s.setParameter);
  const value = currentValue(decl, parameters);

  if (decl.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm" style={{ color: "var(--pc-text)" }}>
        <input type="checkbox" checked={value === true} onChange={(e) => void setParameter(decl.name, e.target.checked)} />
        {decl.name}
      </label>
    );
  }

  if (decl.values && decl.values.length > 0) {
    return (
      <label className="flex flex-col gap-0.5 text-sm" style={{ color: "var(--pc-text)" }}>
        {decl.name}
        <select
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--pc-border)" }}
          value={String(value ?? "")}
          onChange={(e) => void setParameter(decl.name, e.target.value)}
        >
          {decl.values.map((v) => (
            <option key={String(v)} value={String(v)}>
              {String(v)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (decl.type === "number") {
    return (
      <label className="flex flex-col gap-0.5 text-sm" style={{ color: "var(--pc-text)" }}>
        {decl.name}
        <input
          type="number"
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--pc-border)" }}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => void setParameter(decl.name, Number(e.target.value))}
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-0.5 text-sm" style={{ color: "var(--pc-text)" }}>
      {decl.name}
      <input
        type="text"
        className="rounded border px-2 py-1 text-sm"
        style={{ borderColor: "var(--pc-border)" }}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => void setParameter(decl.name, e.target.value)}
      />
    </label>
  );
}

export function RunParametersPanel() {
  const declarations = usePipelineStore((s) => s.parameterDeclarations);
  if (declarations.length === 0) return null;

  return (
    <div className="border-t p-4" style={{ borderColor: "var(--pc-border)" }}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pc-text-secondary)" }}>
        Run parameters
      </div>
      <div className="flex flex-wrap gap-3">
        {declarations.map((decl) => (
          <ParameterControl key={decl.name} decl={decl} />
        ))}
      </div>
    </div>
  );
}
