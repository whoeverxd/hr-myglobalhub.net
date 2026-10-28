// Audit actor: always the authenticated user, never a client-supplied header or an invented name.
const SYSTEM_ACTOR = 'System';

function getUserName(req) {
  return (req && req.user && req.user.name) || SYSTEM_ACTOR;
}

module.exports = { getUserName, SYSTEM_ACTOR };
