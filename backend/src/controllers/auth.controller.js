const authService = require('../services/auth.service');
const firebaseService = require('../services/firebase.service');

const getClientIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const result = await authService.login({
      email,
      password,
      ip: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function loginWithGoogle(req, res, next) {
  try {
    const { idToken } = req.body || {};
    const result = await authService.loginWithGoogle({
      idToken,
      ip: getClientIp(req),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function getFirebaseConfig(req, res) {
  res.json({
    config: firebaseService.getPublicConfig(),
  });
}

function getMe(req, res) {
  res.json({
    user: req.user ? { ...req.user, hasPassword: authService.hasLocalPassword(req.user.id), mustChangePassword: authService.mustChangePassword(req.user.id) } : req.user,
  });
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, googleIdToken } = req.body || {};
    res.json(await authService.changePassword({ userId: req.user.id, currentPassword, newPassword, googleIdToken, ip: getClientIp(req) }));
  } catch (err) {
    next(err);
  }
}

function resetEmployeePassword(req, res, next) {
  try {
    res.json(authService.resetPasswordForEmployee({ employeeId: req.params.id, actor: req.user, ip: getClientIp(req) }));
  } catch (err) {
    next(err);
  }
}

function logout(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : req.headers['x-auth-token'];
    authService.logout(token, getClientIp(req));
    res.json({ ok: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  loginWithGoogle,
  getFirebaseConfig,
  getMe,
  changePassword,
  resetEmployeePassword,
  logout,
};
