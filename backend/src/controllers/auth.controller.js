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
    user: req.user,
  });
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
  logout,
};
