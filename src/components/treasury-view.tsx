"use client";

import { useEffect, useMemo, useState } from "react";
import { useMissionControlStore } from "@/store/mission-control";

type TreasuryDefaults = {
  monthlyCapUnits: number | null;
  currentUsedUnits: number | null;
};

type TreasuryViewProps = {
  defaults: TreasuryDefaults;
};

type BurnStatus = "green" | "yellow" | "red";

function parseUnits(input: string): number | null {
  if (!input.trim()) return null;
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function formatUnits(units: number): string {
  return units.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function getStatus(runwayDays: number, usedUnits: number, capUnits: number): BurnStatus {
  if (capUnits <= 0 || usedUnits > capUnits || runwayDays < 3) return "red";
  if (runwayDays < 7) return "yellow";
  return "green";
}

const statusStyles: Record<BurnStatus, string> = {
  green: "border-emerald-800 bg-emerald-950/35 text-emerald-200",
  yellow: "border-amber-800 bg-amber-950/35 text-amber-200",
  red: "border-rose-800 bg-rose-950/35 text-rose-200",
};

const statusDotStyles: Record<BurnStatus, string> = {
  green: "bg-emerald-400",
  yellow: "bg-amber-400",
  red: "bg-rose-400",
};

const lightingByStatus: Record<BurnStatus, number> = {
  green: 1,
  yellow: 0.72,
  red: 0.4,
};

export function TreasuryView({ defaults }: TreasuryViewProps) {
  const [capInput, setCapInput] = useState(String(defaults.monthlyCapUnits ?? 10000));
  const [usedInput, setUsedInput] = useState(String(defaults.currentUsedUnits ?? 0));
  const setTreasuryTelemetry = useMissionControlStore((state) => state.setTreasuryTelemetry);

  const capUnits = parseUnits(capInput);
  const usedUnits = parseUnits(usedInput);
  const missingEnvConfig = defaults.monthlyCapUnits === null || defaults.currentUsedUnits === null;

  const today = new Date();
  const elapsedDays = Math.max(1, today.getDate());
  const periodDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const metrics = useMemo(() => {
    if (capUnits === null || usedUnits === null || capUnits <= 0) return null;

    const avgDailyUsage = usedUnits / elapsedDays;
    const remainingUnits = Math.max(0, capUnits - usedUnits);
    const runwayDays = avgDailyUsage > 0 ? remainingUnits / avgDailyUsage : Number.POSITIVE_INFINITY;
    const usagePct = (usedUnits / capUnits) * 100;
    const status = getStatus(runwayDays, usedUnits, capUnits);

    return {
      avgDailyUsage,
      remainingUnits,
      runwayDays,
      usagePct,
      status,
      officeLightingFactor: lightingByStatus[status],
    };
  }, [capUnits, usedUnits, elapsedDays]);

  useEffect(() => {
    if (!metrics) return;
    setTreasuryTelemetry({
      burnRatePct: metrics.usagePct,
      officeLightingFactor: metrics.officeLightingFactor,
    });
  }, [metrics, setTreasuryTelemetry]);

  const runwayLabel = !metrics
    ? "N/A"
    : Number.isFinite(metrics.runwayDays)
      ? `${metrics.runwayDays.toFixed(1)} days`
      : "No burn detected";

  return (
    <section className="grid gap-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold text-zinc-100">Treasury</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Burn-rate monitor for {today.toLocaleString("en-US", { month: "long", year: "numeric" })}.
        </p>
      </div>

      {missingEnvConfig ? (
        <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
          Treasury env defaults are missing (`MONTHLY_CAP_UNITS`, `CURRENT_USED_UNITS`). Running on editable local
          fallback values.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
          <p className="text-zinc-300">Monthly Cap Units</p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={capInput}
            onChange={(event) => setCapInput(event.target.value)}
            className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
          />
        </label>
        <label className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
          <p className="text-zinc-300">Current Used Units</p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={usedInput}
            onChange={(event) => setUsedInput(event.target.value)}
            className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
          />
        </label>
      </div>

      {!metrics ? (
        <div className="rounded-xl border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-200">
          Enter valid non-negative values to calculate burn rate and runway.
        </div>
      ) : (
        <>
          {metrics.runwayDays < 3 ? (
            <article className="rounded-xl border border-rose-700 bg-rose-950/30 p-4">
              <h3 className="text-sm font-semibold text-rose-200">Treasury Alert: Runway Critically Low</h3>
              <p className="mt-2 text-sm text-rose-100">
                Dispatch proposal needed. Runway is {metrics.runwayDays.toFixed(1)} days, below 3 days.
              </p>
            </article>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Current Period Usage</p>
              <p className="mt-2 text-xl font-semibold text-zinc-100">
                {formatUnits(usedUnits ?? 0)} / {formatUnits(capUnits ?? 0)}
              </p>
              <p className="mt-1 text-sm text-zinc-400">{metrics.usagePct.toFixed(1)}% consumed</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Burn Rate (Avg Daily Usage)</p>
              <p className="mt-2 text-xl font-semibold text-zinc-100">{formatUnits(metrics.avgDailyUsage)} units/day</p>
              <p className="mt-1 text-sm text-zinc-400">
                Based on {elapsedDays} elapsed days of {periodDays}-day period
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Estimated Runway</p>
              <p className="mt-2 text-xl font-semibold text-zinc-100">{runwayLabel}</p>
              <p className="mt-1 text-sm text-zinc-400">{formatUnits(metrics.remainingUnits)} units remaining</p>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${statusStyles[metrics.status]}`}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotStyles[metrics.status]}`} />
              Burn Status: {metrics.status.toUpperCase()}
            </p>
            <p className="mt-2 text-sm">
              officeLightingFactor: {metrics.officeLightingFactor.toFixed(2)} (for future office dimming hooks)
            </p>
          </div>
        </>
      )}
    </section>
  );
}
