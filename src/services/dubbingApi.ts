import { Capacitor } from '@capacitor/core';

const BACKEND_URL_STORAGE_KEY = 'dubsync_backend_url_v1';
export const DEFAULT_APK_BACKEND_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://ais-pre-6vqae5ovghv7f4myqigwba-566481764938.asia-southeast1.run.app';

export function isNativeAndroidApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getConfiguredBackendUrl(): string {
  try {
    const saved = localStorage.getItem(BACKEND_URL_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
  } catch {
    // ignore storage errors
  }
  return isNativeAndroidApp() ? DEFAULT_APK_BACKEND_URL.replace(/\/+$/, '') : '';
}

export function saveConfiguredBackendUrl(url: string): string {
  const cleaned = url.trim().replace(/\/+$/, '');
  try {
    if (cleaned) {
      localStorage.setItem(BACKEND_URL_STORAGE_KEY, cleaned);
    } else {
      localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
  return getConfiguredBackendUrl();
}

function resolveApiUrl(path: string): string {
  const base = getConfiguredBackendUrl();
  return base ? `${base}${path}` : path;
}

export interface TranscribedSpeakerDto {
  speakerId: string;
  inferredGender: string;
  traits: string;
}

export interface TranscribedSegmentDto {
  startOffsetMs: number;
  endOffsetMs: number;
  speakerId: string;
  englishText: string;
  emotion: string;
  isOverlapping: boolean;
  audioType: string;
}

export interface TranscribeChunkResponse {
  speakers: TranscribedSpeakerDto[];
  segments: TranscribedSegmentDto[];
}

export interface TranslateBatchResponse {
  translations: Array<{
    segmentId: number;
    hindiText: string;
    emotion: string;
  }>;
}

export interface TtsGenerateResponse {
  audioBase64: string;
  mimeType: string;
  voicePreset: string;
}

export interface TestSampleResponse {
  hindiText: string;
  emotion: string;
  latencyMs: number;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(resolveApiUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function checkServerHealth(): Promise<{ ok: boolean; hasGeminiKey: boolean }> {
  try {
    const res = await fetch(resolveApiUrl('/api/health'));
    if (!res.ok) return { ok: false, hasGeminiKey: false };
    return (await res.json()) as { ok: boolean; hasGeminiKey: boolean };
  } catch {
    return { ok: false, hasGeminiKey: false };
  }
}

export async function apiTranscribeChunk(
  params: {
    audioBase64: string;
    mimeType: string;
    chunkDurationMs: number;
    knownSpeakers: Array<{ speakerLabel: string; gender: string; traits: string }>;
  },
  signal?: AbortSignal
): Promise<TranscribeChunkResponse> {
  return postJson<TranscribeChunkResponse>('/api/dub/transcribe', params, signal);
}

export async function apiTranslateBatch(
  params: {
    segments: Array<{
      segmentId: number;
      speaker: string;
      gender: string;
      emotion: string;
      targetDurationMs: number;
      englishText: string;
    }>;
    dialogueStyle: string;
    glossarySection: string;
    rollingHistory: string[];
  },
  signal?: AbortSignal
): Promise<TranslateBatchResponse> {
  return postJson<TranslateBatchResponse>('/api/dub/translate', params, signal);
}

export async function apiGenerateHindiTts(
  params: {
    hindiText: string;
    voicePreset: string;
    emotion: string;
  },
  signal?: AbortSignal
): Promise<TtsGenerateResponse> {
  return postJson<TtsGenerateResponse>('/api/dub/tts', params, signal);
}

export async function apiTestGeminiSample(params: {
  englishLine: string;
  dialogueStyle: string;
  glossarySection: string;
}): Promise<TestSampleResponse> {
  return postJson<TestSampleResponse>('/api/dub/test-sample', params);
}
