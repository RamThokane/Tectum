import { PageShell } from '../components/Layout';
import NotFoundState from '../components/NotFoundState';

export default function NotFound() {
  return (
    <PageShell>
      <NotFoundState title="Page not found">The page you're looking for doesn't exist or has moved.</NotFoundState>
    </PageShell>
  );
}
