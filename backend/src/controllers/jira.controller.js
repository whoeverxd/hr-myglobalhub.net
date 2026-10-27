const jiraService = require('../services/jira.service');

const getClientIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
const getUserName = (req) => (req.user && req.user.name) || req.headers['x-user'] || 'Elena Rostova';

async function getStatus(req, res, next) {
  try {
    const config = jiraService.getConfig();
    const testResult = await jiraService.testConnection();
    const syncStatus = jiraService.getSyncStatus();
    const cachedCount = jiraService.getCachedCount();

    res.json({
      ...config,
      connection: testResult,
      sync: syncStatus,
      cachedCount,
    });
  } catch (err) {
    next(err);
  }
}

async function searchIssues(req, res, next) {
  try {
    const { query = '', projectKey, limit = 20 } = req.query;
    const issues = jiraService.searchIssues({ query, projectKey, limit: Number(limit) || 20 });
    res.json(issues);
  } catch (err) {
    next(err);
  }
}

async function syncIssues(req, res, next) {
  try {
    const { projectKey, limit = 50 } = req.body || {};
    const result = await jiraService.syncIssuesFromJira({
      projectKey,
      limit: Number(limit) || 50,
      user: getUserName(req),
      ip: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function syncWorklogs(req, res, next) {
  try {
    const { empId, dateFrom, dateTo } = req.body || {};
    const result = jiraService.syncWorklogs({
      empId,
      dateFrom,
      dateTo,
      user: getUserName(req),
      ip: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getProjects(req, res, next) {
  try {
    const list = jiraService.listProjects();
    res.json(list);
  } catch (err) {
    next(err);
  }
}

async function linkProject(req, res, next) {
  try {
    const { key, projectKey } = req.body || {};
    const result = await jiraService.validateAndLinkProject({
      key: key || projectKey,
      user: getUserName(req),
      ip: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getProjectIssues(req, res, next) {
  try {
    const { key } = req.params;
    const { q, status } = req.query;
    const result = jiraService.getProjectIssues({
      projectKey: key,
      query: q,
      status,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function syncProject(req, res, next) {
  try {
    const { key } = req.params;
    const { limit } = req.body || {};
    const result = await jiraService.syncIssuesFromJira({
      projectKey: key,
      limit: Number(limit) || 100,
      user: getUserName(req),
      ip: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createProject(req, res, next) {
  try {
    const result = jiraService.createProject({
      ...req.body,
      user: getUserName(req),
      ip: getClientIp(req),
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateProject(req, res, next) {
  try {
    const { key } = req.params;
    const result = jiraService.updateProject(key, {
      ...req.body,
      user: getUserName(req),
      ip: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    const { key } = req.params;
    const result = jiraService.deleteProject(key, {
      user: getUserName(req),
      ip: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  searchIssues,
  syncIssues,
  syncWorklogs,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  linkProject,
  getProjectIssues,
  syncProject,
};

