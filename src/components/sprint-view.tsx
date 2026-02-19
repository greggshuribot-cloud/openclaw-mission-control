"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "FAILED";

type TaskRecord = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dependencyIds: string[];
  sprint: {
    id: string;
    name: string;
    createdAt: string;
  };
  assignedAgent: {
    id: string;
    role: string;
  } | null;
};

type ViewMode = "KANBAN" | "DEPENDENCY";

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: "TODO", label: "Backlog" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "IN_REVIEW", label: "In Review" },
  { status: "DONE", label: "Done" },
  { status: "FAILED", label: "Failed" },
];

function formatStatus(status: TaskStatus): string {
  return status.toLowerCase().replaceAll("_", " ");
}

function statusBadgeClasses(status: TaskStatus): string {
  if (status === "DONE") {
    return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
  }

  if (status === "FAILED") {
    return "border-rose-800 bg-rose-950/40 text-rose-300";
  }

  if (status === "IN_PROGRESS") {
    return "border-sky-800 bg-sky-950/40 text-sky-300";
  }

  if (status === "IN_REVIEW") {
    return "border-amber-800 bg-amber-950/40 text-amber-300";
  }

  return "border-zinc-700 bg-zinc-800/60 text-zinc-300";
}

function excerpt(value: string, length = 130): string {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length).trimEnd()}...`;
}

export function SprintView() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("KANBAN");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadTasks = useCallback(async () => {
    setError(null);

    const response = await fetch("/api/tasks", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to load tasks.");
    }

    const body = (await response.json()) as { tasks: TaskRecord[] };
    setTasks(body.tasks);
  }, []);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await loadTasks();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load tasks.");
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
  }, [loadTasks]);

  const currentSprintId = useMemo(() => {
    if (tasks.length === 0) {
      return null;
    }

    let selected = tasks[0].sprint;

    for (const task of tasks) {
      if (new Date(task.sprint.createdAt).getTime() > new Date(selected.createdAt).getTime()) {
        selected = task.sprint;
      }
    }

    return selected.id;
  }, [tasks]);

  const currentTasks = useMemo(
    () => tasks.filter((task) => (currentSprintId ? task.sprint.id === currentSprintId : false)),
    [tasks, currentSprintId],
  );

  const currentSprintName = useMemo(() => {
    const first = currentTasks[0];
    return first ? first.sprint.name : "Current Sprint";
  }, [currentTasks]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, TaskRecord[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      FAILED: [],
    };

    for (const task of currentTasks) {
      grouped[task.status].push(task);
    }

    return grouped;
  }, [currentTasks]);

  const dependencyGraph = useMemo(() => {
    const taskById = new Map(currentTasks.map((task) => [task.id, task]));
    const lanes: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      FAILED: 0,
    };

    const nodes: Node[] = currentTasks.map((task) => {
      const columnIndex = columns.findIndex((column) => column.status === task.status);
      const rowIndex = lanes[task.status];
      lanes[task.status] += 1;

      return {
        id: task.id,
        position: { x: columnIndex * 260, y: rowIndex * 110 },
        data: { label: task.title },
      };
    });

    const edges: Edge[] = [];

    for (const task of currentTasks) {
      for (const dependencyId of task.dependencyIds) {
        if (taskById.has(dependencyId)) {
          edges.push({
            id: `${dependencyId}-${task.id}`,
            source: dependencyId,
            target: task.id,
          });
        }
      }
    }

    return { nodes, edges };
  }, [currentTasks]);

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status: "TODO" }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create task.");
      }

      setTitle("");
      setDescription("");
      await loadTasks();
      setNotice({ type: "success", message: "Task created in current sprint backlog." });
    } catch (submitError) {
      setNotice({
        type: "error",
        message: submitError instanceof Error ? submitError.message : "Failed to create task.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(taskId: string, nextStatus: TaskStatus) {
    const original = tasks.find((task) => task.id === taskId);

    if (!original || original.status === nextStatus) {
      return;
    }

    setUpdatingId(taskId);
    setError(null);
    setNotice(null);

    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update task status.");
      }

      setNotice({ type: "success", message: "Task status updated." });
      await loadTasks();
    } catch (updateError) {
      setTasks((current) => current.map((task) => (task.id === taskId ? original : task)));
      setNotice({
        type: "error",
        message: updateError instanceof Error ? updateError.message : "Failed to update task status.",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="grid gap-4">
      <form onSubmit={handleCreateTask} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Quick Create Task</h3>
        <div className="mt-3 grid gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Task title"
            required
            maxLength={160}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Task description"
            required
            maxLength={4000}
            rows={2}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            Sprint: {currentSprintName} • Tasks: {currentTasks.length}
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create task"}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-100">{currentSprintName}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("KANBAN")}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              viewMode === "KANBAN"
                ? "border-zinc-500 bg-zinc-700/70 text-zinc-100"
                : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setViewMode("DEPENDENCY")}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              viewMode === "DEPENDENCY"
                ? "border-zinc-500 bg-zinc-700/70 text-zinc-100"
                : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            Dependency View
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</div>
      ) : null}
      {notice ? (
        <div
          className={
            notice.type === "success"
              ? "rounded-md border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300"
              : "rounded-md border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-300"
          }
        >
          {notice.message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading tasks...</div>
      ) : currentTasks.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
          No tasks in the current sprint.
        </div>
      ) : viewMode === "KANBAN" ? (
        <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-5">
          {columns.map((column) => (
            <section key={column.status} className="min-w-[260px] rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">{column.label}</h4>
                <span className="text-xs text-zinc-500">{tasksByStatus[column.status].length}</span>
              </div>

              <div className="grid gap-2">
                {tasksByStatus[column.status].map((task) => (
                  <article key={task.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="text-sm font-medium text-zinc-100">{task.title}</h5>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] uppercase ${statusBadgeClasses(task.status)}`}
                      >
                        {formatStatus(task.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-300">{excerpt(task.description)}</p>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Agent: {task.assignedAgent ? task.assignedAgent.role : "Unassigned"}
                    </p>

                    <label className="mt-3 block text-[11px] text-zinc-500">
                      Status
                      <select
                        value={task.status}
                        onChange={(event) => handleStatusChange(task.id, event.target.value as TaskStatus)}
                        disabled={updatingId === task.id}
                        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {columns.map((option) => (
                          <option key={option.status} value={option.status}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
                {tasksByStatus[column.status].length === 0 ? (
                  <p className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-500">
                    No tasks.
                  </p>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="h-[520px] rounded-xl border border-zinc-800 bg-zinc-950 p-2">
          <ReactFlow nodes={dependencyGraph.nodes} edges={dependencyGraph.edges} fitView>
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      )}
    </section>
  );
}
