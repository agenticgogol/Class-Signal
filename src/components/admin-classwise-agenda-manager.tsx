"use client";

import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { ClasswiseAgendaEntry } from "@/lib/classwise-agenda/types";

type FormState = { loading: boolean; error?: string; errors?: Record<string, string> };

export function AdminClasswiseAgendaManager({ initialEntries, migrationRequired }: { initialEntries: ClasswiseAgendaEntry[]; migrationRequired: boolean }) {
  const [entries, setEntries] = useState(initialEntries);
  const [editing, setEditing] = useState<ClasswiseAgendaEntry | "new" | null>(null);
  const [formState, setFormState] = useState<FormState>({ loading: false });

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState({ loading: true });
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const payload = { ...values, is_visible: form.querySelector<HTMLInputElement>("[name=is_visible]")?.checked ?? true };
    const isNew = editing === "new";
    const id = isNew ? null : (editing as ClasswiseAgendaEntry).id;
    try {
      const response = await fetch(isNew ? "/api/admin/classwise-agenda" : `/api/admin/classwise-agenda/${id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { entry?: ClasswiseAgendaEntry; message?: string; errors?: Record<string, string> };
      if (!response.ok || !result.entry) {
        setFormState({ loading: false, error: result.message ?? "Agenda entry could not be saved.", errors: result.errors });
        return;
      }
      setEntries((current) => {
        const withoutEntry = current.filter((entry) => entry.id !== result.entry!.id);
        return [...withoutEntry, result.entry!].sort((left, right) => left.class_number.localeCompare(right.class_number, undefined, { numeric: true }));
      });
      setFormState({ loading: false });
      setEditing(null);
    } catch {
      setFormState({ loading: false, error: "Agenda entry could not be saved." });
    }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this agenda entry? Students will no longer see it.")) return;
    const response = await fetch(`/api/admin/classwise-agenda/${id}`, { method: "DELETE" });
    if (response.ok) setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  async function toggleVisibility(entry: ClasswiseAgendaEntry) {
    const response = await fetch(`/api/admin/classwise-agenda/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_name: entry.course_name, class_number: entry.class_number, class_date: entry.class_date, concepts: entry.concepts, hands_on: entry.hands_on, is_visible: !entry.is_visible }),
    });
    const result = await response.json() as { entry?: ClasswiseAgendaEntry };
    if (response.ok && result.entry) setEntries((current) => current.map((item) => item.id === entry.id ? result.entry! : item));
  }

  return (
    <div className="admin-classwise-agenda">
      <header className="admin-page__header"><div><div className="admin-page__eyebrow">Course content</div><h1>Classwise Agenda</h1><p>Publish concepts and hands-on plans for each class. Students see only visible entries.</p></div><Button onClick={() => setEditing("new")}><Plus size={16} /> Add class</Button></header>

      {migrationRequired && <p className="form-alert">Run the latest Supabase migration to enable the classwise agenda.</p>}

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <section className="ask-question-modal" role="dialog" aria-modal="true">
            <button className="reset-board-modal__close" onClick={() => setEditing(null)} aria-label="Close"><X /></button>
            <h2>{editing === "new" ? "Add class" : `Edit class ${editing.class_number}`}</h2>
            <form className="admin-agenda-form" onSubmit={submitEntry}>
              <label>Course name<input name="course_name" defaultValue={editing === "new" ? "" : editing.course_name} required maxLength={160} /></label>
              {formState.errors?.course_name && <p className="form-alert">{formState.errors.course_name}</p>}
              <label>Class number<input name="class_number" defaultValue={editing === "new" ? "" : editing.class_number} required maxLength={50} /></label>
              {formState.errors?.class_number && <p className="form-alert">{formState.errors.class_number}</p>}
              <label>Class date<input type="date" name="class_date" defaultValue={editing === "new" ? "" : editing.class_date ?? ""} /></label>
              <label>Concepts (markdown)<textarea name="concepts" rows={6} defaultValue={editing === "new" ? "" : editing.concepts ?? ""} /></label>
              <label>Hands-On (markdown)<textarea name="hands_on" rows={6} defaultValue={editing === "new" ? "" : editing.hands_on ?? ""} /></label>
              <label className="anonymous-toggle"><input type="checkbox" name="is_visible" defaultChecked={editing === "new" ? true : editing.is_visible} /> Visible to students</label>
              {formState.error && <p className="form-alert" role="alert">{formState.error}</p>}
              <div><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={formState.loading}>{formState.loading ? "Saving…" : "Save"}</Button></div>
            </form>
          </section>
        </div>
      )}

      <div className="classwise-agenda__list">
        {entries.length === 0 && <div className="board-empty"><h2>No classes added yet</h2><p>Add your first class to start publishing the agenda.</p></div>}
        {entries.map((entry) => (
          <article key={entry.id} className="classwise-agenda__entry">
            <header>
              <span>Class {entry.class_number}{entry.class_date ? ` · ${entry.class_date}` : ""}</span>
              <div>
                <button type="button" onClick={() => void toggleVisibility(entry)} title={entry.is_visible ? "Hide from students" : "Show to students"}>{entry.is_visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                <button type="button" onClick={() => setEditing(entry)} title="Edit"><Pencil size={15} /></button>
                <button type="button" onClick={() => void deleteEntry(entry.id)} title="Delete"><Trash2 size={15} /></button>
              </div>
            </header>
            {entry.concepts && <div><h3>Concepts</h3><p>{entry.concepts}</p></div>}
            {entry.hands_on && <div><h3>Hands-On</h3><p>{entry.hands_on}</p></div>}
          </article>
        ))}
      </div>
    </div>
  );
}
