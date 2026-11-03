import React, { useCallback, useEffect, useState } from 'react';
import { localDateStr } from '../lib/periodService.js';

/*
 * Recordatorios: sticky notes between team members (reminders.service.js). Private: each person sees only the notes
 * they wrote or received. Shown on the Dashboard, on top of #myentry (only when there are pending ones) and in full at
 * #reminders. The author edits / deletes; each recipient marks "Hecho" for themselves.
 */

export const NOTE_COLORS = {
  yellow: { bg: '#FFF6C9', edge: '#F1D46A', label: 'Amarillo' },
  blue: { bg: '#E3F1FB', edge: '#8CC8EA', label: 'Azul' },
  green: { bg: '#E4F5E9', edge: '#93D2A6', label: 'Verde' },
  pink: { bg: '#FCE6EE', edge: '#EFA3BD', label: 'Rosa' },
  purple: { bg: '#ECE8FB', edge: '#B4A7EC', label: 'Morado' },
};

const fmtDay = (ymd) => {
  const d = new Date(String(ymd) + 'T12:00:00');
  return isNaN(d) ? ymd : d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
};
const ago = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
};

function ReminderNote({ r, busy, onDone, onEdit, onDelete }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { IconButton, Icon } = DS;
  const c = NOTE_COLORS[r.color] || NOTE_COLORS.yellow;
  const today = localDateStr();
  const overdue = r.dueDate && r.dueDate < today && !r.done;
  const others = r.recipients.filter((x) => x.userId !== r.author.id || !r.mine);
  const to = r.recipients.length === 1 && r.recipients[0].userId === r.author.id ? 'Nota personal'
    : r.mine ? 'Para ' + r.recipients.map((x) => x.name.split(' ')[0]).join(', ')
      : 'De ' + r.author.name + (others.length > 1 ? ' • para ' + others.length + ' personas' : '');
  const doneCount = r.recipients.filter((x) => x.done).length;
  return (
    <div style={{ background: c.bg, borderTop: `4px solid ${c.edge}`, borderRadius: 10, padding: '12px 14px 10px', boxShadow: '0 1px 2px rgba(15,23,42,.08), 0 4px 10px rgba(15,23,42,.05)', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 130, opacity: r.done ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 11px/14px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>
        {Icon ? <Icon name={r.mine ? 'edit_note' : 'mail'} size={15} color="var(--mgh-ink-3)" /> : null}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.recipients.map((x) => x.name).join(', ')}>{to}</span>
        <span style={{ color: 'var(--mgh-ink-3)', fontWeight: 500 }}>{ago(r.createdAt)}</span>
      </div>
      <div style={{ flex: 1, font: '500 14px/20px var(--font-sans)', color: 'var(--mgh-ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', textDecoration: r.done ? 'line-through' : 'none' }}>{r.text}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {r.dueDate ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: overdue ? 'var(--mgh-danger)' : 'rgba(255,255,255,.7)', color: overdue ? '#fff' : 'var(--mgh-ink-2)', font: '600 11px/16px var(--font-sans)' }}>
          {Icon ? <Icon name="event" size={13} color={overdue ? '#fff' : 'var(--mgh-ink-3)'} /> : null}{overdue ? 'Vencido • ' : r.dueDate === today ? 'Hoy • ' : ''}{fmtDay(r.dueDate)}
        </span> : null}
        {r.mine && r.recipients.length > 1 ? <span style={{ font: '600 11px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }} title={r.recipients.map((x) => x.name + (x.done ? ' (hecho)' : '')).join(', ')}>{doneCount}/{r.recipients.length} hecho</span> : null}
        <span style={{ flex: 1 }} />
        {r.forMe ? <button type="button" disabled={busy} onClick={() => onDone(r, !r.done)} title={r.done ? 'Volver a pendiente' : 'Marcar como hecho'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(15,23,42,.15)', background: '#fff', cursor: busy ? 'default' : 'pointer', font: '600 12px/16px var(--font-sans)', color: r.done ? 'var(--mgh-ink-2)' : 'var(--mgh-success)' }}>
          {Icon ? <Icon name={r.done ? 'undo' : 'check'} size={14} color="currentColor" /> : null}{r.done ? 'Pendiente' : 'Hecho'}
        </button> : null}
        {r.mine && IconButton ? <IconButton icon="edit" size={28} title="Editar" onClick={() => { if (!busy) onEdit(r); }} /> : null}
        {r.mine && IconButton ? <IconButton icon="delete" size={28} title="Borrar" onClick={() => { if (!busy) onDelete(r); }} /> : null}
      </div>
    </div>
  );
}

function ReminderForm({ initial, people, busy, onSave, onClose }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button, Icon } = DS;
  const M = window.Modal;
  const myEmail = String(((window.MGH_RBAC && window.MGH_RBAC.user) || {}).email || '').toLowerCase();
  const me = people.find((p) => String(p.email || '').toLowerCase() === myEmail);
  const [text, setText] = useState(initial ? initial.text : '');
  const [color, setColor] = useState(initial ? initial.color : 'yellow');
  const [dueDate, setDueDate] = useState(initial && initial.dueDate ? initial.dueDate : '');
  const [to, setTo] = useState(() => new Set(initial ? initial.recipients.map((x) => x.userId) : []));
  const [q, setQ] = useState('');
  const toggle = (id) => setTo((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const shown = people.filter((p) => !q.trim() || `${p.name} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const chosen = people.filter((p) => to.has(p.id));
  const label = { font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--mgh-ink-3)', marginBottom: 6 };
  const input = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--mgh-surface-3,#D5DAE6)', font: '500 14px/20px var(--font-sans)', outline: 'none', background: '#fff' };
  const save = () => onSave({ text, color, dueDate: dueDate || null, recipients: [...to] });

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={label}>Recordatorio</div>
        <textarea autoFocus value={text} maxLength={500} rows={4} placeholder="Ej.: Recuerda pagar la nómina el viernes" onChange={(e) => setText(e.target.value)}
          style={{ ...input, resize: 'vertical', background: (NOTE_COLORS[color] || NOTE_COLORS.yellow).bg }} />
        <div style={{ textAlign: 'right', font: '500 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)', marginTop: 2 }}>{text.length}/500</div>
      </div>
      <div>
        <div style={label}>Para</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, minHeight: 28, alignItems: 'center' }}>
          {chosen.length ? chosen.map((p) => (
            <button key={p.id} type="button" onClick={() => toggle(p.id)} title="Quitar"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 10px', borderRadius: 999, border: 'none', background: 'var(--mgh-primary-50)', color: 'var(--mgh-primary)', font: '600 12px/18px var(--font-sans)', cursor: 'pointer' }}>
              {p.name}{me && p.id === me.id ? ' (yo)' : ''}{Icon ? <Icon name="close" size={14} color="currentColor" /> : null}
            </button>
          )) : <span style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>Nadie elegido: será una nota solo para ti.</span>}
        </div>
        <input type="search" placeholder="Buscar persona…" value={q} onChange={(e) => setQ(e.target.value)} style={input} />
        <div style={{ maxHeight: 190, overflowY: 'auto', marginTop: 6, border: '1px solid var(--mgh-surface-2)', borderRadius: 8 }}>
          {shown.length ? shown.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid var(--mgh-surface-1)', background: to.has(p.id) ? 'var(--mgh-primary-50)' : '#fff' }}>
              <input type="checkbox" checked={to.has(p.id)} onChange={() => toggle(p.id)} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{p.name}{me && p.id === me.id ? ' (yo)' : ''}</span>
                <span style={{ display: 'block', font: '500 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{p.email}</span>
              </span>
            </label>
          )) : <div style={{ padding: 12, font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>Nadie coincide con la búsqueda.</div>}
        </div>
        <div style={{ font: '500 11px/15px var(--font-sans)', color: 'var(--mgh-ink-3)', marginTop: 6 }}>Solo tú y las personas elegidas verán este recordatorio.</div>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={label}>Fecha (opcional)</div>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...input, width: 170 }} />
        </div>
        <div>
          <div style={label}>Color</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(NOTE_COLORS).map(([k, c]) => (
              <button key={k} type="button" title={c.label} aria-label={c.label} onClick={() => setColor(k)}
                style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: c.bg, border: `2px solid ${color === k ? 'var(--mgh-primary)' : c.edge}` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
  const actions = <>
    <Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
    <Button icon={initial ? 'save' : 'send'} disabled={busy || !text.trim()} onClick={save}>{initial ? 'Guardar' : chosen.length && !(chosen.length === 1 && me && chosen[0].id === me.id) ? 'Enviar recordatorio' : 'Guardar nota'}</Button>
  </>;
  return M ? <M open width={560} title={initial ? 'Editar recordatorio' : 'Nuevo recordatorio'} onClose={() => { if (!busy) onClose(); }} actions={actions}>{body}</M> : null;
}

/**
 * The board. compact: at most `limit` notes + "Ver todos" (Dashboard). hideWhenEmpty: render nothing without pending
 * notes (#myentry). Full page otherwise.
 */
export default function RemindersBoard({ notify = () => {}, go, compact = false, hideWhenEmpty = false, limit = 6 }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Card, Button } = DS;
  const [list, setList] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [people, setPeople] = useState(null);
  const [form, setForm] = useState(null); // { initial? }
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => window.api.reminders(showDone ? { done: '1' } : {})
    .then((r) => setList(Array.isArray(r) ? r : []))
    .catch(() => setList([])), [showDone]);
  useEffect(() => { load(); }, [load]);
  const openForm = (initial = null) => {
    setForm({ initial });
    if (!people) window.api.reminderPeople().then((p) => setPeople(Array.isArray(p) ? p : [])).catch((err) => { setPeople([]); notify('No se pudo cargar la lista de personas • ' + err.message); });
  };
  const run = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) notify(msg); await load(); return true; }
    catch (err) { notify(err.message); return false; }
    finally { setBusy(false); }
  };
  const save = async (data) => {
    const f = form.initial;
    if (await run(() => (f ? window.api.updateReminder(f.id, data) : window.api.createReminder(data)), f ? 'Recordatorio actualizado' : data.recipients.length ? 'Recordatorio enviado' : 'Nota guardada')) setForm(null);
  };
  const onDone = (r, done) => run(() => window.api.setReminderDone(r.id, done), done ? 'Marcado como hecho' : 'De vuelta a pendientes');
  const onDelete = (r) => { if (window.confirm('¿Borrar este recordatorio? Desaparece también para las personas a las que lo enviaste.')) run(() => window.api.deleteReminder(r.id), 'Recordatorio borrado'); };

  const pending = (list || []).filter((r) => !r.done).length;
  const forMe = (list || []).filter((r) => r.forMe && !r.done && !r.mine).length;
  if (hideWhenEmpty && (!list || !pending)) return null;
  const shown = compact ? (list || []).slice(0, limit) : (list || []);

  const subtitle = list == null ? 'Cargando…'
    : !list.length ? (showDone ? 'No hay recordatorios.' : 'Sin recordatorios pendientes.')
      : `${pending} pendiente${pending === 1 ? '' : 's'}${forMe ? ` • ${forMe} que te dejaron` : ''} • solo los ves tú y a quienes van dirigidos`;
  const actions = <>
    {!compact ? <Button size="sm" variant="ghost" icon={showDone ? 'visibility_off' : 'task_alt'} onClick={() => setShowDone((x) => !x)}>{showDone ? 'Ocultar hechos' : 'Ver hechos'}</Button> : null}
    {compact && go && list && list.length > limit ? <Button size="sm" variant="ghost" iconRight="arrow_forward" onClick={() => go('reminders')}>Ver todos ({list.length})</Button> : null}
    <Button size="sm" icon="add" onClick={() => openForm()}>Nuevo recordatorio</Button>
  </>;

  return (
    <>
      <Card icon="sticky_note_2" title="Recordatorios" subtitle={subtitle} actions={actions}>
        {list && list.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14 }}>
            {shown.map((r) => <ReminderNote key={r.id} r={r} busy={busy} onDone={onDone} onEdit={(x) => openForm(x)} onDelete={onDelete} />)}
          </div>
        ) : list ? (
          <div style={{ padding: '22px 0', textAlign: 'center', color: 'var(--mgh-ink-3)', font: '500 13px/20px var(--font-sans)' }}>
            Deja una nota para ti o para alguien del equipo: "Recuerda pagar la nómina", "Sube los cambios a producción"…
          </div>
        ) : null}
      </Card>
      {form ? (people
        ? <ReminderForm initial={form.initial} people={people} busy={busy} onSave={save} onClose={() => setForm(null)} />
        : null) : null}
    </>
  );
}

/** #reminders: the full board */
export function RemindersPage({ notify, go }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { PageHeader } = DS;
  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600 }}>
      <PageHeader breadcrumbs={['Overview', 'Recordatorios']} title="Recordatorios" description="Notas para ti o para otras personas del equipo. Cada persona ve solo las que escribió o las que le dejaron." />
      <RemindersBoard notify={notify} go={go} />
    </div>
  );
}
