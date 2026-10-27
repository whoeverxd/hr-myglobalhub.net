const agileService = require('../services/agile.service');

const getClientIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
const getUserName = (req) => (req.user && req.user.name) || req.headers['x-user'] || 'Elena Rostova';

// Statuses / Workflow
async function getStatuses(req, res, next) {
  try {
    const { key } = req.params;
    const statuses = agileService.getStatuses(key);
    res.json(statuses);
  } catch (err) {
    next(err);
  }
}

async function createStatus(req, res, next) {
  try {
    const { key } = req.params;
    const status = agileService.createStatus(key, req.body || {}, getUserName(req), getClientIp(req));
    res.status(201).json(status);
  } catch (err) {
    next(err);
  }
}

async function updateStatuses(req, res, next) {
  try {
    const { key } = req.params;
    const list = Array.isArray(req.body) ? req.body : (req.body.statuses || []);
    const updated = agileService.updateStatuses(key, list, getUserName(req), getClientIp(req));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteStatus(req, res, next) {
  try {
    const { key, id } = req.params;
    const result = agileService.deleteStatus(key, id, getUserName(req), getClientIp(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Sprints
async function listSprints(req, res, next) {
  try {
    const { key } = req.params;
    const sprints = agileService.listSprints(key);
    res.json(sprints);
  } catch (err) {
    next(err);
  }
}

async function createSprint(req, res, next) {
  try {
    const { key } = req.params;
    const sprint = agileService.createSprint(key, req.body || {}, getUserName(req), getClientIp(req));
    res.status(201).json(sprint);
  } catch (err) {
    next(err);
  }
}

async function updateSprint(req, res, next) {
  try {
    const { id } = req.params;
    const sprint = agileService.updateSprint(id, req.body || {}, getUserName(req), getClientIp(req));
    res.json(sprint);
  } catch (err) {
    next(err);
  }
}

async function startSprint(req, res, next) {
  try {
    const { id } = req.params;
    const sprint = agileService.startSprint(id, req.body || {}, getUserName(req), getClientIp(req));
    res.json(sprint);
  } catch (err) {
    next(err);
  }
}

async function completeSprint(req, res, next) {
  try {
    const { id } = req.params;
    const sprint = agileService.completeSprint(id, req.body || {}, getUserName(req), getClientIp(req));
    res.json(sprint);
  } catch (err) {
    next(err);
  }
}

async function deleteSprint(req, res, next) {
  try {
    const { id } = req.params;
    const result = agileService.deleteSprint(id, getUserName(req), getClientIp(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Tasks
async function listTasks(req, res, next) {
  try {
    const { key } = req.params;
    const { sprintId, inBacklog, statusId, assigneeId, query, limit } = req.query;
    const tasks = agileService.listTasks(key, { sprintId, inBacklog, statusId, assigneeId, query, limit });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

async function getTask(req, res, next) {
  try {
    const { id } = req.params;
    const task = agileService.getTask(id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(task);
  } catch (err) {
    next(err);
  }
}

async function createTask(req, res, next) {
  try {
    const { key } = req.params;
    const task = agileService.createTask(key, req.body || {}, getUserName(req), getClientIp(req));
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const task = agileService.updateTask(id, req.body || {}, getUserName(req), getClientIp(req));
    res.json(task);
  } catch (err) {
    next(err);
  }
}

async function moveTask(req, res, next) {
  try {
    const { id } = req.params;
    const task = agileService.moveTask(id, req.body || {}, getUserName(req), getClientIp(req));
    res.json(task);
  } catch (err) {
    next(err);
  }
}

async function deleteTask(req, res, next) {
  try {
    const { id } = req.params;
    const result = agileService.deleteTask(id, getUserName(req), getClientIp(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function searchAllTasks(req, res, next) {
  try {
    const { query = '', projectKey, assigneeId, limit = 15 } = req.query;
    const tasks = agileService.searchAllTasks({ query, projectKey, assigneeId, limit });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

// Jira Cloner
async function cloneJiraIssue(req, res, next) {
  try {
    const result = await agileService.cloneJiraIssue(req.body || {}, getUserName(req), getClientIp(req));
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// Project Members
async function listMembers(req, res, next) {
  try {
    const { key } = req.params;
    const members = agileService.listMembers(key);
    res.json(members);
  } catch (err) {
    next(err);
  }
}

async function addMember(req, res, next) {
  try {
    const { key } = req.params;
    const member = agileService.addMember(key, req.body || {}, getUserName(req), getClientIp(req));
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    const { key, userId } = req.params;
    const result = agileService.removeMember(key, userId, getUserName(req), getClientIp(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatuses,
  createStatus,
  updateStatuses,
  deleteStatus,
  listSprints,
  createSprint,
  updateSprint,
  startSprint,
  completeSprint,
  deleteSprint,
  listTasks,
  getTask,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  searchAllTasks,
  cloneJiraIssue,
  listMembers,
  addMember,
  removeMember,
};
