"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "FAILED";

type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedAgent: { id: string; role: string } | null;
  sprint: { id: string; name: string; createdAt: string };
};

type DbAgent = {
  id: string;
  role: string;
};

// Maps canvas display role → Prisma enum role stored in DB
const CANVAS_TO_DB_ROLE: Record<string, string> = {
  "Co-Founder": "CO_FOUNDER",
  PM: "PM",
  Developer: "DEVELOPER",
  QA: "QA",
  Architect: "ARCHITECT",
  Designer: "DESIGNER",
  Strategist: "STRATEGIST",
  Marketer: "MARKETER",
  Growth: "GROWTH_HACKER",
  Accountant: "ACCOUNTANT",
  Legal: "LEGAL",
  HR: "HR_DIRECTOR",
};

function formatDbRole(dbRole: string): string {
  return dbRole.toLowerCase().replaceAll("_", " ");
}

function statusBadgeClasses(status: TaskStatus): string {
  if (status === "DONE") return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
  if (status === "FAILED") return "border-rose-800 bg-rose-950/40 text-rose-300";
  if (status === "IN_PROGRESS") return "border-sky-800 bg-sky-950/40 text-sky-300";
  if (status === "IN_REVIEW") return "border-amber-800 bg-amber-950/40 text-amber-300";
  return "border-zinc-700 bg-zinc-800/60 text-zinc-300";
}

function formatStatus(status: TaskStatus): string {
  return status.toLowerCase().replaceAll("_", " ");
}

function excerpt(value: string, length = 100): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length).trimEnd()}...`;
}

export type AssignedTaskInfo = {
  id: string;
  title: string;
  status: TaskStatus;
};

type TaskAssignmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  agentRole: string;
  onAssigned?: (task: AssignedTaskInfo) => void;
  onUnassigned?: () => void;
};

export function TaskAssignmentModal({
  isOpen,
  onClose,
  agentRole,
  onAssigned,
  onUnassigned,
}: TaskAssignmentModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbAgent, setDbAgent] = useState<DbAgent | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirmReassign, setConfirmReassign] = useState<Task | null>(null);
  const [confirmUnassign, setConfirmUnassign] = useState(false);

  const backdropRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const [tasksRes, agentsRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/hq/agents")]);

      if (!tasksRes.ok || !agentsRes.ok) {
        throw new Error("Failed to load data.");
      }

      const { tasks: fetchedTasks } = (await tasksRes.json()) as { tasks: Task[] };
      const { agents: fetchedAgents } = (await agentsRes.json()) as { agents: DbAgent[] };

      setTasks(fetchedTasks);

      const targetDbRole = CANVAS_TO_DB_ROLE[agentRole];
      const matched = fetchedAgents.find((a) => a.role === targetDbRole) ?? null;
      setDbAgent(matched);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load.",
      });
    } finally {
      setLoading(false);
    }
  }, [agentRole]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setFilter("ALL");
      setSearch("");
      setConfirmReassign(null);
      setConfirmUnassign(false);
    }
  }, [isOpen, fetchData]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmReassign) {
          setConfirmReassign(null);
        } else if (confirmUnassign) {
          setConfirmUnassign(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, confirmReassign, confirmUnassign, onClose]);

  // Determine current sprint (most recently created)
  const currentSprintId = useMemo(() => {
    if (!tasks.length) return null;
    const sprintMap = new Map(tasks.map((t) => [t.sprint.id, t.sprint]));
    const latest = [...sprintMap.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
    return latest?.id ?? null;
  }, [tasks]);

  const currentSprintTasks = useMemo(
    () => tasks.filter((t) => t.sprint.id === currentSprintId),
    [tasks, currentSprintId],
  );

  const currentTask = dbAgent
    ? (currentSprintTasks.find((t) => t.assignedAgent?.id === dbAgent.id) ?? null)
    : null;

  const assignableTasks = useMemo(
    () =>
      currentSprintTasks.filter(
        (t) => (t.status === "TODO" || t.status === "IN_PROGRESS") && t.id !== currentTask?.id,
      ),
    [currentSprintTasks, currentTask],
  );

  const filteredTasks = useMemo(
    () =>
      assignableTasks.filter((t) => {
        if (filter !== "ALL" && t.status !== filter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [assignableTasks, filter, search],
  );

  async function doAssign(taskId: string) {
    if (!dbAgent) return;

    const prevTasks = tasks;
    const taskBeingAssigned = tasks.find((t) => t.id === taskId);

    setAssigning(true);
    setNotice(null);
    setConfirmReassign(null);

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) return { ...t, assignedAgent: { id: dbAgent.id, role: dbAgent.role } };
        if (t.assignedAgent?.id === dbAgent.id) return { ...t, assignedAgent: null };
        return t;
      }),
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedAgentId: dbAgent.id }),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to assign task.");
      }

      onAssigned?.({
        id: taskId,
        title: taskBeingAssigned?.title ?? "",
        status: taskBeingAssigned?.status ?? "TODO",
      });
      onClose();
    } catch (err) {
      setTasks(prevTasks);
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to assign task.",
      });
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign() {
    if (!currentTask || !dbAgent) return;

    const prevTasks = tasks;

    setAssigning(true);
    setNotice(null);
    setConfirmUnassign(false);

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === currentTask.id ? { ...t, assignedAgent: null } : t)));

    try {
      const res = await fetch(`/api/tasks/${currentTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedAgentId: null }),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to unassign task.");
      }

      onUnassigned?.();
      onClose();
    } catch (err) {
      setTasks(prevTasks);
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to unassign task.",
      });
    } finally {
      setAssigning(false);
    }
  }

  function handleTaskClick(task: Task) {
    if (!dbAgent || assigning) return;

    if (task.assignedAgent && task.assignedAgent.id !== dbAgent.id) {
      setConfirmReassign(task);
      return;
    }

    doAssign(task.id);
  }

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-100">Assign Task to {agentRole}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close modal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-sm text-zinc-400">Loading tasks...</p>
          ) : !dbAgent ? (
            <div className="rounded-md border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
              No database agent found for role &quot;{agentRole}&quot;. Create agents in the HQ tab first.
            </div>
          ) : (
            <>
              {/* Notice */}
              {notice && (
                <div
                  className={`mb-4 rounded-md border px-3 py-2 text-sm ${
                    notice.type === "success"
                      ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
                      : "border-rose-800 bg-rose-950/30 text-rose-300"
                  }`}
                >
                  {notice.message}
                </div>
              )}

              {/* Reassignment confirmation */}
              {confirmReassign && (
                <div className="mb-4 rounded-lg border border-amber-800 bg-amber-950/30 p-4">
                  <p className="text-sm font-medium text-amber-200">Reassign task?</p>
                  <p className="mt-1 text-xs text-amber-300">
                    &quot;{confirmReassign.title}&quot; is currently assigned to{" "}
                    {formatDbRole(confirmReassign.assignedAgent!.role)}. Reassign to {agentRole}?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => doAssign(confirmReassign.id)}
                      disabled={assigning}
                      className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-60"
                    >
                      {assigning ? "Reassigning..." : "Confirm Reassign"}
                    </button>
                    <button
                      onClick={() => setConfirmReassign(null)}
                      disabled={assigning}
                      className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Current Assignment */}
              <section className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Current Assignment
                </h3>
                {currentTask ? (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-zinc-100">{currentTask.title}</p>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${statusBadgeClasses(currentTask.status)}`}
                          >
                            {formatStatus(currentTask.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">{excerpt(currentTask.description)}</p>
                      </div>
                      {confirmUnassign ? (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={handleUnassign}
                            disabled={assigning}
                            className="rounded bg-rose-700 px-2 py-1 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-60"
                          >
                            {assigning ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmUnassign(false)}
                            disabled={assigning}
                            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmUnassign(true)}
                          disabled={assigning}
                          className="shrink-0 rounded border border-rose-800 bg-rose-950/30 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Unassign
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No task currently assigned.</p>
                )}
              </section>

              {/* Search + Filter */}
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or description..."
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as "ALL" | TaskStatus)}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                >
                  <option value="ALL">All statuses</option>
                  <option value="TODO">Backlog</option>
                  <option value="IN_PROGRESS">In Progress</option>
                </select>
              </div>

              {/* Available Tasks */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Available Tasks ({filteredTasks.length})
                </h3>
                {filteredTasks.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {assignableTasks.length === 0
                      ? "No assignable tasks in the current sprint."
                      : "No tasks match your search or filter."}
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {filteredTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        disabled={assigning}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-zinc-100">{task.title}</p>
                              <span
                                className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${statusBadgeClasses(task.status)}`}
                              >
                                {formatStatus(task.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-zinc-400">{excerpt(task.description)}</p>
                            {task.assignedAgent && (
                              <p className="mt-1 text-[11px] text-amber-400">
                                Assigned to: {formatDbRole(task.assignedAgent.role)}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-zinc-500">Assign →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
