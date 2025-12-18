'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Key,
  FileText,
  BarChart3,
  Users,
  Settings,
  LogOut,
  FileSearch,
  Sparkles,
  X,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as any)?.role;

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Sparkles, label: 'AI Assistant', href: '/ai-assistant' },
    { icon: Key, label: 'Credentials', href: '/credentials' },
    { icon: FileText, label: 'Invoices', href: '/invoices' },
    { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  ];

  if (role === 'ADMIN' || role === 'ACCOUNTANT') {
    menuItems.push({ icon: Users, label: 'Users', href: '/users' });
    menuItems.push({ icon: UserCog, label: 'Teams', href: '/teams' });
  }
  if (role === 'ADMIN') {
    menuItems.push({ icon: FileSearch, label: 'Audit Logs', href: '/audit' });
  }

  menuItems.push({ icon: Settings, label: 'Settings', href: '/settings' });

  const handleLinkClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-white border-r border-gray-200 shadow-sm transition-transform duration-300 ease-in-out lg:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          {/* Mobile Header with Close Button */}
          <div className="flex items-center justify-between flex-shrink-0 px-4 mb-6 lg:justify-start">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-gray-900 text-xl font-bold">ToolLedger</h1>
            </div>
            <button
              onClick={onMobileClose}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="mt-5 flex-1 flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={cn(
                      'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                    )}
                  >
                    <Icon className={cn(
                      'mr-3 flex-shrink-0 h-5 w-5',
                      isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-blue-600'
                    )} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <button
              onClick={() => {
                signOut();
                handleLinkClick();
              }}
              className="flex-shrink-0 w-full group block hover:bg-red-50 rounded-lg p-2 transition-colors"
            >
              <div className="flex items-center">
                <LogOut className="h-5 w-5 text-gray-500 group-hover:text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 group-hover:text-red-600">Sign out</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
