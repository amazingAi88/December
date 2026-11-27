import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Film,
  FileAudio,
  Play,
  Sparkles,
  Square,
  Subtitles,
  Trash2,
} from 'lucide-react';
import { StudioChip, StudioTopBar, ToolRoleTag } from '../components/StudioComponents';
import {
  cleanTempProjectAudio,
  estimateTempAudioBytes,
  getMediaBlob,
  getProjectById,
  loadSegmentsForProject,
  loadSpeakersForProject,
  putMediaBlob,
  saveSegmentsForProject,
  upsertProject,
} from '../data/studioStorage';
import { generateAndStoreSegmentTts } from '../services/dubbingPipeline';
import {
  ALL_EXPORT_QUALITIES,
  MovieProject,
  ProcessingStage,
  ProjectStatus,
} from '../types/studio';
import {
  decodeMediaAudio,
  renderMasterDubMixWav,
  synthesizeDemoSoundtrackBuffer,
} from '../utils/studioAudioDsp';
import {
  buildBilingualSrt,
  buildHindiSrt,
  formatFileSize,
  formatTimecodeMs,
} from '../utils/subtitleParser';

interface ExportScreenProps {
  projectId: string;
  onBack: () => void;
}

export function ExportScreen({ projectId, onBack }: ExportScreenProps) {
  const [project, setProject] = useState<MovieProject | null>(() => getProjectById(projectId));
  const [segments, setSegments] = useState(() => loadSegmentsForProject(projectId));
  const [tempBytes, setTempBytes] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderPct, setRenderPct] = useState(0);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [mixedWavUrl, setMixedWavUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refreshExports = async () => {
    setProject(getProjectById(projectId));
    setSegments(loadSegmentsForProject(projectId));
    setTempBytes(await estimateTempAudioBytes(projectId));

    const wavBlob = await getMediaBlob(`proj_${projectId}_export_wav`);
    if (wavBlob) {
      setMixedWavUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(wavBlob);
      });
    }

    const vidBlob = await getMediaBlob(`proj_${projectId}_source_video`);
    if (vidBlob) {
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(vidBlob);
      });
    }
  };

  useEffect(() => {
    refreshExports();
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleRenderMaster = async () => {
    if (!project || rendering) return;
    setRendering(true);
    setRenderPct(5);
    setRenderStatus('Checking Hindi TTS lines...');

    try {
      const speakers = loadSpeakersForProject(project.id);
      const speakerMap = new Map(speakers.map((s) => [s.speakerLabel, s]));
      let currentSegments = loadSegmentsForProject(project.id);

      // Synthesize any speech segments missing TTS audio
      const speechSegs = currentSegments.filter((s) => s.audioType === 'SPEECH' && s.hindiText.trim());
      const ttsMap = new Map<string, AudioBuffer>();

      for (let i = 0; i < speechSegs.length; i++) {
        let seg = speechSegs[i];
        let blob = seg.ttsAudioKey ? await getMediaBlob(seg.ttsAudioKey) : null;
        if (!blob) {
          setRenderStatus(`Generating Hindi voice (${i + 1}/${speechSegs.length})...`);
          const voice = speakerMap.get(seg.speakerLabel)?.voicePresetName || project.defaultVoicePreset;
          seg = await generateAndStoreSegmentTts(project, seg, voice);
          currentSegments = currentSegments.map((s) => (s.id === seg.id ? seg : s));
          saveSegmentsForProject(project.id, currentSegments);
          blob = seg.ttsAudioKey ? await getMediaBlob(seg.ttsAudioKey) : null;
        }
        if (blob) {
          const buf = await decodeMediaAudio(blob);
          if (buf) ttsMap.set(seg.id, buf);
        }
        setRenderPct(10 + Math.round(((i + 1) / Math.max(1, speechSegs.length)) * 35));
      }
      setSegments(currentSegments);

      setRenderStatus('Separating BGM & rendering Master Mix...');
      const vidBlob = await getMediaBlob(`proj_${project.id}_source_video`);
      let sourceBuf = vidBlob ? await decodeMediaAudio(vidBlob) : null;
      if (!sourceBuf) {
        sourceBuf = synthesizeDemoSoundtrackBuffer(Math.max(10, project.durationMs / 1000));
      }

      const { wavBlob } = await renderMasterDubMixWav({
        durationMs: project.durationMs,
        sourceBuffer: sourceBuf,
        segments: currentSegments,
        ttsBuffersBySegId: ttsMap,
        preserveBgm: project.preserveBgm,
        removeEnglishDialogue: project.removeEnglishDialogue,
        separationMode: project.separationMode,
        hindiVolume: project.hindiVolume,
        bgmVolume: project.bgmVolume,
        originalVolume: project.originalVolume,
        onProgress: (p) => setRenderPct(45 + Math.round(p * 0.55)),
      });

      await putMediaBlob(`proj_${project.id}_export_wav`, wavBlob);
      const updated = upsertProject({
        ...project,
        status: ProjectStatus.COMPLETED,
        currentStage: ProcessingStage.DONE,
        exportFileName: `${project.title.replace(/\s+/g, '_')}_Hindi_Dub.wav`,
        exportSizeBytes: wavBlob.size,
      });
      setProject(updated);
      await refreshExports();
      setRenderStatus('Master Hindi + BGM Mix ready!');
    } catch (err) {
      setRenderStatus(err instanceof Error ? err.message : 'Export render failed.');
    } finally {
      setRendering(false);
    }
  };

  const toggleSyncedPreview = async () => {
    if (!mixedWavUrl) return;
    if (isPreviewPlaying) {
      audioRef.current?.pause();
      videoRef.current?.pause();
      setIsPreviewPlaying(false);
      return;
    }

    if (!audioRef.current) {
      const a = new Audio(mixedWavUrl);
      a.ontimeupdate = () => setCurrentMs(Math.round(a.currentTime * 1000));
      a.onended = () => {
        setIsPreviewPlaying(false);
        videoRef.current?.pause();
      };
      audioRef.current = a;
    }

    audioRef.current.currentTime = 0;
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = true;
      await videoRef.current.play().catch(() => undefined);
    }
    await audioRef.current.play();
    setIsPreviewPlaying(true);
  };

  const downloadBlobUrl = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const downloadTextFile = (text: string, fileName: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    downloadBlobUrl(url, fileName);
    URL.revokeObjectURL(url);
  };

  const handleCleanTemp = async () => {
    await cleanTempProjectAudio(projectId);
    setTempBytes(await estimateTempAudioBytes(projectId));
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0D0B14] text-[#F7F4EF]">
        <StudioTopBar title="Export Studio" onBack={onBack} />
      </div>
    );
  }

  const activeSeg = segments.find(
    (s) => s.audioType === 'SPEECH' && currentMs >= s.startMs && currentMs <= s.endMs
  );

  return (
    <div className="min-h-screen bg-[#0D0B14] pb-12 text-[#F7F4EF]">
      <StudioTopBar title="Export Studio" subtitle={project.title} onBack={onBack} />

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-5">
        {/* Export Quality Selector */}
        <section className="rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <h2 className="text-sm font-semibold text-[#F7F4EF]">Export Quality Preset</h2>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {ALL_EXPORT_QUALITIES.map((q) => (
              <StudioChip
                key={q}
                selected={project.exportQuality === q}
                label={q}
                onClick={() => setProject(upsertProject({ ...project, exportQuality: q }))}
              />
            ))}
          </div>
        </section>

        {/* Preview Stage */}
        <section className="overflow-hidden rounded-2xl border border-[#36304E] bg-[#151221]">
          <div className="relative aspect-video w-full bg-[#0D0B14]">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                playsInline
                muted
                className="h-full w-full object-contain"
              />
            ) : (
              <img
                src={project.thumbnailDataUrl || '/assets/img_studio_hero.jpg'}
                alt={project.title}
                className="h-full w-full object-cover opacity-80"
              />
            )}

            {activeSeg && (
              <div className="absolute inset-x-4 bottom-4 rounded-xl bg-black/75 px-3.5 py-2 text-center backdrop-blur-sm">
                <p className="text-sm font-semibold text-[#F7F4EF]">
                  {activeSeg.hindiText || activeSeg.englishText}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4">
            <ToolRoleTag role="WSOLA Time-Sync + Stereo BGM Audio Mixer Tool" tone="GOLD" />
            {rendering && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#FFB347]">{renderStatus}</span>
                  <span className="font-mono text-[#FFB347]">{renderPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#1F1B2E]">
                  <div
                    className="h-full bg-[#FFB347] transition-all"
                    style={{ width: `${renderPct}%` }}
                  />
                </div>
              </div>
            )}

            {!rendering && renderStatus && (
              <div className="flex items-center gap-2 text-xs text-[#34D399]">
                <CheckCircle2 className="h-4 w-4" />
                <span>{renderStatus}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={rendering}
                onClick={handleRenderMaster}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFB347] px-4 text-xs font-bold text-[#1E1100] cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                <span>{mixedWavUrl ? 'Re-Render Master Mix' : 'Render Master Hindi Mix'}</span>
              </button>

              {mixedWavUrl && (
                <button
                  type="button"
                  onClick={toggleSyncedPreview}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#38BDF8]/50 bg-[#0F2D3E] px-4 text-xs font-bold text-[#38BDF8] cursor-pointer"
                >
                  {isPreviewPlaying ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isPreviewPlaying
                      ? `Stop (${formatTimecodeMs(currentMs)})`
                      : 'Play Synced Preview'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Download Artifacts */}
        <section className="flex flex-col gap-2.5 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <ToolRoleTag role="Master WAV & .SRT Subtitle Exporter Tool" tone="CYAN" />
            <h2 className="mt-1.5 text-sm font-semibold text-[#F7F4EF]">Export Deliverables</h2>
          </div>

          {mixedWavUrl && (
            <button
              type="button"
              onClick={() =>
                downloadBlobUrl(
                  mixedWavUrl,
                  project.exportFileName || `${project.title.replace(/\s+/g, '_')}_Hindi_Dub.wav`
                )
              }
              className="flex h-11 items-center justify-between rounded-xl bg-[#34D399] px-4 text-xs font-bold text-[#052e16] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <FileAudio className="h-4 w-4" />
                Download Master Hindi + BGM Mix (.WAV)
              </span>
              <Download className="h-4 w-4" />
            </button>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  buildHindiSrt(segments),
                  `${project.title.replace(/\s+/g, '_')}_Hindi.srt`
                )
              }
              className="flex h-11 items-center justify-between rounded-xl border border-[#36304E] bg-[#1F1B2E] px-3.5 text-xs font-semibold text-[#F7F4EF] hover:border-[#FFB347]/60 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Subtitles className="h-4 w-4 text-[#FFB347]" />
                Hindi Subtitles (.SRT)
              </span>
              <Download className="h-4 w-4 text-[#B3ACC8]" />
            </button>

            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  buildBilingualSrt(segments),
                  `${project.title.replace(/\s+/g, '_')}_Bilingual.srt`
                )
              }
              className="flex h-11 items-center justify-between rounded-xl border border-[#36304E] bg-[#1F1B2E] px-3.5 text-xs font-semibold text-[#F7F4EF] hover:border-[#38BDF8]/60 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Film className="h-4 w-4 text-[#38BDF8]" />
                Bilingual (.SRT)
              </span>
              <Download className="h-4 w-4 text-[#B3ACC8]" />
            </button>
          </div>
        </section>

        {/* Temp Audio Cleanup */}
        {tempBytes > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
            <div>
              <p className="text-xs font-semibold text-[#F7F4EF]">
                Temporary Audio Chunks: {formatFileSize(tempBytes)}
              </p>
              <p className="mt-0.5 text-[11px] text-[#B3ACC8]">
                Delete intermediate TTS chunks to free browser storage.
              </p>
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
        )}
      </div>
    </div>
  );
}
