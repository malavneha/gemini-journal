import React from 'react';
import { BookOpen, Sparkles, Shield, HeartHandshake } from 'lucide-react';

interface EmptyJournalProps {
  onQuickPrompt: (prompt: string) => void;
}

const STARTER_PROMPTS = [
  {
    title: "Morning Clarity",
    text: "What is my primary intention for today, and what is one thing I will not stress over?",
    icon: Sparkles,
  },
  {
    title: "Evening Decompression",
    text: "Three moments that brought me peace or taught me something valuable today:",
    icon: HeartHandshake,
  },
  {
    title: "Unpacking Stress",
    text: "I am feeling overwhelmed about a situation. Here is what happened and how I feel:",
    icon: Shield,
  },
];

export const EmptyJournal: React.FC<EmptyJournalProps> = ({ onQuickPrompt }) => {
  return (
    <div className="text-center py-12 px-4 bg-stone-900/40 border border-stone-800/80 rounded-2xl">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
        <BookOpen className="w-7 h-7 stroke-[1.5]" />
      </div>

      <h3 className="text-lg font-serif font-medium text-stone-200 mb-1">
        Your journal is currently empty
      </h3>
      <p className="text-xs text-stone-400 max-w-md mx-auto mb-6 leading-relaxed">
        Start by jotting down any thought, goal, or feeling above. Gemini will generate supportive, mindful reflections saved securely in your isolated Firestore collection.
      </p>

      {/* Starter Prompt Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
        {STARTER_PROMPTS.map((prompt, idx) => {
          const Icon = prompt.icon;
          return (
            <button
              key={idx}
              onClick={() => onQuickPrompt(prompt.text)}
              className="p-3.5 rounded-xl bg-stone-950/60 hover:bg-stone-950 border border-stone-800/80 hover:border-amber-500/40 transition-all text-left flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1.5">
                  <Icon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span>{prompt.title}</span>
                </div>
                <p className="text-[11px] text-stone-400 line-clamp-3 leading-normal">
                  "{prompt.text}"
                </p>
              </div>
              <span className="text-[10px] text-stone-500 font-mono mt-3 group-hover:text-amber-300 transition-colors">
                Click to start &rarr;
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
