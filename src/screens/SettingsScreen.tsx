import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Cloud,
  Cpu,
  FlaskConical,
  Trash2,
} from 'lucide-react';
import {
  StatusPill,
  StudioChip,
  StudioSwitch,
  StudioTopBar,
  ToolRoleTag,
} from '../components/StudioComponents';
import {
  cleanTempProjectAudio,
  estimateTempAudioBytes,
  loadPreferences,
  savePreferences,
} from '../data/studioStorage';
import { apiTestGeminiSample, checkServerHealth } from '../services/dubbingApi';
import {
  ALL_DIALOGUE_STYLES,
  ALL_DUBBING_SPEED_MODES,
  ALL_ENGINE_MODES,
  ALL_MEDIA_ACCEL_MODES,
  ALL_STT_ENGINE_MODES,
  DubbingSpeedMode,
  EngineMode,
  mediaAccelLabel,
  sttEngineLabel,
  StudioPreferences,
} from '../types/studio';
import {
  buildPromptGlossaryHints,
  loadSlangConfig,
  localTranslateWithDictionary,
  resolveSlangMatches,
} from '../utils/slangDictionary';
import { formatFileSize } from '../utils/subtitleParser';

interface SettingsScreenProps {
  onBack: () => void;
  onOpenSlangDictionary: () => void;
}

export function SettingsScreen({ onBack, onOpenSlangDictionary }: SettingsScreenProps) {
  const [prefs, setPrefs] = useState<StudioPreferences>(() => loadPreferences());
  const [tempBytes, setTempBytes] = useState(0);
  const [serverHasKey, setServerHasKey] = useState<boolean | null>(null);
  const [slangCount, setSlangCount] = useState(() => loadSlangConfig().rules.length);

  // Cloud Tester
  const [geminiInput, setGeminiInput] = useState(
    "Don't worry, we will get out of here before sunset."
  );
  const [testingCloud, setTestingCloud] = useState(false);
  const [cloudResult, setCloudResult] = useState<{
    hindiText: string;
    emotion: string;
    latencyMs: number;
  } | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Local Slang Tester
  const [slangTestInput, setSlangTestInput] = useState('What the hell are you doing, man?');
  const [slangTestOutput, setSlangTestOutput] = useState<string | null>(null);

  useEffect(() => {
    estimateTempAudioBytes().then(setTempBytes);
    checkServerHealth().then((h) => setServerHasKey(h.hasGeminiKey));
    setSlangCount(loadSlangConfig().rules.length);
  }, []);

  const updatePrefs = (patch: Partial<StudioPreferences>) => {
    const next = savePreferences({ ...prefs, ...patch });
    setPrefs(next);
  };

  const handleTestCloud = async () => {
    setTestingCloud(true);
    setCloudError(null);
    setCloudResult(null);
    try {
      const cfg = loadSlangConfig();
      const matches = resolveSlangMatches({
        config: cfg,
        englishText: geminiInput,
        dialogueStyle: prefs.defaultDialogueStyle,
      });
      const glossarySection = buildPromptGlossaryHints(matches);
      const res = await apiTestGeminiSample({
        englishLine: geminiInput,
        dialogueStyle: prefs.defaultDialogueStyle,
        glossarySection,
      });
      setCloudResult(res);
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Gemini Cloud test failed.');
    } finally {
      setTestingCloud(false);
    }
  };

  const handleTestLocalSlang = () => {
    const cfg = loadSlangConfig();
    const res = localTranslateWithDictionary(slangTestInput, cfg, prefs.defaultDialogueStyle);
    setSlangTestOutput(`${res.hindiText} (${res.usedDictionary ? 'Dictionary Override' : 'Offline Fallback'})`);
  };

  const handleCleanTemp = async () => {
    await cleanTempProjectAudio();
    setTempBytes(await estimateTempAudioBytes());
  };

  return (
    <div className="min-h-screen bg-[#0D0B14] pb-12 text-[#F7F4EF]">
      <StudioTopBar
        title="Studio Settings"
        subtitle="Defaults, Pipeline Engine & Storage"
        onBack={onBack}
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-5">
        {/* Default Engine & Dubbing Speed */}
        <section className="flex flex-col gap-4 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <ToolRoleTag role="AI LLM Engine • Speech-to-Text, Translation & TTS" tone="GOLD" />
            <h2 className="mt-1.5 text-sm font-semibold text-[#F7F4EF]">Default Dubbing Engine</h2>
            <p className="mt-0.5 text-[11px] text-[#B3ACC8]">
              Selects whether Gemini Cloud LLM handles English→Hindi translation + voice, or uses local slang rules.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {ALL_ENGINE_MODES.map((mode) => (
                <StudioChip
                  key={mode}
                  selected={prefs.defaultEngineMode === mode}
                  label={
                    mode === EngineMode.GEMINI_CLOUD
                      ? 'Gemini Cloud AI'
                      : mode === EngineMode.ON_DEVICE_LLM
                        ? 'Local GGUF / Hybrid'
                        : 'On-Device Free'
                  }
                  onClick={() => updatePrefs({ defaultEngineMode: mode })}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-[#36304E] pt-3">
            <ToolRoleTag role="Translation Context & Speed Controller" tone="CYAN" />
            <h3 className="mt-1.5 text-xs font-semibold text-[#F7F4EF]">Dubbing Context Mode</h3>
            <p className="mt-0.5 text-[11px] text-[#B3ACC8]">
              Full Scene-Context translates every cue with surrounding story context; Hybrid Fast runs dictionary first.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_DUBBING_SPEED_MODES.map((mode) => (
                <StudioChip
                  key={mode}
                  selected={prefs.dubbingSpeedMode === mode}
                  label={
                    mode === DubbingSpeedMode.FULL_GGUF
                      ? 'Full Scene-Context (Every Line)'
                      : 'Hybrid Fast (Dictionary + LLM)'
                  }
                  onClick={() => updatePrefs({ dubbingSpeedMode: mode })}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-[#36304E] pt-3">
            <ToolRoleTag role="Hindi Translation Tone & Vocabulary Preset" tone="GOLD" />
            <h3 className="mt-1.5 text-xs font-semibold text-[#F7F4EF]">Default Dialogue Style</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_DIALOGUE_STYLES.map((style) => (
                <StudioChip
                  key={style}
                  selected={prefs.defaultDialogueStyle === style}
                  label={style}
                  onClick={() => updatePrefs({ defaultDialogueStyle: style })}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-[#36304E] pt-3">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-[#F7F4EF]">Default Chunk Duration</span>
              <span className="font-mono text-[#FFB347]">{prefs.defaultChunkDurationSec}s</span>
            </div>
            <input
              type="range"
              min={60}
              max={300}
              step={30}
              value={prefs.defaultChunkDurationSec}
              onChange={(e) => updatePrefs({ defaultChunkDurationSec: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[#FFB347]"
            />
          </div>
        </section>

        {/* STT & Vocal Isolation */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <ToolRoleTag role="Speech-to-Text (STT) Engine • Movie Audio → Transcript" tone="CYAN" />
            <div className="mt-1.5 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#38BDF8]" />
              <h2 className="text-sm font-semibold text-[#F7F4EF]">
                Speech Recognition (STT) &amp; Vocal Filter
              </h2>
            </div>
            <p className="mt-0.5 text-[11px] text-[#B3ACC8]">
              Extracts spoken dialogue timings when no .SRT subtitle file is uploaded.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {ALL_STT_ENGINE_MODES.map((mode) => (
              <StudioChip
                key={mode}
                selected={prefs.sttEngineMode === mode}
                label={sttEngineLabel(mode)}
                onClick={() => updatePrefs({ sttEngineMode: mode })}
              />
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[#36304E] pt-3">
            <div>
              <p className="text-xs font-semibold text-[#F7F4EF]">Vocal-Isolation Pre-Filter</p>
              <p className="text-[11px] text-[#B3ACC8]">
                Pre-STT bandpass tool: center vocal extraction + 160–3600 Hz noise removal before STT
              </p>
            </div>
            <StudioSwitch
              checked={prefs.sttVocalIsolationEnabled}
              onChange={(v) => updatePrefs({ sttVocalIsolationEnabled: v })}
            />
          </div>
        </section>

        {/* Media Acceleration */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <ToolRoleTag role="Video/Audio Hardware Acceleration & Cache Tool" tone="EMERALD" />
            <h2 className="mt-1.5 text-sm font-semibold text-[#F7F4EF]">Media Processing Profile</h2>
            <p className="mt-0.5 text-[11px] text-[#B3ACC8]">
              Balances audio extraction speed vs CPU/thermal usage during long movie dubbing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_MEDIA_ACCEL_MODES.map((m) => (
              <StudioChip
                key={m}
                selected={prefs.mediaAccelMode === m}
                label={mediaAccelLabel(m)}
                onClick={() => updatePrefs({ mediaAccelMode: m })}
              />
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[#36304E] pt-2.5">
            <span className="text-xs text-[#F7F4EF]">Auto-Cleanup Temp Audio After Export</span>
            <StudioSwitch
              checked={prefs.autoCleanupAfterExport}
              onChange={(v) => updatePrefs({ autoCleanupAfterExport: v })}
            />
          </div>
        </section>

        {/* Gemini Cloud Connection Tester */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#FFB347]/45 bg-[#151221] p-4">
          <div>
            <ToolRoleTag role="Translation LLM Diagnostic Tester • Gemini 4 Hydrogen" tone="GOLD" />
            <div className="mt-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-[#FFB347]" />
                <h2 className="text-sm font-semibold text-[#F7F4EF]">Gemini Cloud Connection Test</h2>
              </div>
              <StatusPill
                label={serverHasKey ? 'API KEY READY' : serverHasKey === false ? 'NO KEY' : 'CHECKING'}
                tone={serverHasKey ? 'SUCCESS' : 'WARN'}
              />
            </div>
            <p className="mt-0.5 text-[11px] text-[#B3ACC8]">
              Tests live English → Hindi translation and emotion detection via the server-side Gemini LLM.
            </p>
          </div>

          <input
            type="text"
            value={geminiInput}
            onChange={(e) => setGeminiInput(e.target.value)}
            className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] px-3 py-2 text-xs text-[#F7F4EF] focus:border-[#FFB347] focus:outline-none"
          />

          <button
            type="button"
            disabled={testingCloud}
            onClick={handleTestCloud}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#FFB347] text-xs font-bold text-[#1E1100] cursor-pointer disabled:opacity-60"
          >
            <FlaskConical className="h-4 w-4" />
            <span>{testingCloud ? 'Testing Gemini Cloud...' : 'Test Gemini Translation'}</span>
          </button>

          {cloudResult && (
            <div className="rounded-xl border border-[#34D399]/35 bg-[#0E3325] p-3 text-xs">
              <div className="flex items-center justify-between text-[#34D399]">
                <span className="flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Connected ({cloudResult.latencyMs} ms)
                </span>
                <span className="font-mono uppercase">{cloudResult.emotion}</span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-[#F7F4EF]">{cloudResult.hindiText}</p>
            </div>
          )}

          {cloudError && (
            <div className="rounded-xl border border-[#F87171]/40 bg-[#44161A] p-3 text-xs text-[#F87171]">
              {cloudError}
            </div>
          )}
        </section>

        {/* Slang Dictionary + Local Tester */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <ToolRoleTag role="Local Translation Override Tool • Slang & Idiom Rules" tone="CYAN" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-5 w-5 text-[#38BDF8]" />
              <div>
                <h2 className="text-sm font-semibold text-[#F7F4EF]">
                  Slang Override Dictionary ({slangCount} rules)
                </h2>
                <p className="text-xs text-[#B3ACC8]">
                  Context-aware JSON overrides for uncensored &amp; colloquial Hindi translation
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSlangDictionary}
              className="rounded-xl border border-[#38BDF8]/40 bg-[#0F2D3E] px-3 py-2 text-xs font-semibold text-[#38BDF8] cursor-pointer"
            >
              Open Editor
            </button>
          </div>

          <div className="flex gap-2 border-t border-[#36304E] pt-3">
            <input
              type="text"
              value={slangTestInput}
              onChange={(e) => setSlangTestInput(e.target.value)}
              className="flex-1 rounded-xl border border-[#36304E] bg-[#0D0B14] px-3 py-2 text-xs text-[#F7F4EF]"
            />
            <button
              type="button"
              onClick={handleTestLocalSlang}
              className="rounded-xl border border-[#36304E] bg-[#1F1B2E] px-3 text-xs font-semibold text-[#FFB347] cursor-pointer"
            >
              Test Dict
            </button>
          </div>
          {slangTestOutput && (
            <p className="rounded-xl bg-[#1F1B2E] p-2.5 text-xs text-[#F7F4EF]">{slangTestOutput}</p>
          )}
        </section>

        {/* Temp Cache */}
        <div className="flex items-center justify-between rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <p className="text-xs font-semibold text-[#F7F4EF]">
              Temp Audio Cache: {formatFileSize(tempBytes)}
            </p>
            <p className="text-[11px] text-[#B3ACC8]">Clean intermediate TTS &amp; mix WAV chunks</p>
          </div>
          <button
            type="button"
            onClick={handleCleanTemp}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#36304E] bg-[#1F1B2E] px-3 text-xs font-semibold text-[#F7F4EF] hover:text-[#F87171] cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clean</span>
          </button>
        </div>
      </div>
    </div>
  );
}
