import { useState } from 'react';
import {
  Code2,
  Edit3,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  StatusPill,
  StudioChip,
  StudioSwitch,
  StudioTopBar,
  ToolRoleTag,
} from '../components/StudioComponents';
import { DialogueStyle, SlangDictionaryConfig, SlangOverrideRule } from '../types/studio';
import {
  loadSlangConfig,
  resetSlangConfig,
  saveSlangConfig,
} from '../utils/slangDictionary';

interface SlangDictionaryScreenProps {
  onBack: () => void;
}

export function SlangDictionaryScreen({ onBack }: SlangDictionaryScreenProps) {
  const [config, setConfig] = useState<SlangDictionaryConfig>(() => loadSlangConfig());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ENABLED' | 'CONTEXTUAL' | 'RAW'>('ALL');
  const [editingRule, setEditingRule] = useState<SlangOverrideRule | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const persist = (next: SlangDictionaryConfig) => {
    setConfig(saveSlangConfig(next));
  };

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    persist({
      ...config,
      rules: config.rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)),
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    persist({
      ...config,
      rules: config.rules.filter((r) => r.id !== ruleId),
    });
  };

  const handleSaveRule = (rule: SlangOverrideRule) => {
    const exists = config.rules.some((r) => r.id === rule.id);
    const updatedRules = exists
      ? config.rules.map((r) => (r.id === rule.id ? rule : r))
      : [rule, ...config.rules];
    persist({ ...config, rules: updatedRules });
    setEditingRule(null);
  };

  const openJsonModal = () => {
    setRawJsonText(JSON.stringify(config, null, 2));
    setJsonError(null);
    setJsonOpen(true);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText) as SlangDictionaryConfig;
      if (!parsed || !Array.isArray(parsed.rules)) {
        setJsonError('JSON must contain a "rules" array.');
        return;
      }
      persist(parsed);
      setJsonOpen(false);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON format.');
    }
  };

  const filteredRules = config.rules.filter((r) => {
    const q = search.trim().toLowerCase();
    if (
      q &&
      !r.sourceTerm.toLowerCase().includes(q) &&
      !r.hindiReplacement.toLowerCase().includes(q) &&
      !r.note.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (filter === 'ENABLED') return r.enabled;
    if (filter === 'CONTEXTUAL') return r.contextKeywords.length > 0;
    if (filter === 'RAW') return r.dialogueStyles.includes(DialogueStyle.RAW_UNCENSORED);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0D0B14] pb-12 text-[#F7F4EF]">
      <StudioTopBar
        title="Slang & Colloquial Dictionary"
        subtitle={`${config.rules.length} override rules`}
        onBack={onBack}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={openJsonModal}
              title="Edit Raw JSON"
              className="flex h-9 items-center gap-1 rounded-xl border border-[#36304E] bg-[#151221] px-2.5 text-xs font-semibold text-[#38BDF8] cursor-pointer"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setEditingRule({
                  id: '',
                  sourceTerm: '',
                  hindiReplacement: '',
                  contextKeywords: [],
                  dialogueStyles: [],
                  wholeWord: true,
                  enabled: true,
                  note: '',
                })
              }
              className="flex h-9 items-center gap-1 rounded-xl bg-[#FFB347] px-3 text-xs font-bold text-[#1E1100] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>
        }
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-3.5 px-4 pt-4">
        <div className="rounded-2xl border border-[#38BDF8]/35 bg-[#0F2D3E]/55 p-3.5">
          <ToolRoleTag role="Translation Override Tool • Runs Before Hindi TTS" tone="CYAN" />
          <p className="mt-1.5 text-xs leading-relaxed text-[#F7F4EF]">
            Use: Automatically replaces English slang, idioms, and profanity with natural Devanagari Hindi dialogue before voice dubbing (only applies when translating English dialogue or English .SRT).
          </p>
        </div>

        {/* Master Enable Switch */}
        <div className="flex items-center justify-between rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <h2 className="text-sm font-semibold text-[#F7F4EF]">
              Enable Slang &amp; Colloquial Overrides
            </h2>
            <p className="text-xs text-[#B3ACC8]">
              Applies exact Hindi Devanagari phrases during Local &amp; Gemini Cloud dubbing
            </p>
          </div>
          <StudioSwitch
            checked={config.enabled}
            onChange={(enabled) => persist({ ...config, enabled })}
          />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <Search className="absolute top-3 left-3.5 h-4 w-4 text-[#7D7694]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search English slang, Hindi replacement, or context..."
              className="w-full rounded-xl border border-[#36304E] bg-[#151221] py-2.5 pr-3 pl-10 text-xs text-[#F7F4EF] focus:border-[#FFB347] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { k: 'ALL', l: 'All' },
                { k: 'ENABLED', l: 'Enabled' },
                { k: 'CONTEXTUAL', l: 'Contextual' },
                { k: 'RAW', l: 'Raw Uncensored' },
              ].map((item) => (
                <StudioChip
                  key={item.k}
                  selected={filter === item.k}
                  label={item.l}
                  onClick={() => setFilter(item.k as typeof filter)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setConfig(resetSlangConfig())}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-[#36304E] bg-[#151221] px-2.5 py-1.5 text-[11px] font-semibold text-[#B3ACC8] hover:text-[#FFB347] cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Rule Cards */}
        <div className="flex flex-col gap-2.5">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col gap-2 rounded-2xl border border-[#36304E] bg-[#151221] p-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      rule.enabled ? 'text-[#FFB347]' : 'text-[#B3ACC8]'
                    }`}
                  >
                    &ldquo;{rule.sourceTerm}&rdquo; → {rule.hindiReplacement}
                  </p>
                  {rule.note && <p className="mt-0.5 text-xs text-[#B3ACC8]">{rule.note}</p>}
                </div>
                <StudioSwitch
                  checked={rule.enabled}
                  onChange={(v) => handleToggleRule(rule.id, v)}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {rule.contextKeywords.length > 0 ? (
                    <StatusPill
                      label={`CONTEXT: ${rule.contextKeywords.slice(0, 4).join(', ')}${
                        rule.contextKeywords.length > 4 ? '…' : ''
                      }`}
                      tone="ACTIVE"
                    />
                  ) : (
                    <StatusPill label="GENERAL OVERRIDE" tone="NEUTRAL" />
                  )}
                  {rule.dialogueStyles.length > 0 && (
                    <StatusPill label={rule.dialogueStyles[0]} tone="WARN" />
                  )}
                  {rule.wholeWord && <StatusPill label="WHOLE WORD" tone="NEUTRAL" />}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingRule(rule)}
                    className="rounded-lg p-2 text-[#38BDF8] hover:bg-[#1F1B2E] cursor-pointer"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="rounded-lg p-2 text-[#F87171] hover:bg-[#44161A] cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rule Editor Modal */}
      {editingRule && (
        <RuleEditorModal
          initialRule={editingRule}
          onDismiss={() => setEditingRule(null)}
          onSave={handleSaveRule}
        />
      )}

      {/* Raw JSON Import/Export Modal */}
      {jsonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#F7F4EF]">
                Slang Dictionary JSON
              </h3>
              <button
                type="button"
                onClick={() => setJsonOpen(false)}
                className="rounded-lg p-1 text-[#B3ACC8] hover:bg-[#1F1B2E] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              rows={14}
              value={rawJsonText}
              onChange={(e) => setRawJsonText(e.target.value)}
              className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] p-3 font-mono text-xs text-[#F7F4EF] focus:border-[#FFB347] focus:outline-none"
            />
            {jsonError && <p className="text-xs text-[#F87171]">{jsonError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setJsonOpen(false)}
                className="h-10 rounded-xl border border-[#36304E] px-4 text-xs font-semibold text-[#B3ACC8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className="h-10 rounded-xl bg-[#FFB347] px-5 text-xs font-bold text-[#1E1100] cursor-pointer"
              >
                Apply JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleEditorModal({
  initialRule,
  onDismiss,
  onSave,
}: {
  initialRule: SlangOverrideRule;
  onDismiss: () => void;
  onSave: (rule: SlangOverrideRule) => void;
}) {
  const [sourceTerm, setSourceTerm] = useState(initialRule.sourceTerm);
  const [hindiReplacement, setHindiReplacement] = useState(initialRule.hindiReplacement);
  const [contextCsv, setContextCsv] = useState(initialRule.contextKeywords.join(', '));
  const [note, setNote] = useState(initialRule.note);
  const [wholeWord, setWholeWord] = useState(initialRule.wholeWord);
  const [rawOnly, setRawOnly] = useState(
    initialRule.dialogueStyles.includes(DialogueStyle.RAW_UNCENSORED)
  );

  const canSave = sourceTerm.trim().length > 0 && hindiReplacement.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[#F7F4EF]">
            {initialRule.id ? 'Edit Slang Rule' : 'Add Slang JSON Rule'}
          </h3>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1 text-[#B3ACC8] hover:bg-[#1F1B2E] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#B3ACC8]">English Word / Phrase</label>
          <input
            type="text"
            value={sourceTerm}
            onChange={(e) => setSourceTerm(e.target.value)}
            placeholder="e.g., fucker or fuck off"
            className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] px-3 py-2 text-xs text-[#F7F4EF]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#B3ACC8]">Hindi Devanagari Replacement</label>
          <input
            type="text"
            value={hindiReplacement}
            onChange={(e) => setHindiReplacement(e.target.value)}
            placeholder="e.g., चुतिया"
            className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] px-3 py-2 text-sm text-[#F7F4EF]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#B3ACC8]">
            Context Keywords (comma-separated, optional)
          </label>
          <input
            type="text"
            value={contextCsv}
            onChange={(e) => setContextCsv(e.target.value)}
            placeholder="e.g., bed, tonight (blank for always)"
            className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] px-3 py-2 text-xs text-[#F7F4EF]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#B3ACC8]">Context Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] px-3 py-2 text-xs text-[#F7F4EF]"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#F7F4EF]">
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(e) => setWholeWord(e.target.checked)}
            className="h-4 w-4 accent-[#FFB347]"
          />
          <span>Match whole words only</span>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#F7F4EF]">
          <input
            type="checkbox"
            checked={rawOnly}
            onChange={(e) => setRawOnly(e.target.checked)}
            className="h-4 w-4 accent-[#FFB347]"
          />
          <span>Only apply in Raw Uncensored style</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="h-10 rounded-xl border border-[#36304E] px-4 text-xs font-semibold text-[#B3ACC8] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave({
                id: initialRule.id || `custom_${Date.now()}`,
                sourceTerm: sourceTerm.trim(),
                hindiReplacement: hindiReplacement.trim(),
                contextKeywords: contextCsv
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                dialogueStyles: rawOnly ? [DialogueStyle.RAW_UNCENSORED] : [],
                wholeWord,
                enabled: initialRule.enabled,
                note: note.trim(),
              })
            }
            className="h-10 rounded-xl bg-[#FFB347] px-5 text-xs font-bold text-[#1E1100] cursor-pointer disabled:opacity-50"
          >
            Save Rule
          </button>
        </div>
      </div>
    </div>
  );
}
