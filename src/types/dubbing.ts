export type UILanguage = 'en' | 'hi';

export type DubUploadMode = 'continuous' | 'concatenated';

export type ContinuousAlignStrategy = 'srt-slice' | 'silence-split';

export type FitStatus = 'optimal' | 'mild-stretch' | 'high-speed' | 'unassigned';

export interface SrtCue {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

export interface DubSegment extends SrtCue {
  /** Start time in the source dub AudioBuffer (seconds) */
  sourceStartSec: number;
  /** End time in the source dub AudioBuffer (seconds) */
  sourceEndSec: number;
  /** Playback speed / FFmpeg atempo multiplier (sourceDuration / targetDuration) */
  atempo: number;
  /** Optional dedicated AudioBuffer when individual line files are uploaded */
  clipBuffer?: AudioBuffer | null;
  clipFileName?: string;
  /** Manual gain multiplier (0.0 - 2.0) */
  gain: number;
  /** Whether this cue's dub audio is muted */
  muted: boolean;
  /** Whether the segment timing or atempo was manually locked by the user */
  manualOverride?: boolean;
  /** True if a valid audio region is assigned to this cue */
  hasAudio: boolean;
}

export interface GapInterval {
  id: string;
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface BgmConfig {
  fileName: string | null;
  buffer: AudioBuffer | null;
  peaks: number[];
  /** Volume (0 to 1) during dialogue-free gaps */
  gapVolume: number;
  /** Volume (0 to 1) ducked underneath active dialogue */
  duckVolume: number;
  /** Fade duration in milliseconds between gap and dialogue */
  duckFadeMs: number;
  /** Loop background track if shorter than movie duration */
  loop: boolean;
  /** Trim start offset in BGM file (seconds) */
  offsetSec: number;
  muted: boolean;
}

export interface SilenceDetectionConfig {
  /** Automatically calibrate noise floor and split/merge regions to match SRT cue count */
  autoCalibrate: boolean;
  /** RMS threshold in dBFS below which audio is treated as silence (-50 to -15) */
  thresholdDb: number;
  /** Minimum silence duration in ms to split concatenated lines */
  minSilenceMs: number;
  /** Minimum speech duration in ms to ignore transient clicks */
  minSpeechMs: number;
}

export interface ProjectMediaState {
  videoUrl: string | null;
  videoFileName: string | null;
  videoDurationSec: number;
  originalVideoMuted: boolean;
  originalVideoVolume: number;

  srtFileName: string | null;

  dubMode: DubUploadMode;
  continuousStrategy: ContinuousAlignStrategy;
  dubMasterFileName: string | null;
  dubMasterBuffer: AudioBuffer | null;
  dubMasterPeaks: number[];
  pitchPreserve: boolean;
}

export type ActiveWorkspaceTab = 'timeline' | 'alignment' | 'tools' | 'export';

export type ExportFormat = 'wav' | 'webm' | 'ffmpeg' | 'srt' | 'fcpxml' | 'json';
