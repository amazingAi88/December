import { useEffect, useRef, useState } from 'react';
import {
  BookPlus,
  Edit3,
  Film,
  Play,
  RefreshCw,
  Square,
  X,
} from 'lucide-react';
import {
  StatusPill,
  StudioChip,
  StudioDisclosureCard,
  StudioTopBar,
  ToolRoleTag,
} from '../components/StudioComponents';
import {
  getMediaBlob,
  getProjectById,
  loadSegmentsForProject,
  loadSpeakersForProject,
  saveSegmentsForProject,
} from '../data/studioStorage';
import { generateAndStoreSegmentTts } from '../services/dubbingPipeline';
import {
  DialogueSegment,
  MovieProject,
  SegmentStatus,
  SpeakerProfile,
  TranslationSource,
  translationSourceLabel,
} from '../types/studio';
import { loadSlangConfig, saveSlangConfig } from '../utils/slangDictionary';
import { formatTimecodeMs } from '../utils/subtitleParser';

interface ReviewScreenProps {
  projectId: string;
  onBack: () => void;
  onGoToExport: () => void;
}

const EMOTIONS = ['neutral', 'serious', 'happy', 'angry', 'sad', 'excited', 'whisper', 'fearful'];

export function ReviewScreen({ projectId, onBack, onGoToExport }: ReviewScreenProps) {
  const [project, setProject] = useState<MovieProject | null>(() => getProjectById(projectId));
  const [segments, setSegments] = useState<DialogueSegment[]>(() => loadSegmentsForProject(projectId));
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>(() => loadSpeakersForProject(projectId));
  const [activeFilter, setActiveFilter] = useState<'SPEECH' | 'ALL' | 'NON_SPEECH' | 'FAILED'>('SPEECH');
  const [playingSegId, setPlayingSegId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Edit dialog state
  const [editingSeg, setEditingSeg] = useState<DialogueSegment | null>(null);
  const [editHindi, setEditHindi] = useState('');
  const [editEnglish, setEditEnglish] = useState('');
  const [editEmotion, setEditEmotion] = useState('neutral');
  const [editSpeaker, setEditSpeaker] = useState('SPEAKER_1');
  const [editSpeed, setEditSpeed] = useState(1.0);
  const [saveToDict, setSaveToDict] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setProject(getProjectById(projectId));
    setSegments(loadSegmentsForProject(projectId));
    setSpeakers(loadSpeakersForProject(projectId));
    return () => stopAudio();
  }, [projectId]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingSegId(null);
  };

  const openEditor = (seg: DialogueSegment, defaultSaveDict = false) => {
    setEditingSeg(seg);
    setEditHindi(seg.hindiText);
    setEditEnglish(seg.englishText);
    setEditEmotion(seg.emotion || 'neutral');
    setEditSpeaker(seg.speakerLabel || 'SPEAKER_1');
    setEditSpeed(seg.speechSpeed || 1.0);
    setSaveToDict(defaultSaveDict);
  };

  const handlePlaySegment = async (seg: DialogueSegment) => {
    if (playingSegId === seg.id) {
      stopAudio();
      return;
    }
    stopAudio();
    if (!project) return;

    let key = seg.ttsAudioKey;
    let blob = key ? await getMediaBlob(key) : null;

    if (!blob && seg.hindiText.trim()) {
      setRegeneratingId(seg.id);
      try {
        const sp = speakers.find((s) => s.speakerLabel === seg.speakerLabel);
        const updated = await generateAndStoreSegmentTts(
          project,
          seg,
          sp?.voicePresetName || project.defaultVoicePreset
        );
        const nextSegs = segments.map((s) => (s.id === updated.id ? updated : s));
        setSegments(nextSegs);
        saveSegmentsForProject(projectId, nextSegs);
        key = updated.ttsAudioKey;
        blob = key ? await getMediaBlob(key) : null;
      } catch (err) {
        setBanner(err instanceof Error ? err.message : 'Could not synthesize segment audio.');
        setRegeneratingId(null);
        return;
      }
      setRegeneratingId(null);
    }

    if (!blob) {
      setBanner('No TTS audio generated yet for this line.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = seg.speechSpeed || 1.0;
    audioRef.current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      setPlayingSegId(null);
    };
    setPlayingSegId(seg.id);
    await audio.play();
  };

  const handleRegenerateTts = async (seg: DialogueSegment) => {
    if (!project || !seg.hindiText.trim()) return;
    setRegeneratingId(seg.id);
    setBanner(null);
    try {
      const sp = speakers.find((s) => s.speakerLabel === seg.speakerLabel);
      const updated = await generateAndStoreSegmentTts(
        project,
        seg,
        sp?.voicePresetName || project.defaultVoicePreset
      );
      const next = segments.map((s) => (s.id === updated.id ? updated : s));
      setSegments(next);
      saveSegmentsForProject(projectId, next);
      setBanner('Regenerated Hindi voice for dialogue line.');
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'TTS regeneration failed.');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleSaveEdit = () => {
    if (!editingSeg) return;
    const nextSeg: DialogueSegment = {
      ...editingSeg,
      hindiText: editHindi.trim(),
      englishText: editEnglish.trim(),
      emotion: editEmotion,
      speakerLabel: editSpeaker,
      speechSpeed: editSpeed,
      translationSource:
        editHindi.trim() !== editingSeg.hindiText.trim()
          ? TranslationSource.MANUAL
          : editingSeg.translationSource,
      status: SegmentStatus.TRANSLATED,
    };

    const nextList = segments.map((s) => (s.id === nextSeg.id ? nextSeg : s));
    setSegments(nextList);
    saveSegmentsForProject(projectId, nextList);

    if (saveToDict && editEnglish.trim() && editHindi.trim()) {
      const cfg = loadSlangConfig();
      const newRule = {
        id: `review_${Date.now()}`,
        sourceTerm: editEnglish.trim(),
        hindiReplacement: editHindi.trim(),
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Saved from Dialogue Review',
      };
      saveSlangConfig({ ...cfg, rules: [newRule, ...cfg.rules] });
      setBanner('Saved edit & added phrase to Slang Override Dictionary.');
    } else {
      setBanner('Dialogue updated. Tap Regenerate to refresh voice audio.');
    }
    setEditingSeg(null);
  };

  const filtered = segments.filter((s) => {
    if (activeFilter === 'SPEECH') return s.audioType === 'SPEECH';
    if (activeFilter === 'NON_SPEECH') return s.audioType !== 'SPEECH';
    if (activeFilter === 'FAILED') return s.status === SegmentStatus.FAILED;
    return true;
  });

  const totalDurMs = Math.max(1000, project?.durationMs || 20000);

  return (
    <div className="min-h-screen bg-[#0D0B14] pb-12 text-[#F7F4EF]">
      <StudioTopBar
        title="Dialogue Review"
        subtitle={project?.title}
        onBack={onBack}
        actions={
          <button
            type="button"
            onClick={() => {
              stopAudio();
              onGoToExport();
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-[#34D399] px-3 text-xs font-bold text-[#052e16] cursor-pointer"
          >
            <Film className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>
        }
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-3.5 px-4 pt-4">
        {banner && (
          <div className="rounded-xl border border-[#38BDF8]/40 bg-[#0F2D3E] px-4 py-2.5 text-xs text-[#38BDF8]">
            {banner}
          </div>
        )}

        {/* Mini Timeline Overview Bar */}
        <div className="rounded-xl border border-[#36304E] bg-[#151221] p-3">
          <ToolRoleTag role="Dialogue Editor • Slang Dict Saver • Per-Line TTS Regenerator" tone="CYAN" />
          <div className="mt-2 mb-1.5 flex items-center justify-between text-[11px] text-[#B3ACC8]">
            <span>Timeline Cue Coverage</span>
            <span className="font-mono">
              {segments.filter((s) => s.audioType === 'SPEECH').length} cues •{' '}
              {formatTimecodeMs(totalDurMs)}
            </span>
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-lg bg-[#0D0B14] border border-[#36304E]">
            {segments
              .filter((s) => s.audioType === 'SPEECH')
              .map((s) => {
                const leftPct = Math.min(99, (s.startMs / totalDurMs) * 100);
                const widthPct = Math.max(1.5, ((s.endMs - s.startMs) / totalDurMs) * 100);
                return (
                  <div
                    key={s.id}
                    title={`${formatTimecodeMs(s.startMs)}: ${s.hindiText || s.englishText}`}
                    className={`absolute top-1 bottom-1 rounded ${
                      s.status === SegmentStatus.TTS_DONE
                        ? 'bg-[#34D399]'
                        : s.status === SegmentStatus.FAILED
                          ? 'bg-[#F87171]'
                          : 'bg-[#FFB347]'
                    }`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  />
                );
              })}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'SPEECH', label: 'Dialogue' },
            { key: 'ALL', label: 'All' },
            { key: 'NON_SPEECH', label: 'BGM/SFX' },
            { key: 'FAILED', label: 'Failed' },
          ].map((f) => (
            <StudioChip
              key={f.key}
              selected={activeFilter === f.key}
              label={f.label}
              onClick={() => setActiveFilter(f.key as typeof activeFilter)}
            />
          ))}
        </div>

        {filtered.length === 0 ? (
          <StudioDisclosureCard
            title="No Segments in This Filter"
            body="Switch filter tabs or run the dubbing pipeline to populate English transcripts and Hindi dialogue."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((seg) => {
              const isPlaying = playingSegId === seg.id;
              const isRegen = regeneratingId === seg.id;
              const sourceLabel = translationSourceLabel(seg.translationSource);
              return (
                <div
                  key={seg.id}
                  className="flex flex-col gap-2.5 rounded-2xl border border-[#36304E] bg-[#151221] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-[#FFB347]">
                        {formatTimecodeMs(seg.startMs)} – {formatTimecodeMs(seg.endMs)}
                      </span>
                      <StatusPill label={seg.speakerLabel} tone="ACTIVE" />
                      <StatusPill label={seg.emotion || 'neutral'} tone="NEUTRAL" />
                      {sourceLabel && <StatusPill label={sourceLabel} tone="SUCCESS" />}
                    </div>
                    <StatusPill
                      label={seg.status}
                      tone={
                        seg.status === SegmentStatus.TTS_DONE
                          ? 'SUCCESS'
                          : seg.status === SegmentStatus.FAILED
                            ? 'ERROR'
                            : 'WARN'
                      }
                    />
                  </div>

                  {seg.englishText && (
                    <p className="text-xs leading-relaxed text-[#B3ACC8]">
                      <span className="font-mono text-[10px] uppercase text-[#7D7694]">EN: </span>
                      {seg.englishText}
                    </p>
                  )}

                  <p className="text-sm font-medium leading-relaxed text-[#F7F4EF]">
                    {seg.hindiText || (
                      <span className="italic text-[#7D7694]">No Hindi translation yet</span>
                    )}
                  </p>

                  {seg.errorMessage && (
                    <p className="text-xs text-[#F87171]">{seg.errorMessage}</p>
                  )}

                  {seg.audioType === 'SPEECH' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isRegen}
                        onClick={() => handlePlaySegment(seg)}
                        className="flex h-9 items-center gap-1.5 rounded-xl border border-[#38BDF8]/40 bg-[#0F2D3E] px-3 text-xs font-semibold text-[#38BDF8] cursor-pointer disabled:opacity-60"
                      >
                        {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        <span>{isPlaying ? 'Stop' : 'Play Hindi'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditor(seg, false)}
                        className="flex h-9 items-center gap-1.5 rounded-xl border border-[#36304E] bg-[#1F1B2E] px-3 text-xs font-semibold text-[#F7F4EF] hover:border-[#FFB347]/60 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-[#FFB347]" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditor(seg, true)}
                        title="Save translation override to Slang Dictionary"
                        className="flex h-9 items-center gap-1.5 rounded-xl border border-[#36304E] bg-[#1F1B2E] px-3 text-xs font-semibold text-[#B3ACC8] hover:text-[#FFB347] cursor-pointer"
                      >
                        <BookPlus className="h-3.5 w-3.5" />
                        <span>Save Dict</span>
                      </button>

                      <button
                        type="button"
                        disabled={isRegen}
                        onClick={() => handleRegenerateTts(seg)}
                        className="flex h-9 items-center gap-1.5 rounded-xl border border-[#36304E] bg-[#1F1B2E] px-3 text-xs font-semibold text-[#34D399] cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRegen ? 'animate-spin' : ''}`} />
                        <span>{isRegen ? 'Generating...' : 'Regenerate'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Dialogue Modal */}
      {editingSeg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-2xl border border-[#36304E] bg-[#151221] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#F7F4EF]">
                Edit Dialogue Line
              </h3>
              <button
                type="button"
                onClick={() => setEditingSeg(null)}
                className="rounded-lg p-1 text-[#B3ACC8] hover:bg-[#1F1B2E] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#B3ACC8]">
                English Line
              </label>
              <textarea
                rows={2}
                value={editEnglish}
                onChange={(e) => setEditEnglish(e.target.value)}
                className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] p-2.5 text-xs text-[#F7F4EF] focus:border-[#FFB347] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#B3ACC8]">
                Hindi Dialogue (Devanagari)
              </label>
              <textarea
                rows={3}
                value={editHindi}
                onChange={(e) => setEditHindi(e.target.value)}
                className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] p-2.5 text-sm text-[#F7F4EF] focus:border-[#FFB347] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#B3ACC8]">Emotion</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS.map((em) => (
                  <StudioChip
                    key={em}
                    selected={editEmotion === em}
                    label={em}
                    onClick={() => setEditEmotion(em)}
                  />
                ))}
              </div>
            </div>

            {speakers.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#B3ACC8]">Speaker</label>
                <div className="flex flex-wrap gap-1.5">
                  {speakers.map((sp) => (
                    <StudioChip
                      key={sp.id}
                      selected={editSpeaker === sp.speakerLabel}
                      label={sp.displayName}
                      onClick={() => setEditSpeaker(sp.speakerLabel)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between text-xs">
                <span className="text-[#B3ACC8]">Line Speed</span>
                <span className="font-mono text-[#FFB347]">{editSpeed.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.5}
                step={0.05}
                value={editSpeed}
                onChange={(e) => setEditSpeed(Number(e.target.value))}
                className="mt-1 w-full accent-[#FFB347]"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#F7F4EF]">
              <input
                type="checkbox"
                checked={saveToDict}
                onChange={(e) => setSaveToDict(e.target.checked)}
                className="h-4 w-4 accent-[#FFB347]"
              />
              <span>Save phrase permanently to Slang Override Dictionary</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSeg(null)}
                className="h-10 rounded-xl border border-[#36304E] px-4 text-xs font-semibold text-[#B3ACC8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="h-10 rounded-xl bg-[#FFB347] px-5 text-xs font-bold text-[#1E1100] cursor-pointer"
              >
                Save Dialogue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
