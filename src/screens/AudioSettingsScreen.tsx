import { useEffect, useRef, useState } from 'react';
import { ArrowRight, AudioWaveform, Play, Square } from 'lucide-react';
import {
  StepHeaderRow,
  StudioChip,
  StudioDisclosureCard,
  StudioSwitch,
  StudioTopBar,
  ToolRoleTag,
} from '../components/StudioComponents';
import { getMediaBlob, getProjectById, upsertProject } from '../data/studioStorage';
import {
  MovieProject,
  ProjectStatus,
  SeparationMode,
  SeparationModeType,
} from '../types/studio';
import { getSharedAudioContext } from '../utils/audioEngine';
import {
  createSeparatedBgmBuffer,
  decodeMediaAudio,
  synthesizeDemoSoundtrackBuffer,
} from '../utils/studioAudioDsp';

interface AudioSettingsScreenProps {
  projectId: string;
  onBack: () => void;
  onGoToProcessing: () => void;
}

export function AudioSettingsScreen({
  projectId,
  onBack,
  onGoToProcessing,
}: AudioSettingsScreenProps) {
  const [project, setProject] = useState<MovieProject | null>(null);
  const [preparingPreview, setPreparingPreview] = useState(false);
  const [activePreviewTag, setActivePreviewTag] = useState<'orig' | 'mix' | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const activeNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setProject(getProjectById(projectId));
    return () => stopAudioPreview();
  }, [projectId]);

  const stopAudioPreview = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (activeNodeRef.current) {
      try {
        activeNodeRef.current.stop();
        activeNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      activeNodeRef.current = null;
    }
    setActivePreviewTag(null);
    setPreviewProgress(0);
  };

  const updateProject = (patch: Partial<MovieProject>) => {
    if (!project) return;
    const next = upsertProject({ ...project, ...patch });
    setProject(next);
  };

  const runPreview = async (mode: 'orig' | 'mix') => {
    if (!project) return;
    if (activePreviewTag === mode) {
      stopAudioPreview();
      return;
    }
    stopAudioPreview();
    setPreparingPreview(true);
    setPreviewError(null);

    try {
      const ctx = getSharedAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const blob = await getMediaBlob(`proj_${project.id}_source_video`);
      let buf = blob ? await decodeMediaAudio(blob) : null;
      if (!buf) {
        buf = synthesizeDemoSoundtrackBuffer(15);
      }

      const maxPreviewSec = Math.min(15, buf.duration);
      const sliceSamples = Math.floor(maxPreviewSec * buf.sampleRate);
      const previewSlice = ctx.createBuffer(buf.numberOfChannels, sliceSamples, buf.sampleRate);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        previewSlice.copyToChannel(new Float32Array(buf.getChannelData(ch).subarray(0, sliceSamples)), ch);
      }

      const playBuffer =
        mode === 'orig'
          ? previewSlice
          : createSeparatedBgmBuffer(
              previewSlice,
              [
                { startSec: 1, endSec: 4.2 },
                { startSec: 5.8, endSec: 8.9 },
                { startSec: 10.8, endSec: 14.1 },
              ],
              project.separationMode,
              project.removeEnglishDialogue
            );

      const src = ctx.createBufferSource();
      src.buffer = playBuffer;
      const gain = ctx.createGain();
      gain.gain.value = mode === 'orig' ? 1.0 : project.preserveBgm ? project.bgmVolume : 0.1;
      src.connect(gain);
      gain.connect(ctx.destination);

      const startedAt = performance.now();
      activeNodeRef.current = src;
      setActivePreviewTag(mode);
      setPreparingPreview(false);
      src.start(0);

      src.onended = () => {
        stopAudioPreview();
      };

      const tick = () => {
        const elapsed = (performance.now() - startedAt) / 1000;
        setPreviewProgress(Math.min(100, Math.round((elapsed / maxPreviewSec) * 100)));
        if (elapsed < maxPreviewSec && activeNodeRef.current) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setPreparingPreview(false);
      setPreviewError(err instanceof Error ? err.message : 'Preview playback failed.');
    }
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0D0B14] text-[#F7F4EF]">
        <StudioTopBar title="Audio & BGM Mixing" onBack={onBack} />
      </div>
    );
  }

  const isStereo = project.audioChannels >= 2;
  const alreadyStarted = project.status !== ProjectStatus.CONFIGURING;

  return (
    <div className="min-h-screen bg-[#0D0B14] pb-12 text-[#F7F4EF]">
      <StudioTopBar title="Audio & BGM Mixing" subtitle={project.title} onBack={onBack} />

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-5">
        <StepHeaderRow stepNumber={2} stepName="Audio & BGM" />

        {/* Separation Switches */}
        <section className="flex flex-col gap-4 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ToolRoleTag role="BGM & Vocal Separation Tool • Mid-Side / Band Ducking" tone="CYAN" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#F7F4EF]">
                Preserve Background Music &amp; SFX
              </h2>
              <p className="mt-0.5 text-xs text-[#B3ACC8]">
                Retain movie soundtrack, explosions, and stereo ambience.
              </p>
            </div>
            <StudioSwitch
              checked={project.preserveBgm}
              onChange={(v) => updateProject({ preserveBgm: v })}
              ariaLabel="Preserve BGM"
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#36304E] pt-3">
            <div>
              <h2 className="text-sm font-semibold text-[#F7F4EF]">
                Suppress Original English Dialogue
              </h2>
              <p className="mt-0.5 text-xs text-[#B3ACC8]">
                Apply Mid-Side vocal cancellation &amp; speech-band ducking during spoken lines.
              </p>
            </div>
            <StudioSwitch
              checked={project.removeEnglishDialogue}
              onChange={(v) => updateProject({ removeEnglishDialogue: v })}
              ariaLabel="Suppress Original English Dialogue"
            />
          </div>

          <div className="border-t border-[#36304E] pt-3">
            <p className="mb-2 text-xs font-semibold text-[#F7F4EF]">Separation Algorithm</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: SeparationMode.STEREO_MID_SIDE, label: 'Stereo Mid-Side' },
                { id: SeparationMode.MONO_BAND_DUCKING, label: 'Speech-Band Ducking' },
                { id: SeparationMode.ORIGINAL_UNSEPARATED, label: 'Keep Original Mix' },
              ].map((m) => (
                <StudioChip
                  key={m.id}
                  selected={project.separationMode === m.id}
                  label={m.label}
                  onClick={() => updateProject({ separationMode: m.id as SeparationModeType })}
                />
              ))}
            </div>
          </div>
        </section>

        <StudioDisclosureCard
          title={isStereo ? 'Stereo Mid-Side Separation Active' : 'Mono Audio Track — Limited Separation'}
          body={
            isStereo
              ? 'Stereo Mid-Side + Speech-Band Suppression active. Preserves stereo music & SFX while attenuating center-panned English dialogue.'
              : 'Mono audio track detected. Center-channel dialogue cancellation cannot isolate speech from mono mixes; speech-band ducking is used.'
          }
          isWarning
        />

        {/* 3-Channel Volume Mixer */}
        <section className="flex flex-col gap-4 rounded-2xl border border-[#36304E] bg-[#151221] p-4">
          <div>
            <ToolRoleTag role="Audio Balance & Gain Mixer Tool" tone="GOLD" />
            <h2 className="mt-1.5 text-sm font-semibold text-[#F7F4EF]">3-Channel Studio Mixer</h2>
            <p className="mt-0.5 text-xs text-[#B3ACC8]">
              Controls loudness ratio between Hindi TTS voice, background BGM, and original audio bleed.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <span className="text-[#F7F4EF]">Hindi Dubbed Dialogue</span>
              <span className="font-mono font-bold text-[#FFB347]">
                {Math.round(project.hindiVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={project.hindiVolume}
              onChange={(e) => updateProject({ hindiVolume: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[#FFB347]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <span className="text-[#F7F4EF]">Background Music &amp; SFX</span>
              <span className="font-mono font-bold text-[#38BDF8]">
                {Math.round(project.bgmVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={project.bgmVolume}
              onChange={(e) => updateProject({ bgmVolume: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[#38BDF8]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <span className="text-[#F7F4EF]">Original English Bleed</span>
              <span className="font-mono font-bold text-[#FF6B4A]">
                {Math.round(project.originalVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.05}
              value={project.originalVolume}
              onChange={(e) => updateProject({ originalVolume: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[#FF6B4A]"
            />
          </div>
        </section>

        {/* Real Audio A/B Preview */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#FFB347]/45 bg-[#151221] p-4">
          <div>
            <ToolRoleTag role="Pre-Render A/B Audio Comparison Tool" tone="EMERALD" />
            <div className="mt-1.5 flex items-center gap-2">
              <AudioWaveform className="h-5 w-5 text-[#FFB347]" />
              <h2 className="text-sm font-semibold text-[#F7F4EF]">Real Audio A/B Preview</h2>
            </div>
          </div>
          <p className="text-xs text-[#B3ACC8]">
            Audition the first 15s comparing raw original audio vs Mid-Side separated BGM bed before dubbing.
          </p>

          {preparingPreview && (
            <p className="text-xs text-[#FFB347]">Extracting &amp; separating real audio preview...</p>
          )}
          {previewError && <p className="text-xs text-[#F87171]">{previewError}</p>}

          {activePreviewTag && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1F1B2E]">
              <div
                className="h-full bg-[#FFB347] transition-all"
                style={{ width: `${previewProgress}%` }}
              />
            </div>
          )}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => runPreview('orig')}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#36304E] bg-[#1F1B2E] text-xs font-semibold text-[#F7F4EF] cursor-pointer"
            >
              {activePreviewTag === 'orig' ? (
                <Square className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>{activePreviewTag === 'orig' ? 'Stop Orig' : 'Original'}</span>
            </button>

            <button
              type="button"
              onClick={() => runPreview('mix')}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#38BDF8] text-xs font-bold text-[#091c28] cursor-pointer"
            >
              {activePreviewTag === 'mix' ? (
                <Square className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>{activePreviewTag === 'mix' ? 'Stop BGM Bed' : 'Separated BGM'}</span>
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={() => {
            stopAudioPreview();
            onGoToProcessing();
          }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFB347] text-sm font-bold text-[#1E1100] hover:bg-[#ffc36d] cursor-pointer"
        >
          <span>{alreadyStarted ? 'Open Processing Pipeline' : 'Start Hindi Dubbing Pipeline'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
