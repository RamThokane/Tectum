import { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api } from './api/client';
import { useAuthStore } from './store/auth';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { PageLoader, Toaster } from './components/ui';
import { pages } from './lib/routes';
import { useScrollManager } from './hooks/useScrollManager';
import { useCanonicalLink } from './hooks/useDocumentTitle';
const {
  landing: Landing, login: Login, signup: Signup, forgot: ForgotPassword, reset: ResetPassword, feed: Feed, home: Home,
  wards: Wards, ward: Ward, cases: CaseRounds, post: PostDetail, profile: Profile, discover: Discovery, topic: Topic,
  notifications: Notifications, admin: Admin, settings: Settings, notebook: Saved, notFound: NotFound, legal: Legal, messages: Messages,
  privacyDemo: PrivacyDemo, styleguide: Styleguide,
} = pages;

function RequireAuth({ children }) {
  const status = useAuthStore((s) => s.status);
  const loggedOut = useAuthStore((s) => s.loggedOut);
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (status === 'guest') {
    // Just logged out: the landing page. Otherwise (e.g. session expired): log in, then come back here.
    if (loggedOut) return <Navigate to="/" replace />;
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return children;
}

/** Old /search links now live on the Discovery page. */
function SearchRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/discover${search}`} replace />;
}

function GuestOnly({ children }) {
  const status = useAuthStore((s) => s.status);
  const { pathname, search } = useLocation();
  // Logged-in members may open /login?add=1 to add another account.
  const addingAccount = pathname === '/login' && new URLSearchParams(search).get('add') === '1';
  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated' && !addingAccount) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);

  // Restore the session from the httpOnly cookie on first load.
  useEffect(() => {
    api
      .get('/auth/me')
      .then((r) => setSession(r.data.user))
      .catch(() => clear());
  }, [setSession, clear]);

  const { pathname } = useLocation();
  useScrollManager();
  useCanonicalLink();

  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/legal/:doc" element={<Legal />} />
          {/* design system v2 for review (not linked from the app) */}
          <Route path="/styleguide" element={<Styleguide />} />

          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/home" element={<Home />} />
            {/* the full community feed (Home's "See all") */}
            <Route path="/feed" element={<Feed />} />
            {/* posts open for academic collaboration (was /feed?collab=1) */}
            <Route path="/collaboration" element={<Feed />} />
            <Route path="/wards" element={<Wards />} />
            <Route path="/ward/:slug" element={<Ward />} />
            <Route path="/cases" element={<CaseRounds />} />
            <Route path="/cases/:id" element={<CaseRounds />} />
            {/* The Notes Library was removed; old links land on the home feed. */}
            <Route path="/notes" element={<Navigate to="/home" replace />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/discover" element={<Discovery />} />
            <Route path="/topic/:slug" element={<Topic />} />
            <Route path="/search" element={<SearchRedirect />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:id" element={<Messages />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/notebook" element={<Saved />} />
            <Route path="/privacy-demo" element={<PrivacyDemo />} />
            {/* "Saved" became the Notebook; old links keep working */}
            <Route path="/saved" element={<Navigate to="/notebook" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </ErrorBoundary>
  );
}

