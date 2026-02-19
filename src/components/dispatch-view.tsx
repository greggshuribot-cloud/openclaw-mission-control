"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ProposalStatus = "PENDING_PM" | "PENDING_FOUNDER" | "APPROVED" | "REJECTED";

type ProposalRecord = {
  id: string;
  status: ProposalStatus;
  pmNotes: string | null;
  createdAt: string;
  content: {
    title?: string;
    summary?: string;
  };
  proposingAgent: {
    id: string;
    role: string;
  };
};

function formatStatus(status: ProposalStatus): string {
  return status.toLowerCase().replace("_", " ");
}

function statusClasses(status: ProposalStatus): string {
  if (status === "APPROVED") {
    return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
  }

  if (status === "REJECTED") {
    return "border-rose-800 bg-rose-950/40 text-rose-300";
  }

  return "border-zinc-700 bg-zinc-800/60 text-zinc-300";
}

export function DispatchView() {
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => proposals.filter((proposal) => proposal.status === "PENDING_FOUNDER").length,
    [proposals],
  );

  const loadProposals = useCallback(async () => {
    setError(null);

    const response = await fetch("/api/proposals", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to load proposals.");
    }

    const body = (await response.json()) as { proposals: ProposalRecord[] };
    setProposals(body.proposals);
  }, []);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await loadProposals();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load proposals.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [loadProposals]);

  async function handleCreateProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary }),
      });

      if (!response.ok) {
        throw new Error("Failed to create proposal.");
      }

      setTitle("");
      setSummary("");
      await loadProposals();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create proposal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStatus(id: string, status: ProposalStatus) {
    setUpdatingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update proposal status.");
      }

      await loadProposals();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update proposal.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="grid gap-4">
      <form onSubmit={handleCreateProposal} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">New Proposal</h3>
        <div className="mt-3 grid gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            required
            maxLength={160}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Summary"
            required
            maxLength={4000}
            rows={3}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-zinc-400">Pending founder decisions: {pendingCount}</p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create proposal"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-md border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading proposals...</div>
      ) : proposals.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
          No proposals yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {proposals.map((proposal) => (
            <article key={proposal.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-zinc-100">{proposal.content.title ?? "Untitled proposal"}</h3>
                  <p className="mt-1 text-sm text-zinc-300">{proposal.content.summary ?? "No summary provided."}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Proposed by {proposal.proposingAgent.role} • {new Date(proposal.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={`rounded-md border px-2 py-1 text-xs uppercase ${statusClasses(proposal.status)}`}>
                  {formatStatus(proposal.status)}
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleUpdateStatus(proposal.id, "APPROVED")}
                  disabled={updatingId === proposal.id}
                  className="rounded-md border border-emerald-700 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleUpdateStatus(proposal.id, "REJECTED")}
                  disabled={updatingId === proposal.id}
                  className="rounded-md border border-rose-700 px-3 py-1 text-xs font-medium text-rose-300 hover:bg-rose-950/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
