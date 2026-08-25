import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, BookOpen, Sparkles, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  onSignOut: () => Promise<void>;
  entriesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onSignOut, entriesCount }) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-stone-800/80 bg-stone-950/80 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-100 font-serif tracking-tight text-base sm:text-lg">
                Gemini Journal
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold bg-emerald-950/70 border border-emerald-800 text-emerald-300 px-1.5 py-0.5 rounded">
                <ShieldCheck className="w-3 h-3" />
                Protected
              </span>
            </div>
            <p className="text-[11px] text-stone-400 hidden xs:block">
              Empathetic AI reflections & private logs
            </p>
          </div>
        </div>

        {/* User Info & Actions */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Stats Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 border border-stone-800 text-xs text-stone-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{entriesCount} {entriesCount === 1 ? 'Reflection' : 'Reflections'}</span>
            </div>

            {/* Profile Avatar / Name */}
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User Avatar'}
                  className="w-8 h-8 rounded-full border border-stone-700 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-600/30 border border-amber-500/50 flex items-center justify-center text-xs font-semibold text-amber-200">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium text-stone-200 leading-tight max-w-[120px] truncate">
                  {user.displayName || user.email?.split('@')[0] || 'Journaler'}
                </p>
                <p className="text-[10px] text-stone-400 truncate max-w-[120px]">
                  {user.email || 'Google Auth'}
                </p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              id="nav-logout-btn"
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
