import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Home } from 'lucide-react';
import { EmptyState } from './ui';

/**
 * The one "doesn't exist" screen (missing post, case, profile, Ward or page): what's missing,
 * then Go back and Home. `extra` adds a page-specific action (e.g. "See all Wards").
 */
export default function NotFoundState({ icon = Compass, title = 'Page not found', children, extra }) {
  const navigate = useNavigate();
  // React Router records how deep we are in this tab's history; at 0 there's nothing to go back to.
  const canGoBack = (window.history.state?.idx ?? 0) > 0;
  return (
    <EmptyState
      icon={icon}
      title={title}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => (canGoBack ? navigate(-1) : navigate('/home'))}>
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
          <Link to="/home" className="btn-primary">
            <Home className="h-4 w-4" /> Home
          </Link>
          {extra}
        </div>
      }
    >
      {children}
    </EmptyState>
  );
}
