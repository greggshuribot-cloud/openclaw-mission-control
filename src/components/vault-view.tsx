"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type VaultKind = "PITCH" | "LEGAL" | "NOTE";

type VaultDoc = {
  id: string;
  userId: string;
  title: string;
  kind: VaultKind;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type VaultTemplate = {
  label: string;
  title: string;
  kind: VaultKind;
  content: string;
};

const kindOptions: VaultKind[] = ["PITCH", "LEGAL", "NOTE"];

const templates: VaultTemplate[] = [
  {
    label: "Live Pitch Deck",
    title: "Live Pitch Deck",
    kind: "PITCH",
    content: [
      "# Live Pitch Deck",
      "",
      "## Problem",
      "- What pain are we solving?",
      "",
      "## Solution",
      "- Product overview",
      "",
      "## Market",
      "- ICP",
      "- TAM/SAM/SOM",
      "",
      "## Traction",
      "- Milestones",
      "- Revenue/engagement",
      "",
      "## Ask",
      "- Funding amount",
      "- Use of funds",
    ].join("\n"),
  },
  {
    label: "Terms of Service Draft",
    title: "Terms of Service Draft",
    kind: "LEGAL",
    content: [
      "# Terms of Service Draft",
      "",
      "Effective Date: [Insert Date]",
      "",
      "1. Acceptance of Terms",
      "2. Description of Services",
      "3. User Obligations",
      "4. Fees and Billing",
      "5. Intellectual Property",
      "6. Disclaimers and Limitation of Liability",
      "7. Termination",
      "8. Governing Law",
    ].join("\n"),
  },
];

function formatKind(kind: VaultKind): string {
  return kind.toLowerCase();
}

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

export function VaultView() {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<VaultKind>("NOTE");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftKind, setDraftKind] = useState<VaultKind>("NOTE");
  const [draftContent, setDraftContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadDocs = useCallback(async (query?: string) => {
    const url = query?.trim() ? `/api/vault/docs?q=${encodeURIComponent(query.trim())}` : "/api/vault/docs";

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to load documents.");
    }

    const payload = (await response.json()) as { docs: VaultDoc[] };
    setDocs(payload.docs);

    setSelectedDocId((current) => {
      if (!payload.docs.length) {
        return null;
      }

      if (current && payload.docs.some((doc) => doc.id === current)) {
        return current;
      }

      return payload.docs[0].id;
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await loadDocs();
      } catch (error) {
        if (active) {
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Failed to load documents.",
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
  }, [loadDocs]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        await loadDocs(search);
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to search documents.",
        });
      }
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [search, loadDocs, loading]);

  const selectedDoc = useMemo(() => docs.find((doc) => doc.id === selectedDocId) ?? null, [docs, selectedDocId]);

  useEffect(() => {
    if (!selectedDoc) {
      setDraftTitle("");
      setDraftKind("NOTE");
      setDraftContent("");
      return;
    }

    setDraftTitle(selectedDoc.title);
    setDraftKind(selectedDoc.kind);
    setDraftContent(selectedDoc.content);
  }, [selectedDoc]);

  async function handleCreateDoc(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/vault/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, kind: newKind, content: "" }),
      });

      const payload = (await response.json()) as { error?: string; doc?: VaultDoc };

      if (!response.ok || !payload.doc) {
        throw new Error(payload.error ?? "Failed to create document.");
      }

      setNewTitle("");
      setNewKind("NOTE");
      await loadDocs(search);
      setSelectedDocId(payload.doc.id);
      setNotice({ type: "success", message: "Document created." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to create document.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateFromTemplate(template: VaultTemplate) {
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/vault/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.title,
          kind: template.kind,
          content: template.content,
        }),
      });

      const payload = (await response.json()) as { error?: string; doc?: VaultDoc };

      if (!response.ok || !payload.doc) {
        throw new Error(payload.error ?? "Failed to apply template.");
      }

      await loadDocs(search);
      setSelectedDocId(payload.doc.id);
      setNotice({ type: "success", message: `Template created: ${template.label}.` });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to apply template.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    if (!selectedDoc) {
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/vault/docs/${selectedDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          kind: draftKind,
          content: draftContent,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save document.");
      }

      await loadDocs(search);
      setNotice({ type: "success", message: "Document saved." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save document.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedDoc) {
      return;
    }

    setDeleting(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/vault/docs/${selectedDoc.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        let message = "Failed to delete document.";
        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as { error?: string };
          message = payload.error ?? message;
        }

        throw new Error(message);
      }

      await loadDocs(search);
      setNotice({ type: "success", message: "Document deleted." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete document.",
      });
    } finally {
      setDeleting(false);
    }
  }

  const hasChanges =
    !!selectedDoc &&
    (selectedDoc.title !== draftTitle || selectedDoc.kind !== draftKind || selectedDoc.content !== draftContent);

  return (
    <section className="grid gap-4">
      <form onSubmit={handleCreateDoc} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Create Document</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Title"
            required
            maxLength={200}
            className="md:col-span-3 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <select
            value={newKind}
            onChange={(event) => setNewKind(event.target.value as VaultKind)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          >
            {kindOptions.map((option) => (
              <option key={option} value={option}>
                {formatKind(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {templates.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => handleCreateFromTemplate(template)}
              disabled={submitting}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Use template: {template.label}
            </button>
          ))}
          <button
            type="submit"
            disabled={submitting}
            className="ml-auto rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create document"}
          </button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">Vault Documents</h3>
            <div className="text-xs text-zinc-500">{docs.length} total</div>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title/content"
            className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />

          <div className="mt-3 max-h-[520px] overflow-y-auto pr-1">
            {loading && <p className="py-6 text-center text-sm text-zinc-500">Loading documents...</p>}

            {!loading && docs.length === 0 && (
              <p className="py-6 text-center text-sm text-zinc-500">No documents found for current search.</p>
            )}

            {!loading &&
              docs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`mb-2 w-full rounded-lg border p-3 text-left ${
                    selectedDocId === doc.id
                      ? "border-zinc-200 bg-zinc-100/10"
                      : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-zinc-100">{doc.title}</p>
                    <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                      {formatKind(doc.kind)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Updated {formatRelativeTime(doc.updatedAt)}</p>
                </button>
              ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          {!selectedDoc && <p className="text-sm text-zinc-500">Select or create a document to start editing.</p>}

          {selectedDoc && (
            <div>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  maxLength={200}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
                <select
                  value={draftKind}
                  onChange={(event) => setDraftKind(event.target.value as VaultKind)}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                >
                  {kindOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatKind(option)}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                placeholder="Document content"
                className="mt-3 h-[420px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
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
