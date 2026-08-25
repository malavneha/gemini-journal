import React, { useState } from 'react';
import { JournalInteraction, ActionPlan, ActionPlanResponse } from '../types';
import {
  Bot,
  User as UserIcon,
  Calendar,
  Trash2,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ListChecks,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ActionPlanCard } from './ActionPlanCard';

interface JournalEntryCardProps {
  entry: JournalInteraction;
  onDelete: (id: string) => Promise<void>;
  onUpdateActionPlan: (entryId: string, plan: ActionPlan) => Promise<void>;
}

export const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
  entry,
  onDelete,
  onUpdateActionPlan,
}) => {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Action Plan states
  const [actionPlan, setActionPlan] = useState<ActionPlan | undefined>(entry.actionPlan);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const formattedDate = new Date(entry.createdAt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopy = () => {
    let copyText = `User Thought:\n${entry.prompt}\n\nGemini Reflection:\n${entry.response}`;
    if (actionPlan) {
      copyText += `\n\nAction Plan:\n1. Key Insight: ${actionPlan.keyInsight}\n2. Practical Step: ${actionPlan.practicalNextStep}\n3. Small Action Today: ${actionPlan.smallActionToday}\n4. Goal Later: ${actionPlan.goalToRevisitLater}`;
    }
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this journal interaction?")) {
      setIsDeleting(true);
      try {
        await onDelete(entry.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleGenerateActionPlan = async () => {
    setIsGeneratingPlan(true);
    setPlanError(null);

    try {
      const response = await fetch('/api/journal/action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: entry.prompt,
          reflection: entry.response,
        }),
      });

      const data: ActionPlanResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to turn reflection into an action plan.");
      }

      const generatedPlan = data.actionPlan;
      setActionPlan(generatedPlan);

      // Auto-save or update parent interaction
      await onUpdateActionPlan(entry.id, generatedPlan);
    } catch (err: any) {
      console.error("Action plan generation error:", err);
      setPlanError(err?.message || "Failed to create action plan. Please retry.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleSaveActionPlanToFirestore = async (planToSave: ActionPlan) => {
    await onUpdateActionPlan(entry.id, planToSave);
    setActionPlan({ ...planToSave, savedToFirestore: true });
  };

  return (
    <article className="w-full bg-stone-900/70 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-md transition-all hover:border-stone-700/80">
      {/* Card Header: Timestamp & Actions */}
      <div className="flex items-center justify-between border-b border-stone-800/80 pb-3 mb-4 text-xs text-stone-400">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-stone-500" />
          <time dateTime={entry.createdAt} className="font-mono text-stone-300">
            {formattedDate}
          </time>
        </div>

        <div className="flex items-center gap-1.5">
          {entry.modelUsed && (
            <span className="text-[10px] font-mono bg-stone-950 px-2 py-0.5 rounded text-amber-400/90 border border-stone-800 hidden sm:inline-block">
              {entry.modelUsed}
            </span>
          )}

          <button
            onClick={handleCopy}
            title="Copy Reflection & Action Plan"
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete Entry"
            className="p-1.5 rounded-lg hover:bg-red-950/60 text-stone-400 hover:text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* User Thought Section */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md bg-stone-800 flex items-center justify-center text-stone-300">
            <UserIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider">Your Thought</span>
        </div>
        <div className="pl-7 text-stone-200 text-sm whitespace-pre-wrap font-sans leading-relaxed bg-stone-950/40 p-3 rounded-xl border border-stone-800/40">
          {entry.prompt}
        </div>
      </div>

      {/* Gemini Reflection Section */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              Gemini Companion Reflection
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-stone-400 hover:text-stone-200 flex items-center gap-1 cursor-pointer"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {expanded && (
          <div className="pl-7">
            <div className="text-stone-300 text-sm leading-relaxed p-4 rounded-xl bg-gradient-to-b from-stone-950/90 to-stone-950/50 border border-stone-800/80 font-serif">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-stone-300">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-amber-300/90">{children}</strong>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-amber-500/50 pl-3 my-2 text-stone-400 italic font-sans">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {entry.response}
              </ReactMarkdown>
            </div>

            {/* Reflection to Action Plan Prompt Button (if plan not created yet) */}
            {!actionPlan && !isGeneratingPlan && (
              <div className="mt-3.5 pt-1">
                <button
                  id={`action-plan-btn-${entry.id}`}
                  onClick={handleGenerateActionPlan}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-800/90 hover:bg-stone-800 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>Turn Reflection into Action Plan</span>
                  <ListChecks className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Loading State during Action Plan Generation */}
            {isGeneratingPlan && (
              <div className="mt-4 p-4 rounded-xl bg-stone-950/80 border border-amber-500/30 flex items-center gap-3 text-stone-300 text-xs">
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Analyzing reflection and creating your 4-step action plan with Gemini...</span>
              </div>
            )}

            {/* Generation Error & Retry Banner */}
            {planError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{planError}</span>
                </div>
                <button
                  onClick={handleGenerateActionPlan}
                  className="px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white rounded-lg text-[11px] font-medium flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* Action Plan Card Display */}
            {actionPlan && (
              <ActionPlanCard
                actionPlan={actionPlan}
                onSaveToFirestore={handleSaveActionPlanToFirestore}
                onRegenerate={handleGenerateActionPlan}
                isRegenerating={isGeneratingPlan}
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
};

