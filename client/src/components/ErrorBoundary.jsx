import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

// After a new deploy, a tab opened earlier asks for page files that no longer exist.
const isStaleChunk = (err) => /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(err?.message || '');
const RELOAD_KEY = 'tectum-chunk-reload';

/**
 * Catches a crash while drawing a page, so the member sees a way out instead of a blank screen.
 * Give it `resetKey` (e.g. the current path) to clear the error when they navigate away.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isStaleChunk(error)) {
      // Reload to pick up the new version - at most once every 30 s, so a truly missing file can't loop.
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        /* storage blocked: show the fallback instead */
      }
    }
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
        <h1 className="font-editorial font-medium mt-3 text-[17px]">Something went wrong</h1>
        <p className="muted mt-1 max-w-sm text-[13px]">This page couldn't be shown. Reloading usually fixes it.</p>
        <div className="mt-5 flex gap-2">
          <button className="btn-primary" onClick={() => window.location.reload()}>Reload</button>
          <a href="/home" className="btn-secondary">Go to Home</a>
        </div>
      </div>
    );
  }
}
