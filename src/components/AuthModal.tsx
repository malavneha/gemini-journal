import React from 'react';
import { Sparkles, Shield, UserCheck, BookOpen, LogIn } from 'lucide-react';

interface AuthModalProps {
  onSignIn: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSignIn, loading, error }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-8">
      <div className="w-full max-w-md bg-stone-900/60 backdrop-blur-md border border-stone-800 rounded-2xl p-6 sm:p-8 shadow-xl text-center">
        {/* Header Icon */}
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <BookOpen className="w-8 h-8 stroke-[1.5]" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold text-stone-100 mb-2 font-serif tracking-tight">
          Personal Gemini Journal
        </h1>
        <p className="text-stone-400 text-sm leading-relaxed mb-6">
          A tranquil, safe space to record your thoughts, gain clarity, and receive mindful reflections powered by Google Gemini.
        </p>

        {/* Security / Privacy Highlights */}
        <div className="space-y-2.5 mb-8 text-left bg-stone-950/40 p-4 rounded-xl border border-stone-800/60">
          <div className="flex items-center gap-3 text-xs text-stone-300">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span><strong>Private by Design:</strong> Isolated Firestore documents per user.</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span><strong>Empathetic AI:</strong> Mindful feedback tailored to your thoughts.</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-300">
            <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span><strong>Secure Access:</strong> Sign in with your Google account.</span>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-950/50 border border-red-800/80 text-red-200 text-xs text-left">
            {error}
          </div>
        )}

        {/* Sign-In Button */}
        <button
          id="google-signin-btn"
          onClick={onSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-stone-100 hover:bg-white text-stone-900 font-medium rounded-xl transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer text-sm"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {/* Google G Logo SVG */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8 0-1 .2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <p className="mt-4 text-[11px] text-stone-500">
          By signing in, you access your protected personal journal storage.
        </p>
      </div>
    </div>
  );
};
