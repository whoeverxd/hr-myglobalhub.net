import React, { useState, useEffect, useMemo } from 'react';

export const WORK_TYPES = [
  { value: 'Desarrollo', label: 'Desarrollo / Implementación', tone: 'info', icon: 'code' },
  { value: 'QA', label: 'Pruebas / QA', tone: 'neutral', icon: 'bug_report' },
  { value: 'Reunión', label: 'Reunión técnica / Sync', tone: 'warning', icon: 'groups' },
  { value: 'Documentación', label: 'Documentación / Arquitectura', tone: 'success', icon: 'description' },
  { value: 'Soporte', label: 'Soporte / Hotfix', tone: 'danger', icon: 'build' },
];

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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null);

  // Formulario
  const [jiraSearch, setJiraSearch] = useState('');
  const [selectedJira, setSelectedJira] = useState(null);
  const [customTicket, setCustomTicket] = useState('');
  const [hours, setHours] = useState('2.0');
  const [workType, setWorkType] = useState('Desarrollo');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkInput, setLinkInput] = useState('');
  const [linkLabelInput, setLinkLabelInput] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Limpia datos de demostración que versiones anteriores guardaban en el navegador
  useEffect(() => {
    try { localStorage.removeItem('mgh-activities'); } catch (_) {}
  }, []);

  const todayStr = (A && A.TODAY) || '2025-04-15';
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
  }, [activeEmpId, activeDate]);

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

  // Sugerencias de Jira reactivas con API, caché SQLite y estados de carga / error
  const [liveJiraTickets, setLiveJiraTickets] = useState([]);
  const [loadingJira, setLoadingJira] = useState(false);
  const [jiraError, setJiraError] = useState(null);

  // Diagnóstico inicial de conexión con Jira Cloud
  useEffect(() => {
    let cancel = false;
    async function checkStatus() {
      if (window.api && window.api.jiraStatus) {
        try {
          const status = await window.api.jiraStatus();
          if (!cancel && status && status.connection && !status.connection.ok) {
            setJiraError(status.connection.message || 'No se ha podido conectar con Jira');
          }
        } catch (_) {
          if (!cancel) setJiraError('No se ha podido conectar con Jira');
        }
      }
    }
    checkStatus();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    let cancel = false;
    const timer = setTimeout(async () => {
      setLoadingJira(true);
      try {
        const results = [];
        // 1. Prioridad: Tareas Nativas de Proyectos MGH (Sistema Ágil)
        if (window.api && window.api.searchTasks) {
          try {
            const nativeTasks = await window.api.searchTasks({ query: jiraSearch, limit: 10 });
            if (Array.isArray(nativeTasks)) {
              nativeTasks.forEach(t => {
                results.push({
                  key: t.task_key,
                  summary: t.title,
                  project: t.project_name || t.project_key || 'Proyecto Local',
                  isNative: true,
                  status: t.status_name,
                  originJira: t.origin_jira_key
                });
              });
            }
          } catch (_) {}
        }

        // 2. Tickets históricos de Jira Cloud / caché local
        if (window.api && window.api.jiraIssues) {
          try {
            const jiraIssues = await window.api.jiraIssues({ query: jiraSearch, limit: 8 });
            if (Array.isArray(jiraIssues)) {
              jiraIssues.forEach(j => {
                if (!results.some(r => r.key === j.key || r.originJira === j.key)) {
                  results.push({
                    key: j.key,
                    summary: j.summary,
                    project: j.project || 'Jira Cloud',
                    isNative: false,
                    status: j.status
                  });
                }
              });
            }
          } catch (e) {
            console.warn('[DailyActivities] Jira autocomplete fallback:', e.message);
          }
        }

        if (!cancel) {
          setLiveJiraTickets(results);
        }
      } catch (err) {
        console.warn('[DailyActivities] Ticket search error:', err.message);
      } finally {
        if (!cancel) setLoadingJira(false);
      }
    }, 150);

    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [jiraSearch]);

  const filteredJira = useMemo(() => {
    if (!jiraSearch.trim()) return liveJiraTickets.slice(0, 8);
    const q = jiraSearch.toLowerCase();
    return liveJiraTickets.filter(j => j.key.toLowerCase().includes(q) || (j.summary || '').toLowerCase().includes(q));
  }, [jiraSearch, liveJiraTickets]);

  // Manejo de drag & drop de archivos
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const processFiles = (fileList) => {
    Array.from(fileList).forEach(file => {
      const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.webm');
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      const localUrl = URL.createObjectURL(file);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataBase64 = event.target.result;
        let finalUrl = localUrl;
        let fileId = null;

        if (window.api && window.api.uploadFile) {
          try {
            const uploaded = await window.api.uploadFile({
              filename: file.name,
              dataBase64,
              mimeType: file.type || (isVideo ? 'video/mp4' : 'image/png'),
              category: 'evidences'
            });
            if (uploaded && uploaded.url) {
              finalUrl = uploaded.url;
              fileId = uploaded.id;
            }
          } catch (err) {
            console.warn('[Upload] Servidor offline o error, usando URL local temporal:', err.message);
          }
        }

        setFiles(prev => [
          ...prev,
          {
            id: fileId,
            name: file.name,
            size: sizeMB,
            type: isVideo ? 'video' : 'image',
            url: finalUrl
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const addLink = () => {
    if (!linkInput.trim()) return;
    setLinks(prev => [
      ...prev,
      { label: linkLabelInput.trim() || linkInput.trim(), url: linkInput.trim() }
    ]);
    setLinkInput('');
    setLinkLabelInput('');
  };

  const removeLink = (idx) => {
    setLinks(prev => prev.filter((_, i) => i !== idx));
  };

  // Abrir Drawer para crear o editar
  const openNewActivity = () => {
    setEditingActivity(null);
    setSelectedJira(null);
    setJiraSearch('');
    setCustomTicket('');
    setHours('2.0');
    setWorkType('Desarrollo');
    setDescription('');
    setFiles([]);
    setLinks([]);
    setDrawerOpen(true);
  };

  const openEditActivity = (act) => {
    setEditingActivity(act);
    setSelectedJira({ key: act.jiraKey, summary: act.jiraSummary });
    setJiraSearch(act.jiraKey);
    setCustomTicket('');
    setHours(String(act.hours));
    setWorkType(act.workType || 'Desarrollo');
    setDescription(act.description || '');
    setFiles(act.files || []);
    setLinks(act.links || []);
    setDrawerOpen(true);
  };

  // Guardar actividad
  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!activeEmpId || !window.api) {
      if (notify) notify('Tu usuario no tiene un empleado asociado; no se puede registrar la actividad');
      return;
    }
    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      if (notify) notify('Ingresa una duración en horas válida (ej. 2.0)');
      return;
    }

    const ticketKey = selectedJira ? selectedJira.key : (customTicket.trim() || 'GENERAL-TASK');
    const ticketSummary = selectedJira ? selectedJira.summary : (description.slice(0, 40) || 'Actividad general');

    if (!description.trim()) {
      if (notify) notify('Ingresa una descripción del avance técnico');
      return;
    }

    const payload = {
      empId: editingActivity ? editingActivity.empId : activeEmpId,
      date: editingActivity ? editingActivity.date : activeDate,
      jiraKey: ticketKey,
      jiraSummary: ticketSummary,
      hours: parsedHours,
      workType,
      description,
      files,
      links
    };

    try {
      if (editingActivity) {
        // No hay endpoint de actualización: se reemplaza conservando el id
        await window.api.deleteActivity(editingActivity.id);
        const saved = await window.api.createActivity({ ...payload, id: editingActivity.id });
        setActivities(prev => prev.map(a => a.id === editingActivity.id ? saved : a));
        if (notify) notify(`Actividad ${ticketKey} actualizada (${parsedHours}h)`);
      } else {
        const saved = await window.api.createActivity(payload);
        setActivities(prev => [saved, ...prev]);
        if (notify) notify(`Actividad ${ticketKey} registrada (+${parsedHours}h)`);
      }
      setDrawerOpen(false);
    } catch (err) {
      console.warn('[DailyActivities] Error al guardar la actividad:', err.message);
      if (notify) notify(`No se pudo guardar la actividad: ${err.message}`);
    }
  };

  // Eliminar actividad
  const handleDeleteActivity = async (id, key) => {
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
          <Button size="sm" variant="primary" onClick={openNewActivity}>
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
          <Button size="sm" variant="primary" onClick={openNewActivity}>
            + Nueva Actividad
          </Button>
        </div>

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
            <Button size="sm" variant="primary" onClick={openNewActivity}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="add" size={16} /> Registrar primera actividad
              </span>
            </Button>
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
                    <IconButton icon="edit" title="Editar actividad" onClick={() => openEditActivity(act)} />
                    <IconButton icon="delete" title="Eliminar actividad" onClick={() => handleDeleteActivity(act.id, act.jiraKey)} />
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

      {/* Drawer Deslizable / Modal de Carga de Actividad */}
      {drawerOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeIn 150ms ease-out'
        }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 560,
              maxWidth: '100%',
              height: '100%',
              background: '#fff',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 200ms ease-out'
            }}
          >
            {/* Header del Drawer */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--mgh-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--mgh-surface-1)'
            }}>
              <div>
                <div style={{ font: '700 18px/22px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                  {editingActivity ? 'Editar Actividad' : 'Registrar Actividad'}
                </div>
                <div style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--mgh-ink-3)', marginTop: 2 }}>
                  Jornada: {activeDate} • Equivalente a cómputo de horas
                </div>
              </div>
              <IconButton icon="close" title="Cerrar" onClick={() => setDrawerOpen(false)} />
            </div>

            {/* Contenido / Formulario */}
            <form onSubmit={handleSaveActivity} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* 1. Tarea de Proyecto Ágil / Ticket Asociado */}
              <div>
                <label style={{ display: 'block', font: '700 12px/16px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-2)', marginBottom: 6 }}>
                  1. Tarea de Proyecto Ágil / Ticket Asociado *
                </label>
                
                {/* Banner de Estado de Conexión / Error */}
                {jiraError && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                    fontSize: 12,
                    marginBottom: 8
                  }}>
                    <Icon name="cloud_off" size={16} color="#DC2626" />
                    <span style={{ flex: 1 }}>{jiraError}</span>
                    <Badge tone="warning" size="xs">Caché Local</Badge>
                  </div>
                )}

                {selectedJira ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: selectedJira.isNative ? 'rgba(16, 185, 129, 0.08)' : 'rgba(37, 99, 235, 0.08)',
                    border: `1px solid ${selectedJira.isNative ? 'var(--mgh-success, #10b981)' : 'var(--mgh-primary)'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge tone={selectedJira.isNative ? 'success' : 'primary'} size="xs">
                        {selectedJira.isNative ? 'Ágil Nativo' : 'Jira Legacy'}
                      </Badge>
                      <span style={{ font: '700 13px/16px var(--font-sans)', color: selectedJira.isNative ? '#065f46' : 'var(--mgh-primary)' }}>
                        {selectedJira.key}
                      </span>
                      <span style={{ font: '500 13px/16px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                        {selectedJira.summary}
                      </span>
                    </div>
                    <Button size="xs" variant="ghost" onClick={() => setSelectedJira(null)}>Cambiar</Button>
                  </div>
                ) : (
                  <div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Buscar tarea ágil o ticket (ej. MSHP-1, MSH-214, ATLAS-412)..."
                        value={jiraSearch}
                        onChange={e => setJiraSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          paddingRight: loadingJira ? 90 : 12,
                          borderRadius: 8,
                          border: '1px solid var(--mgh-surface-3)',
                          font: '500 13px/18px var(--font-sans)',
                          outline: 'none',
                          marginBottom: 6
                        }}
                      />
                      {loadingJira && (
                        <div style={{
                          position: 'absolute',
                          right: 10,
                          top: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--mgh-primary)'
                        }}>
                          <Icon name="sync" size={14} className="spin" />
                          <span>Buscando...</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                      {filteredJira.map(j => (
                        <div
                          key={j.key}
                          onClick={() => { setSelectedJira(j); setJiraSearch(j.key); }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--mgh-surface-1)',
                            font: '500 12px/16px var(--font-sans)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
                            <Badge tone={j.isNative ? 'success' : 'neutral'} size="xs">
                              {j.isNative ? 'Ágil' : 'Jira'}
                            </Badge>
                            <span style={{ fontWeight: 700, color: j.isNative ? '#059669' : 'var(--mgh-primary)' }}>{j.key}</span>
                            <span style={{ color: 'var(--mgh-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {j.summary}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                            {j.status && (
                              <Badge tone={j.status === 'Done' ? 'success' : 'primary'} size="xs">
                                {j.status}
                              </Badge>
                            )}
                            {j.estimate && (
                              <span style={{ fontSize: 11, color: 'var(--mgh-ink-3)', fontWeight: 600 }}>
                                {j.estimate}h
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Dedicación y Tipo de Trabajo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', font: '700 12px/16px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-2)', marginBottom: 6 }}>
                    2. Duración Dedicada (Horas) *
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    placeholder="ej. 2.0"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--mgh-surface-3)',
                      font: '700 16px/20px var(--font-sans)',
                      color: 'var(--mgh-ink)',
                      outline: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {['0.5', '1.0', '2.0', '4.0'].map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHours(h)}
                        style={{
                          background: hours === h ? 'var(--mgh-navy)' : 'var(--mgh-surface-1)',
                          color: hours === h ? '#fff' : 'var(--mgh-ink-2)',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer'
                        }}
                      >
                        +{h}h
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', font: '700 12px/16px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-2)', marginBottom: 6 }}>
                    Tipo de Trabajo *
                  </label>
                  <select
                    value={workType}
                    onChange={e => setWorkType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--mgh-surface-3)',
                      font: '500 13px/18px var(--font-sans)',
                      background: '#fff',
                      outline: 'none'
                    }}
                  >
                    {WORK_TYPES.map(wt => (
                      <option key={wt.value} value={wt.value}>{wt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Descripción del Avance */}
              <div>
                <label style={{ display: 'block', font: '700 12px/16px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-2)', marginBottom: 6 }}>
                  3. Descripción del Avance Técnico *
                </label>
                <textarea
                  rows={4}
                  placeholder="Detalla lo que construiste, componentes modificados, resultados de pruebas o decisiones tomadas..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--mgh-surface-3)',
                    font: '400 13px/20px var(--font-sans)',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* 4. Zona de Evidencias Multimedia (Dropzone & Links) */}
              <div>
                <label style={{ display: 'block', font: '700 12px/16px var(--font-sans)', textTransform: 'uppercase', color: 'var(--mgh-ink-2)', marginBottom: 6 }}>
                  4. Zona de Evidencias Multimedia (Imágenes y Videos)
                </label>
                
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragActive ? 'var(--mgh-primary)' : 'var(--mgh-surface-3)'}`,
                    borderRadius: 10,
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: dragActive ? 'rgba(37, 99, 235, 0.05)' : 'var(--mgh-surface-1)',
                    cursor: 'pointer',
                    transition: 'all 150ms'
                  }}
                  onClick={() => document.getElementById('media-dropzone-input').click()}
                >
                  <input
                    id="media-dropzone-input"
                    type="file"
                    multiple
                    accept="image/*,video/mp4,video/webm"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <Icon name="cloud_upload" size={28} color="var(--mgh-primary)" />
                    <div style={{ font: '600 13px/18px var(--font-sans)', color: 'var(--mgh-ink)' }}>
                      Arrastra capturas de pantalla o demos de video aquí
                    </div>
                    <div style={{ font: '400 11px/14px var(--font-sans)', color: 'var(--mgh-ink-3)' }}>
                      PNG, JPG, WebP o videos en MP4 / WebM
                    </div>
                  </div>
                </div>

                {/* Lista previa de archivos */}
                {files.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    {files.map((file, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: 'var(--mgh-surface-1)',
                          borderRadius: 6,
                          border: '1px solid var(--mgh-surface-2)',
                          fontSize: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon name={file.type === 'video' ? 'videocam' : 'image'} size={16} color="var(--mgh-primary)" />
                          <span style={{ fontWeight: 600 }}>{file.name}</span>
                          <span style={{ color: 'var(--mgh-ink-3)' }}>({file.size})</span>
                        </div>
                        <IconButton icon="close" size="xs" title="Eliminar archivo" onClick={() => removeFile(i)} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Agregar Enlace Externo (PRs, Loom, Docs) */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ font: '600 12px/16px var(--font-sans)', color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                    Enlaces Externos (Pull Requests de GitHub, Loom, Figma):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Etiqueta (ej. PR #42)"
                      value={linkLabelInput}
                      onChange={e => setLinkLabelInput(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12 }}
                    />
                    <input
                      type="url"
                      placeholder="https://github.com/..."
                      value={linkInput}
                      onChange={e => setLinkInput(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12 }}
                    />
                    <Button size="xs" variant="secondary" onClick={addLink}>+ Agregar</Button>
                  </div>

                  {links.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {links.map((link, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            background: 'rgba(37, 99, 235, 0.08)',
                            borderRadius: 6,
                            fontSize: 12,
                            color: 'var(--mgh-primary)'
                          }}
                        >
                          <Icon name="link" size={14} />
                          <span>{link.label}</span>
                          <button
                            type="button"
                            onClick={() => removeLink(i)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 2 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de Acción */}
              <div style={{
                marginTop: 'auto',
                paddingTop: 16,
                borderTop: '1px solid var(--mgh-surface-2)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10
              }}>
                <Button size="sm" variant="secondary" onClick={() => setDrawerOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="primary" type="submit">
                  {editingActivity ? 'Guardar Cambios' : 'Guardar Actividad'}
                </Button>
              </div>
            </form>
          </div>
        </div>
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
