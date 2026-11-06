import React, { useState } from 'react';

/*
 * QA workflow pieces shared by #mytasks, #projects (MyProjects) and the PM board (AgileWorkspace).
 * Statuses carry qa_step: 'ready' = "Listo para QA", 'bug' = "Bug encontrado" (tasks expose it as status_qa_step).
 * Whoever did the task sends it to "Listo para QA"; another project member (or a PM) takes it to "Completado" or to
 * "Bug encontrado" with a note. Rules are enforced by the backend (agileService.checkStatusChange).
 */

export const isQaReady = (t) => t && t.status_qa_step === 'ready';
export const isQaBug = (t) => t && t.status_qa_step === 'bug';

/** The QA note on a task sent back with a bug: what is missing or broken, and who found it */
export function QaBugNote({ t, style }) {
  if (!isQaBug(t) || !t.qa_note) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: 'rgba(220,38,38,.07)', border: '1px solid rgba(220,38,38,.3)', font: '500 12px/17px var(--font-sans)', color: 'var(--mgh-ink)', ...style }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--mgh-danger,#dc2626)' }}>bug_report</span>
      <span><b>Bug encontrado{t.qa_by ? ` por ${t.qa_by}` : ''}:</b> <span style={{ whiteSpace: 'pre-wrap' }}>{t.qa_note}</span></span>
    </div>
  );
}

/** Asks for the bug note. onConfirm(note) may be async; errors are shown by the caller's notify */
export function QaNoteModal({ task, onCancel, onConfirm }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button } = DS;
  const M = window.Modal;
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  if (!task || !M) return null;
  const send = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try { await onConfirm(note.trim()); } finally { setSaving(false); }
  };
  return (
    <M open width={520} title={`Bug encontrado • ${task.task_key}`} onClose={() => { if (!saving) onCancel(); }}
      actions={<>
        <Button variant="outline" disabled={saving} onClick={onCancel}>Cancelar</Button>
        <Button icon="bug_report" disabled={saving || !note.trim()} onClick={send}>{saving ? 'Enviando…' : 'Devolver con bug'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="mgh-body" style={{ color: 'var(--mgh-ink-2)' }}>
          <b>{task.title}</b>{task.assignee_name ? ` • ${task.assignee_name}` : ''}. La tarea vuelve a quien la hizo con esta nota.
        </div>
        <label htmlFor="qa-note" style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>¿Qué falta o qué bug encontraste? (obligatorio)</label>
        <textarea id="qa-note" rows={5} autoFocus value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Pasos para reproducirlo, qué esperabas y qué pasó…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--mgh-surface-3,#D5DAE6)', font: '500 13px/18px var(--font-sans)', resize: 'vertical', outline: 'none' }} />
      </div>
    </M>
  );
}

/** "Completado" / "Bug encontrado" buttons for a task in "Listo para QA" (POST /tasks/:id/qa) */
export function QaReviewButtons({ t, notify, onDone }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button } = DS;
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const review = async (result, note) => {
    setBusy(true);
    try {
      const updated = await window.api.qaReview(t.id, result, note);
      if (notify) notify(result === 'bug' ? `${t.task_key} devuelta con bug` : `${t.task_key} completada`);
      setAsking(false);
      if (onDone) onDone(updated);
    } catch (err) {
      if (notify) notify('No se pudo guardar la revisión • ' + err.message);
    } finally {
      setBusy(false);
    }
  };
  if (!Button) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <Button size="sm" icon="task_alt" disabled={busy} onClick={() => review('passed')}>Completado</Button>
      <Button size="sm" variant="outline" icon="bug_report" disabled={busy} onClick={() => setAsking(true)}>Bug encontrado</Button>
      {asking ? <QaNoteModal task={t} onCancel={() => setAsking(false)} onConfirm={(note) => review('bug', note)} /> : null}
    </span>
  );
}
