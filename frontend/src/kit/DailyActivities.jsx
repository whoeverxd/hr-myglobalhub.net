import React, { useState, useEffect, useMemo } from 'react';
import { getQuincenaForDate } from '../lib/periodService.js';
import { EDITABLE, statusLabel } from './MyTimesheets.jsx';
import ActivityFormModal, { WORK_TYPES, isMeetingCopy } from './ActivityFormModal.jsx';

export { WORK_TYPES };

export default function DailyActivities({ f, setF, go, notify, empId }) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button, IconButton, Badge, Card, ProgressBar, Icon } = DS;
  const A = typeof window !== 'undefined' ? window.MGH_ATT : null;
  const rbac = typeof window !== 'undefined' ? window.MGH_RBAC : null;
  const isSelf = rbac && (rbac.role === 'Employee' || rbac.role === 'Contractor');
  const myEmpId = (rbac && rbac.me() ? rbac.me().emp : null) || null;
  const activeEmpId = isSelf ? myEmpId : (empId || myEmpId);

  // Actividades del empleado activo; el backend es la única fuente de verdad
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Formulario de actividad (ActivityFormModal): {} para registrar • { activity } para editar
  const [form, setForm] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [previewMedia, setPreviewMedia] = useState(null);

  // Limpia datos de demostración que versiones anteriores guardaban en el navegador
  useEffect(() => {
    try { localStorage.removeItem('mgh-activities'); } catch (_) {}
  }, []);

  const todayStr = (A && A.TODAY) || (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const activeDate = f && f.d ? f.d : todayStr;

  // Cargar desde el backend las actividades del empleado activo para la fecha seleccionada
  useEffect(() => {
    let cancel = false;
    setActivities([]);
    if (!activeEmpId || !window.api) return;
    setLoadingActivities(true);
    window.api.activities({ empId: activeEmpId, date: activeDate })
      .then(res => { if (!cancel) setActivities(Array.isArray(res) ? res : []); })
      .catch(e => {
        console.warn('[DailyActivities] No se pudieron cargar las actividades:', e.message);
        if (!cancel && notify) notify('No se pudieron cargar las actividades del día');
      })
      .finally(() => { if (!cancel) setLoadingActivities(false); });
    return () => { cancel = true; };
  }, [activeEmpId, activeDate, reloadKey]);

  // Same rule as the backend (routes.js activityWriteError) and MyTimeView: activities are written only by their owner
  // (admin may correct) and only while that quincena's sheet is Draft/Returned. Unknown status = locked.
  const isAdmin = !!rbac && rbac.role === 'Platform Admin';
  const ownRecord = !!activeEmpId && (activeEmpId === myEmpId || isAdmin);
  const periodCode = useMemo(() => getQuincenaForDate(activeDate).code, [activeDate]);
  const [sheetStatus, setSheetStatus] = useState(null);
  const [sheetErr, setSheetErr] = useState(false);
  useEffect(() => {
    let cancel = false;
    setSheetStatus(null); setSheetErr(false);
    if (!activeEmpId || !window.api || !window.api.timesheets) return;
    window.api.timesheets({ empId: activeEmpId, periodId: periodCode })
      // No sheet yet for this quincena = it will be created as Draft on first save
      .then(list => { if (!cancel) setSheetStatus((Array.isArray(list) && list[0] && list[0].status) || 'Draft'); })
      .catch(() => { if (!cancel) { setSheetStatus(null); setSheetErr(true); } });
    return () => { cancel = true; };
  }, [activeEmpId, periodCode]);
  const canWrite = ownRecord && sheetStatus != null && EDITABLE.includes(sheetStatus);
  const lockReason = !activeEmpId ? 'Tu usuario no está vinculado a un empleado.'
    : !ownRecord ? 'Estás viendo las actividades de otra persona (solo lectura).'
    : sheetStatus == null ? (sheetErr ? 'No se pudo consultar el estado de la hoja de esta quincena; la edición queda bloqueada.' : 'Consultando el estado de la hoja…')
    : !EDITABLE.includes(sheetStatus) ? `La hoja ${periodCode} está "${statusLabel(sheetStatus)}": ya no se puede editar.`
    : '';

  // Filtrar actividades por fecha y empleado activo
  const dayActivities = useMemo(() => {
    return activities.filter(act => act.date === activeDate && act.empId === activeEmpId);
  }, [activities, activeDate, activeEmpId]);

  // Cómputo de horas del día
  const totalHours = useMemo(() => {
    return dayActivities.reduce((acc, act) => acc + (Number(act.hours) || 0), 0);
  }, [dayActivities]);

  const dailyGoal = 8.0;
  const progressPercent = Math.min(100, Math.round((totalHours / dailyGoal) * 100));
  const remainingHours = Math.max(0, +(dailyGoal - totalHours).toFixed(1));
  const otHours = Math.max(0, +(totalHours - dailyGoal).toFixed(1));

  // Navegación de fechas
  const shiftDate = (days) => {
    if (!setF) return;
    if (A && typeof A.addD === 'function') {
      const nextDate = A.addD(activeDate, days);
      setF(prev => ({ ...prev, d: nextDate }));
    } else {
      const base = new Date(activeDate + 'T00:00:00Z');
      base.setUTCDate(base.getUTCDate() + days);
      setF(prev => ({ ...prev, d: base.toISOString().slice(0, 10) }));
    }
  };

  const setToday = () => {
    if (setF) {
      setF(prev => ({ ...prev, d: todayStr }));
    }
  };

  // Abrir el formulario para registrar o editar
  const openNewActivity = () => {
    if (!canWrite) { if (notify) notify(lockReason); return; }
    setForm({});
  };

  const openEditActivity = (act) => {
    if (!canWrite) { if (notify) notify(lockReason); return; }
    if (isMeetingCopy(act)) { if (notify) notify('Esta reunión la registró otra persona: no se edita, solo puedes eliminarla.'); return; }
    setForm({ activity: act });
  };

  // Eliminar actividad
  const handleDeleteActivity = async (id, key) => {
    if (!canWrite) { if (notify) notify(lockReason); return; }
    if (!window.confirm(`¿Eliminar la actividad ${key}? Se recalcularán las horas del día.`)) return;
    try {
      await window.api.deleteActivity(id);
      setActivities(prev => prev.filter(a => a.id !== id));
      if (notify) notify(`Actividad ${key} eliminada`);
    } catch (err) {
      console.warn('[DailyActivities] Error al eliminar la actividad:', err.message);
      if (notify) notify(`No se pudo eliminar la actividad: ${err.message}`);
    }
  };

  const getWorkTypeBadge = (wt) => {
    const item = WORK_TYPES.find(w => w.value === wt) || WORK_TYPES[0];
    return <Badge tone={item.tone}>{item.label}</Badge>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner de Equivalencia Arquitectural */}
      <div style={{
        background: 'linear-gradient(90deg, var(--mgh-navy) 0%, #1e293b 100%)',
        borderRadius: 12,
        padding: '16px 20px',
        color: '#FAF8FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 800 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Icon name="task_alt" size={24} color="#6EE7B7" />
          </div>
          <div>
            <div style={{ font: '600 15px/20px var(--font-sans)', color: '#FAF8FF' }}>
              Registro de Jornada por Actividades y Entregables
            </div>
            <div style={{ font: '400 13px/18px var(--font-sans)', color: 'rgba(255, 255, 255, 0.75)', marginTop: 2 }}>
              <strong>Equivalencia total:</strong> Las horas registradas por tareas alimentan directamente tu hoja de tiempo quincenal y nómina de forma equivalente al reloj de fichaje tradicional.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button size="sm" variant="secondary" onClick={() => go && go('attDaily')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="schedule" size={16} /> Ver en registro por horas
            </span>
          </Button>
          <Button size="sm" variant="primary" onClick={openNewActivity} disabled={!canWrite} title={lockReason || undefined}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="add_task" size={16} /> Registrar Actividad
            </span>
          </Button>
        </div>
      </div>

      {/* Selector de Fecha y Barra de Progreso Diario */}
      <Card padding={20}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16
        }}>
          {/* Navegación de fecha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconButton icon="chevron_left" title="Día anterior" onClick={() => shiftDate(-1)} />
            <div style={{ textAlign: 'center', minWidth: 160 }}>
              <div style={{ font: '700 17px/22px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                {activeDate}
              </div>
              <div style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>
                {activeDate === todayStr ? 'Hoy (Jornada activa)' : 'Fecha seleccionada'}
              </div>
            </div>
            <IconButton icon="chevron_right" title="Día siguiente" onClick={() => shiftDate(1)} />
            <Button size="xs" variant="ghost" onClick={setToday}>Hoy</Button>
          </div>

          {/* KPIs del Día */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-3)' }}>
                Horas en Tareas
              </div>
              <div style={{ font: '700 22px/26px var(--font-sans)', color: totalHours >= dailyGoal ? 'var(--mgh-success)' : 'var(--mgh-primary)' }}>
                {totalHours.toFixed(1)}h
              </div>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--mgh-surface-2)' }} />
            <div>
              <div style={{ font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-3)' }}>
                Meta Diaria
              </div>
              <div style={{ font: '600 20px/26px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                {dailyGoal.toFixed(1)}h
              </div>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--mgh-surface-2)' }} />
            <div>
              <div style={{ font: '700 11px/14px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-3)' }}>
                {otHours > 0 ? 'Horas Extra (OT)' : 'Faltante'}
              </div>
              <div style={{ font: '600 20px/26px var(--font-sans)', color: otHours > 0 ? '#F59E0B' : 'var(--mgh-ink-2)' }}>
                {otHours > 0 ? `+${otHours.toFixed(1)}h` : `${remainingHours.toFixed(1)}h`}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de progreso visual */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 12px/16px var(--font-sans)', marginBottom: 6, color: 'var(--mgh-ink-2)' }}>
            <span>Cumplimiento de Jornada: {progressPercent}%</span>
            <span>{totalHours.toFixed(1)} / {dailyGoal.toFixed(1)} horas</span>
          </div>
          <ProgressBar value={progressPercent} tone={totalHours >= dailyGoal ? 'success' : 'primary'} />
        </div>
      </Card>

      {/* Timeline y Listado de Actividades */}
      <Card padding={20}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ font: '700 16px/20px var(--font-sans)', color: 'var(--mgh-ink)' }}>
              Actividades del Día
            </span>
            <Badge size="sm" tone="neutral">{dayActivities.length} registradas</Badge>
          </div>
          <Button size="sm" variant="primary" onClick={openNewActivity} disabled={!canWrite} title={lockReason || undefined}>
            + Nueva Actividad
          </Button>
        </div>
        {lockReason ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'var(--mgh-surface-1)', font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)' }}>
            <Icon name="lock" size={16} /> {lockReason}
          </div>
        ) : null}

        {dayActivities.length === 0 ? (
          <div style={{
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            border: '2px dashed var(--mgh-surface-2)',
            borderRadius: 12
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--mgh-surface-1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mgh-ink-3)'
            }}>
              <Icon name="assignment" size={28} />
            </div>
            <div style={{ font: '600 15px/20px var(--font-sans)', color: 'var(--mgh-ink)' }}>
              {loadingActivities ? 'Cargando actividades…' : !activeEmpId ? 'Tu usuario no tiene un empleado asociado' : 'No hay actividades registradas para esta fecha'}
            </div>
            <div style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--mgh-ink-3)', maxWidth: 440 }}>
              Registra los tickets de Jira, tiempo dedicado y evidencias en las que trabajaste hoy para completar tu jornada.
            </div>
            {canWrite ? (
              <Button size="sm" variant="primary" onClick={openNewActivity}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="add" size={16} /> Registrar primera actividad
                </span>
              </Button>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {dayActivities.map(act => (
              <div
                key={act.id}
                style={{
                  border: '1px solid var(--mgh-surface-2)',
                  borderRadius: 12,
                  padding: 16,
                  background: '#fff',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'border-color 150ms'
                }}
              >
                {/* Cabecera de la actividad */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{
                      font: '700 13px/16px var(--font-sans)',
                      background: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--mgh-primary)',
                      padding: '4px 8px',
                      borderRadius: 6
                    }}>
                      {act.jiraKey}
                    </span>
                    <span style={{ font: '600 14px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                      {act.jiraSummary}
                    </span>
                    {getWorkTypeBadge(act.workType)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      font: '700 16px/20px var(--font-sans)',
                      color: 'var(--mgh-ink)',
                      background: 'var(--mgh-surface-1)',
                      padding: '4px 10px',
                      borderRadius: 8
                    }}>
                      {Number(act.hours).toFixed(1)}h
                    </div>
                    {canWrite && (isMeetingCopy(act) ? (
                      <span title="Actividad de una reunión: no se puede editar (se perdería el vínculo con la reunión). Solo puedes eliminarla." style={{ display: 'inline-flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', color: 'var(--mgh-ink-3)', cursor: 'not-allowed' }}>
                        <Icon name="edit_off" size={18} />
                      </span>
                    ) : (
                      <IconButton icon="edit" title="Editar actividad" onClick={() => openEditActivity(act)} />
                    ))}
                    {canWrite && <IconButton icon="delete" title="Eliminar actividad" onClick={() => handleDeleteActivity(act.id, act.jiraKey)} />}
                  </div>
                </div>

                {/* Descripción */}
                <div style={{ font: '400 13px/20px var(--font-sans)', color: 'var(--mgh-ink-2)', whiteSpace: 'pre-wrap' }}>
                  {act.description}
                </div>

                {/* Evidencias multimedia y Enlaces */}
                {((act.files && act.files.length > 0) || (act.links && act.links.length > 0)) && (
                  <div style={{
                    paddingTop: 10,
                    borderTop: '1px solid var(--mgh-surface-1)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'center'
                  }}>
                    {/* Archivos adjuntos */}
                    {act.files && act.files.map((file, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPreviewMedia(file)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'var(--mgh-surface-1)',
                          border: '1px solid var(--mgh-surface-2)',
                          padding: '4px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          font: '500 12px/16px var(--font-sans)',
                          color: 'var(--mgh-ink)'
                        }}
                      >
                        <Icon name={file.type === 'video' ? 'videocam' : 'image'} size={16} color="var(--mgh-primary)" />
                        <span>{file.name}</span>
                        <span style={{ color: 'var(--mgh-ink-3)', fontSize: 11 }}>({file.size})</span>
                      </button>
                    ))}

                    {/* Enlaces externos */}
                    {act.links && act.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'rgba(37, 99, 235, 0.05)',
                          border: '1px solid rgba(37, 99, 235, 0.2)',
                          padding: '4px 10px',
                          borderRadius: 6,
                          font: '500 12px/16px var(--font-sans)',
                          color: 'var(--mgh-primary)',
                          textDecoration: 'none'
                        }}
                      >
                        <Icon name="link" size={16} />
                        <span>{link.label}</span>
                        <Icon name="open_in_new" size={12} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Formulario único de actividad (mismo que #myentry) */}
      {form && (
        <ActivityFormModal
          empId={activeEmpId}
          date={activeDate}
          activity={form.activity}
          notify={notify}
          onClose={() => setForm(null)}
          onSaved={() => setReloadKey(k => k + 1)}
        />
      )}

      {/* Modal Lightbox de Preview Multimedia */}
      {previewMedia && (
        <div
          onClick={() => setPreviewMedia(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#0f172a',
              borderRadius: 12,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
              <span style={{ fontWeight: 600 }}>{previewMedia.name}</span>
              <IconButton icon="close" title="Cerrar" onClick={() => setPreviewMedia(null)} />
            </div>
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewMedia.type === 'video' ? (
                <video src={previewMedia.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 8 }} />
              ) : (
                <img src={previewMedia.url} alt={previewMedia.name} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 8, objectFit: 'contain' }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
