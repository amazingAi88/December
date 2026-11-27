import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Film,
  Pause,
  Play,
  RefreshCw,
  Sliders,
  Subtitles,
} from 'lucide-react';
import { StatusPill, StudioTopBar, ToolRoleTag } from '../components/StudioComponents';
import {
  getProjectById,
  loadChunksForProject,
  loadSegmentsForProject,
  loadSpeakersForProject,
} from '../data/studioStorage';
import { runDubbingPipeline } from '../services/dubbingPipeline';
import {
  AudioChunk,
  ChunkStatus,
  DialogueSegment,
  MovieProject,
  ProcessingStage,
  ProjectStatus,
  SpeakerProfile,
} from '../types/studio';
import { formatTimecodeMs } from '../utils/subtitleParser';

interface ProcessingScreenProps {
  projectId: string;
  onBack: () => void;
  onOpenAudioSettings: () => void;
  onOpenReview: () => void;
  onOpenExport: () => void;
}

const PIPELINE_STEPS = [
  { label: 'Extract', role: 'Audio Decode', key: ProcessingStage.EXTRACTING },
  { label: 'Transcribe', role: 'STT / .SRT', key: ProcessingStage.TRANSCRIBING },
  { label: 'Translate', role: 'LLM / Skip HI', key: ProcessingStage.TRANSLATING },
  { label: 'Voice', role: 'Gemini TTS', key: ProcessingStage.GENERATING_TTS },
  { label: 'Mix', role: 'Mid-Side + Sync', key: ProcessingStage.MIXING },
];

export function ProcessingScreen({
  projectId,
  onBack,
  onOpenAudioSettings,
  onOpenReview,
  onOpenExport,
}: ProcessingScreenProps) {
  const [project, setProject] = useState<MovieProject | null>(() => getProjectById(projectId));
  const [chunks, setChunks] = useState<AudioChunk[]>(() => loadChunksForProject(projectId));
  const [segments, setSegments] = useState<DialogueSegment[]>(() => loadSegmentsForProject(projectId));
  const [, setSpeakers] = useState<SpeakerProfile[]>(() => loadSpeakersForProject(projectId));
  const [isRunningLocal, setIsRunningLocal] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const autoStartedRef = useRef(false);

  const startPipeline = async () => {
    const latest = getProjectById(projectId);
    if (!latest || isRunningLocal) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunningLocal(true);

    await runDubbingPipeline(
      latest,
      {
        onProjectUpdate: (p) => setProject(p),
        onChunksUpdate: (c) => setChunks(c),
        onSpeakersUpdate: (s) => setSpeakers(s),
        onSegmentsUpdate: (seg) => setSegments(seg),
      },
      controller.signal
    );

    setIsRunningLocal(false);
    abortRef.current = null;
  };

  useEffect(() => {
    const current = getProjectById(projectId);
    setProject(current);
    setChunks(loadChunksForProject(projectId));
    setSegments(loadSegmentsForProject(projectId));
    setSpeakers(loadSpeakersForProject(projectId));

    if (
      current &&
      current.status === ProjectStatus.CONFIGURING &&
      !autoStartedRef.current
    ) {
      autoStartedRef.current = true;
      startPipeline();
    }

    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0D0B14] text-[#F7F4EF]">
        <StudioTopBar title="Processing Pipeline" onBack={onBack} />
      </div>
    );
  }

  const isRunning = isRunningLocal || project.status === ProjectStatus.PROCESSING;
  const isReady =
    project.status === ProjectStatus.READY_FOR_REVIEW ||
    project.status === ProjectStatus.COMPLETED;

  const stageLower = project.currentStage.toLowerCase();
  const activeIdx = isReady
    ? PIPELINE_STEPS.length
    : stageLower.includes('mix')
      ? 4
      : stageLower.includes('voice') || stageLower.includes('tts')
        ? 3
        : stageLower.includes('translat') || stageLower.includes('direct dub')
          ? 2
          : stageLower.includes('transcrib') || stageLower.includes('loading') || stageLower.includes('.srt')
            ? 1
            : stageLower.includes('extract')
              ? 0
              : -1;

  const speechLinesCount = segments.filter((s) => s.audioType === 'SPEECH').length;

  return (
    <div className="min-h-screen bg-[#0D0B14] pb-12 text-[#F7F4EF]">
      <StudioTopBar
        title="Dubbing Pipeline"
        subtitle={project.title}
        onBack={onBack}
        actions={
          <button
            type="button"
            onClick={onOpenAudioSettings}
            title="Audio Mixer"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#36304E] bg-[#151221] text-[#38BDF8] hover:bg-[#1F1B2E] cursor-pointer"
          >
            <Sliders className="h-4 w-4" />
          </button>
        }
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-5">
        {/* Main Status Card */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#B3ACC8]">
                Current Stage
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-[#F7F4EF]">
                {project.currentStage}
              </h2>
            </div>

            {isRunning && (
              <div className="flex h-6 items-center gap-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <span
                    key={idx}
                    className={`animate-wave-bar w-1 rounded-full ${
                      idx % 2 === 0 ? 'bg-[#FFB347]' : 'bg-[#38BDF8]'
                    }`}
                    style={{
                      height: '20px',
                      animationDelay: `${idx * 140}ms`,
                    }}
                  />
                ))}
              </div>
            )}

            <StatusPill
              label={project.status.replace(/_/g, ' ')}
              tone={
                isReady
                  ? 'SUCCESS'
                  : isRunning
                    ? 'ACTIVE'
                    : project.status === ProjectStatus.ERROR
                      ? 'ERROR'
                      : 'WARN'
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <ToolRoleTag
              role={
                project.hindiSubtitleRawText
                  ? 'Active Pipeline • Hindi .SRT Direct Dub (Translation Skipped)'
                  : project.englishSubtitleRawText
                    ? 'Active Pipeline • English .SRT → Gemini Translation → TTS'
                    : 'Active Pipeline • Gemini STT → Translation → TTS → BGM Mix'
              }
              tone={project.hindiSubtitleRawText ? 'EMERALD' : 'GOLD'}
            />
          </div>

          {/* 5-Step Pipeline Stepper */}
          <div className="grid grid-cols-5 gap-1.5">
            {PIPELINE_STEPS.map((step, idx) => {
              const completed = isReady || activeIdx > idx;
              const current = isRunning && activeIdx === idx;
              return (
                <div
                  key={step.label}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-center ${
                    completed
                      ? 'border-[#34D399]/35 bg-[#0E3325] text-[#34D399]'
                      : current
                        ? 'border-[#FFB347]/70 bg-[#3E290E] text-[#FFB347]'
                        : 'border-[#36304E] bg-[#28233B] text-[#B3ACC8]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 text-[11px] font-semibold">
                    {completed && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                    {current && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFB347]" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </div>
                  <span className="truncate font-mono text-[9px] opacity-80">{step.role}</span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#1F1B2E]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                project.status === ProjectStatus.ERROR
                  ? 'bg-[#F87171]'
                  : isReady
                    ? 'bg-[#34D399]'
                    : 'bg-[#FFB347]'
              }`}
              style={{ width: `${Math.max(3, project.progressPercent)}%` }}
            />
          </div>

          {project.lastError && (
            <div className="rounded-xl border border-[#F87171]/40 bg-[#44161A] p-3 text-xs text-[#F87171]">
              {project.lastError}
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            {isRunning ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#FBBF24]/50 bg-[#3B2C09] text-xs font-bold text-[#FBBF24] cursor-pointer"
              >
                <Pause className="h-4 w-4" />
                <span>Pause / Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startPipeline}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFB347] text-xs font-bold text-[#1E1100] cursor-pointer"
              >
                {project.status === ProjectStatus.ERROR ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>
                  {project.status === ProjectStatus.ERROR
                    ? 'Retry Pipeline'
                    : isReady
                      ? 'Re-Run Pipeline'
                      : 'Start / Resume Pipeline'}
                </span>
              </button>
            )}

            {isReady && (
              <>
                <button
                  type="button"
                  onClick={onOpenReview}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#38BDF8]/50 bg-[#0F2D3E] text-xs font-bold text-[#38BDF8] cursor-pointer"
                >
                  <Subtitles className="h-4 w-4" />
                  <span>Review Dialogue</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenExport}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#34D399] text-xs font-bold text-[#052e16] cursor-pointer"
                >
                  <Film className="h-4 w-4" />
                  <span>Export Studio</span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* Metric Tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-[#36304E] bg-[#151221] p-3 text-center">
            <p className="font-display text-xl font-bold text-[#FFB347]">{chunks.length}</p>
            <p className="text-[11px] text-[#B3ACC8]">Audio Chunks</p>
          </div>
          <div className="rounded-xl border border-[#36304E] bg-[#151221] p-3 text-center">
            <p className="font-display text-xl font-bold text-[#38BDF8]">{speechLinesCount}</p>
            <p className="text-[11px] text-[#B3ACC8]">Hindi Lines</p>
          </div>
          <div className="rounded-xl border border-[#36304E] bg-[#151221] p-3 text-center">
            <p className="font-display text-xl font-bold text-[#34D399]">
              {project.progressPercent}%
            </p>
            <p className="text-[11px] text-[#B3ACC8]">Progress</p>
          </div>
        </div>

        {/* Chunk List */}
        <div className="flex flex-col gap-2.5">
          <h3 className="font-display text-sm font-semibold text-[#F7F4EF]">
            Chunk Breakdown ({chunks.length})
          </h3>
          {chunks.map((chunk) => {
            const tone =
              chunk.status === ChunkStatus.MIXED
                ? 'SUCCESS'
                : chunk.status === ChunkStatus.FAILED
                  ? 'ERROR'
                  : chunk.status === ChunkStatus.PENDING
                    ? 'NEUTRAL'
                    : 'ACTIVE';
            return (
              <div
                key={chunk.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#36304E] bg-[#151221] p-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#F7F4EF]">
                    Chunk {chunk.chunkIndex + 1} • {formatTimecodeMs(chunk.startMs)} –{' '}
                    {formatTimecodeMs(chunk.endMs)}
                  </p>
                  {chunk.processingTimeMs > 0 && (
                    <p className="mt-0.5 text-[11px] text-[#B3ACC8]">
                      Completed in {(chunk.processingTimeMs / 1000).toFixed(1)}s
                    </p>
                  )}
                  {chunk.errorMessage && (
                    <p className="mt-0.5 text-[11px] text-[#F87171]">{chunk.errorMessage}</p>
                  )}
                </div>
                <StatusPill label={chunk.status} tone={tone} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
