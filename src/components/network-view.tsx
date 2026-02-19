"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ContactStatus = "LEAD" | "CONTACTED" | "CLOSED";

type ContactRecord = {
  id: string;
  name: string;
  email: string;
  source: string;
  status: ContactStatus;
  createdAt: string;
  ownerAgent: {
    id: string;
    role: string;
    status: string;
    currentLocation: string;
  } | null;
};

const statusOptions: ContactStatus[] = ["LEAD", "CONTACTED", "CLOSED"];

function formatStatus(status: ContactStatus): string {
  return status.toLowerCase();
}

function formatOwner(role: string | null): string {
  if (!role) {
    return "Unassigned";
  }

  return role.toLowerCase().replaceAll("_", " ");
}

export function NetworkView() {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<ContactStatus>("LEAD");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ContactStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [enrichmentById, setEnrichmentById] = useState<Record<string, string>>({});

  const loadContacts = useCallback(async () => {
    setError(null);

    const response = await fetch("/api/crm/contacts", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to load contacts.");
    }

    const payload = (await response.json()) as { contacts: ContactRecord[] };
    setContacts(payload.contacts);
    setEnrichmentById((current) => {
      const next: Record<string, string> = {};

      for (const contact of payload.contacts) {
        if (current[contact.id]) {
          next[contact.id] = current[contact.id];
        }
      }

      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await loadContacts();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load contacts.");
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
  }, [loadContacts]);

  const filteredContacts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return contacts.filter((contact) => {
      if (statusFilter !== "ALL" && contact.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${contact.name} ${contact.email}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [contacts, search, statusFilter]);

  async function handleCreateContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, source, status }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create contact.");
      }

      setName("");
      setEmail("");
      setSource("");
      setStatus("LEAD");
      await loadContacts();
      setNotice({ type: "success", message: "Contact created." });
    } catch (submitError) {
      setNotice({
        type: "error",
        message: submitError instanceof Error ? submitError.message : "Failed to create contact.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(contactId: string, nextStatus: ContactStatus) {
    const original = contacts.find((contact) => contact.id === contactId);

    if (!original || original.status === nextStatus) {
      return;
    }

    setMutatingId(contactId);
    setError(null);
    setNotice(null);

    setContacts((current) =>
      current.map((contact) => (contact.id === contactId ? { ...contact, status: nextStatus } : contact)),
    );

    try {
      const response = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update contact status.");
      }

      setNotice({ type: "success", message: "Contact status updated." });
      await loadContacts();
    } catch (updateError) {
      setContacts((current) => current.map((contact) => (contact.id === contactId ? original : contact)));
      setNotice({
        type: "error",
        message: updateError instanceof Error ? updateError.message : "Failed to update contact status.",
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(contactId: string) {
    setMutatingId(contactId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        let message = "Failed to delete contact.";
        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as { error?: string };
          message = payload.error ?? message;
        }

        throw new Error(message);
      }

      setContacts((current) => current.filter((contact) => contact.id !== contactId));
      setEnrichmentById((current) => {
        const next = { ...current };
        delete next[contactId];
        return next;
      });
      setNotice({ type: "success", message: "Contact deleted." });
    } catch (deleteError) {
      setNotice({
        type: "error",
        message: deleteError instanceof Error ? deleteError.message : "Failed to delete contact.",
      });
    } finally {
      setMutatingId(null);
    }
  }

  function handleEnrich(contactId: string) {
    setEnrichmentById((current) => ({
      ...current,
      [contactId]: "Strategist enrichment queued",
    }));

    setNotice({
      type: "success",
      message: "Strategist enrichment placeholder applied locally.",
    });
  }

  return (
    <section className="grid gap-4">
      <form onSubmit={handleCreateContact} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Create Contact</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            required
            maxLength={120}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            type="email"
            maxLength={320}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Source"
            required
            maxLength={120}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ContactStatus)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {formatStatus(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create contact"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Network</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name/email"
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ALL" | ContactStatus)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              <option value="ALL">all statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Owner</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((contact) => {
                const enrichmentNote = enrichmentById[contact.id];
                const displaySource = enrichmentNote ? `${contact.source} (enriched)` : contact.source;

                return (
                  <tr key={contact.id} className="border-b border-zinc-900/80 text-zinc-200">
                    <td className="px-2 py-2">
                      <div className="font-medium text-zinc-100">{contact.name}</div>
                      {enrichmentNote && <div className="text-xs text-sky-300">{enrichmentNote}</div>}
                    </td>
                    <td className="px-2 py-2 text-zinc-300">{contact.email}</td>
                    <td className="px-2 py-2 text-zinc-300">{displaySource}</td>
                    <td className="px-2 py-2">
                      <select
                        value={contact.status}
                        disabled={mutatingId === contact.id}
                        onChange={(event) => handleStatusChange(contact.id, event.target.value as ContactStatus)}
                        className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-60"
                      >
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>
                            {formatStatus(option)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-zinc-300">{formatOwner(contact.ownerAgent?.role ?? null)}</td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={mutatingId === contact.id}
                          onClick={() => handleEnrich(contact.id)}
                          className="rounded border border-sky-800 bg-sky-950/30 px-2 py-1 text-xs text-sky-200 hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Enrich
                        </button>
                        <button
                          type="button"
                          disabled={mutatingId === contact.id}
                          onClick={() => handleDelete(contact.id)}
                          className="rounded border border-rose-800 bg-rose-950/30 px-2 py-1 text-xs text-rose-200 hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-sm text-zinc-500">
                    No contacts found for current filters.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-sm text-zinc-500">
                    Loading contacts...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            notice?.type === "success"
              ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
              : "border-rose-800 bg-rose-950/30 text-rose-200"
          }`}
        >
          {notice?.message ?? error}
        </div>
      )}
    </section>
  );
}
