import { useEffect, useState } from 'react';
import {
  BookOpen,
  Delete,
  Film,
  FolderOpen,
  HardDrive,
  Lock,
  Play,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
import { StatusPill, StudioDisclosureCard } from '../components/StudioComponents';
import {
  createDemoSceneProject,
  deleteProject,
  estimateTempAudioBytes,
  loadProjects,
} from '../data/studioStorage';
import { MovieProject, ProjectStatus } from '../types/studio';
import { formatFileSize, formatTimecodeMs } from '../utils/subtitleParser';

interface HomeScreenProps {
  onSelectMovie: () => void;
  onOpenProject: (project: MovieProject) => void;
  onOpenSettings: () => void;
  onOpenSlangDictionary: () => void;
}

export function HomeScreen({
  onSelectMovie,
  onOpenProject,
  onOpenSettings,
  onOpenSlangDictionary,
}: HomeScreenProps) {
  const [projects, setProjects] = useState<MovieProject[]>([]);
  const [tempCacheBytes, setTempCacheBytes] = useState<number>(0);
  const [quotaEstimate, setQuotaEstimate] = useState<{ freeBytes: number | null }>({
    freeBytes: null,
  });

  const refreshData = async () => {
    setProjects(loadProjects());
    const temp = await estimateTempAudioBytes();
    setTempCacheBytes(temp);
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (typeof est.quota === 'number' && typeof est.usage === 'number') {
        setQuotaEstimate({ freeBytes: Math.max(0, est.quota - est.usage) });
      }
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteProject(id);
    await refreshData();
  };

  const handleLoadDemo = () => {
    const demo = createDemoSceneProject();
    setProjects(loadProjects());
    onOpenProject(demo);
  };

  return (
    <div className="min-h-screen bg-[#0D0B14] pb-12 text-[#F7F4EF]">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-5">
        {/* Top Studio Emblem & Quick Actions */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/assets/ic_dub_studio_fg.jpg"
              alt="Hindi Movie Dubbing AI emblem"
              className="h-12 w-12 shrink-0 rounded-xl border border-[#36304E] object-cover"
            />
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold text-[#F7F4EF]">
                Hindi Movie Dubbing AI
              </h1>
              <p className="truncate text-xs text-[#B3ACC8]">
                On-Device &amp; AI English to Hindi Movie Dubbing
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenSlangDictionary}
              title="Slang & Colloquial Dictionary"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#36304E] bg-[#151221] text-[#38BDF8] transition-colors hover:border-[#38BDF8]/60 hover:bg-[#1F1B2E] cursor-pointer"
            >
              <BookOpen className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              title="Studio Settings"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#36304E] bg-[#151221] text-[#FFB347] transition-colors hover:border-[#FFB347]/60 hover:bg-[#1F1B2E] cursor-pointer"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Hero Studio Card */}
        <section className="overflow-hidden rounded-2xl border border-[#36304E] bg-[#151221]">
          <div className="relative h-48 w-full">
            <img
              src="/assets/img_studio_hero.jpg"
              alt="Soundstage dubbing studio illustration"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0D0B14]/75 to-[#0D0B14]/95" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <h2 className="font-display text-xl font-bold text-[#F7F4EF]">
                English → Natural Hindi Dubbing
              </h2>
              <p className="mt-1 text-xs text-[#B3ACC8]">
                Speaker diarization, colloquial slang &amp; BGM-preserved cinema mixing
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 p-4 sm:flex-row">
            <button
              type="button"
              onClick={onSelectMovie}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFB347] px-4 text-sm font-bold text-[#1E1100] transition-colors hover:bg-[#ffc36d] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Select Movie (MP4, MKV, WebM, MOV…)</span>
            </button>
            <button
              type="button"
              onClick={handleLoadDemo}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#38BDF8]/40 bg-[#0F2D3E]/60 px-4 text-xs font-semibold text-[#38BDF8] transition-colors hover:bg-[#0F2D3E] cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Load Demo Scene</span>
            </button>
          </div>
        </section>

        {/* Storage & Cache Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#36304E] bg-[#151221] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-[#B3ACC8]">
            <HardDrive className="h-4 w-4 text-[#FFB347]" />
            <span>
              Storage Free:{' '}
              <strong className="font-mono text-[#F7F4EF]">
                {quotaEstimate.freeBytes !== null ? formatFileSize(quotaEstimate.freeBytes) : 'Available'}
              </strong>
            </span>
          </div>
          <span className="font-mono text-[#B3ACC8]">
            Temp Audio Cache: <strong className="text-[#38BDF8]">{formatFileSize(tempCacheBytes)}</strong>
          </span>
        </div>

        {/* Recent Dubbing Projects */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="font-display text-base font-semibold text-[#F7F4EF]">
            Recent Dubbing Projects
          </h2>
          <span className="font-mono text-xs text-[#7D7694]">{projects.length} total</span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-[#36304E] bg-[#151221] p-4">
            <img
              src="/assets/img_empty_reels.jpg"
              alt="No dubbing projects yet"
              className="h-36 w-full rounded-xl object-cover"
            />
            <h3 className="mt-3.5 text-base font-semibold text-[#F7F4EF]">
              No Dubbing Projects Yet
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#B3ACC8]">
              Import any legally obtained video (MP4, MKV, WebM, MOV, AVI) or load the Demo Scene to dub English dialogue into natural Hindi with preserved background music.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {projects.map((project) => {
              const tone =
                project.status === ProjectStatus.COMPLETED ||
                project.status === ProjectStatus.READY_FOR_REVIEW
                  ? 'SUCCESS'
                  : project.status === ProjectStatus.PROCESSING
                    ? 'ACTIVE'
                    : project.status === ProjectStatus.ERROR
                      ? 'ERROR'
                      : project.status === ProjectStatus.PAUSED
                        ? 'WARN'
                        : 'NEUTRAL';

              return (
                <div
                  key={project.id}
                  onClick={() => onOpenProject(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpenProject(project);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-3 transition-colors hover:border-[#FFB347]/50 hover:bg-[#1F1B2E]"
                >
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#28233B]">
                    {project.thumbnailDataUrl ? (
                      <img
                        src={project.thumbnailDataUrl}
                        alt={project.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Film className="h-6 w-6 text-[#FFB347]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-[#F7F4EF]">
                      {project.title}
                    </h3>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-[#B3ACC8]">
                      {formatTimecodeMs(project.durationMs)} • {project.width}x{project.height} •{' '}
                      {formatFileSize(project.fileSizeBytes)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <StatusPill label={project.status.replace(/_/g, ' ')} tone={tone} />
                      {project.progressPercent > 0 && project.progressPercent < 100 && (
                        <span className="font-mono text-[11px] text-[#FFB347]">
                          {project.progressPercent}%
                        </span>
                      )}
                    </div>
                    {(project.status === ProjectStatus.PROCESSING ||
                      project.status === ProjectStatus.PAUSED) && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#1F1B2E]">
                        <div
                          className="h-full rounded-full bg-[#FFB347] transition-all"
                          style={{ width: `${Math.max(4, project.progressPercent)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, project.id)}
                    aria-label={`Delete ${project.title}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#B3ACC8] hover:bg-[#44161A] hover:text-[#F87171] cursor-pointer"
                  >
                    <Delete className="h-4 w-4" />
                  </button>
                  <Play className="h-5 w-5 shrink-0 text-[#FFB347]" />
                </div>
              );
            })}
          </div>
        )}

        {/* Studio LLMs, Models & Tools Role Directory */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <span className="inline-flex items-center rounded-md border border-[#FFB347]/35 bg-[#3E290E] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#FFB347]">
              App Tools &amp; AI Models Guide
            </span>
            <h2 className="mt-1.5 font-display text-sm font-bold text-[#F7F4EF]">
              इस ऐप के सभी LLM और Tools का उपयोग (What Each Tool Does)
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[#36304E] bg-[#1F1B2E] p-3">
              <span className="font-mono text-[10px] font-bold uppercase text-[#38BDF8]">
                Speech-to-Text + Translation LLM
              </span>
              <p className="mt-0.5 text-xs font-semibold text-[#F7F4EF]">
                Gemini 4 Hydrogen (gemini-4-hydrogen)
              </p>
              <p className="mt-1 text-[11px] text-[#B3ACC8]">
                मूवी ऑडियो से English डायलॉग निकालना (STT), स्पीकर पहचानना और सीन के अनुसार Hindi Translation करना।
              </p>
            </div>

            <div className="rounded-xl border border-[#36304E] bg-[#1F1B2E] p-3">
              <span className="font-mono text-[10px] font-bold uppercase text-[#FFB347]">
                Text-to-Speech (TTS Voice Engine)
              </span>
              <p className="mt-0.5 text-xs font-semibold text-[#F7F4EF]">
                Gemini 3.8 Flash Lite TTS (8 Voices)
              </p>
              <p className="mt-1 text-[11px] text-[#B3ACC8]">
                हिंदी डायलॉग टेक्स्ट को Charon, Fenrir, Kore, Aoede आदि 8 स्टूडियो आवाज़ों में बोलकर डब करना।
              </p>
            </div>

            <div className="rounded-xl border border-[#36304E] bg-[#1F1B2E] p-3">
              <span className="font-mono text-[10px] font-bold uppercase text-[#34D399]">
                English &amp; Hindi .SRT Subtitle Tool
              </span>
              <p className="mt-0.5 text-xs font-semibold text-[#F7F4EF]">
                Dual .SRT / .VTT Parser
              </p>
              <p className="mt-1 text-[11px] text-[#B3ACC8]">
                English .SRT का हिंदी अनुवाद करके डब करता है; Hindi .SRT बिना ट्रांसलेशन के सीधे टाइमिंग पर डब करता है।
              </p>
            </div>

            <div className="rounded-xl border border-[#36304E] bg-[#1F1B2E] p-3">
              <span className="font-mono text-[10px] font-bold uppercase text-[#FF6B4A]">
                Translation Override Tool
              </span>
              <p className="mt-0.5 text-xs font-semibold text-[#F7F4EF]">
                Slang &amp; Colloquial JSON Dictionary
              </p>
              <p className="mt-1 text-[11px] text-[#B3ACC8]">
                गाली-गलौज, स्लैंग और देसी बोलचाल के वाक्यों के लिए कस्टम हिंदी अनुवाद नियम लागू करता है।
              </p>
            </div>

            <div className="rounded-xl border border-[#36304E] bg-[#1F1B2E] p-3">
              <span className="font-mono text-[10px] font-bold uppercase text-[#38BDF8]">
                BGM &amp; Vocal Separation DSP
              </span>
              <p className="mt-0.5 text-xs font-semibold text-[#F7F4EF]">
                Stereo Mid-Side + Band Ducking
              </p>
              <p className="mt-1 text-[11px] text-[#B3ACC8]">
                ओरिजिनल इंग्लिश आवाज़ को कम करके मूवी का बैकग्राउंड म्यूज़िक (BGM) और SFX सुरक्षित रखता है।
              </p>
            </div>

            <div className="rounded-xl border border-[#36304E] bg-[#1F1B2E] p-3">
              <span className="font-mono text-[10px] font-bold uppercase text-[#FFB347]">
                Time-Sync &amp; Master Export Tool
              </span>
              <p className="mt-0.5 text-xs font-semibold text-[#F7F4EF]">
                WSOLA Time-Stretch + WAV/SRT Export
              </p>
              <p className="mt-1 text-[11px] text-[#B3ACC8]">
                हिंदी वॉइस की स्पीड को बिना पिच बदले सीन के टाइम स्लॉट में फिट कर Master WAV और .SRT एक्सपोर्ट करता है।
              </p>
            </div>
          </div>
        </section>

        {/* Disclosures */}
        <StudioDisclosureCard
          title="Supported Video & Audio Formats"
          body="Supports MP4, MKV, WebM, MOV, AVI, M4V, and OGV directly in your browser. Extracts audio tracks, preserves stereo BGM via Mid-Side separation, and exports dubbed Hindi video & master WAV."
          icon={<FolderOpen className="h-5 w-5" />}
        />

        <StudioDisclosureCard
          title="Offline Dictionary & Slang Override Mode"
          body="Includes a local JSON Slang & Colloquial Override Dictionary (25+ built-in rules + custom edits) that enforces authentic spoken Hindi in both Local Dictionary Mode and Gemini Cloud Mode."
          icon={<Lock className="h-5 w-5" />}
        />

        <StudioDisclosureCard
          title="Gemini Cloud AI Pipeline"
          body="Gemini Cloud Mode powers multi-speaker audio transcription, context-aware English-to-Hindi cinema dialogue translation, and 8 Studio Hindi TTS voices (Charon, Fenrir, Orus, Puck, Kore, Aoede, Leda, Zephyr)."
          isWarning
        />
      </div>
    </div>
  );
}
