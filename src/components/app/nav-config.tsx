import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/lib/types';

export interface NavItem {
  key: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function getNavGroups(t: (key: string) => string): NavGroup[] {
  return [
    {
      label: 'Overview',
      items: [
        { key: 'dashboard', icon: <NavIcon path="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />, roles: ['farmer', 'champion', 'buyer', 'admin'] },
      ],
    },
    {
      label: 'My Farm',
      items: [
        { key: 'farm', icon: <NavIcon path="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z M3 19l3-3 3 3 4-4 4 4 3-3" />, roles: ['farmer'] },
        { key: 'clusters', icon: <NavIcon path="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8z" />, roles: ['farmer', 'champion'] },
        { key: 'bulkBuying', icon: <NavIcon path="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />, roles: ['farmer', 'champion'] },
        { key: 'machinery', icon: <NavIcon path="M7 7h.01M7 3h5a1.99 1.99 0 011.75 1.05L17 10l-2 2-3-3v6a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h3z" />, roles: ['farmer', 'champion'] },
        { key: 'harvest', icon: <NavIcon path="M12 2v6m0 0l3-3m-3 3L9 5m3 1v14m-7-7H5m14 0h-1" />, roles: ['farmer', 'champion'] },
      ],
    },
    {
      label: 'Market',
      items: [
        { key: 'marketplace', icon: <NavIcon path="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />, roles: ['farmer', 'buyer', 'champion'] },
        { key: 'marketPrices', icon: <NavIcon path="M3 17l6-6 4 4 8-8 M21 7v4h-4" />, roles: ['farmer', 'buyer', 'champion'] },
        { key: 'collectionCenters', icon: <NavIcon path="M17.657 16.657L13.414 20.9a1.99 1.99 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />, roles: ['farmer', 'champion'] },
        { key: 'quality', icon: <NavIcon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />, roles: ['farmer', 'champion', 'buyer'] },
      ],
    },
    {
      label: 'Tools',
      items: [
        { key: 'aiAssistant', icon: <NavIcon path="M12 2a3 3 0 00-3 3v1a3 3 0 000 6v1a3 3 0 006 0v-1a3 3 0 000-6V5a3 3 0 00-3-3z M12 8v8 M8 12h8" />, roles: ['farmer', 'champion'] },
        { key: 'cropDisease', icon: <NavIcon path="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.93 4h2.14a2 2 0 011.664.89l.812 1.22A2 2 0 0017.07 7H18a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" />, roles: ['farmer'] },
        { key: 'weather', icon: <NavIcon path="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />, roles: ['farmer', 'champion'] },
        { key: 'farmRecords', icon: <NavIcon path="M9 17v-2m3 2v-4m3 4v-6m-6 6h9 M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />, roles: ['farmer'] },
        { key: 'groupChat', icon: <NavIcon path="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />, roles: ['farmer', 'champion'] },
      ],
    },
    {
      label: 'Account',
      items: [
        { key: 'rewards', icon: <NavIcon path="M12 15a3 3 0 100-6 3 3 0 000 6z M12 2v3m0 14v3m10-10h-3M5 12H2" />, roles: ['farmer'] },
        { key: 'notifications', icon: <NavIcon path="M15 17h5l-1.405-1.405A2.03 2.03 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />, roles: ['farmer', 'champion', 'buyer', 'admin'] },
        { key: 'profile', icon: <NavIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />, roles: ['farmer', 'champion', 'buyer', 'admin'] },
        { key: 'help', icon: <NavIcon path="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, roles: ['farmer', 'champion', 'buyer', 'admin'] },
      ],
    },
  ];
}

export function getNavItems(t: (key: string) => string): NavItem[] {
  return getNavGroups(t).flatMap((g) => g.items);
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}
