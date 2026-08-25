import React, { useState } from 'react';
import { Send, Sparkles, RefreshCw, AlertCircle, Smile, HelpCircle, Flame } from 'lucide-react';

interface JournalInputProps {
  onSubmit: (prompt: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  lastPrompt: string;
}

const INSPIRATION_PROMPTS = [
  "What made me pause and feel grateful today?",
  "How did I handle a stressful or challenging moment recently?",
  "What is one positive boundary I want to keep this week?",
  "A quiet win or realization I want to remember:",
];

export const JournalInput: React.FC<JournalInputProps> = ({
  onSubmit,
  loading,
  error,
  onRetry,
  lastPrompt,
}) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    const textToSubmit = prompt.trim();
    // Clear textarea first for swift interactive feedback
    setPrompt('');
    await onSubmit(textToSubmit);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const selectPrompt = (sampleText: string) => {
    setPrompt(sampleText);
  };

  return (
    <div className="w-full bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="journal-textarea" className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Today's Reflection</span>
          </label>
          <span className="text-[11px] text-stone-500 hidden sm:inline">
            Press <kbd className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono text-[10px]">Enter</kbd> to reflect
          </span>
        </div>

        <div className="relative">
          <textarea
            id="journal-textarea"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write freely about your day, feelings, challenges, or aspirations..."
            disabled={loading}
            className="w-full bg-stone-950/80 border border-stone-800 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 rounded-xl p-3.5 text-stone-200 text-sm placeholder:text-stone-500 resize-none outline-none transition-all disabled:opacity-60"
          />
        </div>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Inspiration Quick Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] text-stone-400 shrink-0 flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-500" /> Prompts:
            </span>
            {INSPIRATION_PROMPTS.slice(0, 2).map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectPrompt(item)}
                className="text-[11px] bg-stone-800/80 hover:bg-stone-800 text-stone-300 px-2.5 py-1 rounded-full whitespace-nowrap border border-stone-700/50 transition-colors cursor-pointer"
              >
                {item.slice(0, 26)}...
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <button
            id="reflect-submit-btn"
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-semibold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Reflecting with Gemini...</span>
              </>
            ) : (
              <>
                <span>Save & Reflect</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error & Retry Banner */}
      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-950/70 border border-red-800/80 flex items-start justify-between gap-3 text-red-200 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-100">Reflection encountered an issue</p>
              <p className="text-red-300 text-[11px] mt-0.5">{error}</p>
            </div>
          </div>
          {lastPrompt && (
            <button
              id="retry-reflection-btn"
              onClick={onRetry}
              className="px-3 py-1.5 bg-red-900/80 hover:bg-red-800 text-white rounded-lg text-[11px] font-medium flex items-center gap-1.5 shrink-0 border border-red-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
