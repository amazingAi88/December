import { DialogueSegment, SeparationMode, SeparationModeType } from '../types/studio';
import { encodeAudioBufferToWav, getSharedAudioContext, wsolaTimeStretch } from './audioEngine';

export interface VideoMetadataResult {
  durationMs: number;
  width: number;
  height: number;
  thumbnailDataUrl: string | null;
}

export async function inspectVideoFile(file: File): Promise<VideoMetadataResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve({ durationMs: 30000, width: 1280, height: 720, thumbnailDataUrl: null });
    }, 8000);

    video.onloadedmetadata = () => {
      const durMs = Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration * 1000) : 30000;
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const seekSec = Math.min(2.5, Math.max(0.2, (durMs / 1000) * 0.15));
      video.currentTime = seekSec;

      video.onseeked = () => {
        window.clearTimeout(timeout);
        let thumb: string | null = null;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = Math.max(180, Math.round((320 * h) / Math.max(1, w)));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumb = canvas.toDataURL('image/jpeg', 0.78);
          }
        } catch {
          thumb = null;
        }
        cleanup();
        resolve({ durationMs: durMs, width: w, height: h, thumbnailDataUrl: thumb });
      };
    };

    video.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      resolve({ durationMs: 30000, width: 1280, height: 720, thumbnailDataUrl: null });
    };

    video.src = url;
  });
}

export async function decodeMediaAudio(blob: Blob): Promise<AudioBuffer | null> {
  try {
    const ctx = getSharedAudioContext();
    const ab = await blob.arrayBuffer();
    return await ctx.decodeAudioData(ab.slice(0));
  } catch {
    return null;
  }
}

/**
 * Generates an ambient cinema score AudioBuffer for Demo scenes or silent source tracks
 * so A/B BGM separation, ducking, and Master Export always produce real audible sound.
 */
export function synthesizeDemoSoundtrackBuffer(durationSec: number): AudioBuffer {
  const ctx = getSharedAudioContext();
  const sampleRate = 44100;
  const totalSamples = Math.max(sampleRate, Math.floor(durationSec * sampleRate));
  const buf = ctx.createBuffer(2, totalSamples, sampleRate);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);

  const chordRoots = [110, 130.81, 98, 123.47]; // A2, C3, G2, B2
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.floor(t / 4.5) % chordRoots.length;
    const root = chordRoots[chordIdx];

    const padL =
      0.16 * Math.sin(2 * Math.PI * root * t) +
      0.09 * Math.sin(2 * Math.PI * (root * 1.5) * t + 0.4) +
      0.05 * Math.sin(2 * Math.PI * (root * 2) * t);
    const padR =
      0.16 * Math.sin(2 * Math.PI * root * t + 0.35) +
      0.09 * Math.sin(2 * Math.PI * (root * 1.25) * t) +
      0.05 * Math.sin(2 * Math.PI * (root * 2.005) * t);

    // Subtle heartbeat pulse every 0.75s
    const beatPhase = t % 0.75;
    const pulse = Math.exp(-beatPhase * 12) * 0.14 * Math.sin(2 * Math.PI * 58 * t);

    // Center-panned simulated original English speech energy around dialogue windows
    const inSpeech =
      (t >= 1.0 && t <= 4.2) ||
      (t >= 5.8 && t <= 8.9) ||
      (t >= 10.8 && t <= 14.1) ||
      (t >= 15.4 && t <= 18.4);
    const fakeEnglishVoice = inSpeech
      ? 0.11 * Math.sin(2 * Math.PI * 185 * t + Math.sin(t * 9) * 1.6) * (0.6 + 0.4 * Math.sin(t * 14))
      : 0;

    left[i] = Math.max(-0.95, Math.min(0.95, padL + pulse + fakeEnglishVoice));
    right[i] = Math.max(-0.95, Math.min(0.95, padR + pulse + fakeEnglishVoice));
  }

  return buf;
}

/**
 * Downsamples a slice of an AudioBuffer to 16kHz Mono 16-bit WAV Base64 for Gemini STT.
 */
export function sliceAudioBufferToMonoWavBase64(
  source: AudioBuffer,
  startSec: number,
  endSec: number
): string {
  const targetRate = 16000;
  const startSample = Math.max(0, Math.floor(startSec * source.sampleRate));
  const endSample = Math.min(source.length, Math.ceil(endSec * source.sampleRate));
  const srcLen = Math.max(1, endSample - startSample);
  const outLen = Math.max(1, Math.floor((srcLen * targetRate) / source.sampleRate));

  const ch0 = source.getChannelData(0);
  const ch1 = source.numberOfChannels > 1 ? source.getChannelData(1) : ch0;

  const byteLength = 44 + outLen * 2;
  const ab = new ArrayBuffer(byteLength);
  const view = new DataView(ab);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + outLen * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, outLen * 2, true);

  const ratio = srcLen / outLen;
  let offset = 44;
  for (let i = 0; i < outLen; i++) {
    const idx = Math.min(source.length - 1, startSample + Math.floor(i * ratio));
    const mono = (ch0[idx] + ch1[idx]) * 0.5;
    const clamped = Math.max(-1, Math.min(1, mono));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(ab);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Applies Stereo Mid-Side vocal cancellation + speech-band ducking to isolate BGM & SFX.
 */
export function createSeparatedBgmBuffer(
  source: AudioBuffer,
  speechWindowsSec: Array<{ startSec: number; endSec: number }>,
  separationMode: SeparationModeType,
  removeEnglishDialogue: boolean
): AudioBuffer {
  const ctx = getSharedAudioContext();
  const channels = source.numberOfChannels;
  const sr = source.sampleRate;
  const len = source.length;
  const out = ctx.createBuffer(2, len, sr);

  const srcL = source.getChannelData(0);
  const srcR = channels > 1 ? source.getChannelData(1) : srcL;
  const dstL = out.getChannelData(0);
  const dstR = out.getChannelData(1);

  const isStereo = channels >= 2;
  const useMidSide = removeEnglishDialogue && isStereo && separationMode === SeparationMode.STEREO_MID_SIDE;
  const useBandDuck = removeEnglishDialogue && (!isStereo || separationMode === SeparationMode.MONO_BAND_DUCKING);

  // Build quick speech mask per 10ms block
  const blockSamples = Math.max(1, Math.floor(sr * 0.01));
  const blockCount = Math.ceil(len / blockSamples);
  const speechMask = new Float32Array(blockCount);
  for (const w of speechWindowsSec) {
    const bStart = Math.max(0, Math.floor((w.startSec * sr) / blockSamples));
    const bEnd = Math.min(blockCount - 1, Math.ceil((w.endSec * sr) / blockSamples));
    for (let b = bStart; b <= bEnd; b++) {
      speechMask[b] = 1;
    }
  }

  for (let i = 0; i < len; i++) {
    const bIdx = Math.min(blockCount - 1, Math.floor(i / blockSamples));
    const inSpeech = speechMask[bIdx] > 0.5;
    const l = srcL[i];
    const r = srcR[i];

    if (!removeEnglishDialogue || separationMode === SeparationMode.ORIGINAL_UNSEPARATED) {
      dstL[i] = l;
      dstR[i] = r;
    } else if (useMidSide) {
      const side = (l - r) * 0.65;
      const mid = (l + r) * 0.5;
      const midRetention = inSpeech ? 0.14 : 0.72;
      dstL[i] = Math.max(-1, Math.min(1, mid * midRetention + side));
      dstR[i] = Math.max(-1, Math.min(1, mid * midRetention - side));
    } else if (useBandDuck) {
      const duck = inSpeech ? 0.25 : 0.9;
      dstL[i] = l * duck;
      dstR[i] = r * duck;
    }
  }

  return out;
}

/**
 * Renders full Master Mix WAV (Separated BGM + Original bleed + WSOLA time-fitted Hindi TTS voices).
 */
export async function renderMasterDubMixWav(params: {
  durationMs: number;
  sourceBuffer: AudioBuffer | null;
  segments: DialogueSegment[];
  ttsBuffersBySegId: Map<string, AudioBuffer>;
  preserveBgm: boolean;
  removeEnglishDialogue: boolean;
  separationMode: SeparationModeType;
  hindiVolume: number;
  bgmVolume: number;
  originalVolume: number;
  onProgress?: (pct: number) => void;
}): Promise<{ wavBlob: Blob; mixedBuffer: AudioBuffer }> {
  const {
    durationMs,
    sourceBuffer,
    segments,
    ttsBuffersBySegId,
    preserveBgm,
    removeEnglishDialogue,
    separationMode,
    hindiVolume,
    bgmVolume,
    originalVolume,
    onProgress,
  } = params;

  const sampleRate = 44100;
  const durationSec = Math.max(2, durationMs / 1000);
  const totalSamples = Math.ceil(durationSec * sampleRate);
  const offline = new OfflineAudioContext(2, totalSamples, sampleRate);
  onProgress?.(15);

  const speechSegments = segments.filter((s) => s.audioType === 'SPEECH');
  const speechWindows = speechSegments.map((s) => ({
    startSec: s.startMs / 1000,
    endSec: s.endMs / 1000,
  }));

  if (sourceBuffer && preserveBgm) {
    const bgmBuf = createSeparatedBgmBuffer(
      sourceBuffer,
      speechWindows,
      separationMode,
      removeEnglishDialogue
    );
    const bgmNode = offline.createBufferSource();
    bgmNode.buffer = bgmBuf;

    const bgmGain = offline.createGain();
    bgmGain.gain.setValueAtTime(bgmVolume, 0);

    // Smooth ducking during Hindi dialogue delivery
    for (const w of speechWindows) {
      const duckIn = Math.max(0, w.startSec - 0.14);
      const duckOut = Math.min(durationSec, w.endSec + 0.16);
      bgmGain.gain.setValueAtTime(bgmVolume, duckIn);
      bgmGain.gain.linearRampToValueAtTime(bgmVolume * 0.42, w.startSec);
      bgmGain.gain.setValueAtTime(bgmVolume * 0.42, w.endSec);
      bgmGain.gain.linearRampToValueAtTime(bgmVolume, duckOut);
    }

    bgmNode.connect(bgmGain);
    bgmGain.connect(offline.destination);
    bgmNode.start(0);
  }

  if (sourceBuffer && originalVolume > 0.01) {
    const origNode = offline.createBufferSource();
    origNode.buffer = sourceBuffer;
    const origGain = offline.createGain();
    origGain.gain.value = originalVolume;
    origNode.connect(origGain);
    origGain.connect(offline.destination);
    origNode.start(0);
  }

  onProgress?.(40);

  for (let i = 0; i < speechSegments.length; i++) {
    const seg = speechSegments[i];
    const ttsBuf = ttsBuffersBySegId.get(seg.id);
    if (!ttsBuf) continue;

    const startSec = Math.max(0, seg.startMs / 1000);
    const slotDurSec = Math.max(0.25, (seg.endMs - seg.startMs) / 1000);
    const desiredRatio = Math.min(1.65, Math.max(0.75, (ttsBuf.duration / slotDurSec) * (seg.speechSpeed || 1)));

    let finalTtsBuf = ttsBuf;
    if (Math.abs(desiredRatio - 1.0) > 0.06) {
      const stretched = offline.createBuffer(
        ttsBuf.numberOfChannels,
        Math.max(1024, Math.round(ttsBuf.length / desiredRatio)),
        ttsBuf.sampleRate
      );
      for (let ch = 0; ch < ttsBuf.numberOfChannels; ch++) {
        const res = wsolaTimeStretch(ttsBuf.getChannelData(ch), ttsBuf.sampleRate, desiredRatio);
        const copyLen = Math.min(res.length, stretched.length);
        stretched.copyToChannel(new Float32Array(res.subarray(0, copyLen)), ch);
      }
      finalTtsBuf = stretched;
    }

    const srcNode = offline.createBufferSource();
    srcNode.buffer = finalTtsBuf;

    const gainNode = offline.createGain();
    gainNode.gain.setValueAtTime(0, startSec);
    gainNode.gain.linearRampToValueAtTime(hindiVolume, startSec + 0.015);
    const endAt = Math.min(durationSec, startSec + finalTtsBuf.duration);
    gainNode.gain.setValueAtTime(hindiVolume, Math.max(startSec + 0.015, endAt - 0.02));
    gainNode.gain.linearRampToValueAtTime(0, endAt);

    srcNode.connect(gainNode);
    gainNode.connect(offline.destination);
    srcNode.start(startSec);

    onProgress?.(40 + Math.round(((i + 1) / Math.max(1, speechSegments.length)) * 35));
  }

  onProgress?.(80);
  const renderedBuffer = await offline.startRendering();
  onProgress?.(94);
  const wavBlob = encodeAudioBufferToWav(renderedBuffer);
  onProgress?.(100);
  return { wavBlob, mixedBuffer: renderedBuffer };
}

export function base64ToBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
