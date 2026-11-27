import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Languages,
  Play,
  Settings,
  Square,
  Subtitles,
  User,
  X,
} from 'lucide-react';
import {
  StatusPill,
  StepHeaderRow,
  StudioChip,
  StudioDisclosureCard,
  StudioTopBar,
  ToolRoleTag,
} from '../components/StudioComponents';
import {
  getProjectById,
  loadSpeakersForProject,
  saveChunksForProject,
  saveSegmentsForProject,
  saveSpeakersForProject,
  upsertProject,
} from '../data/studioStorage';
import { apiGenerateHindiTts } from '../services/dubbingApi';
import {
  ALL_DIALOGUE_STYLES,
  EngineMode,
  HINDI_VOICE_PRESETS,
  MovieProject,
  ProcessingStage,
  ProjectStatus,
  SpeakerProfile,
  SubtitleLanguage,
  VoicePreset,
} from '../types/studio';
import { base64ToBlob } from '../utils/studioAudioDsp';
import { parseSubtitleText } from '../utils/subtitleParser';

interface DubbingSettingsScreenProps {
  projectId: string;
  onBack: () => void;
  onOpenSettings: () => void;
  onOpenSlangDictionary: () => void;
  onNextAudioSettings: () => void;
}

const ENGINE_OPTIONS = [
  {
    id: EngineMode.GEMINI_CLOUD,
    name: 'Gemini Cloud AI (gemini-4-hydrogen + TTS)',
    role: 'STT + Translation + Text-to-Speech',
    desc: 'Audio transcription, speaker diarization, context-aware Hindi translation, and 8 studio Hindi voices.',
  },
  {
    id: EngineMode.ON_DEVICE_LLM,
    name: 'Slang Dictionary + Hybrid Engine',
    role: 'Translation + Slang Override',
    desc: 'Uses local JSON Slang & Colloquial rules to override literal wording before Hindi voice synthesis.',
  },
  {
    id: EngineMode.ON_DEVICE_FREE,
    name: 'Local Offline Dictionary Mode',
    role: 'Offline Phrase Translation',
    desc: 'Zero-cloud local phrase & dictionary lookup (ideal when using pre-translated Hindi .SRT subtitles).',
  },
];

export function DubbingSettingsScreen({
  projectId,
  onBack,
  onOpenSettings,
  onOpenSlangDictionary,
  onNextAudioSettings,
}: DubbingSettingsScreenProps) {
  const [project, setProject] = useState<MovieProject | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>([]);
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'MALE' | 'FEMALE' | 'NEUTRAL'>('ALL');
  const [auditionText, setAuditionText] = useState(
    'नमस्ते, यह हिंदी मूवी डबिंग स्टूडियो की आवाज़ का परीक्षण है।'
  );
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState<number>(0);
  const [banner, setBanner] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enSubInputRef = useRef<HTMLInputElement | null>(null);
  const hiSubInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setProject(getProjectById(projectId));
    setSpeakers(loadSpeakersForProject(projectId));
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [projectId]);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewPlayingId(null);
    setPreviewProgress(0);
  };

  const updateProject = (patch: Partial<MovieProject>) => {
    if (!project) return;
    const updated = upsertProject({ ...project, ...patch });
    setProject(updated);
  };

  const handlePreviewVoice = async (presetId: string, tagId: string, speed = 1.0) => {
    if (previewPlayingId === tagId) {
      stopPreview();
      return;
    }
    stopPreview();
    setPreviewLoadingId(tagId);
    setBanner(null);
    try {
      const res = await apiGenerateHindiTts({
        hindiText: auditionText.trim() || 'नमस्ते, मैं आपकी फिल्म के लिए तैयार हूँ।',
        voicePreset: presetId,
        emotion: project?.defaultEmotionBias || 'natural',
      });
      const blob = base64ToBlob(res.audioBase64, res.mimeType || 'audio/wav');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = speed;
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          setPreviewProgress(Math.round((audio.currentTime / audio.duration) * 100));
        }
      };
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPreviewPlayingId(null);
        setPreviewProgress(0);
      };

      setPreviewLoadingId(null);
      setPreviewPlayingId(tagId);
      await audio.play();
    } catch (err) {
      setPreviewLoadingId(null);
      setBanner(err instanceof Error ? err.message : 'Voice preview failed.');
    }
  };

  const resetPipelineForNewSrt = () => {
    saveChunksForProject(projectId, []);
    saveSegmentsForProject(projectId, []);
  };

  const handleAttachEnglishSub = async (file: File | undefined) => {
    if (!file || !project) return;
    const raw = await file.text();
    const cues = parseSubtitleText(raw);
    if (cues.length === 0) {
      setBanner('No valid .SRT or .VTT dialogue lines found in English file.');
      return;
    }
    resetPipelineForNewSrt();
    updateProject({
      englishSubtitleFileName: file.name,
      englishSubtitleRawText: raw,
      subtitleFileName: project.hindiSubtitleFileName || file.name,
      subtitleRawText: project.hindiSubtitleRawText || raw,
      subtitleLanguage: project.hindiSubtitleRawText
        ? SubtitleLanguage.HINDI
        : SubtitleLanguage.ENGLISH,
      status: ProjectStatus.CONFIGURING,
      currentStage: ProcessingStage.IDLE,
      progressPercent: 0,
    });
    setBanner(`English .SRT attached (${cues.length} cues) — will translate to Hindi & dub.`);
  };

  const handleAttachHindiSub = async (file: File | undefined) => {
    if (!file || !project) return;
    const raw = await file.text();
    const cues = parseSubtitleText(raw);
    if (cues.length === 0) {
      setBanner('No valid .SRT or .VTT dialogue lines found in Hindi file.');
      return;
    }
    resetPipelineForNewSrt();
    updateProject({
      hindiSubtitleFileName: file.name,
      hindiSubtitleRawText: raw,
      subtitleFileName: file.name,
      subtitleRawText: raw,
      subtitleLanguage: SubtitleLanguage.HINDI,
      status: ProjectStatus.CONFIGURING,
      currentStage: ProcessingStage.IDLE,
      progressPercent: 0,
    });
    setBanner(`Hindi .SRT attached (${cues.length} cues) — translation skipped, direct scene dubbing ready!`);
  };

  const handleRemoveEnglishSub = () => {
    if (!project) return;
    resetPipelineForNewSrt();
    updateProject({
      englishSubtitleFileName: null,
      englishSubtitleRawText: null,
      subtitleFileName: project.hindiSubtitleFileName || null,
      subtitleRawText: project.hindiSubtitleRawText || null,
      subtitleLanguage: project.hindiSubtitleRawText
        ? SubtitleLanguage.HINDI
        : SubtitleLanguage.ENGLISH,
      status: ProjectStatus.CONFIGURING,
      currentStage: ProcessingStage.IDLE,
      progressPercent: 0,
    });
  };

  const handleRemoveHindiSub = () => {
    if (!project) return;
    resetPipelineForNewSrt();
    updateProject({
      hindiSubtitleFileName: null,
      hindiSubtitleRawText: null,
      subtitleFileName: project.englishSubtitleFileName || null,
      subtitleRawText: project.englishSubtitleRawText || null,
      subtitleLanguage: SubtitleLanguage.ENGLISH,
      status: ProjectStatus.CONFIGURING,
      currentStage: ProcessingStage.IDLE,
      progressPercent: 0,
    });
  };

  const handleUpdateSpeaker = (speakerId: string, patch: Partial<SpeakerProfile>) => {
    const next = speakers.map((s) => (s.id === speakerId ? { ...s, ...patch } : s));
    setSpeakers(next);
    saveSpeakersForProject(projectId, next);
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0D0B14] text-[#F7F4EF]">
        <StudioTopBar title="Dubbing Settings" onBack={onBack} />
        <div className="p-8 text-center text-sm text-[#B3ACC8]">Project not found.</div>
      </div>
    );
  }

  const filteredVoices: VoicePreset[] =
    genderFilter === 'ALL'
      ? HINDI_VOICE_PRESETS
      : HINDI_VOICE_PRESETS.filter((v) => v.gender === genderFilter);

  const hasEnSub = Boolean(project.englishSubtitleRawText?.trim());
  const hasHiSub = Boolean(project.hindiSubtitleRawText?.trim());

  return (
    <div className="min-h-screen bg-[#0D0B14] pb-12 text-[#F7F4EF]">
      <StudioTopBar
        title="Dubbing Settings"
        subtitle={project.title}
        onBack={onBack}
        actions={
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#36304E] bg-[#151221] text-[#FFB347] hover:bg-[#1F1B2E] cursor-pointer"
          >
            <Settings className="h-4 w-4" />
          </button>
        }
      />

      <input
        ref={enSubInputRef}
        type="file"
        accept=".srt,.vtt,text/plain"
        className="hidden"
        onChange={(e) => handleAttachEnglishSub(e.target.files?.[0])}
      />
      <input
        ref={hiSubInputRef}
        type="file"
        accept=".srt,.vtt,text/plain"
        className="hidden"
        onChange={(e) => handleAttachHindiSub(e.target.files?.[0])}
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-5">
        <StepHeaderRow stepNumber={1} stepName="Dubbing & Voices" />

        {banner && (
          <div className="rounded-xl border border-[#38BDF8]/40 bg-[#0F2D3E] px-4 py-2.5 text-xs text-[#38BDF8]">
            {banner}
          </div>
        )}

        {/* Engine Mode & Dialogue Style */}
        <section className="flex flex-col gap-4 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <div className="mb-1.5">
              <ToolRoleTag role="LLM Engine • Transcription (STT), Translation & TTS" tone="GOLD" />
            </div>
            <h2 className="text-sm font-semibold text-[#F7F4EF]">Dubbing AI Engine</h2>
            <p className="mt-0.5 text-xs text-[#B3ACC8]">
              Select which LLM / translation engine handles speech recognition and Hindi script generation.
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              {ENGINE_OPTIONS.map((eng) => {
                const selected = project.engineMode === eng.id;
                return (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => updateProject({ engineMode: eng.id })}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#FFB347] bg-[#28233B]'
                        : 'border-[#36304E] bg-[#1F1B2E] hover:border-[#FFB347]/50'
                    }`}
                  >
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#F7F4EF]">{eng.name}</span>
                      <ToolRoleTag role={eng.role} tone={selected ? 'GOLD' : 'CYAN'} />
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#B3ACC8]">{eng.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#36304E] pt-3">
            <div className="mb-1.5">
              <ToolRoleTag role="Translation Tool • Dialogue Tone & Script Style" tone="CYAN" />
            </div>
            <h2 className="text-sm font-semibold text-[#F7F4EF]">Hindi Dialogue Style</h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {ALL_DIALOGUE_STYLES.map((style) => (
                <StudioChip
                  key={style}
                  selected={project.dialogueStyle === style}
                  label={style}
                  onClick={() => updateProject({ dialogueStyle: style })}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-[#36304E] pt-3">
            <div className="mb-1.5">
              <ToolRoleTag role="Pipeline Tool • Audio Chunk Segmentation Window" tone="EMERALD" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#F7F4EF]">Processing Chunk Duration</span>
              <span className="font-mono font-bold text-[#FFB347]">{project.chunkDurationSec}s</span>
            </div>
            <input
              type="range"
              min={60}
              max={300}
              step={30}
              value={project.chunkDurationSec}
              onChange={(e) => updateProject({ chunkDurationSec: Number(e.target.value) })}
              className="mt-2 w-full accent-[#FFB347]"
            />
          </div>
        </section>

        {/* Separate English .SRT & Hindi .SRT Upload Tracks */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <ToolRoleTag
              role="Subtitle Timing Tools • English (Translate + Dub) vs Hindi (Direct Dub)"
              tone="CYAN"
            />
            <h2 className="mt-1.5 text-sm font-semibold text-[#F7F4EF]">
              Subtitle Files (.SRT / .VTT)
            </h2>
            <p className="mt-0.5 text-xs text-[#B3ACC8]">
              English .SRT का अनुवाद होकर डबिंग होगी; Hindi .SRT बिना ट्रांसलेशन के सीधे सीन टाइमिंग पर डब होगी।
            </p>
          </div>

          {/* English .SRT Slot */}
          <div
            className={`rounded-xl border p-3.5 ${
              hasEnSub ? 'border-[#38BDF8]/60 bg-[#0F2D3E]/35' : 'border-[#36304E] bg-[#1F1B2E]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-[#38BDF8]" />
                <span className="text-xs font-bold text-[#F7F4EF]">
                  1. English .SRT (Translation Required)
                </span>
              </div>
              <StatusPill label={hasEnSub ? 'ATTACHED' : 'OPTIONAL'} tone={hasEnSub ? 'ACTIVE' : 'NEUTRAL'} />
            </div>
            <p className="mt-1 text-[11px] text-[#B3ACC8]">
              {hasEnSub
                ? `${project.englishSubtitleFileName} — Will translate English lines into Hindi before TTS dubbing.`
                : 'Upload English subtitles to skip audio STT and translate lines accurately to Hindi.'}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => enSubInputRef.current?.click()}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#38BDF8]/40 bg-[#0F2D3E] text-xs font-semibold text-[#38BDF8] cursor-pointer"
              >
                <Subtitles className="h-3.5 w-3.5" />
                <span>{hasEnSub ? 'Replace English .SRT' : 'Upload English .SRT'}</span>
              </button>
              {hasEnSub && (
                <button
                  type="button"
                  onClick={handleRemoveEnglishSub}
                  className="flex h-9 items-center gap-1 rounded-lg border border-[#F87171]/40 bg-[#44161A]/60 px-3 text-xs font-semibold text-[#F87171] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>

          {/* Hindi .SRT Slot */}
          <div
            className={`rounded-xl border p-3.5 ${
              hasHiSub ? 'border-[#34D399]/60 bg-[#0E3325]/35' : 'border-[#36304E] bg-[#1F1B2E]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Subtitles className="h-4 w-4 text-[#34D399]" />
                <span className="text-xs font-bold text-[#F7F4EF]">
                  2. Hindi .SRT (Direct Dub — No Translation)
                </span>
              </div>
              <StatusPill
                label={hasHiSub ? 'DIRECT DUB ACTIVE' : 'OPTIONAL'}
                tone={hasHiSub ? 'SUCCESS' : 'NEUTRAL'}
              />
            </div>
            <p className="mt-1 text-[11px] text-[#B3ACC8]">
              {hasHiSub
                ? `${project.hindiSubtitleFileName} — Translation skipped; video will dub directly to Hindi at exact SRT timings.`
                : 'Upload Hindi subtitles to skip both STT and translation and dub straight to movie timings.'}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => hiSubInputRef.current?.click()}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#34D399]/40 bg-[#0E3325] text-xs font-semibold text-[#34D399] cursor-pointer"
              >
                <Subtitles className="h-3.5 w-3.5" />
                <span>{hasHiSub ? 'Replace Hindi .SRT' : 'Upload Hindi .SRT'}</span>
              </button>
              {hasHiSub && (
                <button
                  type="button"
                  onClick={handleRemoveHindiSub}
                  className="flex h-9 items-center gap-1 rounded-lg border border-[#F87171]/40 bg-[#44161A]/60 px-3 text-xs font-semibold text-[#F87171] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Slang Dictionary Card */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-1 h-5 w-5 shrink-0 text-[#38BDF8]" />
            <div>
              <ToolRoleTag role="Translation Override Tool • Slang & Colloquial Rules" tone="CYAN" />
              <h3 className="mt-1 text-sm font-semibold text-[#F7F4EF]">
                Slang &amp; Colloquial JSON Dictionary
              </h3>
              <p className="text-xs text-[#B3ACC8]">
                Enforces uncensored &amp; context-aware Hindi phrase replacements during translation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSlangDictionary}
            className="shrink-0 rounded-xl border border-[#38BDF8]/40 bg-[#0F2D3E] px-3 py-2 text-xs font-semibold text-[#38BDF8] hover:bg-[#133b52] cursor-pointer"
          >
            Manage
          </button>
        </div>

        {/* Hindi Voice Presets (TTS) */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <ToolRoleTag role="Text-to-Speech (TTS) Engine • Gemini 3.8 Flash Lite TTS" tone="GOLD" />
            <div className="mt-1.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F7F4EF]">Default Hindi Voice Preset</h2>
              <span className="font-mono text-xs text-[#FFB347]">{project.defaultVoicePreset}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#B3ACC8]">
              Converts translated or .SRT Hindi dialogue text into natural Hindi speech audio.
            </p>
          </div>

          <input
            type="text"
            value={auditionText}
            onChange={(e) => setAuditionText(e.target.value)}
            placeholder="Custom Hindi audition line..."
            className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] px-3 py-2 text-xs text-[#F7F4EF] focus:border-[#FFB347] focus:outline-none"
          />

          <div className="flex flex-wrap gap-2">
            {(['ALL', 'MALE', 'FEMALE', 'NEUTRAL'] as const).map((g) => (
              <StudioChip
                key={g}
                selected={genderFilter === g}
                label={g}
                onClick={() => setGenderFilter(g)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {filteredVoices.map((preset) => {
              const isApplied = project.defaultVoicePreset === preset.id;
              const tagId = `preset_${preset.id}`;
              const isLoading = previewLoadingId === tagId;
              const isPlaying = previewPlayingId === tagId;
              return (
                <div
                  key={preset.id}
                  className={`flex flex-col justify-between gap-2.5 rounded-xl border p-3 ${
                    isApplied
                      ? 'border-[#FFB347] bg-[#28233B]'
                      : 'border-[#36304E] bg-[#1F1B2E]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#F7F4EF]">{preset.label}</p>
                      <p className="mt-0.5 text-[11px] text-[#B3ACC8]">{preset.description}</p>
                    </div>
                    <StatusPill label={preset.gender} tone={isPlaying ? 'ACTIVE' : 'NEUTRAL'} />
                  </div>

                  {isPlaying && (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[#0D0B14]">
                      <div className="h-full bg-[#38BDF8]" style={{ width: `${previewProgress}%` }} />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handlePreviewVoice(preset.id, tagId)}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#36304E] bg-[#151221] text-xs font-semibold text-[#38BDF8] hover:border-[#38BDF8]/60 cursor-pointer disabled:opacity-60"
                    >
                      {isPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      <span>{isLoading ? 'Loading...' : isPlaying ? 'Stop' : 'Preview'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateProject({
                          defaultVoicePreset: preset.id,
                          defaultVoiceGender: preset.gender,
                        })
                      }
                      className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-xs font-bold cursor-pointer ${
                        isApplied ? 'bg-[#34D399] text-[#052e16]' : 'bg-[#FFB347] text-[#1E1100]'
                      }`}
                    >
                      {isApplied && <Check className="h-3.5 w-3.5" />}
                      <span>{isApplied ? 'Applied' : 'Apply'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Detected Speakers Assignment */}
        {speakers.length > 0 && (
          <section className="flex flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
            <div>
              <ToolRoleTag role="Speaker Voice Mapper • Multi-Voice TTS Assignment" tone="EMERALD" />
              <h2 className="mt-1.5 text-sm font-semibold text-[#F7F4EF]">
                Detected Speakers ({speakers.length})
              </h2>
            </div>
            {speakers.map((sp) => {
              const tagId = `speaker_${sp.id}`;
              const isPlaying = previewPlayingId === tagId;
              const isLoading = previewLoadingId === tagId;
              return (
                <div
                  key={sp.id}
                  className="flex flex-col gap-2.5 rounded-xl border border-[#36304E] bg-[#1F1B2E] p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#FFB347]" />
                      <div>
                        <p className="text-sm font-semibold text-[#F7F4EF]">{sp.displayName}</p>
                        {sp.traits && <p className="text-[11px] text-[#B3ACC8]">{sp.traits}</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handlePreviewVoice(sp.voicePresetName, tagId, sp.speedMultiplier)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-[#36304E] bg-[#151221] px-2.5 text-xs font-semibold text-[#38BDF8] cursor-pointer"
                    >
                      {isPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      <span>{isLoading ? 'Loading...' : isPlaying ? 'Stop' : 'Preview'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {HINDI_VOICE_PRESETS.map((p) => (
                      <StudioChip
                        key={p.id}
                        selected={sp.voicePresetName === p.id}
                        label={p.id}
                        onClick={() =>
                          handleUpdateSpeaker(sp.id, {
                            voicePresetName: p.id,
                            gender: p.gender,
                          })
                        }
                      />
                    ))}
                  </div>

                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#B3ACC8]">Speaker Speed</span>
                      <span className="font-mono text-[#FFB347]">
                        {sp.speedMultiplier.toFixed(2)}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.75}
                      max={1.35}
                      step={0.05}
                      value={sp.speedMultiplier}
                      onChange={(e) =>
                        handleUpdateSpeaker(sp.id, { speedMultiplier: Number(e.target.value) })
                      }
                      className="mt-1 w-full accent-[#FFB347]"
                    />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <StudioDisclosureCard
          title="Voice Synthesis Disclosure"
          body="AI Hindi voices use synthesized studio TTS presets (Charon, Fenrir, Orus, Puck, Kore, Aoede, Leda, Zephyr) and do not clone the original actor's voice."
        />

        <button
          type="button"
          onClick={() => {
            stopPreview();
            onNextAudioSettings();
          }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFB347] text-sm font-bold text-[#1E1100] hover:bg-[#ffc36d] cursor-pointer"
        >
          <span>Next: Audio &amp; BGM Mixing</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
