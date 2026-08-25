import React, { useState } from 'react';
import { ActionPlan } from '../types';
import {
  Lightbulb,
  ArrowRight,
  Zap,
  Target,
  BookmarkCheck,
  Check,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Share2
} from 'lucide-react';

interface ActionPlanCardProps {
  actionPlan: ActionPlan;
  onSaveToFirestore: (plan: ActionPlan) => Promise<void>;
  onRegenerate: () => Promise<void>;
  isRegenerating: boolean;
}

export const ActionPlanCard: React.FC<ActionPlanCardProps> = ({
  actionPlan,
  onSaveToFirestore,
  onRegenerate,
  isRegenerating,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(actionPlan.savedToFirestore || false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveToFirestore(actionPlan);
      setSaveSuccess(true);
    } catch (err: any) {
      console.error("Failed to save action plan:", err);
      setSaveError(err?.message || "Failed to save action plan to Firestore. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareOrCopy = () => {
    const text = `🎯 ACTION PLAN from Personal Gemini Journal\n\n💡 Key Insight:\n${actionPlan.keyInsight}\n\n👣 Practical Next Step:\n${actionPlan.practicalNextStep}\n\n⚡ Small Action for Today:\n${actionPlan.smallActionToday}\n\n🎯 Goal to Revisit Later:\n${actionPlan.goalToRevisitLater}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 rounded-2xl bg-gradient-to-b from-stone-900 via-stone-900/90 to-stone-950 border border-amber-500/30 p-4 sm:p-5 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Target className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>Action Plan</span>
              <span className="text-[10px] lowercase font-normal bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 rounded-full">
                4-step blueprint
              </span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareOrCopy}
            title="Copy Action Plan"
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors text-xs flex items-center gap-1 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline">Copy</span>
              </>
            )}
          </button>

          <button
            onClick={onRegenerate}
            disabled={isRegenerating || isSaving}
            title="Regenerate Plan"
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-colors text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span className="text-[10px] hidden sm:inline">Regenerate</span>
          </button>
        </div>
      </div>

      {/* 4-Step Plan Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* 1. Key Insight */}
        <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Key Insight</span>
            </div>
            <p className="text-xs text-stone-200 leading-relaxed">
              {actionPlan.keyInsight}
            </p>
          </div>
        </div>

        {/* 2. Practical Next Step */}
        <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 mb-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
              <span>2. Practical Next Step</span>
            </div>
            <p className="text-xs text-stone-200 leading-relaxed">
              {actionPlan.practicalNextStep}
            </p>
          </div>
        </div>

        {/* 3. Small Action Today */}
        <div className="p-3.5 rounded-xl bg-stone-950/70 border border-emerald-500/30 bg-emerald-950/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>3. Micro-Action for Today</span>
              </div>
              <span className="text-[9px] bg-emerald-950 border border-emerald-700/60 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                &lt; 10 mins
              </span>
            </div>
            <p className="text-xs text-stone-200 leading-relaxed font-medium">
              {actionPlan.smallActionToday}
            </p>
          </div>
        </div>

        {/* 4. Goal to Revisit Later */}
        <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 mb-1.5">
              <Target className="w-3.5 h-3.5 text-purple-400" />
              <span>4. Goal to Revisit Later</span>
            </div>
            <p className="text-xs text-stone-200 leading-relaxed">
              {actionPlan.goalToRevisitLater}
            </p>
          </div>
        </div>
      </div>

      {/* Save Action Plan to Firestore Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-stone-800/80">
        <div className="flex items-center gap-2 text-xs">
          {saveSuccess ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <BookmarkCheck className="w-4 h-4 text-emerald-400" />
              <span>Saved to your personal Firestore collection</span>
            </div>
          ) : (
            <span className="text-stone-400 text-[11px]">
              Ready to save under your private user documents
            </span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || saveSuccess}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow cursor-pointer ${
            saveSuccess
              ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300 opacity-90'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 active:scale-95'
          } disabled:cursor-default`}
        >
          {isSaving ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
              <span>Saving to Firestore...</span>
            </>
          ) : saveSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved to Firestore</span>
            </>
          ) : (
            <>
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Save Action Plan to Firestore</span>
            </>
          )}
        </button>
      </div>

      {/* Save Error Banner */}
      {saveError && (
        <div className="mt-3 p-2.5 rounded-lg bg-red-950/70 border border-red-800 text-red-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            onClick={handleSave}
            className="px-2 py-1 bg-red-900 hover:bg-red-800 text-white rounded text-[10px] font-medium"
          >
            Retry Save
          </button>
        </div>
      )}
    </div>
  );
};
