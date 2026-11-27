import {
  AudioChunk,
  DialogueSegment,
  DialogueStyle,
  DubbingSpeedMode,
  EngineMode,
  ExportQuality,
  MediaAccelMode,
  MovieProject,
  ProcessingStage,
  ProjectStatus,
  SegmentStatus,
  SeparationMode,
  SpeakerProfile,
  SttEngineMode,
  StudioPreferences,
  SubtitleLanguage,
  TranslationSource,
} from '../types/studio';

const PROJECTS_KEY = 'hindi_dub_projects_v1';
const CHUNKS_KEY = 'hindi_dub_chunks_v1';
const SPEAKERS_KEY = 'hindi_dub_speakers_v1';
const SEGMENTS_KEY = 'hindi_dub_segments_v1';
const PREFS_KEY = 'hindi_dub_prefs_v1';

const DB_NAME = 'hindi_dub_studio_blobs_v1';
const STORE_NAME = 'media_blobs';

function openBlobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putMediaBlob(key: string, blob: Blob): Promise<void> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMediaBlob(key: string): Promise<Blob | null> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as Blob) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMediaBlob(key: string): Promise<void> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProjectBlobs(projectId: string): Promise<void> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = req.result as string[];
      for (const k of keys) {
        if (typeof k === 'string' && k.startsWith(`proj_${projectId}_`)) {
          store.delete(k);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function estimateTempAudioBytes(projectId?: string): Promise<number> {
  const db = await openBlobDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = async () => {
      const keys = (req.result as string[]) || [];
      let total = 0;
      const filtered = projectId
        ? keys.filter((k) => k.startsWith(`proj_${projectId}_`) && !k.endsWith('_source_video') && !k.endsWith('_export_wav'))
        : keys.filter((k) => !k.endsWith('_source_video') && !k.endsWith('_export_wav'));
      if (filtered.length === 0) {
        resolve(0);
        return;
      }
      let pending = filtered.length;
      for (const k of filtered) {
        const g = store.get(k);
        g.onsuccess = () => {
          const val = g.result as Blob | undefined;
          if (val?.size) total += val.size;
          pending -= 1;
          if (pending === 0) resolve(total);
        };
        g.onerror = () => {
          pending -= 1;
          if (pending === 0) resolve(total);
        };
      }
    };
    req.onerror = () => resolve(0);
  });
}

export async function cleanTempProjectAudio(projectId?: string): Promise<void> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as string[]) || [];
      for (const k of keys) {
        const matchesProject = projectId ? k.startsWith(`proj_${projectId}_`) : true;
        if (matchesProject && !k.endsWith('_source_video') && !k.endsWith('_export_wav')) {
          store.delete(k);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getDefaultPreferences(): StudioPreferences {
  return {
    defaultChunkDurationSec: 180,
    defaultEngineMode: EngineMode.GEMINI_CLOUD,
    defaultDialogueStyle: DialogueStyle.CONVERSATIONAL,
    defaultSpeechSpeed: 1.0,
    defaultPreserveBgm: true,
    defaultExportQuality: ExportQuality.ORIGINAL,
    autoCleanupAfterExport: false,
    activeGgufModelFileName: '',
    dubbingSpeedMode: DubbingSpeedMode.FULL_GGUF,
    mediaAccelMode: MediaAccelMode.HARDWARE_PRIORITY,
    mediaAsyncCodecQueueing: true,
    mediaHighOperatingRate: true,
    mediaAllowCodecFallback: true,
    mediaTransformerTimeoutSec: 30,
    sttEngineMode: SttEngineMode.WHISPER_BASE_EN,
    sttVocalIsolationEnabled: true,
  };
}

export function loadPreferences(): StudioPreferences {
  return { ...getDefaultPreferences(), ...readJson<Partial<StudioPreferences>>(PREFS_KEY, {}) };
}

export function savePreferences(prefs: StudioPreferences): StudioPreferences {
  writeJson(PREFS_KEY, prefs);
  return prefs;
}

function normalizeProjectSubtitles(p: MovieProject): MovieProject {
  if (
    p.englishSubtitleRawText !== undefined ||
    p.hindiSubtitleRawText !== undefined
  ) {
    return p;
  }
  if (p.subtitleRawText) {
    if (p.subtitleLanguage === SubtitleLanguage.HINDI) {
      return {
        ...p,
        hindiSubtitleFileName: p.subtitleFileName,
        hindiSubtitleRawText: p.subtitleRawText,
        englishSubtitleFileName: null,
        englishSubtitleRawText: null,
      };
    }
    return {
      ...p,
      englishSubtitleFileName: p.subtitleFileName,
      englishSubtitleRawText: p.subtitleRawText,
      hindiSubtitleFileName: null,
      hindiSubtitleRawText: null,
    };
  }
  return p;
}

export function loadProjects(): MovieProject[] {
  return readJson<MovieProject[]>(PROJECTS_KEY, [])
    .map(normalizeProjectSubtitles)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProjectById(id: string): MovieProject | null {
  return loadProjects().find((p) => p.id === id) || null;
}

export function upsertProject(project: MovieProject): MovieProject {
  const list = loadProjects();
  const updated = { ...project, updatedAt: Date.now() };
  const idx = list.findIndex((p) => p.id === updated.id);
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.unshift(updated);
  }
  writeJson(PROJECTS_KEY, list);
  return updated;
}

export async function deleteProject(projectId: string): Promise<void> {
  writeJson(
    PROJECTS_KEY,
    loadProjects().filter((p) => p.id !== projectId)
  );
  writeJson(
    CHUNKS_KEY,
    readJson<AudioChunk[]>(CHUNKS_KEY, []).filter((c) => c.projectId !== projectId)
  );
  writeJson(
    SPEAKERS_KEY,
    readJson<SpeakerProfile[]>(SPEAKERS_KEY, []).filter((s) => s.projectId !== projectId)
  );
  writeJson(
    SEGMENTS_KEY,
    readJson<DialogueSegment[]>(SEGMENTS_KEY, []).filter((g) => g.projectId !== projectId)
  );
  await deleteProjectBlobs(projectId);
}

export function loadChunksForProject(projectId: string): AudioChunk[] {
  return readJson<AudioChunk[]>(CHUNKS_KEY, [])
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
}

export function saveChunksForProject(projectId: string, chunks: AudioChunk[]): void {
  const others = readJson<AudioChunk[]>(CHUNKS_KEY, []).filter((c) => c.projectId !== projectId);
  writeJson(CHUNKS_KEY, [...others, ...chunks]);
}

export function loadSpeakersForProject(projectId: string): SpeakerProfile[] {
  return readJson<SpeakerProfile[]>(SPEAKERS_KEY, []).filter((s) => s.projectId === projectId);
}

export function saveSpeakersForProject(projectId: string, speakers: SpeakerProfile[]): void {
  const others = readJson<SpeakerProfile[]>(SPEAKERS_KEY, []).filter((s) => s.projectId !== projectId);
  writeJson(SPEAKERS_KEY, [...others, ...speakers]);
}

export function loadSegmentsForProject(projectId: string): DialogueSegment[] {
  return readJson<DialogueSegment[]>(SEGMENTS_KEY, [])
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.startMs - b.startMs);
}

export function saveSegmentsForProject(projectId: string, segments: DialogueSegment[]): void {
  const others = readJson<DialogueSegment[]>(SEGMENTS_KEY, []).filter((s) => s.projectId !== projectId);
  writeJson(SEGMENTS_KEY, [...others, ...segments]);
}

export function createDemoSceneProject(): MovieProject {
  const prefs = loadPreferences();
  const id = `demo_${Date.now()}`;
  const now = Date.now();

  const demoSrt = `1
00:00:01,000 --> 00:00:04,200
The midnight train won't wait for anyone, Vikram.

2
00:00:05,800 --> 00:00:08,900
Then we run faster. Keep your eyes on the bridge.

3
00:00:10,800 --> 00:00:14,100
What the hell are you doing, man? They locked the gate!

4
00:00:15,400 --> 00:00:18,400
Don't worry, we will get out of here before sunset.`;

  const project: MovieProject = {
    id,
    title: 'Midnight Express (Demo Scene)',
    fileName: 'midnight_express_demo.mp4',
    durationMs: 20000,
    width: 1920,
    height: 1080,
    fileSizeBytes: 14_820_000,
    videoMime: 'video/mp4',
    audioMime: 'audio/aac',
    audioChannels: 2,
    audioSampleRate: 44100,
    thumbnailDataUrl: '/assets/img_studio_hero.jpg',
    chunkDurationSec: prefs.defaultChunkDurationSec,
    engineMode: prefs.defaultEngineMode,
    dialogueStyle: prefs.defaultDialogueStyle,
    defaultVoiceGender: 'MALE',
    defaultVoicePreset: 'Charon',
    defaultSpeechSpeed: 1.0,
    defaultEmotionBias: 'dramatic',
    preserveBgm: true,
    removeEnglishDialogue: true,
    separationMode: SeparationMode.STEREO_MID_SIDE,
    hindiVolume: 1.0,
    bgmVolume: 0.85,
    originalVolume: 0.0,
    status: ProjectStatus.READY_FOR_REVIEW,
    currentStage: ProcessingStage.READY,
    progressPercent: 100,
    estimatedRemainingMs: null,
    lastError: null,
    exportQuality: ExportQuality.HD_1080P,
    exportFileName: null,
    exportSizeBytes: 0,
    tempFilesCleaned: false,
    subtitleFileName: 'midnight_express_en.srt',
    subtitleRawText: demoSrt,
    subtitleLanguage: SubtitleLanguage.ENGLISH,
    englishSubtitleFileName: 'midnight_express_en.srt',
    englishSubtitleRawText: demoSrt,
    hindiSubtitleFileName: null,
    hindiSubtitleRawText: null,
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  };

  upsertProject(project);

  const speakers: SpeakerProfile[] = [
    {
      id: `${id}_sp1`,
      projectId: id,
      speakerLabel: 'SPEAKER_1',
      displayName: 'Vikram (Hero)',
      gender: 'MALE',
      voicePresetName: 'Charon',
      speedMultiplier: 1.0,
      defaultEmotion: 'serious',
      traits: 'Grounded, urgent action hero baritone',
    },
    {
      id: `${id}_sp2`,
      projectId: id,
      speakerLabel: 'SPEAKER_2',
      displayName: 'Meera (Co-Lead)',
      gender: 'FEMALE',
      voicePresetName: 'Kore',
      speedMultiplier: 1.0,
      defaultEmotion: 'excited',
      traits: 'Crisp, urgent conversational tone',
    },
  ];
  saveSpeakersForProject(id, speakers);

  const chunks: AudioChunk[] = [
    {
      id: `${id}_chunk_0`,
      projectId: id,
      chunkIndex: 0,
      startMs: 0,
      endMs: 20000,
      status: 'MIXED',
      processingTimeMs: 2400,
      errorMessage: null,
    },
  ];
  saveChunksForProject(id, chunks);

  const segments: DialogueSegment[] = [
    {
      id: `${id}_seg_1`,
      projectId: id,
      chunkIndex: 0,
      orderIndex: 0,
      startMs: 1000,
      endMs: 4200,
      speakerLabel: 'SPEAKER_2',
      englishText: "The midnight train won't wait for anyone, Vikram.",
      hindiText: 'आधी रात की ट्रेन किसी का इंतज़ार नहीं करेगी, विक्रम।',
      emotion: 'serious',
      isOverlapping: false,
      audioType: 'SPEECH',
      speechSpeed: 1.0,
      ttsAudioKey: null,
      ttsDurationMs: 0,
      status: SegmentStatus.TRANSLATED,
      errorMessage: null,
      translationSource: TranslationSource.GEMINI,
    },
    {
      id: `${id}_seg_2`,
      projectId: id,
      chunkIndex: 0,
      orderIndex: 1,
      startMs: 5800,
      endMs: 8900,
      speakerLabel: 'SPEAKER_1',
      englishText: 'Then we run faster. Keep your eyes on the bridge.',
      hindiText: 'तो फिर और तेज़ भागेंगे। पुल पर नज़र बनाए रखो।',
      emotion: 'excited',
      isOverlapping: false,
      audioType: 'SPEECH',
      speechSpeed: 1.0,
      ttsAudioKey: null,
      ttsDurationMs: 0,
      status: SegmentStatus.TRANSLATED,
      errorMessage: null,
      translationSource: TranslationSource.GEMINI,
    },
    {
      id: `${id}_seg_3`,
      projectId: id,
      chunkIndex: 0,
      orderIndex: 2,
      startMs: 10800,
      endMs: 14100,
      speakerLabel: 'SPEAKER_2',
      englishText: 'What the hell are you doing, man? They locked the gate!',
      hindiText: 'ये क्या बकवास कर रहे हो यार? उन्होंने गेट बंद कर दिया है!',
      emotion: 'angry',
      isOverlapping: false,
      audioType: 'SPEECH',
      speechSpeed: 1.05,
      ttsAudioKey: null,
      ttsDurationMs: 0,
      status: SegmentStatus.TRANSLATED,
      errorMessage: null,
      translationSource: TranslationSource.DICTIONARY,
    },
    {
      id: `${id}_seg_4`,
      projectId: id,
      chunkIndex: 0,
      orderIndex: 3,
      startMs: 15400,
      endMs: 18400,
      speakerLabel: 'SPEAKER_1',
      englishText: "Don't worry, we will get out of here before sunset.",
      hindiText: 'फिक्र मत करो, सूरज ढलने से पहले हम यहाँ से निकल जाएंगे।',
      emotion: 'serious',
      isOverlapping: false,
      audioType: 'SPEECH',
      speechSpeed: 1.0,
      ttsAudioKey: null,
      ttsDurationMs: 0,
      status: SegmentStatus.TRANSLATED,
      errorMessage: null,
      translationSource: TranslationSource.GEMINI,
    },
  ];
  saveSegmentsForProject(id, segments);

  return project;
}
