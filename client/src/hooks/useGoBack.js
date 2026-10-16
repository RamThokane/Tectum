import { useLocation, useNavigate } from 'react-router-dom';

/**
 * "Back" for in-app back buttons: the previous page in Tectum, or `fallback` when this page was
 * opened directly (a link, a fresh tab, or the iPhone home-screen app, which has no browser back
 * button). React Router marks the first page of a visit with the key "default".
 */
export function useGoBack(fallback = '/home') {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => (key !== 'default' ? navigate(-1) : navigate(fallback, { replace: true }));
}
