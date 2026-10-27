require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { requestLogger } = require('./src/middleware/logger.middleware');
const { initDatabase, getDialect } = require('./src/db');
const routes = require('./src/routes');

const app = express();
// 5050 by default: on macOS port 5000 is taken by AirPlay Receiver.
const PORT = process.env.PORT || 5050;

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '12mb' })); // proof-of-payment images are sent as data URLs
app.use(requestLogger);

app.use('/api', routes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// In production, serve the built React app (npm run build in ../frontend)
const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[server error]', err);
  }
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

async function startServer() {
  try {
    if (initDatabase) {
      await initDatabase();
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`MGH Timekeeping API running on http://127.0.0.1:${PORT} [DB: ${getDialect()}]`);
    });
  } catch (err) {
    console.error('[server startup error]', err);
    process.exit(1);
  }
}

startServer();
