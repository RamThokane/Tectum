import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';

/**
 * Per-request database timing. Every Mongoose query / aggregate run while handling a request is
 * timed; the totals go out as a `Server-Timing` header (visible in the browser's Network panel)
 * and slow requests are logged with their slowest DB calls, e.g.
 *   [slow] GET /api/posts/123 1830ms · 9 DB calls, 1702ms in DB · Post.findOne 231ms, Comment.find 229ms, …
 * Must be imported before any model is compiled (global plugins apply at mongoose.model()).
 */
const store = new AsyncLocalStorage();
const SLOW_MS = Number(process.env.SLOW_REQUEST_MS) || 300;
const LOG_ALL = process.env.DB_TIMING === '1';

const QUERY_OPS = /^(find|findOne|findOneAndUpdate|findOneAndDelete|countDocuments|estimatedDocumentCount|distinct|updateOne|updateMany|deleteOne|deleteMany|replaceOne)$/;

function record(label, startedAt) {
  const calls = store.getStore();
  if (calls) calls.push({ label, ms: performance.now() - startedAt });
}

mongoose.plugin((schema) => {
  schema.pre(QUERY_OPS, function startTimer() {
    this._dbTimingStart = performance.now();
  });
  schema.post(QUERY_OPS, function stopTimer() {
    if (this._dbTimingStart) record(`${this.model?.modelName}.${this.op}`, this._dbTimingStart);
  });
  schema.pre('aggregate', function startTimer() {
    this._dbTimingStart = performance.now();
  });
  schema.post('aggregate', function stopTimer() {
    if (this._dbTimingStart) record(`${this._model?.modelName}.aggregate`, this._dbTimingStart);
  });
});

/** Express middleware: collects this request's DB calls. */
export function dbTiming(req, res, next) {
  const calls = [];
  const started = performance.now();
  const total = () => calls.reduce((s, c) => s + c.ms, 0);
  const writeHead = res.writeHead;
  res.writeHead = function withServerTiming(...args) {
    if (!res.headersSent) {
      res.setHeader('Server-Timing', `db;desc="${calls.length} queries";dur=${total().toFixed(1)}, app;dur=${(performance.now() - started).toFixed(1)}`);
    }
    return writeHead.apply(this, args);
  };
  res.on('finish', () => {
    const ms = performance.now() - started;
    if (!req.originalUrl.startsWith('/api') || (!LOG_ALL && ms < SLOW_MS)) return;
    const slowest = [...calls].sort((a, b) => b.ms - a.ms).slice(0, 5).map((c) => `${c.label} ${Math.round(c.ms)}ms`).join(', ');
    console.log(`[${ms >= SLOW_MS ? 'slow' : 'timing'}] ${req.method} ${req.originalUrl.split('?')[0]} ${Math.round(ms)}ms · ${calls.length} DB calls, ${Math.round(total())}ms in DB${slowest ? ` · ${slowest}` : ''}`);
  });
  store.run(calls, next);
}
