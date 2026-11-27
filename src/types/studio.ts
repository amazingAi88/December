export type AppRoute =
  | { name: 'home' }
  | { name: 'import' }
  | { name: 'dubbing_settings'; projectId: string }
  | { name: 'audio_settings'; projectId: string }
  | { name: 'processing'; projectId: string }
  | { name: 'review'; projectId: string }
  | { name: 'export'; projectId: string }
  | { name: 'settings' }
  | { name: 'slang_dictionary' };

export const ProjectStatus = {
  CONFIGURING: 'CONFIGURING',
  PROCESSING: 'PROCESSING',
  PAUSED: 'PAUSED',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
} as const;
export type ProjectStatusType = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const ProcessingStage = {
  IDLE: 'Idle',
  EXTRACTING: 'Extracting Audio',
  TRANSCRIBING: 'Transcribing English',
  TRANSLATING: 'Translating to Hindi',
  GENERATING_TTS: 'Generating Hindi Voices',
  MIXING: 'Mixing Audio & Background Music',
  READY: 'Ready for Review',
  EXPORTING: 'Exporting Hindi MP4',
  DONE: 'Completed',
} as const;

export const ChunkStatus = {
  PENDING: 'PENDING',
  EXTRACTED: 'EXTRACTED',
  TRANSCRIBED: 'TRANSCRIBED',
  TRANSLATED: 'TRANSLATED',
  TTS_DONE: 'TTS_DONE',
  MIXED: 'MIXED',
  FAILED: 'FAILED',
} as const;
export type ChunkStatusType = (typeof ChunkStatus)[keyof typeof ChunkStatus];

export const SegmentStatus = {
  TRANSCRIBED: 'TRANSCRIBED',
  TRANSLATED: 'TRANSLATED',
  TTS_DONE: 'TTS_DONE',
  FAILED: 'FAILED',
} as const;
export type SegmentStatusType = (typeof SegmentStatus)[keyof typeof SegmentStatus];

export const TranslationSource = {
  GEMINI: 'GEMINI',
  LOCAL_GGUF: 'LOCAL_GGUF',
  ML_KIT: 'ML_KIT',
  DICTIONARY: 'DICTIONARY',
  SUBTITLE: 'SUBTITLE',
  MANUAL: 'MANUAL',
} as const;
export type TranslationSourceType = (typeof TranslationSource)[keyof typeof TranslationSource] | '';

export function translationSourceLabel(source: string): string {
  switch (source) {
    case TranslationSource.GEMINI:
      return 'GEMINI';
    case TranslationSource.LOCAL_GGUF:
      return 'QWEN GGUF';
    case TranslationSource.ML_KIT:
      return 'LOCAL / ML';
    case TranslationSource.DICTIONARY:
      return 'DICT';
    case TranslationSource.SUBTITLE:
      return 'SRT';
    case TranslationSource.MANUAL:
      return 'MANUAL';
    default:
      return '';
  }
}

export const DialogueStyle = {
  CONVERSATIONAL: 'Natural Conversational Hindi',
  CINEMATIC: 'Cinematic Dramatic Hindi',
  CASUAL: 'Casual Everyday Hindustani',
  RAW_UNCENSORED: 'Raw Uncensored / Adult Cinema',
} as const;
export const ALL_DIALOGUE_STYLES = [
  DialogueStyle.CONVERSATIONAL,
  DialogueStyle.CINEMATIC,
  DialogueStyle.CASUAL,
  DialogueStyle.RAW_UNCENSORED,
];

export const SeparationMode = {
  STEREO_MID_SIDE: 'STEREO_MID_SIDE',
  MONO_BAND_DUCKING: 'MONO_BAND_DUCKING',
  ORIGINAL_UNSEPARATED: 'ORIGINAL_UNSEPARATED',
} as const;
export type SeparationModeType = (typeof SeparationMode)[keyof typeof SeparationMode];

export const ExportQuality = {
  ORIGINAL: 'ORIGINAL',
  HD_1080P: '1080P',
  HD_720P: '720P',
  SD_480P: '480P',
} as const;
export const ALL_EXPORT_QUALITIES = [
  ExportQuality.ORIGINAL,
  ExportQuality.HD_1080P,
  ExportQuality.HD_720P,
  ExportQuality.SD_480P,
];

export const EngineMode = {
  GEMINI_CLOUD: 'GEMINI_CLOUD',
  ON_DEVICE_FREE: 'ON_DEVICE_FREE',
  ON_DEVICE_LLM: 'ON_DEVICE_LLM',
} as const;
export const ALL_ENGINE_MODES = [
  EngineMode.GEMINI_CLOUD,
  EngineMode.ON_DEVICE_FREE,
  EngineMode.ON_DEVICE_LLM,
];

export const DubbingSpeedMode = {
  FULL_GGUF: 'FULL_GGUF',
  HYBRID_TURBO: 'HYBRID_TURBO',
} as const;
export const ALL_DUBBING_SPEED_MODES = [
  DubbingSpeedMode.FULL_GGUF,
  DubbingSpeedMode.HYBRID_TURBO,
];

export const SttEngineMode = {
  VOSK_FAST: 'VOSK_FAST',
  WHISPER_TINY_EN: 'WHISPER_TINY_EN',
  WHISPER_BASE_EN: 'WHISPER_BASE_EN',
} as const;
export const ALL_STT_ENGINE_MODES = [
  SttEngineMode.VOSK_FAST,
  SttEngineMode.WHISPER_TINY_EN,
  SttEngineMode.WHISPER_BASE_EN,
];

export function sttEngineLabel(mode: string): string {
  switch (mode) {
    case SttEngineMode.WHISPER_TINY_EN:
      return 'Whisper Tiny EN (~32 MB)';
    case SttEngineMode.WHISPER_BASE_EN:
      return 'Whisper Base EN (~60 MB)';
    default:
      return 'Vosk Fast EN (~40 MB)';
  }
}

export const MediaAccelMode = {
  HARDWARE_PRIORITY: 'HARDWARE_PRIORITY',
  BALANCED_AUTO: 'BALANCED_AUTO',
  SOFTWARE_SAFE: 'SOFTWARE_SAFE',
} as const;
export const ALL_MEDIA_ACCEL_MODES = [
  MediaAccelMode.HARDWARE_PRIORITY,
  MediaAccelMode.BALANCED_AUTO,
  MediaAccelMode.SOFTWARE_SAFE,
];

export function mediaAccelLabel(mode: string): string {
  switch (mode) {
    case MediaAccelMode.BALANCED_AUTO:
      return 'Balanced Auto';
    case MediaAccelMode.SOFTWARE_SAFE:
      return 'Software Safe';
    default:
      return 'Hardware Priority';
  }
}

export const SubtitleLanguage = {
  ENGLISH: 'EN',
  HINDI: 'HI',
} as const;
export const ALL_SUBTITLE_LANGUAGES = [SubtitleLanguage.ENGLISH, SubtitleLanguage.HINDI];

export function subtitleLanguageLabel(lang: string): string {
  return lang === SubtitleLanguage.HINDI
    ? 'Hindi (.SRT → Direct Dub)'
    : 'English (.SRT → Translate)';
}

export interface VoicePreset {
  id: string;
  label: string;
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  description: string;
}

export const HINDI_VOICE_PRESETS: VoicePreset[] = [
  { id: 'Charon', label: 'Charon (Deep Male)', gender: 'MALE', description: 'Grounded, authoritative cinema baritone' },
  { id: 'Fenrir', label: 'Fenrir (Bold Male)', gender: 'MALE', description: 'Dramatic, intense action & hero voice' },
  { id: 'Orus', label: 'Orus (Warm Male)', gender: 'MALE', description: 'Natural conversational male lead' },
  { id: 'Puck', label: 'Puck (Youthful Male)', gender: 'MALE', description: 'Energetic, expressive younger male' },
  { id: 'Kore', label: 'Kore (Clear Female)', gender: 'FEMALE', description: 'Crisp, expressive lead actress tone' },
  { id: 'Aoede', label: 'Aoede (Warm Female)', gender: 'FEMALE', description: 'Smooth, emotional conversational tone' },
  { id: 'Leda', label: 'Leda (Soft Female)', gender: 'FEMALE', description: 'Gentle, reflective narrative voice' },
  { id: 'Zephyr', label: 'Zephyr (Balanced Neutral)', gender: 'NEUTRAL', description: 'Versatile neutral narrator or supporting voice' },
];

export interface MovieProject {
  id: string;
  title: string;
  fileName: string;
  durationMs: number;
  width: number;
  height: number;
  fileSizeBytes: number;
  videoMime: string;
  audioMime: string;
  audioChannels: number;
  audioSampleRate: number;
  thumbnailDataUrl: string | null;
  chunkDurationSec: number;
  engineMode: string;
  dialogueStyle: string;
  defaultVoiceGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  defaultVoicePreset: string;
  defaultSpeechSpeed: number;
  defaultEmotionBias: string;
  preserveBgm: boolean;
  removeEnglishDialogue: boolean;
  separationMode: SeparationModeType;
  hindiVolume: number;
  bgmVolume: number;
  originalVolume: number;
  status: ProjectStatusType;
  currentStage: string;
  progressPercent: number;
  estimatedRemainingMs: number | null;
  lastError: string | null;
  exportQuality: string;
  exportFileName: string | null;
  exportSizeBytes: number;
  tempFilesCleaned: boolean;
  subtitleFileName: string | null;
  subtitleRawText: string | null;
  subtitleLanguage: string;
  englishSubtitleFileName?: string | null;
  englishSubtitleRawText?: string | null;
  hindiSubtitleFileName?: string | null;
  hindiSubtitleRawText?: string | null;
  isDemo?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AudioChunk {
  id: string;
  projectId: string;
  chunkIndex: number;
  startMs: number;
  endMs: number;
  status: ChunkStatusType;
  processingTimeMs: number;
  errorMessage: string | null;
}

export interface SpeakerProfile {
  id: string;
  projectId: string;
  speakerLabel: string;
  displayName: string;
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  voicePresetName: string;
  speedMultiplier: number;
  defaultEmotion: string;
  traits: string;
}

export interface DialogueSegment {
  id: string;
  projectId: string;
  chunkIndex: number;
  orderIndex: number;
  startMs: number;
  endMs: number;
  speakerLabel: string;
  englishText: string;
  hindiText: string;
  emotion: string;
  isOverlapping: boolean;
  audioType: 'SPEECH' | 'MUSIC' | 'SFX' | 'SILENCE';
  speechSpeed: number;
  ttsAudioKey: string | null;
  ttsDurationMs: number;
  status: SegmentStatusType;
  errorMessage: string | null;
  translationSource: TranslationSourceType;
}

export interface StudioPreferences {
  defaultChunkDurationSec: number;
  defaultEngineMode: string;
  defaultDialogueStyle: string;
  defaultSpeechSpeed: number;
  defaultPreserveBgm: boolean;
  defaultExportQuality: string;
  autoCleanupAfterExport: boolean;
  activeGgufModelFileName: string;
  dubbingSpeedMode: string;
  mediaAccelMode: string;
  mediaAsyncCodecQueueing: boolean;
  mediaHighOperatingRate: boolean;
  mediaAllowCodecFallback: boolean;
  mediaTransformerTimeoutSec: number;
  sttEngineMode: string;
  sttVocalIsolationEnabled: boolean;
}

export interface SlangOverrideRule {
  id: string;
  sourceTerm: string;
  hindiReplacement: string;
  contextKeywords: string[];
  dialogueStyles: string[];
  wholeWord: boolean;
  enabled: boolean;
  note: string;
}

export interface SlangDictionaryConfig {
  version: number;
  enabled: boolean;
  rules: SlangOverrideRule[];
}
