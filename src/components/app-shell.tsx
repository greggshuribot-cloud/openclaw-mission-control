"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OfficeView } from "@/components/office-view";
import { DispatchView } from "@/components/dispatch-view";
import { SprintView } from "@/components/sprint-view";
import { CalendarView } from "@/components/calendar-view";
import { TreasuryView } from "@/components/treasury-view";
import { NetworkView } from "@/components/network-view";
import { useMissionControlStore } from "@/store/mission-control";

const tabs = [
  "Office",
  "Dispatch",
  "Current Sprint",
  "Calendar",
  "Treasury",
  "Network",
  "HQ",
  "Vault",
] as const;

type AppShellProps = {
  founderEmail: string;
  treasuryDefaults: {
    monthlyCapUnits: number | null;
    currentUsedUnits: number | null;
  };
};

export function AppShell({ founderEmail, treasuryDefaults }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Office");
  const [logoutPending, setLogoutPending] = useState(false);
  const router = useRouter();
  const { agents, burnRatePct, meetingMode, triggerMeeting } = useMissionControlStore();

  const blockedCount = useMemo(() => agents.filter((a) => a.status === "Blocked").length, [agents]);

  async function handleLogout() {
    setLogoutPending(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">OpenClaw Mission Control</h1>
            <p className="text-sm text-zinc-400">Founder Mode OS • v0 scaffold</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="rounded-md border border-zinc-700 px-3 py-1">Founder: {founderEmail}</div>
            <div className="rounded-md border border-zinc-700 px-3 py-1">Burn Rate: {burnRatePct}%</div>
            <div className="rounded-md border border-zinc-700 px-3 py-1">Blocked: {blockedCount}</div>
            <button
              onClick={triggerMeeting}
              className="rounded-md bg-indigo-500 px-3 py-1 font-medium text-white hover:bg-indigo-400"
            >
              {meetingMode ? "End Company Meeting" : "Company Meeting"}
            </button>
            <button
              onClick={handleLogout}
              disabled={logoutPending}
              className="rounded-md border border-zinc-700 px-3 py-1 font-medium text-zinc-200 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {logoutPending ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-2 text-sm ${
              activeTab === tab ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-7xl px-6 pb-10">
        {activeTab === "Office" && <OfficeView />}

        {activeTab === "Dispatch" && <DispatchView />}

        {activeTab === "Current Sprint" && <SprintView />}

        {activeTab === "Calendar" && <CalendarView />}

        {activeTab === "Treasury" && <TreasuryView defaults={treasuryDefaults} />}

        {activeTab === "Network" && <NetworkView />}

        {!["Office", "Dispatch", "Current Sprint", "Calendar", "Treasury", "Network"].includes(activeTab) && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-300">
            <h2 className="text-lg font-semibold">{activeTab}</h2>
            <p className="mt-2 text-sm text-zinc-400">Scaffold ready. Wiring for this tab is next in Phase 2.</p>
          </section>
        )}
      </main>
    </div>
  );
}
