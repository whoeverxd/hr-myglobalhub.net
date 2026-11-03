import React, { useCallback, useEffect, useState } from 'react';

/** Active banks of the catalog (null while loading, [] when the catalog is empty or unreachable) */
export function useBankCatalog() {
  const [banks, setBanks] = useState(null);
  useEffect(() => { let off = false; window.api.banks().then((b) => { if (!off) setBanks(Array.isArray(b) ? b : []); }).catch(() => { if (!off) setBanks([]); }); return () => { off = true; }; }, []);
  return banks;
}

/** Select options from the catalog; a stored bank that is not (or no longer) in it stays selectable as "(actual)" */
export function bankOptions(banks, current, placeholder = 'Elige un banco…') {
  const names = (banks || []).map((b) => b.name);
  const cur = String(current || '').trim();
  return [{ value: '', label: placeholder }, ...(cur && !names.includes(cur) ? [{ value: cur, label: cur + ' (actual)' }] : []), ...names.map((n) => ({ value: n, label: n }))];
}

export const BANK_HINT = '¿No está el banco? Un administrador, HR o finanzas lo añade en el menú Bancos.';

/*
 * #banks "Bancos": the catalog people pick from in "Datos de pago" → Banco (banks.service.js).
 * Admin / HR / finance add, rename and (de)activate banks. A bank is never deleted: deactivating it stops offering it
 * for new registrations while existing methods keep it.
 */
export default function BanksAdmin({ notify }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Card, Button, Badge } = DS;
  const [list, setList] = useState(null);
  const [draft, setDraft] = useState({ name: '', swift: '', country: 'República Dominicana' });
  const [edit, setEdit] = useState(null); // { id, name, swift, country }
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => window.api.banks({ all: '1' }).then((b) => setList(Array.isArray(b) ? b : [])).catch((err) => { setList([]); notify('No se pudieron cargar los bancos • ' + err.message); }), []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn, msg) => {
    setBusy(true);
    try { const r = await fn(); if (msg) notify(typeof msg === 'function' ? msg(r) : msg); await load(); return true; }
    catch (err) { notify(err.message); return false; }
    finally { setBusy(false); }
  };
  const add = async () => {
    if (!draft.name.trim()) { notify('Escribe el nombre del banco'); return; }
    if (await run(() => window.api.createBank(draft), (b) => `${b.name} añadido: ya se puede elegir en "Datos de pago"`)) setDraft({ name: '', swift: '', country: draft.country });
  };
  const save = async () => { if (await run(() => window.api.updateBank(edit.id, edit), 'Banco actualizado')) setEdit(null); };

  const rows = (list || []).filter((b) => !q.trim() || `${b.name} ${b.swift} ${b.country}`.toLowerCase().includes(q.trim().toLowerCase()));
  const input = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3,#D5DAE6)', font: '500 13px/18px var(--font-sans)', outline: 'none', background: '#fff', minWidth: 0 };
  const td = { padding: '8px 10px', borderTop: '1px solid var(--mgh-surface-2)', font: '500 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' };

  return (
    <Card icon="account_balance" title="Bancos"
      subtitle={list == null ? 'Cargando…' : `Los bancos que se pueden elegir en "Datos de pago" • ${list.filter((b) => b.active).length} activo${list.filter((b) => b.active).length === 1 ? '' : 's'}. Un banco desactivado deja de ofrecerse, pero quien ya lo tiene lo conserva.`}
      actions={list && list.length ? <input type="search" placeholder="Buscar banco…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...input, width: 200 }} /> : null}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="Nombre del banco (ej.: Qik Banco Digital)" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} style={{ ...input, flex: 2, minWidth: 220 }} />
        <input placeholder="SWIFT (opcional)" value={draft.swift} onChange={(e) => setDraft((d) => ({ ...d, swift: e.target.value }))} style={{ ...input, width: 150, fontFamily: 'var(--font-mono)' }} />
        <input placeholder="País" value={draft.country} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))} style={{ ...input, width: 190 }} />
        <Button size="sm" icon="add" disabled={busy} onClick={add}>Añadir banco</Button>
        {list && !list.length ? <Button size="sm" variant="secondary" icon="playlist_add" disabled={busy} onClick={() => run(() => window.api.addDominicanBanks(), (r) => `${(r.added || []).length} bancos dominicanos añadidos`)}>Cargar bancos de RD</Button> : null}
      </div>
      {list && !list.length ? <div className="mgh-body" style={{ padding: '14px 0', color: 'var(--mgh-ink-3)' }}>La lista está vacía: mientras no tenga bancos, cada persona escribe el nombre de su banco a mano. Al añadir el primero, solo se podrán elegir los de la lista.</div> : null}
      {rows.length ? <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead><tr>{['Banco', 'SWIFT', 'País', 'Estado', ''].map((c, i) => <th key={i} style={{ textAlign: 'left', padding: '8px 10px', background: 'var(--mgh-surface-1)', font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--mgh-ink-2)' }}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((b) => edit && edit.id === b.id ? (
            <tr key={b.id}>
              <td style={td}><input value={edit.name} onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))} style={{ ...input, width: '100%' }} /></td>
              <td style={td}><input value={edit.swift} onChange={(e) => setEdit((x) => ({ ...x, swift: e.target.value }))} style={{ ...input, width: 130, fontFamily: 'var(--font-mono)' }} /></td>
              <td style={td}><input value={edit.country} onChange={(e) => setEdit((x) => ({ ...x, country: e.target.value }))} style={{ ...input, width: 170 }} /></td>
              <td style={td} />
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Button size="sm" icon="save" disabled={busy} onClick={save}>Guardar</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEdit(null)}>Cancelar</Button>
              </td>
            </tr>
          ) : (
            <tr key={b.id} style={{ opacity: b.active ? 1 : 0.6 }}>
              <td style={{ ...td, fontWeight: 600 }}>{b.name}</td>
              <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{b.swift || '—'}</td>
              <td style={td}>{b.country || '—'}</td>
              <td style={td}>{Badge ? <Badge size="sm" dot tone={b.active ? 'success' : 'neutral'}>{b.active ? 'Activo' : 'Desactivado'}</Badge> : null}</td>
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Button size="sm" variant="ghost" icon="edit" disabled={busy} onClick={() => setEdit({ id: b.id, name: b.name, swift: b.swift || '', country: b.country || '' })}>Editar</Button>
                <Button size="sm" variant="ghost" icon={b.active ? 'block' : 'check_circle'} disabled={busy} onClick={() => run(() => window.api.updateBank(b.id, { active: !b.active }), b.active ? `${b.name} desactivado` : `${b.name} activado`)}>{b.active ? 'Desactivar' : 'Activar'}</Button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div> : null}
    </Card>
  );
}
