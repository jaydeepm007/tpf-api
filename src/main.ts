import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3200);

// middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// mount API router on both /api and / for compatibility
app.use('/api', apiRouter);
app.use('/', apiRouter);

// simple health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

// list registered routes for debugging
function listRoutes() {
  const out: { method: string; path: string }[] = [];
  const stack = (app as any)._router?.stack || [];
  for (const layer of stack) {
    if (layer.route && layer.route.path) {
      const methods = layer.route.methods || {};
      const method = Object.keys(methods).find((m) => methods[m])?.toUpperCase() || 'GET';
      out.push({ method, path: layer.route.path });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      for (const nested of layer.handle.stack) {
        if (nested.route && nested.route.path) {
          const methods = nested.route.methods || {};
          const method = Object.keys(methods).find((m) => methods[m])?.toUpperCase() || 'GET';
          // include parent prefix if available
          const prefix = layer.regexp && layer.regexp.fast_slash ? '' : (layer.regexp && layer.regexp.source) || '';
          out.push({ method, path: nested.route.path });
        }
      }
    }
  }
  return out;
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('Registered routes:', listRoutes());
});

// basic 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});