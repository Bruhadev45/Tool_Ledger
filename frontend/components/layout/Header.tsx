'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { Shield, User, LogOut, Settings, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ACCOUNTANT':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return <Shield className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors -ml-2"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex-shrink-0">
              <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">
                Welcome back, {user?.name?.split(' ')[0] || 'User'}
              </h1>
              <p className="text-xs text-gray-500">ToolLedger Platform</p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-base font-semibold text-gray-900">
                {user?.name?.split(' ')[0] || 'User'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Role Badge - Hidden on very small screens */}
            <div
              className={`hidden sm:flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border text-xs font-medium ${getRoleBadgeColor(
                user?.role,
              )}`}
            >
              {getRoleIcon(user?.role)}
              <span className="capitalize hidden sm:inline">{user?.role?.toLowerCase()}</span>
            </div>

            {/* User Avatar & Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 sm:gap-3 cursor-pointer p-1.5 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs sm:text-sm shadow-md flex-shrink-0">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[120px]">{user?.email}</p>
                </div>
              </button>

              {/* Dropdown Menu */}
              <div
                className={cn(
                  'absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-[100] transition-all',
                  isDropdownOpen
                    ? 'opacity-100 visible'
                    : 'opacity-0 invisible pointer-events-none'
                )}
              >
                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
