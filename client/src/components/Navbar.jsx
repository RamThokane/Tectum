import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  Stethoscope,
  Hospital,
  ChevronRight,
  ChevronLeft,
  Bell,
  Mail,
  User,
  Plus,
  Moon,
  Sun,
  LogOut,
  ShieldCheck,
  BadgeCheck,
  Settings,
  MoreHorizontal,
  NotebookPen,
  ClipboardCheck,
  PanelLeftOpen,
  PanelLeftClose,
  LifeBuoy,
  ArrowLeftRight,
  UserPlus,
  Search,
  X,
} from 'lucide-react';
import { useSavedAccounts, useSwitchAccount, useLogout } from '../hooks/useAccounts';
import { useGoBack } from '../hooks/useGoBack';
import { useScrollLock } from './ui';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';
import Avatar from './Avatar';
import { hasBlueTick, Tick } from './VerificationBadge';
import { CollabIcon } from './ds/icons';
import { SpecialtyDot } from './ds/display';
import { userTitle } from '../lib/constants';
import { specialtyMeta } from '../lib/specialties';
import { useMyWards } from '../hooks/useWards';
import { cn } from '../lib/format';
import { prefetchRoute, prefetchProps } from '../lib/routes';
import { sectionFor } from '../lib/nav';

/** Tectum's mark: the "T" cut from the owner's logo (Pictures\ttm.png) - client/public/logo-mark.png. */
export function LogoMark({ className }) {
  return <img src="/logo-mark.png" alt="" aria-hidden="true" draggable={false} className={cn('shrink-0 object-contain', className)} />;
}

/** The mark plus "Tectum" in the logo's typeface and navy (`wordmark` in index.css). */
export function Logo({ className, compact = false, nameClass }) {
  return (
    <Link to="/home" className={cn('flex items-center gap-1.5', className)} aria-label="Tectum home">
      <LogoMark className={compact ? 'h-10 w-10' : 'h-11 w-11'} />
      <span className={cn('whitespace-nowrap wordmark leading-none', compact ? 'text-[25px]' : 'text-[30px]', nameClass)}>
        Tectum
      </span>
    </Link>
  );
}

export function useUnreadCount() {
  const status = useAuthStore((s) => s.status);
  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    // just the count (the bell badge); live socket events refresh it, polling is the fallback
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data.unreadCount),
    enabled: status === 'authenticated',
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  return data ?? 0;
}

export function ThemeToggle({ className }) {
  const theme = useUIStore((s) => s.theme);
  const toggle = useUIStore((s) => s.toggleTheme);
  return (
    <button onClick={toggle} className={cn('btn-ghost p-2', className)} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

/** Unread count on an icon: the coral accent (dark text on coral passes AA). */
function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="ds-num absolute -right-1.5 -top-1 min-w-[18px] rounded-full bg-ds-accent px-1 text-center text-caption font-semibold leading-[18px] text-ds-on-accent ring-2 ring-ds-surface">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Other accounts saved on this browser, for one-tap switching in menus. */
function QuickSwitch({ onDone, itemClass }) {
  const { data } = useSavedAccounts();
  const switchTo = useSwitchAccount();
  const others = (data ?? []).filter((a) => !a.current);
  return (
    <>
      {others.map((a) => (
        <button
          key={a._id}
          className={itemClass}
          disabled={switchTo.isPending}
          onClick={() => {
            onDone?.();
            switchTo.mutate(a._id);
          }}
        >
          <Avatar user={a} size="xs" /> <span className="truncate">Switch to {a.name}</span>
        </button>
      ))}
      <Link to={others.length ? '/settings?section=accounts' : '/login?add=1'} className={itemClass} onClick={onDone}>
        {others.length ? <ArrowLeftRight className="size-4.5" strokeWidth={1.5} /> : <UserPlus className="size-4.5" strokeWidth={1.5} />}
        {others.length ? 'Manage accounts' : 'Add another account'}
      </Link>
    </>
  );
}

/** Which menu item is active for the current page (see lib/nav.js). */
function useSection() {
  const { pathname, search } = useLocation();
  const myId = useAuthStore((s) => s.user?._id);
  return sectionFor(pathname, search, myId);
}

/** Unread direct messages across all conversations (kept fresh by the socket in useSocket). */
export function useUnreadMessages() {
  const status = useAuthStore((s) => s.status);
  const { data } = useQuery({
    queryKey: ['chat', 'unread'],
    queryFn: () => api.get('/chat/unread').then((r) => r.data.unread),
    enabled: status === 'authenticated',
    staleTime: 60_000, // the chat socket refreshes it when a message arrives
    refetchInterval: 120_000,
  });
  return data ?? 0;
}

function useNavItems() {
  const me = useAuthStore((s) => s.user);
  const unread = useUnreadCount();
  const unreadMessages = useUnreadMessages();
  return [
    { id: 'home', to: '/home', label: 'Home', icon: Home },
    { id: 'wards', to: '/wards', label: 'Wards', icon: Hospital },
    { id: 'cases', to: '/cases', label: 'Case Rounds', icon: Stethoscope },
    { id: 'collab', to: '/collaboration', label: 'Collaboration', icon: CollabIcon },
    { id: 'saved', to: '/notebook', label: 'Notebook', icon: NotebookPen },
    { id: 'quiz', to: '/quiz', label: 'Tests', icon: ClipboardCheck },
    { id: 'messages', to: '/messages', label: 'Messages', icon: Mail, badge: unreadMessages },
    { id: 'notifications', to: '/notifications', label: 'Notifications', icon: Bell, badge: unread },
    { id: 'profile', to: `/profile/${me?._id}`, label: 'Profile', icon: User },
    ...(me?.isAdmin ? [{ id: 'admin', to: '/admin', label: 'Moderation', icon: ShieldCheck }] : []),
  ];
}

// Shared look of every menu / nav row: quiet text with a soft fill on hover, or blue when it's the
// current page. (cn() doesn't merge classes, so a row gets exactly one of the two colour sets.)
const ROW = 'ds-focus flex items-center rounded-ds-md text-body transition-colors duration-150';
const ROW_IDLE = 'text-ds-fg-2 hover:bg-ds-surface-2 hover:text-ds-fg';
const ROW_ACTIVE = 'bg-ds-brand-soft font-semibold text-ds-brand-text';
const rowTone = (active) => (active ? ROW_ACTIVE : ROW_IDLE);

/**
 * The account menu.
 *  - Desktop (sidebar bottom): a small glass pop-up above the button, kept inside the screen.
 *  - Phones (`drawer`, the avatar in the top bar): a side menu sliding in from the right, full
 *    height, listing every page with its icon and title, then settings, theme, help and log out.
 * Drawn in a fixed layer (portal) so nothing clips it.
 */
function AccountMenu({ children, anchor = 'up', drawer = false, className }) {
  const me = useAuthStore((s) => s.user);
  const logout = useLogout();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const navItems = useNavItems();
  const section = useSection();
  const [open, setOpen] = useState(null); // null, or where to draw the pop-up
  const ref = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && !menuRef.current?.contains(e.target) && setOpen(null);
    const esc = (e) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    menuRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  // the side menu covers the page: hold the page still underneath
  useScrollLock(Boolean(open) && drawer);

  const MENU_W = 288;
  const toggle = () => {
    if (open) return setOpen(null);
    if (drawer) return setOpen({});
    const r = ref.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - MENU_W - 8); // never off-screen
    setOpen(anchor === 'up' ? { left, bottom: window.innerHeight - r.top + 8 } : { left, top: r.bottom + 8 });
  };
  const done = () => setOpen(null);
  const base = cn(ROW, 'w-full gap-3 px-3', drawer ? 'min-h-12' : 'min-h-10');
  const item = cn(base, ROW_IDLE);
  const icon = 'size-4.5 shrink-0';

  /** Settings, theme, help, verification, account switching and log out (both layouts). */
  const accountItems = (
    <>
      {me?.isAdmin && !drawer && (
        <Link to="/admin" className={item} onClick={done} role="menuitem">
          <ShieldCheck className={icon} strokeWidth={1.5} /> Moderation
        </Link>
      )}
      {!hasBlueTick(me) && (
        <Link to="/settings?section=verification" className={item} onClick={done} role="menuitem">
          <BadgeCheck className={cn(icon, 'text-ds-brand-text')} strokeWidth={1.5} /> Get Verified
        </Link>
      )}
      <Link to="/settings" className={cn(base, rowTone(section === 'settings'))} onClick={done} role="menuitem">
        <Settings className={icon} strokeWidth={1.5} /> Settings
      </Link>
      <button className={item} onClick={toggleTheme} role="menuitem">
        {theme === 'dark' ? <Sun className={icon} strokeWidth={1.5} /> : <Moon className={icon} strokeWidth={1.5} />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <Link to="/settings?section=help" className={item} onClick={done} role="menuitem">
        <LifeBuoy className={icon} strokeWidth={1.5} /> Help & Support
      </Link>
      <div className="my-1.5 h-px bg-ds-line" role="separator" />
      <QuickSwitch itemClass={item} onDone={done} />
      <button className={cn(base, 'text-ds-danger hover:bg-ds-danger-soft')} onClick={logout} role="menuitem">
        <LogOut className={icon} strokeWidth={1.5} /> Log out
      </button>
    </>
  );

  return (
    <div ref={ref} className={className}>
      <button onClick={toggle} className="ds-focus w-full rounded-ds-md" aria-label="Account menu" aria-expanded={Boolean(open)} aria-haspopup="menu">
        {children}
      </button>
      {open &&
        createPortal(
          drawer ? (
            <div className="fixed inset-0 z-[70] font-ui" role="presentation">
              <div className="ds-scrim ds-fade absolute inset-0 touch-none" onClick={done} aria-hidden="true" />
              <nav
                ref={menuRef}
                tabIndex={-1}
                role="menu"
                aria-label="Menu"
                className="ds-glass-strong animate-drawer absolute inset-y-0 right-0 flex w-[min(20rem,86vw)] flex-col rounded-l-ds-lg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-ds-fg outline-none"
              >
                <div className="flex items-start gap-3 border-b border-ds-line p-4">
                  <Link to={`/profile/${me?._id}`} onClick={done} className="ds-focus flex min-w-0 flex-1 items-center gap-3 rounded-ds-md">
                    <Avatar user={me} size="md" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 truncate font-editorial text-lead font-medium">
                        <span className="truncate">{me?.name}</span> <Tick user={me} className="h-4 w-4" />
                      </span>
                      <span className="block truncate text-meta text-ds-fg-3">{userTitle(me)}</span>
                      <span className="block text-meta font-medium text-ds-brand-text">View profile</span>
                    </span>
                  </Link>
                  <button onClick={done} className="ds-focus ds-press -mr-1 flex size-11 items-center justify-center rounded-full text-ds-fg-3 hover:bg-ds-surface-2 hover:text-ds-fg" aria-label="Close menu">
                    <X className="size-5" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                  {navItems.map((it) => {
                    const active = section === it.id;
                    return (
                      <Link key={it.id} to={it.to} onClick={done} role="menuitem" aria-current={active ? 'page' : undefined} className={cn(base, rowTone(active))}>
                        <it.icon className={icon} size={18} strokeWidth={active ? 2 : 1.5} />
                        <span className="flex-1">{it.label}</span>
                        {it.badge > 0 && (
                          <span className="ds-num rounded-full bg-ds-accent px-1.5 text-caption font-semibold leading-5 text-ds-on-accent">{it.badge > 99 ? '99+' : it.badge}</span>
                        )}
                      </Link>
                    );
                  })}
                  <div className="my-1.5 h-px bg-ds-line" role="separator" />
                  {accountItems}
                </div>
              </nav>
            </div>
          ) : (
            <div ref={menuRef} role="menu" style={open} className="ds-glass-strong ds-rise fixed z-[70] w-72 overflow-hidden rounded-ds-lg p-1.5 font-ui text-ds-fg">
              <div className="mb-1 border-b border-ds-line px-3 pb-2.5 pt-1.5">
                <p className="flex items-center gap-1 truncate font-editorial text-lead font-medium">{me?.name} <Tick user={me} className="h-3.5 w-3.5" /></p>
                <p className="truncate text-meta text-ds-fg-3">{me?.email}</p>
              </div>
              {accountItems}
            </div>
          ),
          document.body
        )}
    </div>
  );
}

/** Lucide line icon (1.5px stroke, a touch heavier on the current page) with an optional unread badge. */
function NavIcon({ icon: Icon, active, badge }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center">
      <Icon className="size-5" size={20} strokeWidth={active ? 2 : 1.5} />
      <Badge count={badge} />
    </span>
  );
}

/**
 * Tooltip for the icon-only sidebar: drawn in a fixed layer beside the item (the sidebar clips
 * overflow). Only shown while labels are hidden.
 */
function useNavTip(enabled) {
  const [tip, setTip] = useState(null);
  // Also warms up the linked page's code (`to`) on hover / focus, so opening it is instant.
  const bind = (label, to) => {
    const show = (e) => {
      if (to) prefetchRoute(to);
      if (!enabled) return;
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
    };
    return { onMouseEnter: show, onFocus: show, onMouseLeave: () => setTip(null), onBlur: () => setTip(null) };
  };
  const node =
    enabled && tip
      ? createPortal(
          <span role="tooltip" style={{ top: tip.top, left: tip.left }} className="ds-glass-strong ds-fade pointer-events-none fixed z-[70] -translate-y-1/2 rounded-ds-sm px-2.5 py-1.5 font-ui text-caption font-medium text-ds-fg">
            {tip.label}
          </span>,
          document.body
        )
      : null;
  return [bind, node];
}

/** "Your Wards": the Ward's icon with its specialty colour as a tiny dot, plus "new" counts. */
function SidebarWards({ showLabels, itemCls, bindTip }) {
  const wards = useMyWards();
  const { pathname } = useLocation();
  return (
    <div className="mt-3 border-t border-ds-line pt-3">
      {showLabels && <p className="ds-eyebrow mb-1.5 px-3">Your Wards</p>}
      <div className="flex flex-col gap-0.5">
        {wards.map((w) => {
          const m = specialtyMeta(w.slug);
          const active = pathname === `/ward/${w.slug}`;
          return (
            <Link key={w.slug} to={`/ward/${w.slug}`} className={cn(itemCls, rowTone(active))} aria-label={m.label} aria-current={active ? 'page' : undefined} {...bindTip(m.label, `/ward/${w.slug}`)}>
              <span className="relative flex h-9 w-10 shrink-0 items-center justify-center">
                <m.icon className="size-4.5" strokeWidth={1.5} />
                <SpecialtyDot hue={m.hue} className="absolute bottom-1.5 right-2 ring-2 ring-ds-surface" />
                {w.newCount > 0 && <span className="absolute right-1.5 top-1 size-2.5 rounded-full bg-ds-accent ring-2 ring-ds-surface" aria-label="new posts" />}
              </span>
              {showLabels && <span className={cn('min-w-0 flex-1 truncate text-meta', active || w.newCount ? 'font-semibold text-ds-fg' : 'font-medium')}>{m.label}</span>}
              {showLabels && w.newCount > 0 && (
                <span className="ds-num rounded-full bg-ds-accent-soft px-1.5 text-caption font-semibold text-ds-accent-text">{w.newCount > 99 ? '99+' : w.newCount}</span>
              )}
            </Link>
          );
        })}
        <Link to="/wards" className={cn(itemCls, ROW_IDLE)} aria-label={wards.length ? 'All Wards' : 'Join a Ward'} {...bindTip(wards.length ? 'All Wards' : 'Join a Ward', '/wards')}>
          <span className="flex h-9 w-10 shrink-0 items-center justify-center">
            <span className="flex size-7 items-center justify-center rounded-ds-sm border border-dashed border-ds-line-strong text-ds-fg-3">
              {wards.length ? <ChevronRight className="size-4" strokeWidth={1.5} /> : <Plus className="size-4" strokeWidth={1.5} />}
            </span>
          </span>
          {showLabels && <span className="text-meta font-medium text-ds-fg-3">{wards.length ? 'All Wards' : 'Join a Ward'}</span>}
        </Link>
      </div>
    </div>
  );
}

// ---------------- desktop / tablet sidebar ----------------
const COLLAPSE_KEY = 'tectum-nav-collapsed';

/** True from the `lg` breakpoint (1024px) up. */
function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : true));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return match;
}

/**
 * Left glass sidebar - the same on every page.
 *  Desktop (>=1024px): icons with text labels; can be collapsed to icons only (remembered).
 *  Tablet (768-1023px): always icons only, with tooltips.
 *  Phones: hidden (TopBar + MobileNav instead).
 */
export function Sidebar() {
  const me = useAuthStore((s) => s.user);
  const items = useNavItems();
  const section = useSection();
  const openComposer = useUIStore((s) => s.openComposer);
  const desktop = useIsDesktop();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });

  const showLabels = desktop && !collapsed;
  const [bindTip, tipNode] = useNavTip(!showLabels);
  const itemCls = cn(ROW, 'group min-h-11 gap-2 px-1', showLabels ? '' : 'justify-center');
  const quietBtn = 'ds-focus ds-press flex size-9 items-center justify-center rounded-full text-ds-fg-3 hover:bg-ds-surface-2 hover:text-ds-fg';

  return (
    <header className={cn('sticky top-0 z-40 hidden h-dvh shrink-0 font-ui md:block', showLabels ? 'w-64' : 'w-[76px]')}>
      <div className="ds-glass absolute inset-y-2 left-2 right-1 flex flex-col overflow-hidden rounded-ds-lg px-2.5 py-3 text-ds-fg">
        <div className={cn('flex h-12 shrink-0 items-center gap-2 pb-2', showLabels ? 'justify-between pl-1' : 'justify-center')}>
          {showLabels ? <Logo compact /> : <Link to="/home" aria-label="Tectum home" className="ds-focus rounded-ds-md"><LogoMark className="h-9 w-9" /></Link>}
          {desktop && showLabels && (
            <button onClick={toggle} className={quietBtn} aria-label="Collapse menu" title="Collapse menu">
              <PanelLeftClose className="size-4.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
        {desktop && !showLabels && (
          <button onClick={toggle} className={cn(quietBtn, 'mx-auto mb-1')} aria-label="Expand menu" {...bindTip('Expand menu')}>
            <PanelLeftOpen className="size-4.5" strokeWidth={1.5} />
          </button>
        )}

        {/* menu + my Wards scroll together if the window is short */}
        <div className="no-scrollbar -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          <nav className="flex flex-col gap-0.5" aria-label="Main">
            {items.map((it) => {
              const active = section === it.id;
              return (
                <Link
                  key={it.id}
                  to={it.to}
                  className={cn(itemCls, rowTone(active), !active && 'font-medium')}
                  aria-label={showLabels ? undefined : it.label}
                  aria-current={active ? 'page' : undefined}
                  {...bindTip(it.label, it.to)}
                >
                  <NavIcon icon={it.icon} active={active} badge={it.badge} />
                  {showLabels && <span>{it.label}</span>}
                </Link>
              );
            })}
          </nav>
          <SidebarWards showLabels={showLabels} itemCls={itemCls} bindTip={bindTip} />
        </div>

        {/* the one solid blue action in the frame */}
        <button
          onClick={() => openComposer('text')}
          className="ds-focus ds-press mt-2 flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-ds-brand text-body font-medium text-ds-on-brand shadow-ds-raised hover:bg-ds-brand-hover"
          aria-label="Create post"
          {...bindTip('Create post')}
        >
          <Plus className="size-5 shrink-0" strokeWidth={1.75} />
          {showLabels && 'Create post'}
        </button>

        {/* photo + name open your profile; the ⋯ button opens the account menu */}
        <div className={cn('mt-2 flex shrink-0 items-center gap-1 border-t border-ds-line pt-2', !showLabels && 'flex-col')}>
          <Link
            to={`/profile/${me?._id}`}
            className={cn('ds-focus flex min-w-0 items-center gap-2.5 rounded-ds-md p-1 transition-colors hover:bg-ds-surface-2', showLabels ? 'flex-1' : 'justify-center', section === 'profile' && 'bg-ds-brand-soft')}
            aria-label={showLabels ? undefined : 'Your profile'}
            {...bindTip('Your profile', `/profile/${me?._id}`)}
          >
            <Avatar user={me} size="sm" />
            {showLabels && (
              <span className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-1 truncate text-meta font-semibold text-ds-fg">
                  <span className="truncate">{me?.name}</span> <Tick user={me} className="h-3.5 w-3.5" />
                </span>
                <span className="block truncate text-caption text-ds-fg-3">{userTitle(me)}</span>
              </span>
            )}
          </Link>
          <AccountMenu className="shrink-0">
            <span className="flex size-10 items-center justify-center rounded-full text-ds-fg-3 transition-colors hover:bg-ds-surface-2 hover:text-ds-fg">
              <MoreHorizontal className="size-5" strokeWidth={1.5} />
            </span>
          </AccountMenu>
        </div>
      </div>
      {tipNode}
    </header>
  );
}

// ---------------- phones: sticky glass top bar ----------------
/**
 * Logo on the left (with a back button on every page but Home, since the iPhone home-screen app
 * has no browser back button); search, notifications and the account menu on the right.
 * The post page has its own "← Case" bar, so it doesn't get a second back button here.
 */
export function TopBar() {
  const me = useAuthStore((s) => s.user);
  const unread = useUnreadCount();
  const section = useSection();
  const { pathname } = useLocation();
  const goBack = useGoBack('/home');
  const showBack = pathname !== '/home' && !pathname.startsWith('/post/');
  const iconBtn = (active) =>
    cn('ds-focus ds-press relative flex size-11 items-center justify-center rounded-full', active ? 'bg-ds-brand-soft text-ds-brand-text' : 'text-ds-fg-2 hover:bg-ds-surface-2 hover:text-ds-fg');
  return (
    <header className="ds-glass sticky top-0 z-30 rounded-none pt-[env(safe-area-inset-top)] font-ui md:hidden">
      <div className={cn('flex h-14 items-center justify-between gap-2 pr-1', showBack ? 'pl-0.5' : 'pl-3')}>
        {showBack ? (
          <div className="flex min-w-0 items-center">
            <button type="button" onClick={goBack} className={cn(iconBtn(false), 'shrink-0 text-ds-fg')} aria-label="Back">
              <ChevronLeft className="size-7" strokeWidth={1.75} />
            </button>
            <Logo compact />
          </div>
        ) : (
          <Logo compact />
        )}
        <div className="flex items-center">
          <Link to="/discover" className={iconBtn(section === 'search')} aria-label="Search" aria-current={section === 'search' ? 'page' : undefined}>
            <Search className="size-5" strokeWidth={section === 'search' ? 2 : 1.5} />
          </Link>
          <Link to="/notifications" className={iconBtn(section === 'notifications')} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
            <Bell className="size-5" strokeWidth={section === 'notifications' ? 2 : 1.5} />
            <Badge count={unread} />
          </Link>
          <AccountMenu drawer className="ml-1">
            <span className="flex size-11 items-center justify-center">
              <Avatar user={me} size="xs" />
            </span>
          </AccountMenu>
        </div>
      </div>
    </header>
  );
}

// ---------------- phones: fixed glass bottom tab bar + floating create button ----------------
export function MobileNav() {
  const items = useNavItems().filter((i) => ['home', 'wards', 'cases', 'saved', 'profile'].includes(i.id));
  const section = useSection();
  const openComposer = useUIStore((s) => s.openComposer);
  const short = { cases: 'Cases', saved: 'Notebook' };
  return (
    <>
      {/* Floating glass capsule: 60px tall, 8px above the screen edge / home indicator */}
      <nav className="ds-glass fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-30 rounded-full p-1 font-ui md:hidden" aria-label="Main">
        <div className="grid grid-cols-5">
          {items.map((l) => {
            const active = section === l.id;
            return (
              <NavLink
                key={l.id}
                to={l.to}
                {...prefetchProps(l.to)}
                className={cn(
                  'ds-focus ds-press flex h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200',
                  // the active tab sits on a soft blue lens
                  active ? 'bg-ds-brand-soft text-ds-brand-text' : 'text-ds-fg-2'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <NavIcon icon={l.icon} active={active} badge={l.badge} />
                <span className={cn('-mt-1.5 max-w-full truncate px-1 text-caption leading-3', active ? 'font-semibold' : 'font-medium')}>{short[l.id] ?? l.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
      {/* only on Home (and the Community feed); elsewhere, e.g. chats, it covered the page */}
      {section === 'home' && (
        <button
          onClick={() => openComposer('text')}
          className="ds-glass-strong ds-press ds-focus fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-full text-ds-brand-text md:hidden"
          aria-label="Create post"
        >
          <Plus className="size-6" strokeWidth={1.75} />
        </button>
      )}
    </>
  );
}
