/** Which menu item a URL belongs to ('' = none lights up). */
export function sectionFor(pathname, search = '', myId = null) {
  if (pathname.startsWith('/collaboration') || (pathname.startsWith('/feed') && new URLSearchParams(search).get('collab'))) return 'collab';
  if (pathname.startsWith('/home') || pathname.startsWith('/feed')) return 'home';
  if (pathname.startsWith('/cases')) return 'cases';
  if (pathname === '/wards' || pathname.startsWith('/ward/')) return 'wards';
  // Search has no menu item of its own (on phones the top-bar search icon lights up instead).
  if (pathname.startsWith('/discover') || pathname.startsWith('/search') || pathname.startsWith('/topic/')) return 'search';
  if (pathname.startsWith('/notifications')) return 'notifications';
  if (pathname.startsWith('/messages')) return 'messages';
  // Only your own profile lights up "Profile"; someone else's lights up nothing.
  if (pathname.startsWith('/profile/')) return myId && pathname === `/profile/${myId}` ? 'profile' : '';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/notebook') || pathname.startsWith('/saved')) return 'saved';
  return '';
}
