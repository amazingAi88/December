import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, FileVideo, Languages, Subtitles, Upload, X } from 'lucide-react';
import { StudioTopBar, ToolRoleTag } from '../components/StudioComponents';
import { loadPreferences, putMediaBlob, upsertProject } from '../data/studioStorage';
import {
  MovieProject,
  ProcessingStage,
  ProjectStatus,
  SeparationMode,
  SubtitleLanguage,
} from '../types/studio';
import { inspectVideoFile } from '../utils/studioAudioDsp';
import { formatFileSize, formatTimecodeMs, parseSubtitleText } from '../utils/subtitleParser';

interface ImportMovieScreenProps {
  onBack: () => void;
  onProjectCreated: (projectId: string) => void;
}

export function ImportMovieScreen({ onBack, onProjectCreated }: ImportMovieScreenProps) {
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const enSubInputRef = useRef<HTMLInputElement | null>(null);
  const hiSubInputRef = useRef<HTMLInputElement | null>(null);

  const [inspecting, setInspecting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [durationMs, setDurationMs] = useState(0);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Separate English .SRT state
  const [enSubFileName, setEnSubFileName] = useState<string | null>(null);
  const [enSubRawText, setEnSubRawText] = useState<string | null>(null);
  const [enSubCueCount, setEnSubCueCount] = useState(0);
  const [enSubError, setEnSubError] = useState<string | null>(null);

  // Separate Hindi .SRT state
  const [hiSubFileName, setHiSubFileName] = useState<string | null>(null);
  const [hiSubRawText, setHiSubRawText] = useState<string | null>(null);
  const [hiSubCueCount, setHiSubCueCount] = useState(0);
  const [hiSubError, setHiSubError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);

  const handleVideoPick = async (file: File | undefined) => {
    if (!file) return;
    setVideoError(null);
    setInspecting(true);
    try {
      const meta = await inspectVideoFile(file);
      setSelectedFile(file);
      setTitle(file.name.replace(/\.[^.]+$/, ''));
      setDurationMs(meta.durationMs);
      setWidth(meta.width);
      setHeight(meta.height);
      setThumbDataUrl(meta.thumbnailDataUrl);
    } catch {
      setVideoError('Could not inspect this video file. Ensure it is a valid MP4/WebM/MKV/MOV.');
    } finally {
      setInspecting(false);
    }
  };

  const handleEnglishSubPick = async (file: File | undefined) => {
    if (!file) return;
    setEnSubError(null);
    const raw = await file.text();
    const cues = parseSubtitleText(raw);
    if (cues.length === 0) {
      setEnSubError('No valid .SRT or .VTT dialogue timestamps found in this English file.');
      return;
    }
    setEnSubFileName(file.name);
    setEnSubRawText(raw);
    setEnSubCueCount(cues.length);
  };

  const handleHindiSubPick = async (file: File | undefined) => {
    if (!file) return;
    setHiSubError(null);
    const raw = await file.text();
    const cues = parseSubtitleText(raw);
    if (cues.length === 0) {
      setHiSubError('No valid .SRT or .VTT dialogue timestamps found in this Hindi file.');
      return;
    }
    setHiSubFileName(file.name);
    setHiSubRawText(raw);
    setHiSubCueCount(cues.length);
  };

  const handleCreateProject = async () => {
    if (!selectedFile || creating) return;
    setCreating(true);
    try {
      const prefs = loadPreferences();
      const id = `proj_${Date.now()}`;
      await putMediaBlob(`proj_${id}_source_video`, selectedFile);

      const primaryLang = hiSubRawText ? SubtitleLanguage.HINDI : SubtitleLanguage.ENGLISH;
      const primaryFileName = hiSubFileName || enSubFileName || null;
      const primaryRaw = hiSubRawText || enSubRawText || null;

      const newProject: MovieProject = {
        id,
        title: title.trim() || selectedFile.name,
        fileName: selectedFile.name,
        durationMs: Math.max(1000, durationMs),
        width,
        height,
        fileSizeBytes: selectedFile.size,
        videoMime: selectedFile.type || 'video/mp4',
        audioMime: 'audio/aac',
        audioChannels: 2,
        audioSampleRate: 44100,
        thumbnailDataUrl: thumbDataUrl,
        chunkDurationSec: prefs.defaultChunkDurationSec,
        engineMode: prefs.defaultEngineMode,
        dialogueStyle: prefs.defaultDialogueStyle,
        defaultVoiceGender: 'MALE',
        defaultVoicePreset: 'Charon',
        defaultSpeechSpeed: prefs.defaultSpeechSpeed,
        defaultEmotionBias: 'natural',
        preserveBgm: prefs.defaultPreserveBgm,
        removeEnglishDialogue: true,
        separationMode: SeparationMode.STEREO_MID_SIDE,
        hindiVolume: 1.0,
        bgmVolume: 0.85,
        originalVolume: 0.0,
        status: ProjectStatus.CONFIGURING,
        currentStage: ProcessingStage.IDLE,
        progressPercent: 0,
        estimatedRemainingMs: null,
        lastError: null,
        exportQuality: prefs.defaultExportQuality,
        exportFileName: null,
        exportSizeBytes: 0,
        tempFilesCleaned: false,
        subtitleFileName: primaryFileName,
        subtitleRawText: primaryRaw,
        subtitleLanguage: primaryLang,
        englishSubtitleFileName: enSubFileName,
        englishSubtitleRawText: enSubRawText,
        hindiSubtitleFileName: hiSubFileName,
        hindiSubtitleRawText: hiSubRawText,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      upsertProject(newProject);
      onProjectCreated(id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0B14] pb-12 text-[#F7F4EF]">
      <StudioTopBar
        title="Import Movie"
        subtitle="Select video & English / Hindi .SRT subtitles"
        onBack={onBack}
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-5">
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*,.mkv,.avi,.mov,.mp4,.webm,.m4v"
          className="hidden"
          onChange={(e) => handleVideoPick(e.target.files?.[0])}
        />
        <input
          ref={enSubInputRef}
          type="file"
          accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain"
          className="hidden"
          onChange={(e) => handleEnglishSubPick(e.target.files?.[0])}
        />
        <input
          ref={hiSubInputRef}
          type="file"
          accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain"
          className="hidden"
          onChange={(e) => handleHindiSubPick(e.target.files?.[0])}
        />

        {!selectedFile ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#FFB347]/50 bg-[#151221] p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3E290E] text-[#FFB347]">
              <FileVideo className="h-8 w-8" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-[#F7F4EF]">
              Choose Movie or Scene Video
            </h2>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#B3ACC8]">
              Supports MP4, WebM, MOV, MKV, and M4V. Audio is decoded directly in your browser without uploading the whole video file.
            </p>
            {videoError && <p className="mt-2 text-xs text-[#F87171]">{videoError}</p>}
            <button
              type="button"
              disabled={inspecting}
              onClick={() => videoInputRef.current?.click()}
              className="mt-5 flex h-12 items-center gap-2 rounded-xl bg-[#FFB347] px-6 text-sm font-bold text-[#1E1100] hover:bg-[#ffc36d] cursor-pointer disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              <span>{inspecting ? 'Inspecting Video...' : 'Pick Video File'}</span>
            </button>
          </div>
        ) : (
          <>
            {/* Inspected Video Card */}
            <div className="overflow-hidden rounded-2xl border border-[#36304E] bg-[#151221]">
              {thumbDataUrl && (
                <img src={thumbDataUrl} alt={title} className="h-44 w-full object-cover" />
              )}
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#34D399]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Video Ready for Dubbing</span>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#B3ACC8]">
                    Project Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-[#36304E] bg-[#0D0B14] px-3.5 py-2.5 text-sm text-[#F7F4EF] focus:border-[#FFB347] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#1F1B2E] p-3 text-xs">
                  <div>
                    <span className="text-[#B3ACC8]">File</span>
                    <p className="truncate font-mono font-medium text-[#F7F4EF]">{selectedFile.name}</p>
                  </div>
                  <div>
                    <span className="text-[#B3ACC8]">Duration</span>
                    <p className="font-mono font-medium text-[#FFB347]">
                      {formatTimecodeMs(durationMs)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#B3ACC8]">Resolution</span>
                    <p className="font-mono font-medium text-[#F7F4EF]">
                      {width} × {height}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#B3ACC8]">Size</span>
                    <p className="font-mono font-medium text-[#F7F4EF]">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Option 1: English .SRT Subtitle Upload (Requires Translation) */}
            <div
              className={`rounded-2xl border bg-[#151221] p-4 ${
                enSubCueCount > 0 ? 'border-[#38BDF8]/60' : 'border-[#36304E]'
              }`}
            >
              <div className="mb-2">
                <ToolRoleTag role="SRT Tool • Translation Required (EN → HI → TTS)" tone="CYAN" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Languages className="mt-0.5 h-5 w-5 shrink-0 text-[#38BDF8]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#F7F4EF]">
                      Upload English .SRT / .VTT Subtitle
                    </h3>
                    <p className="mt-0.5 text-xs">
                      {enSubCueCount > 0 ? (
                        <span className="font-medium text-[#38BDF8]">
                          {enSubFileName} • {enSubCueCount} English cues (will translate to Hindi &amp; dub)
                        </span>
                      ) : (
                        <span className="text-[#B3ACC8]">
                          English .SRT अपलोड करने पर ऐप इसे हिंदी में Translate करके सीन टाइमिंग पर Dub करेगा।
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {enSubCueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setEnSubFileName(null);
                      setEnSubRawText(null);
                      setEnSubCueCount(0);
                    }}
                    className="rounded-lg p-1.5 text-[#B3ACC8] hover:bg-[#1F1B2E] hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {enSubError && <p className="mt-2 text-xs text-[#F87171]">{enSubError}</p>}

              <button
                type="button"
                onClick={() => enSubInputRef.current?.click()}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#38BDF8]/40 bg-[#0F2D3E]/60 text-xs font-semibold text-[#38BDF8] hover:bg-[#0F2D3E] cursor-pointer"
              >
                <Subtitles className="h-4 w-4" />
                <span>
                  {enSubCueCount > 0 ? 'Replace English .SRT / .VTT' : 'Upload English .SRT / .VTT'}
                </span>
              </button>
            </div>

            {/* Option 2: Hindi .SRT Subtitle Upload (Direct Dub — No Translation Needed) */}
            <div
              className={`rounded-2xl border bg-[#151221] p-4 ${
                hiSubCueCount > 0 ? 'border-[#34D399]/60' : 'border-[#36304E]'
              }`}
            >
              <div className="mb-2">
                <ToolRoleTag role="SRT Tool • No Translation Needed (Direct Hindi Dub)" tone="EMERALD" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Subtitles className="mt-0.5 h-5 w-5 shrink-0 text-[#34D399]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#F7F4EF]">
                      Upload Hindi .SRT / .VTT Subtitle
                    </h3>
                    <p className="mt-0.5 text-xs">
                      {hiSubCueCount > 0 ? (
                        <span className="font-medium text-[#34D399]">
                          {hiSubFileName} • {hiSubCueCount} Hindi cues (Direct TTS dubbing — no translation)
                        </span>
                      ) : (
                        <span className="text-[#B3ACC8]">
                          Hindi .SRT अपलोड करने पर Translation की आवश्यकता नहीं होगी — सीधे सीन डायलॉग टाइमिंग पर मूवी Dub होगी।
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {hiSubCueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setHiSubFileName(null);
                      setHiSubRawText(null);
                      setHiSubCueCount(0);
                    }}
                    className="rounded-lg p-1.5 text-[#B3ACC8] hover:bg-[#1F1B2E] hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {hiSubError && <p className="mt-2 text-xs text-[#F87171]">{hiSubError}</p>}

              <button
                type="button"
                onClick={() => hiSubInputRef.current?.click()}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#34D399]/40 bg-[#0E3325]/60 text-xs font-semibold text-[#34D399] hover:bg-[#0E3325] cursor-pointer"
              >
                <Subtitles className="h-4 w-4" />
                <span>
                  {hiSubCueCount > 0 ? 'Replace Hindi .SRT / .VTT' : 'Upload Hindi .SRT / .VTT'}
                </span>
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="h-12 flex-1 rounded-xl border border-[#36304E] bg-[#151221] text-sm font-semibold text-[#F7F4EF] hover:bg-[#1F1B2E] cursor-pointer"
              >
                Change File
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateProject}
                className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[#FFB347] text-sm font-bold text-[#1E1100] hover:bg-[#ffc36d] cursor-pointer disabled:opacity-60"
              >
                <span>{creating ? 'Creating...' : 'Dubbing Settings'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
