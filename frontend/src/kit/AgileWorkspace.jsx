import React, { useState, useEffect, useMemo, useCallback } from 'react';

export default function AgileWorkspace({
  currentProjectKey = 'MSHP',
  projects = [],
  onSelectProject,
  currentUser,
  notify,
  go
}) {
  const DS = window.MyGlobalHubDesignSystem_2a603d || {};
  const { Button, IconButton, Badge, Card, StatCard, Icon, ProgressBar } = DS;

  // RBAC
  const rbac = typeof window !== 'undefined' ? window.MGH_RBAC : null;
  const isPrivileged = !rbac || rbac.role === 'Admin' || rbac.role === 'Project Manager' || (currentUser && (currentUser.role === 'admin' || currentUser.role === 'pm'));

  // Estados de navegación interna
  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'backlog' | 'workflow' | 'cloner' | 'members'
  const [selectedProjectKey, setSelectedProjectKey] = useState(currentProjectKey);

  // Datos del proyecto activo
  const [statuses, setStatuses] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filtros del tablero
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSprintFilter, setSelectedSprintFilter] = useState('active'); // 'active' | 'all' | sprintId

  // Modales
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    taskType: 'Story',
    priority: 'Medium',
    estimateHours: '4.0',
    storyPoints: '2',
    assigneeName: '',
    sprintId: '',
    statusId: ''
  });

  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [sprintForm, setSprintForm] = useState({
    name: '',
    goal: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)
  });

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({
    name: '',
    category: 'in_progress',
    color: '#3b82f6'
  });

  const [completeSprintModalOpen, setCompleteSprintModalOpen] = useState(false);
  const [sprintToComplete, setSprintToComplete] = useState(null);
  const [moveRemainingTo, setMoveRemainingTo] = useState('backlog');

  // Input de creación rápida de tareas
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskSprint, setQuickTaskSprint] = useState('backlog');

  // Clonador de Jira
  const [jiraSearch, setJiraSearch] = useState('');
  const [jiraIssues, setJiraIssues] = useState([]);
  const [selectedJiraIssue, setSelectedJiraIssue] = useState(null);
  const [clonerDestination, setClonerDestination] = useState({
    sprintId: '',
    statusId: ''
  });
  const [cloning, setCloning] = useState(false);
  const [clonedSuccess, setClonedSuccess] = useState(null);

  // Sincronizar selección externa de proyecto
  useEffect(() => {
    if (currentProjectKey && currentProjectKey !== selectedProjectKey) {
      setSelectedProjectKey(currentProjectKey);
    }
  }, [currentProjectKey]);

  // Cargar datos del proyecto (estados, sprints, tareas, miembros)
  const loadProjectData = useCallback(async (projKey) => {
    if (!projKey || !window.api) return;
    setLoading(true);
    try {
      const [fetchedStatuses, fetchedSprints, fetchedTasks, fetchedMembers] = await Promise.all([
        window.api.projectStatuses(projKey).catch(() => []),
        window.api.projectSprints(projKey).catch(() => []),
        window.api.projectTasks(projKey).catch(() => []),
        window.api.projectMembers(projKey).catch(() => [])
      ]);

      setStatuses(Array.isArray(fetchedStatuses) ? fetchedStatuses : []);
      setSprints(Array.isArray(fetchedSprints) ? fetchedSprints : []);
      setTasks(Array.isArray(fetchedTasks) ? fetchedTasks : []);
      setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : []);
    } catch (err) {
      console.warn('Error loading agile project data:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjectData(selectedProjectKey);
  }, [selectedProjectKey, loadProjectData]);

  // Identificar sprint activo
  const activeSprint = useMemo(() => {
    return sprints.find(s => s.status === 'ACTIVE') || null;
  }, [sprints]);

  // Tareas filtradas para el tablero Kanban
  const boardTasks = useMemo(() => {
    return tasks.filter(t => {
      // Filtro de sprint
      if (selectedSprintFilter === 'active') {
        if (activeSprint) {
          if (t.sprint_id !== activeSprint.id) return false;
        }
      } else if (selectedSprintFilter !== 'all') {
        if (t.sprint_id !== selectedSprintFilter) return false;
      }

      // Filtro de responsable
      if (selectedAssignee !== 'all') {
        if (t.assignee_name !== selectedAssignee) return false;
      }

      // Filtro de tipo
      if (selectedType !== 'all') {
        if (t.task_type !== selectedType) return false;
      }

      // Filtro de texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = t.task_key.toLowerCase().includes(q);
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesJira = t.origin_jira_key && t.origin_jira_key.toLowerCase().includes(q);
        if (!matchesKey && !matchesTitle && !matchesJira) return false;
      }

      return true;
    });
  }, [tasks, selectedSprintFilter, activeSprint, selectedAssignee, selectedType, searchQuery]);

  // Lista única de responsables para chips de filtro
  const assignees = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => {
      if (t.assignee_name) set.add(t.assignee_name);
    });
    return Array.from(set);
  }, [tasks]);

  // Tareas del backlog (sin sprint asignado)
  const backlogTasks = useMemo(() => {
    return tasks.filter(t => !t.sprint_id);
  }, [tasks]);

  // Manejo de cambio de estado de una tarea (mover columna)
  const handleMoveStatus = async (task, newStatusId) => {
    try {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status_id: newStatusId } : t));
      if (window.api && window.api.moveTask) {
        await window.api.moveTask(task.id, { statusId: newStatusId });
      }
      if (notify) notify(`Tarea ${task.task_key} movida de estado.`);
      loadProjectData(selectedProjectKey);
    } catch (err) {
      if (notify) notify('Error al mover tarea: ' + err.message);
      loadProjectData(selectedProjectKey);
    }
  };

  // Mover tarea entre Sprint y Backlog
  const handleAssignSprint = async (task, sprintId) => {
    try {
      const targetSprint = sprintId === 'backlog' ? null : sprintId;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, sprint_id: targetSprint } : t));
      if (window.api && window.api.moveTask) {
        await window.api.moveTask(task.id, { sprintId: targetSprint });
      }
      if (notify) notify(`Tarea ${task.task_key} reasignada.`);
      loadProjectData(selectedProjectKey);
    } catch (err) {
      if (notify) notify('Error al reasignar tarea: ' + err.message);
      loadProjectData(selectedProjectKey);
    }
  };

  // Crear Tarea Rápida
  const handleQuickCreateTask = async (e) => {
    if (e) e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    try {
      const sprintId = quickTaskSprint === 'backlog' ? null : quickTaskSprint;
      const defStatus = statuses.find(s => s.is_default === 1) || statuses[0];

      if (window.api && window.api.createTask) {
        const created = await window.api.createTask(selectedProjectKey, {
          title: quickTaskTitle.trim(),
          sprintId,
          statusId: defStatus ? defStatus.id : null,
          taskType: 'Task',
          priority: 'Medium',
          estimateHours: 4.0,
          storyPoints: 2
        });
        if (notify) notify(`Tarea ${created.task_key} creada.`);
        setQuickTaskTitle('');
        loadProjectData(selectedProjectKey);
      }
    } catch (err) {
      if (notify) notify('Error al crear tarea: ' + err.message);
    }
  };

  // Guardar Tarea (Creación / Edición Completa)
  const handleSaveTask = async (e) => {
    if (e) e.preventDefault();
    if (!taskForm.title.trim()) {
      if (notify) notify('El título de la tarea es obligatorio.');
      return;
    }

    try {
      if (editingTask) {
        if (window.api && window.api.updateTask) {
          await window.api.updateTask(editingTask.id, {
            title: taskForm.title.trim(),
            description: taskForm.description,
            taskType: taskForm.taskType,
            priority: taskForm.priority,
            estimateHours: Number(taskForm.estimateHours) || 0,
            storyPoints: parseInt(taskForm.storyPoints, 10) || 0,
            assigneeName: taskForm.assigneeName || null,
            sprintId: taskForm.sprintId || null,
            statusId: taskForm.statusId || null
          });
          if (notify) notify(`Tarea ${editingTask.task_key} actualizada.`);
        }
      } else {
        if (window.api && window.api.createTask) {
          const res = await window.api.createTask(selectedProjectKey, {
            title: taskForm.title.trim(),
            description: taskForm.description,
            taskType: taskForm.taskType,
            priority: taskForm.priority,
            estimateHours: Number(taskForm.estimateHours) || 0,
            storyPoints: parseInt(taskForm.storyPoints, 10) || 0,
            assigneeName: taskForm.assigneeName || null,
            sprintId: taskForm.sprintId || null,
            statusId: taskForm.statusId || null
          });
          if (notify) notify(`Tarea ${res.task_key} creada exitosamente.`);
        }
      }
      setTaskModalOpen(false);
      setEditingTask(null);
      loadProjectData(selectedProjectKey);
    } catch (err) {
      if (notify) notify('Error al guardar tarea: ' + err.message);
    }
  };

  // Abrir modal de edición
  const handleOpenEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      taskType: task.task_type || 'Story',
      priority: task.priority || 'Medium',
      estimateHours: String(task.estimate_hours || 4.0),
      storyPoints: String(task.story_points || 2),
      assigneeName: task.assignee_name || '',
      sprintId: task.sprint_id || '',
      statusId: task.status_id || ''
    });
    setTaskModalOpen(true);
  };

  // Eliminar Tarea
  const handleDeleteTask = async (task) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la tarea ${task.task_key}?`)) return;
    try {
      if (window.api && window.api.deleteTask) {
        await window.api.deleteTask(task.id);
        if (notify) notify(`Tarea ${task.task_key} eliminada.`);
        setTaskModalOpen(false);
        setEditingTask(null);
        loadProjectData(selectedProjectKey);
      }
    } catch (err) {
      if (notify) notify('Error al eliminar tarea: ' + err.message);
    }
  };

  // Crear Sprint
  const handleCreateSprint = async (e) => {
    if (e) e.preventDefault();
    if (!sprintForm.name.trim()) {
      if (notify) notify('El nombre del sprint es obligatorio.');
      return;
    }
    try {
      if (window.api && window.api.createSprint) {
        await window.api.createSprint(selectedProjectKey, {
          name: sprintForm.name.trim(),
          goal: sprintForm.goal,
          startDate: sprintForm.startDate,
          endDate: sprintForm.endDate
        });
        if (notify) notify(`Sprint "${sprintForm.name}" creado.`);
        setSprintModalOpen(false);
        setSprintForm({
          name: '',
          goal: '',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)
        });
        loadProjectData(selectedProjectKey);
      }
    } catch (err) {
      if (notify) notify('Error al crear sprint: ' + err.message);
    }
  };

  // Iniciar Sprint
  const handleStartSprint = async (sprint) => {
    try {
      if (window.api && window.api.startSprint) {
        await window.api.startSprint(sprint.id, {
          startDate: new Date().toISOString().slice(0, 10)
        });
        if (notify) notify(`Sprint "${sprint.name}" iniciado.`);
        loadProjectData(selectedProjectKey);
      }
    } catch (err) {
      if (notify) notify('Error al iniciar sprint: ' + err.message);
    }
  };

  // Completar Sprint
  const handleConfirmCompleteSprint = async () => {
    if (!sprintToComplete) return;
    try {
      if (window.api && window.api.completeSprint) {
        await window.api.completeSprint(sprintToComplete.id, {
          moveRemainingTo
        });
        if (notify) notify(`Sprint "${sprintToComplete.name}" completado. Tareas pendientes reubicadas.`);
        setCompleteSprintModalOpen(false);
        setSprintToComplete(null);
        loadProjectData(selectedProjectKey);
      }
    } catch (err) {
      if (notify) notify('Error al completar sprint: ' + err.message);
    }
  };

  // Crear Estado Personalizado de Flujo
  const handleCreateStatus = async (e) => {
    if (e) e.preventDefault();
    if (!statusForm.name.trim()) return;

    try {
      if (window.api && window.api.createProjectStatus) {
        await window.api.createProjectStatus(selectedProjectKey, statusForm);
        if (notify) notify(`Nuevo estado "${statusForm.name}" añadido al flujo.`);
        setStatusModalOpen(false);
        setStatusForm({ name: '', category: 'in_progress', color: '#3b82f6' });
        loadProjectData(selectedProjectKey);
      }
    } catch (err) {
      if (notify) notify('Error al crear estado: ' + err.message);
    }
  };

  // Eliminar Estado de Flujo
  const handleDeleteStatus = async (statusId) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta columna de estado? Las tareas se moverán al estado inicial.')) return;
    try {
      if (window.api && window.api.deleteProjectStatus) {
        await window.api.deleteProjectStatus(selectedProjectKey, statusId);
        if (notify) notify('Estado eliminado.');
        loadProjectData(selectedProjectKey);
      }
    } catch (err) {
      if (notify) notify('Error al eliminar estado: ' + err.message);
    }
  };

  // Buscar incidencias en Jira Cloud / Caché para Clonación
  useEffect(() => {
    if (activeTab !== 'cloner') return;
    let cancel = false;
    const timer = setTimeout(async () => {
      if (window.api && window.api.jiraIssues) {
        try {
          const res = await window.api.jiraIssues({ query: jiraSearch, limit: 12 });
          if (!cancel && Array.isArray(res)) {
            setJiraIssues(res);
          }
        } catch (_) {}
      }
    }, 200);

    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [jiraSearch, activeTab]);

  // Ejecutar Clonación de Ticket Jira a Nativo
  const handleExecuteClone = async () => {
    if (!selectedJiraIssue) {
      if (notify) notify('Selecciona un ticket de Jira para clonar.');
      return;
    }
    setCloning(true);
    setClonedSuccess(null);
    try {
      if (window.api && window.api.cloneJiraIssue) {
        const res = await window.api.cloneJiraIssue({
          jiraKey: selectedJiraIssue.key,
          targetProjectKey: selectedProjectKey,
          sprintId: clonerDestination.sprintId || null,
          statusId: clonerDestination.statusId || null
        });
        if (res && res.success) {
          setClonedSuccess(res.task);
          if (notify) notify(`Ticket ${selectedJiraIssue.key} clonado exitosamente como ${res.task.task_key}`);
          loadProjectData(selectedProjectKey);
        }
      }
    } catch (err) {
      if (notify) notify('Error al clonar ticket: ' + err.message);
    } finally {
      setCloning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Barra de Proyecto Activo y Navegación Ágil */}
      <Card padding={16}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          
          {/* Selector de Proyecto */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #132A52 0%, #334296 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(51, 66, 150, 0.25)'
            }}>
              <Icon name="folder_special" size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  value={selectedProjectKey}
                  onChange={e => {
                    setSelectedProjectKey(e.target.value);
                    if (onSelectProject) onSelectProject(e.target.value);
                  }}
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--mgh-ink)',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  {projects.map(p => (
                    <option key={p.key || p.id} value={p.key || p.id}>
                      {p.name || p.key} ({p.key || p.id})
                    </option>
                  ))}
                  {!projects.some(p => (p.key || p.id) === selectedProjectKey) && (
                    <option value={selectedProjectKey}>{selectedProjectKey}</option>
                  )}
                </select>
                <Badge mono tone="primary" size="sm">{selectedProjectKey}</Badge>
              </div>
              <div style={{ fontSize: 12, color: 'var(--mgh-ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Módulo Nativo de Gestión Ágil</span>
                <span>•</span>
                <span>{tasks.length} tareas totales</span>
                <span>•</span>
                <span>{sprints.length} sprints</span>
              </div>
            </div>
          </div>

          {/* Botones de Acción Global */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="primary"
              size="sm"
              icon="add"
              onClick={() => {
                setEditingTask(null);
                setTaskForm({
                  title: '',
                  description: '',
                  taskType: 'Story',
                  priority: 'Medium',
                  estimateHours: '4.0',
                  storyPoints: '2',
                  assigneeName: '',
                  sprintId: activeSprint ? activeSprint.id : '',
                  statusId: statuses[0]?.id || ''
                });
                setTaskModalOpen(true);
              }}
            >
              + Nueva Tarea
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="layers"
              onClick={() => setSprintModalOpen(true)}
            >
              + Crear Sprint
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="sync_alt"
              onClick={() => setActiveTab('cloner')}
            >
              Clonar desde Jira
            </Button>
          </div>
        </div>

        {/* Pestañas de Vista */}
        <div style={{
          display: 'flex',
          gap: 6,
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid var(--mgh-surface-2)',
          overflowX: 'auto'
        }}>
          <Button
            variant={activeTab === 'board' ? 'primary' : 'ghost'}
            size="sm"
            icon="view_kanban"
            onClick={() => setActiveTab('board')}
          >
            Tablero Kanban ({boardTasks.length})
          </Button>
          <Button
            variant={activeTab === 'backlog' ? 'primary' : 'ghost'}
            size="sm"
            icon="checklist"
            onClick={() => setActiveTab('backlog')}
          >
            Backlog & Sprints ({backlogTasks.length} sin asignar)
          </Button>
          <Button
            variant={activeTab === 'cloner' ? 'primary' : 'ghost'}
            size="sm"
            icon="content_copy"
            onClick={() => setActiveTab('cloner')}
          >
            Clonador Jira Legacy
          </Button>
          <Button
            variant={activeTab === 'workflow' ? 'primary' : 'ghost'}
            size="sm"
            icon="tune"
            onClick={() => setActiveTab('workflow')}
          >
            Flujo de Estados ({statuses.length})
          </Button>
          <Button
            variant={activeTab === 'members' ? 'primary' : 'ghost'}
            size="sm"
            icon="badge"
            onClick={() => setActiveTab('members')}
          >
            Miembros del Proyecto ({members.length})
          </Button>
        </div>
      </Card>

      {/* =========================================================================
          TAB 1: TABLERO KANBAN
          ========================================================================= */}
      {activeTab === 'board' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Filtros de Tablero */}
          <Card padding={12}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              
              {/* Buscador de texto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240, maxWidth: 360 }}>
                <input
                  type="text"
                  placeholder="Filtrar por clave, título o Jira..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--mgh-surface-3)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Selector de Sprint */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mgh-ink-2)' }}>Sprint:</span>
                <select
                  value={selectedSprintFilter}
                  onChange={e => setSelectedSprintFilter(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--mgh-surface-3)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: '#fff'
                  }}
                >
                  <option value="active">Sprint Activo {activeSprint ? `(${activeSprint.name})` : '(Ninguno)'}</option>
                  <option value="all">Todos los Sprints & Backlog</option>
                  {sprints.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Responsable */}
              {assignees.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mgh-ink-2)' }}>Asignado:</span>
                  <select
                    value={selectedAssignee}
                    onChange={e => setSelectedAssignee(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--mgh-surface-3)',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      background: '#fff'
                    }}
                  >
                    <option value="all">Todos ({assignees.length})</option>
                    {assignees.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro por Tipo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mgh-ink-2)' }}>Tipo:</span>
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--mgh-surface-3)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    background: '#fff'
                  }}
                >
                  <option value="all">Todos los tipos</option>
                  <option value="Story">Story</option>
                  <option value="Task">Task</option>
                  <option value="Bug">Bug</option>
                  <option value="Epic">Epic</option>
                </select>
              </div>

            </div>
          </Card>

          {/* Columnas Kanban Dinámicas */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, statuses.length)}, minmax(280px, 1fr))`,
            gap: 14,
            overflowX: 'auto',
            paddingBottom: 16
          }}>
            {statuses.map(status => {
              const columnTasks = boardTasks.filter(t => t.status_id === status.id);
              return (
                <div
                  key={status.id}
                  style={{
                    background: 'var(--mgh-surface-1)',
                    borderRadius: 12,
                    border: '1px solid var(--mgh-surface-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 520,
                    maxHeight: 'calc(100vh - 280px)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {/* Header de Columna */}
                  <div style={{
                    padding: '12px 14px',
                    borderBottom: '2px solid ' + (status.color || '#3b82f6'),
                    background: '#fff',
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: status.color || '#3b82f6',
                        display: 'inline-block'
                      }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--mgh-ink)' }}>
                        {status.name}
                      </span>
                      <span style={{
                        background: 'var(--mgh-surface-2)',
                        color: 'var(--mgh-ink-2)',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 10
                      }}>
                        {columnTasks.length}
                      </span>
                    </div>

                    <IconButton
                      icon="add"
                      size="sm"
                      title="Añadir tarea a esta columna"
                      onClick={() => {
                        setEditingTask(null);
                        setTaskForm({
                          title: '',
                          description: '',
                          taskType: 'Task',
                          priority: 'Medium',
                          estimateHours: '4.0',
                          storyPoints: '2',
                          assigneeName: '',
                          sprintId: activeSprint ? activeSprint.id : '',
                          statusId: status.id
                        });
                        setTaskModalOpen(true);
                      }}
                    />
                  </div>

                  {/* Listado de Tarjetas */}
                  <div style={{
                    padding: 10,
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    {columnTasks.length === 0 ? (
                      <div style={{
                        padding: '24px 12px',
                        textAlign: 'center',
                        color: 'var(--mgh-ink-3)',
                        fontSize: 12,
                        fontStyle: 'italic',
                        border: '1px dashed var(--mgh-surface-3)',
                        borderRadius: 8
                      }}>
                        Sin tareas en este estado
                      </div>
                    ) : (
                      columnTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => handleOpenEditTask(task)}
                          style={{
                            background: '#fff',
                            borderRadius: 10,
                            padding: 12,
                            border: '1px solid var(--mgh-surface-2)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            transition: 'all 150ms ease',
                            position: 'relative'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            e.currentTarget.style.borderColor = 'var(--mgh-primary)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                            e.currentTarget.style.borderColor = 'var(--mgh-surface-2)';
                          }}
                        >
                          {/* Badges superiores: Clave, Tipo, Origen Jira */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Badge mono size="xs" tone="primary">{task.task_key}</Badge>
                              <Badge size="xs" tone={task.task_type === 'Bug' ? 'danger' : task.task_type === 'Story' ? 'success' : 'neutral'}>
                                {task.task_type}
                              </Badge>
                            </div>
                            
                            {task.origin_jira_key && (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                background: '#E0F2FE',
                                color: '#0369A1',
                                padding: '2px 6px',
                                borderRadius: 4,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                              }} title={`Clonado de ticket Jira: ${task.origin_jira_key}`}>
                                <Icon name="history" size={12} />
                                {task.origin_jira_key}
                              </span>
                            )}
                          </div>

                          {/* Título de la tarea */}
                          <div style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--mgh-ink)',
                            lineHeight: '18px',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {task.title}
                          </div>

                          {/* Métricas: Prioridad, Estimación, Puntos, Horas */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--mgh-ink-3)' }}>
                            <span style={{
                              fontWeight: 600,
                              color: task.priority === 'High' || task.priority === 'Urgent' ? 'var(--mgh-danger)' : 'var(--mgh-ink-2)'
                            }}>
                              {task.priority}
                            </span>
                            <span>•</span>
                            <span>{task.story_points || 0} pts</span>
                            <span>•</span>
                            <span>{task.estimate_hours || 0}h est.</span>
                            {task.logged_hours > 0 && (
                              <>
                                <span>•</span>
                                <span style={{ color: 'var(--mgh-success)', fontWeight: 600 }}>
                                  {task.logged_hours}h reg.
                                </span>
                              </>
                            )}
                          </div>

                          {/* Footer de Tarjeta: Responsable y Selector de Estado Rápido */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: 6,
                            borderTop: '1px solid var(--mgh-surface-1)',
                            marginTop: 2
                          }} onClick={e => e.stopPropagation()}>
                            
                            {/* Responsable */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: 'var(--mgh-surface-2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--mgh-primary)'
                              }}>
                                {task.assignee_name ? task.assignee_name.slice(0, 2).toUpperCase() : '?'}
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--mgh-ink-2)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {task.assignee_name || 'Sin asignar'}
                              </span>
                            </div>

                            {/* Mover rápido a otra columna */}
                            <select
                              value={task.status_id}
                              onChange={e => handleMoveStatus(task, e.target.value)}
                              style={{
                                fontSize: 11,
                                padding: '2px 6px',
                                borderRadius: 4,
                                border: '1px solid var(--mgh-surface-2)',
                                background: '#fff',
                                color: 'var(--mgh-ink-2)',
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                            >
                              {statuses.map(s => (
                                <option key={s.id} value={s.id}>→ {s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: BACKLOG Y GESTIÓN DE SPRINTS
          ========================================================================= */}
      {activeTab === 'backlog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Sprints: Activo y Planificados */}
          {sprints.map(sprint => {
            const sprintTasks = tasks.filter(t => t.sprint_id === sprint.id);
            const totalHours = sprintTasks.reduce((s, t) => s + (t.estimate_hours || 0), 0);
            const loggedHours = sprintTasks.reduce((s, t) => s + (t.logged_hours || 0), 0);
            const totalPoints = sprintTasks.reduce((s, t) => s + (t.story_points || 0), 0);
            const doneTasks = sprintTasks.filter(t => {
              const st = statuses.find(s => s.id === t.status_id);
              return st && st.is_done === 1;
            });
            const progress = sprintTasks.length > 0 ? Math.round((doneTasks.length / sprintTasks.length) * 100) : 0;

            return (
              <Card key={sprint.id} padding={18}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--mgh-ink)' }}>
                        {sprint.name}
                      </span>
                      <Badge
                        size="sm"
                        tone={sprint.status === 'ACTIVE' ? 'success' : sprint.status === 'CLOSED' ? 'dark' : 'neutral'}
                      >
                        {sprint.status === 'ACTIVE' ? 'Activo' : sprint.status === 'CLOSED' ? 'Completado' : 'Planificado'}
                      </Badge>
                      <span style={{ fontSize: 12, color: 'var(--mgh-ink-3)' }}>
                        {sprint.start_date || 'Sin fecha'} — {sprint.end_date || 'Sin fecha'}
                      </span>
                    </div>
                    {sprint.goal && (
                      <div style={{ fontSize: 13, color: 'var(--mgh-ink-2)', marginTop: 4 }}>
                        🎯 <strong>Objetivo:</strong> {sprint.goal}
                      </div>
                    )}
                  </div>

                  {/* Acciones de Sprint */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {sprint.status === 'PLANNED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon="play_arrow"
                        onClick={() => handleStartSprint(sprint)}
                      >
                        Iniciar Sprint
                      </Button>
                    )}
                    {sprint.status === 'ACTIVE' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="task_alt"
                        onClick={() => {
                          setSprintToComplete(sprint);
                          setCompleteSprintModalOpen(true);
                        }}
                      >
                        Completar Sprint
                      </Button>
                    )}
                  </div>
                </div>

                {/* Métricas de Avance */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'var(--mgh-surface-1)', padding: '8px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--mgh-ink-3)' }}>Progreso de Tareas</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--mgh-ink)' }}>
                      {doneTasks.length} / {sprintTasks.length} ({progress}%)
                    </div>
                  </div>
                  <div style={{ background: 'var(--mgh-surface-1)', padding: '8px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--mgh-ink-3)' }}>Puntos de Historia</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--mgh-primary)' }}>
                      {totalPoints} pts
                    </div>
                  </div>
                  <div style={{ background: 'var(--mgh-surface-1)', padding: '8px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--mgh-ink-3)' }}>Estimación vs Registrado</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--mgh-ink)' }}>
                      {(Number(loggedHours) || 0).toFixed(1)}h / {(Number(totalHours) || 0).toFixed(1)}h
                    </div>
                  </div>
                </div>
                <ProgressBar value={progress} tone={progress === 100 ? 'success' : 'primary'} />

                {/* Lista de Tareas en este Sprint */}
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sprintTasks.map(task => {
                    const st = statuses.find(s => s.id === task.status_id);
                    return (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#fff',
                          borderRadius: 8,
                          border: '1px solid var(--mgh-surface-2)',
                          fontSize: 13
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Badge mono size="xs">{task.task_key}</Badge>
                          <span style={{ fontWeight: 600, color: 'var(--mgh-ink)' }}>{task.title}</span>
                          {task.origin_jira_key && (
                            <Badge size="xs" tone="neutral">[De Jira: {task.origin_jira_key}]</Badge>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Badge size="xs" tone={st?.is_done ? 'success' : 'primary'}>{st?.name || 'Estado'}</Badge>
                          <span style={{ fontSize: 12, color: 'var(--mgh-ink-3)' }}>{task.estimate_hours}h</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mgh-ink-2)' }}>{task.assignee_name || 'Sin asignar'}</span>
                          
                          {/* Mover al backlog */}
                          <Button size="xs" variant="ghost" onClick={() => handleAssignSprint(task, 'backlog')}>
                            A Backlog
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {/* Sección de Backlog del Producto */}
          <Card padding={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--mgh-ink)' }}>
                  Backlog General del Producto ({backlogTasks.length} tareas)
                </span>
                <div style={{ fontSize: 12, color: 'var(--mgh-ink-3)' }}>
                  Tareas pendientes sin sprint asignado. Asígnalas a un ciclo con 1 clic.
                </div>
              </div>
            </div>

            {/* Input de Creación Rápida */}
            <form onSubmit={handleQuickCreateTask} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="+ Escribe el título de una nueva tarea y presiona Enter para añadirla al backlog..."
                value={quickTaskTitle}
                onChange={e => setQuickTaskTitle(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--mgh-surface-3)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
              <select
                value={quickTaskSprint}
                onChange={e => setQuickTaskSprint(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--mgh-surface-3)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  background: '#fff'
                }}
              >
                <option value="backlog">Directo al Backlog</option>
                {activeSprint && <option value={activeSprint.id}>Al Sprint Activo ({activeSprint.name})</option>}
              </select>
              <Button type="submit" variant="primary" size="sm">
                Añadir
              </Button>
            </form>

            {/* Listado de Tareas del Backlog */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {backlogTasks.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--mgh-ink-3)', fontSize: 13, fontStyle: 'italic' }}>
                  El backlog está vacío. Crea una tarea rápida arriba o clónala desde Jira.
                </div>
              ) : (
                backlogTasks.map(task => {
                  const st = statuses.find(s => s.id === task.status_id);
                  return (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#fff',
                        borderRadius: 8,
                        border: '1px solid var(--mgh-surface-2)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Badge mono size="xs">{task.task_key}</Badge>
                        <Badge size="xs" tone={task.task_type === 'Bug' ? 'danger' : 'neutral'}>{task.task_type}</Badge>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--mgh-ink)' }}>{task.title}</span>
                        {task.origin_jira_key && (
                          <Badge size="xs" tone="neutral">[De Jira: {task.origin_jira_key}]</Badge>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--mgh-ink-3)' }}>{task.story_points || 0} pts</span>
                        <span style={{ fontSize: 12, color: 'var(--mgh-ink-3)' }}>{task.estimate_hours || 0}h</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mgh-ink-2)' }}>
                          {task.assignee_name || 'Sin asignar'}
                        </span>

                        {/* Mover a Sprint */}
                        {sprints.length > 0 && (
                          <select
                            defaultValue=""
                            onChange={e => {
                              if (e.target.value) handleAssignSprint(task, e.target.value);
                            }}
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--mgh-surface-3)',
                              background: '#fff',
                              color: 'var(--mgh-primary)',
                              fontWeight: 600
                            }}
                          >
                            <option value="" disabled>Mover a Sprint...</option>
                            {sprints.filter(s => s.status !== 'CLOSED').map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        )}

                        <IconButton
                          icon="edit"
                          size="sm"
                          title="Editar tarea"
                          onClick={() => handleOpenEditTask(task)}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 3: CLONADOR DE TICKETS JIRA LEGACY A NATIVO
          ========================================================================= */}
      {activeTab === 'cloner' && (
        <Card padding={20}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--mgh-ink)' }}>
                🔄 Clonador y Migrador de Incidencias Jira Legacy
              </span>
              <Badge tone="success" size="sm">Cero Costo de Licencia</Badge>
            </div>
            <div style={{ fontSize: 13, color: 'var(--mgh-ink-3)', marginTop: 4 }}>
              Consulta el catálogo histórico de Jira Cloud o el caché local e importa tickets directamente al proyecto <strong>{selectedProjectKey}</strong> con 1 clic.
            </div>
          </div>

          {/* Buscador de Jira */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 6 }}>
                Buscar Ticket de Jira por Clave o Palabra Clave
              </label>
              <input
                type="text"
                placeholder="Ej. MSH-214, ATLAS-412, autenticación, redis..."
                value={jiraSearch}
                onChange={e => setJiraSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--mgh-surface-3)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />

              {/* Lista de resultados de Jira */}
              <div style={{
                marginTop: 10,
                maxHeight: 280,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                border: '1px solid var(--mgh-surface-2)',
                borderRadius: 8,
                padding: 6
              }}>
                {jiraIssues.map(issue => (
                  <div
                    key={issue.key}
                    onClick={() => setSelectedJiraIssue(issue)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: selectedJiraIssue?.key === issue.key ? 'rgba(51, 66, 150, 0.1)' : 'var(--mgh-surface-1)',
                      border: selectedJiraIssue?.key === issue.key ? '1px solid var(--mgh-primary)' : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Badge mono size="xs">{issue.key}</Badge>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mgh-ink)' }}>{issue.summary}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mgh-ink-3)', marginTop: 2 }}>
                        {issue.assignee || 'Sin responsable'} • {issue.estimate || 4}h estimado
                      </div>
                    </div>
                    <Badge size="xs" tone={issue.status === 'Done' ? 'success' : 'primary'}>{issue.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Vista previa y configuración de clonación */}
            <div style={{
              background: 'var(--mgh-surface-1)',
              padding: 16,
              borderRadius: 10,
              border: '1px solid var(--mgh-surface-2)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              {selectedJiraIssue ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--mgh-ink)', marginBottom: 8 }}>
                    Previsualización de Clonación
                  </div>
                  <div style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid var(--mgh-surface-2)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Badge tone="primary" size="xs">Jira: {selectedJiraIssue.key}</Badge>
                      <span style={{ fontSize: 11, color: 'var(--mgh-ink-3)' }}>→ Se creará como {selectedProjectKey}-X</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--mgh-ink)' }}>
                      {selectedJiraIssue.summary}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--mgh-ink-2)', marginTop: 4 }}>
                      Estimado: {selectedJiraIssue.estimate || 4}h • Responsable sugerido: {selectedJiraIssue.assignee || 'Sin asignar'}
                    </div>
                  </div>

                  {/* Destino en el proyecto */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                        Destino (Sprint / Backlog)
                      </label>
                      <select
                        value={clonerDestination.sprintId}
                        onChange={e => setClonerDestination(prev => ({ ...prev, sprintId: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12, background: '#fff' }}
                      >
                        <option value="">Backlog General</option>
                        {sprints.filter(s => s.status !== 'CLOSED').map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                        Estado Inicial
                      </label>
                      <select
                        value={clonerDestination.statusId}
                        onChange={e => setClonerDestination(prev => ({ ...prev, statusId: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12, background: '#fff' }}
                      >
                        <option value="">Por defecto (To Do)</option>
                        {statuses.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    icon="file_download"
                    onClick={handleExecuteClone}
                    loading={cloning}
                  >
                    Clonar a Proyecto Local ({selectedProjectKey})
                  </Button>

                  {clonedSuccess && (
                    <div style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      color: '#065F46',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>✅ Creada como tarea nativa <strong>{clonedSuccess.task_key}</strong></span>
                      <Button size="xs" variant="secondary" onClick={() => setActiveTab('board')}>
                        Ver en Tablero
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--mgh-ink-3)', margin: 'auto' }}>
                  Selecciona una incidencia de la lista izquierda para previsualizar y clonar.
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* =========================================================================
          TAB 4: CONFIGURACIÓN DE FLUJO Y ESTADOS (WORKFLOW)
          ========================================================================= */}
      {activeTab === 'workflow' && (
        <Card padding={20}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--mgh-ink)' }}>
                Configuración del Flujo de Trabajo (Workflow)
              </span>
              <div style={{ fontSize: 13, color: 'var(--mgh-ink-3)', marginTop: 2 }}>
                Personaliza las columnas del tablero Kanban para el proyecto <strong>{selectedProjectKey}</strong>.
              </div>
            </div>

            {isPrivileged && (
              <Button
                variant="primary"
                size="sm"
                icon="add"
                onClick={() => setStatusModalOpen(true)}
              >
                + Nuevo Estado
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {statuses.map((status, index) => (
              <div
                key={status.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#fff',
                  borderRadius: 10,
                  border: '1px solid var(--mgh-surface-2)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--mgh-ink-3)' }}>
                    #{index + 1}
                  </span>
                  <span style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: status.color || '#3b82f6',
                    display: 'inline-block'
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--mgh-ink)' }}>
                    {status.name}
                  </span>
                  <Badge
                    size="xs"
                    tone={status.category === 'done' ? 'success' : status.category === 'in_progress' ? 'primary' : 'neutral'}
                  >
                    Categoría: {status.category}
                  </Badge>
                  {status.is_default === 1 && (
                    <Badge size="xs" tone="neutral">Por Defecto</Badge>
                  )}
                  {status.is_done === 1 && (
                    <Badge size="xs" tone="success">Cierre / Completada</Badge>
                  )}
                </div>

                {isPrivileged && statuses.length > 2 && (
                  <IconButton
                    icon="delete"
                    size="sm"
                    title="Eliminar estado"
                    onClick={() => handleDeleteStatus(status.id)}
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* =========================================================================
          TAB 5: MIEMBROS DEL PROYECTO
          ========================================================================= */}
      {activeTab === 'members' && (
        <Card padding={20}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--mgh-ink)' }}>
                Colaboradores y Miembros del Proyecto
              </span>
              <div style={{ fontSize: 13, color: 'var(--mgh-ink-3)', marginTop: 2 }}>
                Todos los miembros tienen visibilidad total de las tareas y sprints del proyecto <strong>{selectedProjectKey}</strong>.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {members.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--mgh-ink-3)', fontSize: 13 }}>
                No hay miembros explícitos en este proyecto. Los empleados asignados en el perfil tienen acceso general.
              </div>
            ) : (
              members.map(m => (
                <div
                  key={m.id}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: '#fff',
                    border: '1px solid var(--mgh-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--mgh-primary-50, #EEF2FF)',
                    color: 'var(--mgh-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14
                  }}>
                    {m.user_name ? m.user_name.slice(0, 2).toUpperCase() : 'US'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--mgh-ink)' }}>
                      {m.user_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--mgh-ink-3)' }}>
                      {m.user_email || 'Colaborador'}
                    </div>
                  </div>
                  <Badge size="xs" tone={m.role === 'lead' ? 'warning' : 'primary'}>
                    {m.role === 'lead' ? 'Project Lead' : 'Miembro'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* =========================================================================
          MODAL: CREAR / EDITAR TAREA NATIVA
          ========================================================================= */}
      {taskModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            width: 600,
            maxWidth: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden'
          }}>
            {/* Header del Modal */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--mgh-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--mgh-surface-1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--mgh-ink)' }}>
                  {editingTask ? `Editar Tarea: ${editingTask.task_key}` : `Nueva Tarea en ${selectedProjectKey}`}
                </span>
                {editingTask && editingTask.origin_jira_key && (
                  <Badge size="xs" tone="neutral">[De Jira: {editingTask.origin_jira_key}]</Badge>
                )}
              </div>
              <IconButton icon="close" size="sm" onClick={() => setTaskModalOpen(false)} />
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveTask} style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                  Título / Resumen *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Descripción concisa del entregable..."
                  value={taskForm.title}
                  onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--mgh-surface-3)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                  Descripción Detallada
                </label>
                <textarea
                  rows={4}
                  placeholder="Detalles técnicos, criterios de aceptación, enlaces a PR o arquitectura..."
                  value={taskForm.description}
                  onChange={e => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--mgh-surface-3)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                    Tipo de Tarea
                  </label>
                  <select
                    value={taskForm.taskType}
                    onChange={e => setTaskForm(prev => ({ ...prev, taskType: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12, background: '#fff' }}
                  >
                    <option value="Story">Story</option>
                    <option value="Task">Task</option>
                    <option value="Bug">Bug</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                    Prioridad
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={e => setTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12, background: '#fff' }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                    Horas Estimadas
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={taskForm.estimateHours}
                    onChange={e => setTaskForm(prev => ({ ...prev, estimateHours: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                    Puntos de Historia (Story Points)
                  </label>
                  <input
                    type="number"
                    value={taskForm.storyPoints}
                    onChange={e => setTaskForm(prev => ({ ...prev, storyPoints: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                    Responsable Asignado
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre del colaborador..."
                    value={taskForm.assigneeName}
                    onChange={e => setTaskForm(prev => ({ ...prev, assigneeName: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                    Sprint
                  </label>
                  <select
                    value={taskForm.sprintId}
                    onChange={e => setTaskForm(prev => ({ ...prev, sprintId: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12, background: '#fff' }}
                  >
                    <option value="">Backlog General (Sin Sprint)</option>
                    {sprints.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                  Estado de Flujo
                </label>
                <select
                  value={taskForm.statusId}
                  onChange={e => setTaskForm(prev => ({ ...prev, statusId: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12, background: '#fff' }}
                >
                  {statuses.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              </div>

              {/* Botones de acción del Modal */}
              <div style={{
                display: 'flex',
                justifyContent: editingTask ? 'space-between' : 'flex-end',
                alignItems: 'center',
                paddingTop: 16,
                borderTop: '1px solid var(--mgh-surface-2)',
                marginTop: 8
              }}>
                {editingTask && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon="delete"
                    onClick={() => handleDeleteTask(editingTask)}
                  >
                    Eliminar Tarea
                  </Button>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTaskModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    {editingTask ? 'Guardar Cambios' : 'Crear Tarea'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREAR SPRINT
          ========================================================================= */}
      {sprintModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            width: 500,
            maxWidth: '100%',
            padding: 24,
            boxShadow: 'var(--shadow-xl)'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--mgh-ink)', marginBottom: 6 }}>
              Crear Nuevo Sprint en {selectedProjectKey}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mgh-ink-3)', marginBottom: 16 }}>
              Planifica un ciclo de iteración con objetivos y fechas de entrega.
            </div>

            <form onSubmit={handleCreateSprint} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                  Nombre del Sprint *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sprint 26 - Motor de Nómina"
                  value={sprintForm.name}
                  onChange={e => setSprintForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                  Objetivo del Sprint (Goal)
                </label>
                <input
                  type="text"
                  placeholder="Meta principal alcanzable en este ciclo..."
                  value={sprintForm.goal}
                  onChange={e => setSprintForm(prev => ({ ...prev, goal: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={sprintForm.startDate}
                    onChange={e => setSprintForm(prev => ({ ...prev, startDate: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                    Fecha de Cierre
                  </label>
                  <input
                    type="date"
                    value={sprintForm.endDate}
                    onChange={e => setSprintForm(prev => ({ ...prev, endDate: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSprintModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Crear Sprint
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: COMPLETAR SPRINT Y TRASPASAR PENDIENTES
          ========================================================================= */}
      {completeSprintModalOpen && sprintToComplete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            width: 480,
            maxWidth: '100%',
            padding: 24,
            boxShadow: 'var(--shadow-xl)'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--mgh-ink)', marginBottom: 6 }}>
              Completar Sprint: {sprintToComplete.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mgh-ink-3)', marginBottom: 16 }}>
              ¿Qué deseas hacer con las tareas que no alcanzaron el estado <strong>Done</strong>?
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: moveRemainingTo === 'backlog' ? 'rgba(51, 66, 150, 0.08)' : 'var(--mgh-surface-1)',
                border: moveRemainingTo === 'backlog' ? '1px solid var(--mgh-primary)' : '1px solid var(--mgh-surface-2)',
                cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="remainingAction"
                  checked={moveRemainingTo === 'backlog'}
                  onChange={() => setMoveRemainingTo('backlog')}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mgh-ink)' }}>
                    Mover tareas pendientes al Backlog General
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mgh-ink-3)' }}>
                    Se liberarán del sprint para replanificarlas en el futuro.
                  </div>
                </div>
              </label>

              {sprints.filter(s => s.id !== sprintToComplete.id && s.status !== 'CLOSED').map(otherSprint => (
                <label
                  key={otherSprint.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: moveRemainingTo === otherSprint.id ? 'rgba(51, 66, 150, 0.08)' : 'var(--mgh-surface-1)',
                    border: moveRemainingTo === otherSprint.id ? '1px solid var(--mgh-primary)' : '1px solid var(--mgh-surface-2)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="remainingAction"
                    checked={moveRemainingTo === otherSprint.id}
                    onChange={() => setMoveRemainingTo(otherSprint.id)}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mgh-ink)' }}>
                      Traspasar directamente a: {otherSprint.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mgh-ink-3)' }}>
                      Ciclo siguiente ({otherSprint.status})
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setCompleteSprintModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmCompleteSprint}>
                Completar y Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREAR ESTADO PERSONALIZADO DE FLUJO
          ========================================================================= */}
      {statusModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            width: 440,
            maxWidth: '100%',
            padding: 24,
            boxShadow: 'var(--shadow-xl)'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--mgh-ink)', marginBottom: 6 }}>
              Añadir Estado al Flujo
            </div>
            <div style={{ fontSize: 13, color: 'var(--mgh-ink-3)', marginBottom: 16 }}>
              Crea una nueva columna en el tablero para el proyecto <strong>{selectedProjectKey}</strong>.
            </div>

            <form onSubmit={handleCreateStatus} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                  Nombre del Estado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. QA Testing, Code Review, Bloqueado..."
                  value={statusForm.name}
                  onChange={e => setStatusForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                  Categoría
                </label>
                <select
                  value={statusForm.category}
                  onChange={e => setStatusForm(prev => ({ ...prev, category: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12, background: '#fff' }}
                >
                  <option value="todo">Por Hacer (To Do)</option>
                  <option value="in_progress">En Progreso (In Progress)</option>
                  <option value="done">Completado / Terminado (Done)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--mgh-ink-2)', marginBottom: 4 }}>
                  Color Identificador
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={statusForm.color}
                    onChange={e => setStatusForm(prev => ({ ...prev, color: e.target.value }))}
                    style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={statusForm.color}
                    onChange={e => setStatusForm(prev => ({ ...prev, color: e.target.value }))}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--mgh-surface-3)', fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setStatusModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Añadir Estado
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
