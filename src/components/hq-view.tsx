"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PromptTemplateRecord = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  _count: {
    agents: number;
  };
};

type AgentRecord = {
  id: string;
  role: string;
  status: string;
  currentLocation: string;
  promptTemplateId: string | null;
  promptTemplate: {
    id: string;
    name: string;
  } | null;
};

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(diffMs / 1000 / 60);

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function formatLabel(value: string): string {
  return value.toLowerCase().replaceAll("_", " ");
}

export function HqView() {
  const [templates, setTemplates] = useState<PromptTemplateRecord[]>([]);
  const [allTemplates, setAllTemplates] = useState<PromptTemplateRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assigningAgentId, setAssigningAgentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadTemplates = useCallback(async (query?: string) => {
    const url = query?.trim() ? `/api/hq/prompt-templates?q=${encodeURIComponent(query.trim())}` : "/api/hq/prompt-templates";

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to load prompt templates.");
    }

    const payload = (await response.json()) as { templates: PromptTemplateRecord[] };
    setTemplates(payload.templates);

    setSelectedId((current) => {
      if (!payload.templates.length) {
        return null;
      }

      if (current && payload.templates.some((template) => template.id === current)) {
        return current;
      }

      return payload.templates[0].id;
    });
  }, []);

  const loadAllTemplates = useCallback(async () => {
    const response = await fetch("/api/hq/prompt-templates", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to load prompt templates.");
    }

    const payload = (await response.json()) as { templates: PromptTemplateRecord[] };
    setAllTemplates(payload.templates);
  }, []);

  const loadAgents = useCallback(async () => {
    const response = await fetch("/api/hq/agents", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to load agents.");
    }

    const payload = (await response.json()) as { agents: AgentRecord[] };
    setAgents(payload.agents);
  }, []);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await Promise.all([loadTemplates(), loadAllTemplates(), loadAgents()]);
      } catch (error) {
        if (active) {
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Failed to load HQ data.",
          });
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
  }, [loadTemplates, loadAllTemplates, loadAgents]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        await loadTemplates(search);
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to search prompt templates.",
        });
      }
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [search, loadTemplates, loading]);

  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedId) ?? null, [templates, selectedId]);

  useEffect(() => {
    if (!selectedTemplate) {
      setDraftName("");
      setDraftContent("");
      return;
    }

    setDraftName(selectedTemplate.name);
    setDraftContent(selectedTemplate.content);
  }, [selectedTemplate]);

  const hasChanges = !!selectedTemplate && (selectedTemplate.name !== draftName || selectedTemplate.content !== draftContent);

  const sortedAgents = useMemo(() => [...agents].sort((a, b) => a.role.localeCompare(b.role)), [agents]);

  async function refreshHqData() {
    await Promise.all([loadTemplates(search), loadAllTemplates(), loadAgents()]);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setNotice(null);

    try {
      const response = await fetch("/api/hq/prompt-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, content: newContent }),
      });

      const payload = (await response.json()) as { error?: string; template?: PromptTemplateRecord };

      if (!response.ok || !payload.template) {
        throw new Error(payload.error ?? "Failed to create prompt template.");
      }

      setNewName("");
      setNewContent("");
      await Promise.all([loadTemplates(search), loadAllTemplates()]);
      setSelectedId(payload.template.id);
      setNotice({ type: "success", message: `Template \"${payload.template.name}\" created.` });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to create prompt template.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!selectedTemplate) {
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/hq/prompt-templates/${selectedTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName, content: draftContent }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save prompt template.");
      }

      await Promise.all([loadTemplates(search), loadAllTemplates()]);
      setNotice({ type: "success", message: `Template \"${draftName.trim()}\" saved.` });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save prompt template.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedTemplate) {
      return;
    }

    const templateName = selectedTemplate.name;

    setDeleting(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/hq/prompt-templates/${selectedTemplate.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        let message = "Failed to delete prompt template.";
        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as { error?: string };
          message = payload.error ?? message;
        }

        throw new Error(message);
      }

      await refreshHqData();
      setNotice({ type: "success", message: `Template \"${templateName}\" deleted.` });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete prompt template.",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleAssignmentChange(agentId: string, promptTemplateId: string | null) {
    const targetAgent = agents.find((agent) => agent.id === agentId);

    if (!targetAgent) {
      setNotice({ type: "error", message: "Agent not found." });
      return;
    }

    if (targetAgent.promptTemplateId === promptTemplateId) {
      return;
    }

    setAssigningAgentId(agentId);
    setNotice(null);

    const previousAgent = targetAgent;
    const nextTemplate = allTemplates.find((template) => template.id === promptTemplateId) ?? null;

    setAgents((current) =>
      current.map((agent) => {
        if (agent.id !== agentId) {
          return agent;
        }

        return {
          ...agent,
          promptTemplateId,
          promptTemplate: nextTemplate ? { id: nextTemplate.id, name: nextTemplate.name } : null,
        };
      }),
    );

    try {
      const response = await fetch(`/api/hq/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptTemplateId }),
      });

      const payload = (await response.json()) as { error?: string; agent?: AgentRecord };

      if (!response.ok || !payload.agent) {
        throw new Error(payload.error ?? "Failed to assign prompt template.");
      }

      await refreshHqData();

      const templateLabel = nextTemplate ? `\"${nextTemplate.name}\"` : "Unassigned";
      setNotice({
        type: "success",
        message: `${formatLabel(targetAgent.role)} now uses ${templateLabel}.`,
      });
    } catch (error) {
      setAgents((current) =>
        current.map((agent) => {
          if (agent.id !== agentId) {
            return agent;
          }

          return previousAgent;
        }),
      );
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to assign prompt template.",
      });
    } finally {
      setAssigningAgentId(null);
    }
  }

  return (
    <section className="grid gap-4">
      <form onSubmit={handleCreate} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Create Prompt Template</h3>
        <div className="mt-3 grid gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Template name"
            required
            maxLength={120}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <textarea
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            placeholder="System prompt content"
            required
            className="h-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create template"}
          </button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">Prompt Templates</h3>
            <div className="text-xs text-zinc-500">{templates.length} total</div>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name/content"
            className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />

          <div className="mt-3 max-h-[520px] overflow-y-auto pr-1">
            {loading && <p className="py-6 text-center text-sm text-zinc-500">Loading templates...</p>}
            {!loading && templates.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-500">No templates found for current search.</p>
            )}

            {!loading &&
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedId(template.id)}
                  className={`mb-2 w-full rounded-lg border p-3 text-left ${
                    selectedId === template.id
                      ? "border-zinc-200 bg-zinc-100/10"
                      : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-zinc-100">{template.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">Created {formatRelativeTime(template.createdAt)}</p>
                  <p className="mt-1 text-xs text-zinc-400">Assigned agents: {template._count.agents}</p>
                </button>
              ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            {!selectedTemplate && <p className="text-sm text-zinc-500">Select or create a template to start editing.</p>}

            {selectedTemplate && (
              <div>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  maxLength={120}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
                <textarea
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                  className="mt-3 h-[320px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded border border-rose-800 bg-rose-950/30 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">Agent Template Assignment</h3>
              <span className="text-xs text-zinc-500">{agents.length} agents</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Assign templates per agent. Search filtering above will not hide assignment choices.</p>
            {!loading && allTemplates.length === 0 && (
              <p className="mt-2 text-xs text-amber-300">Create a template first to assign one.</p>
            )}

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-2 py-2">Agent Role</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Location</th>
                    <th className="px-2 py-2">Prompt Template</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent) => (
                    <tr key={agent.id} className="border-b border-zinc-900/80 text-zinc-200">
                      <td className="px-2 py-2 text-zinc-100">{formatLabel(agent.role)}</td>
                      <td className="px-2 py-2 text-zinc-300">{formatLabel(agent.status)}</td>
                      <td className="px-2 py-2 text-zinc-300">{agent.currentLocation}</td>
                      <td className="px-2 py-2">
                        <select
                          value={agent.promptTemplateId ?? ""}
                          disabled={loading || assigningAgentId === agent.id}
                          onChange={(event) => handleAssignmentChange(agent.id, event.target.value || null)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-60"
                        >
                          <option value="">Unassigned</option>
                          {agent.promptTemplateId && !allTemplates.some((template) => template.id === agent.promptTemplateId) && (
                            <option value={agent.promptTemplateId}>Current template unavailable</option>
                          )}
                          {allTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}

                  {!loading && sortedAgents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-6 text-center text-sm text-zinc-500">
                        No agents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            notice.type === "success"
              ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
              : "border-rose-800 bg-rose-950/30 text-rose-200"
          }`}
        >
          {notice.message}
        </div>
      )}
    </section>
  );
}
