import React, { useCallback, useEffect, useState } from 'react';

/*
 * "Datos de pago" (employee profile): where a person is paid. Several methods may be saved; payroll pays 100% to the
 * verified primary one. The owner's own registrations and edits wait for HR / finance / admin verification
 * (meanwhile the verified method keeps being paid). Backend: payout-methods.service.js.
 */

const CRYPTO = {
  binance: { currencies: ['USDC', 'USDT'], networks: ['BSC', 'Ethereum', 'Tron', 'Solana', 'Base'] },
  coinbase: { currencies: ['USDC', 'BTC', 'ETH'], networks: ['Base', 'Ethereum', 'Polygon', 'Solana'] },
};
export const PAYOUT_TYPES = [
  { value: 'bank', label: 'Banco', icon: 'account_balance', hint: 'Depósito a tu cuenta bancaria' },
  { value: 'binance', label: 'Binance', icon: 'currency_exchange', hint: 'USDC o USDT a tu dirección de depósito' },
  { value: 'coinbase', label: 'Coinbase', icon: 'currency_bitcoin', hint: 'USDC, BTC o ETH a tu billetera' },
  { value: 'western_union', label: 'Western Union', icon: 'send_money', hint: 'Envío para retirar en efectivo' },
  { value: 'paypal', label: 'PayPal', icon: 'alternate_email', hint: 'Pago a tu correo de PayPal' },
];
const FIELDS = {
  bank: [
    ['bank_name', 'Banco', 'Banco BHD León'],
    ['account_type', 'Tipo de cuenta', null, ['Ahorro', 'Corriente']],
    ['account_number', 'Número de cuenta', 'Solo números'],
    ['holder', 'Titular de la cuenta', 'Nombre como aparece en el banco'],
    ['holder_id', 'Cédula del titular (opcional)', '11 dígitos', null, true],
    ['routing', 'Número de ruta ABA (solo cuentas de EE. UU.)', '9 dígitos', null, true],
  ],
  binance: [['currency', 'Moneda'], ['network', 'Red'], ['address', 'Dirección de depósito', 'Cópiala desde Binance → Depositar']],
  coinbase: [['currency', 'Moneda'], ['network', 'Red'], ['address', 'Dirección de depósito', 'Cópiala desde Coinbase → Recibir']],
  western_union: [
    ['full_name', 'Nombre completo (como en el documento)'], ['country', 'País'], ['city', 'Ciudad'],
    ['document_type', 'Tipo de documento', null, ['Cédula', 'Pasaporte', 'DNI', 'Otro']], ['document_number', 'Número de documento'], ['phone', 'Teléfono', '+1 809 …'],
  ],
  paypal: [['email', 'Correo de PayPal', 'tu@correo.com']],
};
const LABEL = Object.fromEntries(Object.values(FIELDS).flat().map(([k, l]) => [k, l.replace(/ \(.*\)$/, '')]));
const STATUS = {
  verified: { tone: 'success', label: 'Verificado' },
  pending: { tone: 'warning', label: 'Pendiente de verificación' },
  rejected: { tone: 'danger', label: 'Rechazado' },
};
const CHANNEL = { bank: 'Archivo del banco', usdc: 'Lote USDC (Base)', manual: 'Pago manual' };
const emptyDetails = (type) => {
  const d = Object.fromEntries((FIELDS[type] || []).map(([k, , , opts]) => [k, opts ? opts[0] : '']));
  if (CRYPTO[type]) { d.currency = CRYPTO[type].currencies[0]; d.network = CRYPTO[type].networks[0]; }
  return d;
};

export default function PayoutMethods({ empId, notify, canReview, canEdit, isOwn }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Card, Button, Badge, Icon } = DS;
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null); // { id?, type, details, primary }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setList(await window.api.payoutMethods(empId)); }
    catch (err) { setList([]); notify('No se pudieron cargar los datos de pago • ' + err.message); }
  }, [empId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) notify(okMsg); await load(); return true; }
    catch (err) { notify(err.message); return false; }
    finally { setBusy(false); }
  };
  const save = async () => {
    const f = form;
    const ok = await run(
      () => (f.id ? window.api.updatePayoutMethod(f.id, { details: f.details }) : window.api.createPayoutMethod(empId, { type: f.type, details: f.details, primary: f.primary })),
      canReview && !isOwn ? 'Datos de pago guardados y verificados' : 'Datos de pago enviados: HR los verificará antes de usarlos en la nómina'
    );
    if (ok) setForm(null);
  };
  const reject = (m) => {
    const note = window.prompt('Motivo del rechazo (la persona lo verá para corregir sus datos):');
    if (note && note.trim()) run(() => window.api.rejectPayoutMethod(m.id, note.trim()), 'Método rechazado');
  };
  const remove = (m) => {
    if (window.confirm(`¿Eliminar ${m.typeLabel} • ${m.summary}?`)) run(() => window.api.deletePayoutMethod(m.id), 'Método eliminado');
  };

  const methods = list || [];
  const replacedBy = (m) => methods.find((x) => x.replacesId === m.id);
  const typeOf = (t) => PAYOUT_TYPES.find((x) => x.value === t) || { label: t, icon: 'payments' };
  const k = { font: '600 11px/14px var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--mgh-ink-3)' };

  return (
    <Card icon="account_balance_wallet" title="Datos de pago"
      subtitle="La nómina paga el 100% al método principal verificado. Los cambios los verifica HR; mientras tanto se sigue pagando al método verificado."
      actions={canEdit ? <Button size="sm" icon="add" disabled={busy} onClick={() => setForm({ type: 'bank', details: emptyDetails('bank'), primary: !methods.length })}>Añadir método de pago</Button> : null}>
      {list == null ? <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)', padding: '12px 0' }}>Cargando…</div>
        : !methods.length ? <div className="mgh-body" style={{ color: 'var(--mgh-ink-3)', padding: '12px 0' }}>Todavía no hay datos de pago. {canEdit ? 'Añade dónde quieres cobrar: banco, Binance, Coinbase, Western Union o PayPal.' : ''}</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 12, marginTop: 6 }}>
            {methods.map((m) => {
              const t = typeOf(m.type), st = STATUS[m.status] || STATUS.pending, pendingChange = replacedBy(m);
              return (
                <div key={m.id} style={{ border: '1px solid ' + (m.isPrimary ? 'var(--mgh-primary)' : 'var(--mgh-surface-2)'), borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: m.status === 'rejected' ? 'var(--mgh-surface-1)' : '#fff' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--mgh-primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{Icon ? <Icon name={t.icon} size={20} color="var(--mgh-primary)" /> : null}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '700 14px/20px var(--font-sans)', color: 'var(--mgh-ink)' }}>{t.label}{m.details.currency ? ` • ${m.details.currency} (${m.details.network})` : ''}</div>
                      <div style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{CHANNEL[m.channel] || ''}</div>
                    </div>
                    {m.isPrimary ? <Badge size="sm" tone="primary">Principal</Badge> : m.wantsPrimary ? <Badge size="sm" tone="neutral">Será principal</Badge> : null}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                    {(FIELDS[m.type] || []).filter(([f]) => m.details[f] && f !== 'currency' && f !== 'network').map(([f]) => (
                      <div key={f}><div style={k}>{LABEL[f]}</div><div style={{ font: '500 13px/18px var(--font-mono)', color: 'var(--mgh-ink)', wordBreak: 'break-all' }}>{m.details[f]}</div></div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge size="sm" dot tone={st.tone}>{st.label}</Badge>
                    {m.replacesId ? <span style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>Cambio de un método verificado</span> : null}
                    {pendingChange ? <span style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-warning)' }}>Hay un cambio pendiente de verificar</span> : null}
                  </div>
                  {m.status === 'rejected' && m.reviewNote ? <div style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-danger)' }}>Motivo: “{m.reviewNote}”{m.reviewedBy ? ' — ' + m.reviewedBy : ''}</div> : null}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--mgh-surface-2)', paddingTop: 10 }}>
                    {canReview && m.status === 'pending' ? <>
                      <Button size="sm" icon="verified" disabled={busy} onClick={() => run(() => window.api.verifyPayoutMethod(m.id), 'Método verificado')}>Verificar</Button>
                      <Button size="sm" variant="danger" icon="close" disabled={busy} onClick={() => reject(m)}>Rechazar</Button>
                    </> : null}
                    {canEdit && !m.isPrimary && m.status !== 'rejected' && !m.wantsPrimary ? <Button size="sm" variant="ghost" icon="star" disabled={busy} onClick={() => run(() => window.api.setPrimaryPayoutMethod(m.id), m.status === 'verified' ? 'Método principal cambiado' : 'Será el principal cuando se verifique')}>Hacer principal</Button> : null}
                    {canEdit && !pendingChange ? <Button size="sm" variant="ghost" icon="edit" disabled={busy} onClick={() => setForm({ id: m.id, type: m.type, details: { ...emptyDetails(m.type), ...m.details } })}>{m.status === 'rejected' ? 'Corregir' : 'Editar'}</Button> : null}
                    {canEdit && !(m.isPrimary && m.status === 'verified') ? <Button size="sm" variant="ghost" icon="delete" disabled={busy} onClick={() => remove(m)}>Eliminar</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>}

      {form ? <PayoutForm form={form} setForm={setForm} busy={busy} onSave={save} onClose={() => setForm(null)} /> : null}
    </Card>
  );
}

function PayoutForm({ form, setForm, busy, onSave, onClose }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button, TextField, Select, Icon } = DS;
  const M = window.Modal;
  const set = (key) => (x) => { const v = typeof x === 'string' ? x : x && x.target ? x.target.value : x; setForm((f) => ({ ...f, details: { ...f.details, [key]: v } })); };
  const crypto = CRYPTO[form.type];
  // Explicit option values: a string option's value is its (auto-translated) text
  const opts = (list) => list.map((o) => ({ value: o, label: o }));
  const field = ([key, label, placeholder, options]) => {
    if (crypto && key === 'currency') return <Select key={key} label={label} value={form.details.currency} onChange={set(key)} options={opts(crypto.currencies)} />;
    if (crypto && key === 'network') return <Select key={key} label={label} value={form.details.network} onChange={set(key)} options={opts(crypto.networks)} />;
    if (options) return <Select key={key} label={label} value={form.details[key]} onChange={set(key)} options={opts(options)} />;
    return <TextField key={key} label={label} value={form.details[key] || ''} placeholder={placeholder || ''} mono={['account_number', 'address', 'routing', 'holder_id', 'document_number'].includes(key)} onChange={set(key)} />;
  };
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!form.id ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {PAYOUT_TYPES.map((t) => (
          <button key={t.value} type="button" onClick={() => setForm((f) => ({ ...f, type: t.value, details: emptyDetails(t.value) }))} title={t.hint}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px', borderRadius: 10, cursor: 'pointer', border: '1px solid ' + (form.type === t.value ? 'var(--mgh-primary)' : 'var(--mgh-surface-2)'), background: form.type === t.value ? 'var(--mgh-primary-50)' : '#fff', font: '600 12px/16px var(--font-sans)', color: form.type === t.value ? 'var(--mgh-primary)' : 'var(--mgh-ink-2)' }}>
            {Icon ? <Icon name={t.icon} size={20} color={form.type === t.value ? 'var(--mgh-primary)' : 'var(--mgh-ink-3)'} /> : null}{t.label}
          </button>
        ))}
      </div> : null}
      <div style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>{(PAYOUT_TYPES.find((t) => t.value === form.type) || {}).hint}{crypto ? '. Comprueba que la red coincide con la de tu dirección: un envío por otra red se pierde.' : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 12 }}>{(FIELDS[form.type] || []).map(field)}</div>
      {!form.id ? <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '500 13px/18px var(--font-sans)', color: 'var(--mgh-ink)', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!form.primary} onChange={(e) => setForm((f) => ({ ...f, primary: e.target.checked }))} /> Usar como método principal (recibe el 100% del pago)
      </label> : null}
    </div>
  );
  const actions = <><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button icon="save" disabled={busy} onClick={onSave}>{busy ? 'Guardando…' : 'Guardar'}</Button></>;
  return M ? <M open width={600} title={form.id ? 'Editar método de pago' : 'Añadir método de pago'} onClose={() => { if (!busy) onClose(); }} actions={actions}>{body}</M> : null;
}

/** Reviewers' queue (#admin): every registration waiting for verification */
export function PendingPayoutMethods({ notify, go }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Card, Button, Badge } = DS;
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => window.api.pendingPayoutMethods().then(setList).catch((err) => { setList([]); notify('No se pudieron cargar los datos de pago pendientes • ' + err.message); }), []);
  useEffect(() => { load(); }, [load]);
  const act = async (m, fn, msg) => { setBusy(m.id); try { await fn(); notify(msg); await load(); } catch (err) { notify(err.message); } finally { setBusy(null); } };
  const rows = list || [];
  return (
    <Card icon="verified_user" title="Datos de pago por verificar" subtitle={list == null ? 'Cargando…' : rows.length ? rows.length + ' pendiente' + (rows.length === 1 ? '' : 's') + ': comprueba los datos con la persona antes de verificarlos.' : 'No hay datos de pago pendientes.'}>
      {rows.map((m) => (
        <div key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--mgh-surface-2)' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ font: '700 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>{m.employeeName} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--mgh-ink-3)', fontWeight: 500 }}>{m.employeeId}</span></div>
            <div style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>{m.summary}{m.replacesId ? ' • cambio de un método verificado' : ''}</div>
          </div>
          {m.wantsPrimary ? <Badge size="sm" tone="neutral">Será principal</Badge> : null}
          {go ? <Button size="sm" variant="ghost" icon="person" onClick={() => go('profile', m.employeeId)}>Ver perfil</Button> : null}
          <Button size="sm" icon="verified" disabled={!!busy} onClick={() => act(m, () => window.api.verifyPayoutMethod(m.id), 'Método verificado')}>Verificar</Button>
          <Button size="sm" variant="danger" icon="close" disabled={!!busy} onClick={() => { const note = window.prompt('Motivo del rechazo:'); if (note && note.trim()) act(m, () => window.api.rejectPayoutMethod(m.id, note.trim()), 'Método rechazado'); }}>Rechazar</Button>
        </div>
      ))}
    </Card>
  );
}
