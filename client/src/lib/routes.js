import { lazy } from 'react';

/**
 * Page code is split per route. Each loader is kept here so the same import can be started early:
 * hovering or focusing a menu link calls `prefetchRoute(path)`, so the page is usually ready by the
 * time it's clicked (no loading flash).
 */
export const loaders = {
  landing: () => import('../pages/Landing'),
  login: () => import('../pages/Login'),
  signup: () => import('../pages/Signup'),
  forgot: () => import('../pages/ForgotPassword'),
  reset: () => import('../pages/ResetPassword'),
  feed: () => import('../pages/Feed'),
  home: () => import('../pages/Home'),
  wards: () => import('../pages/Wards'),
  ward: () => import('../pages/Ward'),
  cases: () => import('../pages/CaseRounds'),
  post: () => import('../pages/PostDetail'),
  profile: () => import('../pages/Profile'),
  discover: () => import('../pages/Discovery'),
  topic: () => import('../pages/Topic'),
  notifications: () => import('../pages/Notifications'),
  admin: () => import('../pages/Admin'),
  settings: () => import('../pages/Settings'),
  notebook: () => import('../pages/Saved'),
  notFound: () => import('../pages/NotFound'),
  legal: () => import('../pages/Legal'),
  messages: () => import('../pages/Messages'),
  privacyDemo: () => import('../pages/PrivacyDemo'),
  styleguide: () => import('../pages/Styleguide'),
  // tests
  quizHome: () => import('../pages/quiz/QuizHome'),
  quizEditor: () => import('../pages/quiz/QuizEditor'),
  quizManage: () => import('../pages/quiz/QuizManage'),
  quizAttemptReview: () => import('../pages/quiz/AttemptReview'),
  quizJoin: () => import('../pages/quiz/QuizJoin'),
  quizInstructions: () => import('../pages/quiz/QuizInstructions'),
  quizAttempt: () => import('../pages/quiz/QuizAttempt'),
  quizResult: () => import('../pages/quiz/QuizResult'),
  quizDetails: () => import('../pages/quiz/QuizDetails'),
};

export const pages = Object.fromEntries(Object.entries(loaders).map(([k, load]) => [k, lazy(load)]));

/** First path segment -> loader. */
const BY_PREFIX = {
  home: 'home',
  feed: 'feed',
  wards: 'wards',
  ward: 'ward',
  cases: 'cases',
  post: 'post',
  profile: 'profile',
  discover: 'discover',
  topic: 'topic',
  notifications: 'notifications',
  admin: 'admin',
  settings: 'settings',
  notebook: 'notebook',
  messages: 'messages',
  quiz: 'quizHome',
  legal: 'legal',
  login: 'login',
  signup: 'signup',
};

const started = new Set();
export function prefetchRoute(to) {
  const seg = String(to || '').replace(/^\//, '').split(/[/?#]/)[0];
  const key = BY_PREFIX[seg];
  if (!key || started.has(key)) return;
  started.add(key);
  loaders[key]().catch(() => started.delete(key));
}

/** Spread onto a <Link> to warm its page up on hover / keyboard focus / touch. */
export const prefetchProps = (to) => ({
  onMouseEnter: () => prefetchRoute(to),
  onFocus: () => prefetchRoute(to),
  onTouchStart: () => prefetchRoute(to),
});
