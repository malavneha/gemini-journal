import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  logOut,
  fetchUserInteractions,
  saveJournalInteraction,
  deleteJournalInteraction,
  saveActionPlanToEntry,
  isFirebaseConfigured,
} from './firebase';
import { JournalInteraction, ReflectionResponse, ActionPlan } from './types';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { JournalInput } from './components/JournalInput';
import { JournalEntryCard } from './components/JournalEntryCard';
import { EmptyJournal } from './components/EmptyJournal';
import { Sparkles, Shield, RefreshCw, AlertTriangle, Key } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [entries, setEntries] = useState<JournalInteraction[]>([]);
  const [entriesLoading, setEntriesLoading] = useState<boolean>(false);
  
  const [reflectLoading, setReflectLoading] = useState<boolean>(false);
  const [reflectError, setReflectError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');

  // Listen for Authentication state changes
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (auth && isFirebaseConfigured) {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
        if (currentUser) {
          loadEntries(currentUser.uid);
        } else {
          setEntries([]);
        }
      });
    } else {
      // Check local storage demo user
      const stored = localStorage.getItem('gemini_journal_demo_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUser(parsed);
          loadEntries(parsed.uid);
        } catch {
          setUser(null);
        }
      }
      setAuthLoading(false);
    }

    return () => unsubscribe();
  }, []);

  const loadEntries = async (userId: string) => {
    setEntriesLoading(true);
    try {
      const data = await fetchUserInteractions(userId);
      setEntries(data);
    } catch (err: any) {
      console.error("Failed to load journal entries:", err);
    } finally {
      setEntriesLoading(false);
    }
  };

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const signedInUser = await signInWithGoogle();
      if (signedInUser) {
        setUser(signedInUser);
        loadEntries(signedInUser.uid);
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setAuthError(
        err?.message || "Unable to sign in with Google. Please check popup permissions or network connection."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setUser(null);
      setEntries([]);
    } catch (err: any) {
      console.error("Sign out error:", err);
    }
  };

  const handleReflectAndSave = async (promptText: string) => {
    if (!user) {
      setReflectError("You must be signed in to reflect and save journal interactions.");
      return;
    }

    setReflectLoading(true);
    setReflectError(null);
    setLastPrompt(promptText);

    try {
      // 1. Prepare conversation history for conversational context
      const historyContext = entries.slice(0, 4).map((e) => [
        { role: 'user' as const, text: e.prompt },
        { role: 'assistant' as const, text: e.response },
      ]).flat();

      // 2. Request Gemini Reflection from Backend
      const response = await fetch('/api/journal/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          history: historyContext,
        }),
      });

      const data: ReflectionResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate reflection from Gemini AI.");
      }

      // 3. Persist interaction in Firestore under user-specific document /users/{userId}/interactions/{interactionId}
      const newInteractionId = `journal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const savedEntry = await saveJournalInteraction(user.uid, {
        id: newInteractionId,
        prompt: promptText,
        response: data.reflection,
        createdAt: data.timestamp || new Date().toISOString(),
        modelUsed: data.modelUsed,
      });

      // 4. Update UI state atomically
      setEntries((prev) => [savedEntry, ...prev.filter((e) => e.id !== savedEntry.id)]);
      setLastPrompt('');
    } catch (err: any) {
      console.error("Error during journal reflection and save:", err);
      setReflectError(err?.message || "An unexpected error occurred while reflecting on your thought.");
    } finally {
      setReflectLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteJournalInteraction(user.uid, entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err: any) {
      alert("Failed to delete entry: " + (err?.message || "Unknown error"));
    }
  };

  const handleUpdateActionPlan = async (entryId: string, plan: ActionPlan) => {
    if (!user) return;
    try {
      await saveActionPlanToEntry(user.uid, entryId, plan);
      setEntries((prev) =>
        prev.map((item) => (item.id === entryId ? { ...item, actionPlan: plan } : item))
      );
    } catch (err: any) {
      console.error("Failed to save action plan:", err);
    }
  };

  const handleRetry = () => {
    if (lastPrompt) {
      handleReflectAndSave(lastPrompt);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-300">
        <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-serif text-sm text-stone-400">Loading Personal Gemini Journal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation */}
      <Navbar user={user} onSignOut={handleSignOut} entriesCount={entries.length} />

      {/* Main Journal Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {!user ? (
          /* Protected Auth Gate View */
          <AuthModal onSignIn={handleSignIn} loading={authLoading} error={authError} />
        ) : (
          /* Protected User Journal Interface */
          <div className="space-y-6">
            {/* Input & AI Reflection Box */}
            <JournalInput
              onSubmit={handleReflectAndSave}
              loading={reflectLoading}
              error={reflectError}
              onRetry={handleRetry}
              lastPrompt={lastPrompt}
            />

            {/* User Isolated Entries Feed */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-300">
                    Journal Log
                  </h2>
                  <span className="text-xs bg-stone-900 border border-stone-800 text-stone-400 px-2 py-0.5 rounded-full font-mono">
                    {entries.length}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <span className="hidden sm:inline text-stone-500">User Scope:</span>
                  <span className="font-mono text-stone-300 bg-stone-900/80 px-2 py-0.5 rounded border border-stone-800 truncate max-w-[140px]">
                    /users/{user.uid.slice(0, 8)}...
                  </span>
                  <button
                    onClick={() => loadEntries(user.uid)}
                    disabled={entriesLoading}
                    title="Refresh Entries"
                    className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${entriesLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Entries List or Empty State */}
              {entriesLoading && entries.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-stone-400">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs">Fetching your private journal records...</p>
                </div>
              ) : entries.length === 0 ? (
                <EmptyJournal
                  onQuickPrompt={(prompt) => {
                    const textarea = document.getElementById('journal-textarea') as HTMLTextAreaElement;
                    if (textarea) {
                      textarea.value = prompt;
                      textarea.focus();
                      // Trigger input event
                      textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <JournalEntryCard
                      key={entry.id}
                      entry={entry}
                      onDelete={handleDeleteEntry}
                      onUpdateActionPlan={handleUpdateActionPlan}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-stone-900 py-4 text-center text-xs text-stone-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Personal Gemini Journal &bull; Cloud Run AI Challenge Baseline</span>
          <span className="flex items-center gap-1 text-[11px] text-stone-400">
            <Shield className="w-3 h-3 text-emerald-400" />
            Zero-Leak Isolation &bull; Gemini API
          </span>
        </div>
      </footer>
    </div>
  );
}
