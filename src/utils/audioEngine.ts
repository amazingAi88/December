import {
  BgmConfig,
  ContinuousAlignStrategy,
  DubSegment,
  FitStatus,
  SilenceDetectionConfig,
  SrtCue,
} from '../types/dubbing';

let sharedAudioCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = getSharedAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer.slice(0));
}

/**
 * Extracts normalized waveform peak amplitudes [0..1] for rendering timeline clips.
 */
export function extractPeaks(buffer: AudioBuffer, bucketCount = 320): number[] {
  const channel = buffer.getChannelData(0);
  const total = channel.length;
  if (total === 0 || bucketCount <= 0) return [];
  const step = Math.max(1, Math.floor(total / bucketCount));
  const peaks: number[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const start = i * step;
    const end = Math.min(total, start + step);
    let maxVal = 0;
    for (let j = start; j < end; j += Math.max(1, Math.floor((end - start) / 16))) {
      const abs = Math.abs(channel[j]);
      if (abs > maxVal) maxVal = abs;
    }
    peaks.push(Math.min(1, maxVal));
  }
  return peaks;
}

export interface DetectedSpeechRegion {
  startSec: number;
  endSec: number;
  durationSec: number;
}

const FRAME_MS = 20;

function computeRmsDbEnvelope(buffer: AudioBuffer): number[] {
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const windowSize = Math.max(1, Math.floor((sampleRate * FRAME_MS) / 1000));
  const frameCount = Math.floor(data.length / windowSize);
  const rmsDb: number[] = new Array(frameCount);

  for (let f = 0; f < frameCount; f++) {
    const offset = f * windowSize;
    let sumSq = 0;
    for (let i = 0; i < windowSize; i++) {
      const v = data[offset + i];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / windowSize);
    rmsDb[f] = rms > 1e-6 ? 20 * Math.log10(rms) : -90;
  }
  return rmsDb;
}

function extractRegionsFromEnvelope(
  rmsDb: number[],
  totalDurationSec: number,
  thresholdDb: number,
  minSilenceMs: number,
  minSpeechMs: number
): DetectedSpeechRegion[] {
  const frameCount = rmsDb.length;
  const minSilenceFrames = Math.max(1, Math.round(minSilenceMs / FRAME_MS));
  const minSpeechFrames = Math.max(1, Math.round(minSpeechMs / FRAME_MS));
  const frameSec = FRAME_MS / 1000;

  const isActive: boolean[] = new Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    isActive[f] = rmsDb[f] >= thresholdDb;
  }

  // Bridge brief intra-sentence pauses shorter than minSilenceMs
  let silentRun = 0;
  let lastSpeechIdx = -1;
  for (let f = 0; f < frameCount; f++) {
    if (isActive[f]) {
      if (lastSpeechIdx !== -1 && silentRun > 0 && silentRun < minSilenceFrames) {
        for (let k = lastSpeechIdx + 1; k < f; k++) {
          isActive[k] = true;
        }
      }
      silentRun = 0;
      lastSpeechIdx = f;
    } else {
      silentRun++;
    }
  }

  const regions: DetectedSpeechRegion[] = [];
  let speechStartFrame: number | null = null;

  for (let f = 0; f < frameCount; f++) {
    if (isActive[f] && speechStartFrame === null) {
      speechStartFrame = f;
    } else if (!isActive[f] && speechStartFrame !== null) {
      if (f - speechStartFrame >= minSpeechFrames) {
        const startSec = Math.max(0, speechStartFrame * frameSec - 0.02);
        const endSec = Math.min(totalDurationSec, f * frameSec + 0.03);
        regions.push({ startSec, endSec, durationSec: endSec - startSec });
      }
      speechStartFrame = null;
    }
  }

  if (speechStartFrame !== null && frameCount - speechStartFrame >= minSpeechFrames) {
    const startSec = Math.max(0, speechStartFrame * frameSec - 0.02);
    const endSec = totalDurationSec;
    regions.push({ startSec, endSec, durationSec: endSec - startSec });
  }

  return regions;
}

/**
 * Detects non-silent speech regions inside an AudioBuffer using RMS energy gating.
 */
export function detectSpeechSegments(
  buffer: AudioBuffer,
  config: SilenceDetectionConfig
): DetectedSpeechRegion[] {
  const rmsDb = computeRmsDbEnvelope(buffer);
  return extractRegionsFromEnvelope(
    rmsDb,
    buffer.duration,
    config.thresholdDb,
    config.minSilenceMs,
    config.minSpeechMs
  );
}

/**
 * Fully automatic concatenated speech splitter:
 * 1. Measures audio noise floor & speech peak to auto-calibrate silence threshold.
 * 2. Searches optimal silence gap to match exact SRT cue count.
 * 3. Automatically merges tiny mid-sentence pauses or splits merged phrases at lowest RMS valleys
 *    so every single SRT cue gets its exact speech clip with zero manual tweaking.
 */
export function autoDetectSpeechForCues(
  buffer: AudioBuffer,
  cues: SrtCue[],
  minSpeechMs = 160
): {
  regions: DetectedSpeechRegion[];
  calibratedThresholdDb: number;
  calibratedMinSilenceMs: number;
} {
  const targetCount = cues.length;
  const rmsDb = computeRmsDbEnvelope(buffer);
  if (rmsDb.length === 0 || targetCount === 0) {
    return { regions: [], calibratedThresholdDb: -34, calibratedMinSilenceMs: 260 };
  }

  // Estimate noise floor (15th percentile) & speech level (90th percentile)
  const sorted = [...rmsDb].sort((a, b) => a - b);
  const noiseFloorDb = sorted[Math.floor(sorted.length * 0.15)] ?? -60;
  const speechLevelDb = sorted[Math.floor(sorted.length * 0.9)] ?? -14;
  const baseThresh = Math.max(-52, Math.min(speechLevelDb - 8, Math.max(noiseFloorDb + 9, -46)));

  const threshCandidates = [-5, -2, 0, 3, 6].map((d) =>
    Math.max(-54, Math.min(-15, Math.round(baseThresh + d)))
  );
  const gapCandidates = [100, 160, 220, 280, 360, 460, 620];

  let bestRegions: DetectedSpeechRegion[] = [];
  let bestThresh = Math.round(baseThresh);
  let bestGap = 240;
  let bestScore = Infinity;

  for (const th of threshCandidates) {
    for (const gap of gapCandidates) {
      const cand = extractRegionsFromEnvelope(rmsDb, buffer.duration, th, gap, minSpeechMs);
      if (cand.length === 0) continue;
      const diff = Math.abs(cand.length - targetCount);
      // Slight preference for moderate gaps (~240ms) when region count ties
      const score = diff * 1000 + Math.abs(gap - 240) * 0.1;
      if (score < bestScore) {
        bestScore = score;
        bestRegions = cand;
        bestThresh = th;
        bestGap = gap;
        if (diff === 0 && gap >= 160 && gap <= 360) break;
      }
    }
  }

  // Fallback if audio is entirely quiet/continuous
  if (bestRegions.length === 0) {
    const sliceDur = buffer.duration / targetCount;
    const fallback = cues.map((_, i) => ({
      startSec: i * sliceDur,
      endSec: (i + 1) * sliceDur,
      durationSec: sliceDur,
    }));
    return { regions: fallback, calibratedThresholdDb: bestThresh, calibratedMinSilenceMs: bestGap };
  }

  let regions = [...bestRegions];

  // If extra regions detected (e.g., breath pause inside a sentence), merge smallest gap pairs
  while (regions.length > targetCount && regions.length > 1) {
    let mergeIdx = 0;
    let smallestGap = Infinity;
    for (let i = 0; i < regions.length - 1; i++) {
      const gap = regions[i + 1].startSec - regions[i].endSec;
      if (gap < smallestGap) {
        smallestGap = gap;
        mergeIdx = i;
      }
    }
    const merged: DetectedSpeechRegion = {
      startSec: regions[mergeIdx].startSec,
      endSec: regions[mergeIdx + 1].endSec,
      durationSec: regions[mergeIdx + 1].endSec - regions[mergeIdx].startSec,
    };
    regions.splice(mergeIdx, 2, merged);
  }

  // If fewer regions detected than cues (two lines had almost no pause), split longest region at deepest RMS dip
  const frameSec = FRAME_MS / 1000;
  while (regions.length < targetCount) {
    let splitIdx = 0;
    let maxDur = -1;
    for (let i = 0; i < regions.length; i++) {
      if (regions[i].durationSec > maxDur) {
        maxDur = regions[i].durationSec;
        splitIdx = i;
      }
    }
    const target = regions[splitIdx];
    if (target.durationSec < 0.25) break;

    const startFrame = Math.floor((target.startSec + target.durationSec * 0.25) / frameSec);
    const endFrame = Math.min(
      rmsDb.length - 1,
      Math.ceil((target.startSec + target.durationSec * 0.75) / frameSec)
    );

    let dipFrame = Math.floor((startFrame + endFrame) / 2);
    let minDb = Infinity;
    for (let f = Math.max(0, startFrame); f <= endFrame; f++) {
      if (rmsDb[f] < minDb) {
        minDb = rmsDb[f];
        dipFrame = f;
      }
    }

    const splitSec = Math.max(
      target.startSec + 0.08,
      Math.min(target.endSec - 0.08, dipFrame * frameSec)
    );
    const leftPart: DetectedSpeechRegion = {
      startSec: target.startSec,
      endSec: splitSec,
      durationSec: splitSec - target.startSec,
    };
    const rightPart: DetectedSpeechRegion = {
      startSec: splitSec,
      endSec: target.endSec,
      durationSec: target.endSec - splitSec,
    };
    regions.splice(splitIdx, 1, leftPart, rightPart);
  }

  return {
    regions,
    calibratedThresholdDb: bestThresh,
    calibratedMinSilenceMs: bestGap,
  };
}

export function getFitStatus(segment: DubSegment): FitStatus {
  if (!segment.hasAudio) return 'unassigned';
  if (segment.atempo >= 0.85 && segment.atempo <= 1.25) return 'optimal';
  if (segment.atempo > 1.45 || segment.atempo < 0.7) return 'high-speed';
  return 'mild-stretch';
}

/**
 * Aligns a Continuous Time Dub AudioBuffer to SRT cues using either direct SRT window slicing
 * or silence-split phrase matching.
 */
export function mapContinuousAudioToCues(
  cues: SrtCue[],
  masterBuffer: AudioBuffer | null,
  strategy: ContinuousAlignStrategy,
  silenceConfig: SilenceDetectionConfig,
  fileName: string | null
): DubSegment[] {
  if (!masterBuffer) {
    return cues.map((cue) => ({
      ...cue,
      sourceStartSec: cue.startSec,
      sourceEndSec: cue.endSec,
      atempo: 1.0,
      gain: 1.0,
      muted: false,
      hasAudio: false,
      clipFileName: undefined,
    }));
  }

  if (strategy === 'silence-split') {
    const speechRegions = silenceConfig.autoCalibrate
      ? autoDetectSpeechForCues(masterBuffer, cues, silenceConfig.minSpeechMs).regions
      : detectSpeechSegments(masterBuffer, silenceConfig);

    return cues.map((cue, idx) => {
      const targetDur = Math.max(0.15, cue.endSec - cue.startSec);
      const region = speechRegions[idx];
      if (!region) {
        return {
          ...cue,
          sourceStartSec: 0,
          sourceEndSec: 0,
          atempo: 1.0,
          gain: 1.0,
          muted: false,
          hasAudio: false,
          clipFileName: fileName || undefined,
        };
      }
      const rawAtempo = region.durationSec / targetDur;
      const clampedAtempo = Math.min(2.5, Math.max(0.5, Number(rawAtempo.toFixed(3))));
      return {
        ...cue,
        sourceStartSec: region.startSec,
        sourceEndSec: region.endSec,
        atempo: clampedAtempo,
        gain: 1.0,
        muted: false,
        hasAudio: true,
        clipFileName: fileName || undefined,
      };
    });
  }

  // 'srt-slice': Continuous audio matches SRT timeline (with safe clamping to buffer duration)
  return cues.map((cue) => {
    const srcStart = Math.min(cue.startSec, masterBuffer.duration);
    const srcEnd = Math.min(cue.endSec, masterBuffer.duration);
    const srcDur = Math.max(0, srcEnd - srcStart);
    const hasAudio = srcDur > 0.05;
    return {
      ...cue,
      sourceStartSec: srcStart,
      sourceEndSec: srcEnd,
      atempo: 1.0,
      gain: 1.0,
      muted: false,
      hasAudio,
      clipFileName: fileName || undefined,
    };
  });
}

/**
 * Splits a single Concatenated Lines AudioBuffer by silence gaps and fits each line 1-to-1 into SRT cues.
 * When autoCalibrate is enabled (default), noise-floor detection & split/merge reconciliation happen automatically.
 */
export function mapConcatenatedAudioToCues(
  cues: SrtCue[],
  concatBuffer: AudioBuffer | null,
  silenceConfig: SilenceDetectionConfig,
  fileName: string | null
): {
  segments: DubSegment[];
  detectedCount: number;
  calibratedThresholdDb?: number;
  calibratedMinSilenceMs?: number;
} {
  if (!concatBuffer) {
    return {
      segments: cues.map((cue) => ({
        ...cue,
        sourceStartSec: 0,
        sourceEndSec: 0,
        atempo: 1.0,
        gain: 1.0,
        muted: false,
        hasAudio: false,
      })),
      detectedCount: 0,
    };
  }

  let regions: DetectedSpeechRegion[];
  let calibratedThresholdDb: number | undefined;
  let calibratedMinSilenceMs: number | undefined;

  if (silenceConfig.autoCalibrate) {
    const auto = autoDetectSpeechForCues(concatBuffer, cues, silenceConfig.minSpeechMs);
    regions = auto.regions;
    calibratedThresholdDb = auto.calibratedThresholdDb;
    calibratedMinSilenceMs = auto.calibratedMinSilenceMs;
  } else {
    regions = detectSpeechSegments(concatBuffer, silenceConfig);
  }

  const segments: DubSegment[] = cues.map((cue, idx) => {
    const region = regions[idx];
    if (!region) {
      return {
        ...cue,
        sourceStartSec: 0,
        sourceEndSec: 0,
        atempo: 1.0,
        gain: 1.0,
        muted: false,
        hasAudio: false,
        clipFileName: fileName || undefined,
      };
    }

    const targetDur = Math.max(0.15, cue.endSec - cue.startSec);
    const rawAtempo = region.durationSec / targetDur;
    const clampedAtempo = Math.min(2.5, Math.max(0.5, Number(rawAtempo.toFixed(3))));

    return {
      ...cue,
      sourceStartSec: region.startSec,
      sourceEndSec: region.endSec,
      atempo: clampedAtempo,
      gain: 1.0,
      muted: false,
      hasAudio: true,
      clipFileName: fileName ? `${fileName} [Line ${idx + 1}]` : `Line ${idx + 1}`,
    };
  });

  return {
    segments,
    detectedCount: regions.length,
    calibratedThresholdDb,
    calibratedMinSilenceMs,
  };
}

/**
 * Maps multiple individually uploaded line audio files onto SRT cues in sorted order.
 */
export function mapIndividualLineFilesToCues(
  cues: SrtCue[],
  clips: Array<{ fileName: string; buffer: AudioBuffer }>,
  existingSegments?: DubSegment[]
): DubSegment[] {
  return cues.map((cue, idx) => {
    const clip = clips[idx];
    if (!clip) {
      const prev = existingSegments?.[idx];
      if (prev?.clipBuffer) return prev;
      return {
        ...cue,
        sourceStartSec: 0,
        sourceEndSec: 0,
        atempo: 1.0,
        gain: 1.0,
        muted: false,
        hasAudio: false,
      };
    }
    const targetDur = Math.max(0.15, cue.endSec - cue.startSec);
    const rawAtempo = clip.buffer.duration / targetDur;
    const clampedAtempo = Math.min(2.5, Math.max(0.5, Number(rawAtempo.toFixed(3))));

    return {
      ...cue,
      sourceStartSec: 0,
      sourceEndSec: clip.buffer.duration,
      atempo: clampedAtempo,
      clipBuffer: clip.buffer,
      clipFileName: clip.fileName,
      gain: 1.0,
      muted: false,
      hasAudio: true,
    };
  });
}

/**
 * Pitch-preserving WSOLA (Waveform Similarity Overlap-Add) time-stretcher for Float32Array PCM.
 * Supports rate factors cleanly from 0.45x to 2.5x without changing vocal pitch.
 */
export function wsolaTimeStretch(
  input: Float32Array,
  sampleRate: number,
  speedRatio: number
): Float32Array {
  if (Math.abs(speedRatio - 1.0) < 0.015 || input.length < 1024) {
    return input;
  }

  const windowSize = Math.round(sampleRate * 0.04); // 40ms window
  const overlapSize = Math.round(windowSize * 0.5); // 20ms Hann overlap
  const hopOut = windowSize - overlapSize;
  const hopIn = hopOut * speedRatio;
  const tolerance = Math.round(sampleRate * 0.01); // +/-10ms search window

  const outputLength = Math.max(windowSize, Math.round(input.length / speedRatio));
  const output = new Float32Array(outputLength);
  const norm = new Float32Array(outputLength);

  // Precompute Hann window
  const hann = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }

  let outPos = 0;
  let inCursor = 0;

  // Copy first frame
  const firstCopy = Math.min(windowSize, input.length, outputLength);
  for (let i = 0; i < firstCopy; i++) {
    output[i] += input[i] * hann[i];
    norm[i] += hann[i];
  }

  outPos += hopOut;
  inCursor += hopIn;

  while (outPos + windowSize < outputLength && Math.round(inCursor) + windowSize < input.length) {
    const nominalIn = Math.round(inCursor);
    const searchStart = Math.max(0, nominalIn - tolerance);
    const searchEnd = Math.min(input.length - windowSize, nominalIn + tolerance);

    // Find best correlation alignment with existing tail in output buffer
    let bestOffset = nominalIn;
    let bestScore = -Infinity;

    // Sample every 4th sample for fast cross-correlation on mobile & desktop CPUs
    for (let cand = searchStart; cand <= searchEnd; cand += 2) {
      let score = 0;
      for (let k = 0; k < overlapSize; k += 4) {
        score += output[outPos + k] * input[cand + k];
      }
      if (score > bestScore) {
        bestScore = score;
        bestOffset = cand;
      }
    }

    for (let i = 0; i < windowSize; i++) {
      const idxOut = outPos + i;
      const idxIn = bestOffset + i;
      if (idxOut < outputLength && idxIn < input.length) {
        output[idxOut] += input[idxIn] * hann[i];
        norm[idxOut] += hann[i];
      }
    }

    outPos += hopOut;
    inCursor += hopIn;
  }

  for (let i = 0; i < outputLength; i++) {
    if (norm[i] > 0.001) {
      output[i] /= norm[i];
    }
  }

  return output;
}

/**
 * Slices a segment from an AudioBuffer and applies WSOLA (if pitchPreserve=true) or linear resampling.
 */
export function buildStretchedSegmentBuffer(
  ctx: BaseAudioContext,
  sourceBuffer: AudioBuffer,
  sourceStartSec: number,
  sourceEndSec: number,
  atempo: number,
  pitchPreserve: boolean
): AudioBuffer {
  const sr = sourceBuffer.sampleRate;
  const startSample = Math.max(0, Math.floor(sourceStartSec * sr));
  const endSample = Math.min(sourceBuffer.length, Math.ceil(sourceEndSec * sr));
  const frameLen = Math.max(1, endSample - startSample);
  const channels = sourceBuffer.numberOfChannels;

  if (!pitchPreserve || Math.abs(atempo - 1) < 0.015) {
    const sliced = ctx.createBuffer(channels, frameLen, sr);
    for (let ch = 0; ch < channels; ch++) {
      const src = sourceBuffer.getChannelData(ch).subarray(startSample, endSample);
      sliced.copyToChannel(new Float32Array(src), ch);
    }
    return sliced;
  }

  const stretchedChannels: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    const src = sourceBuffer.getChannelData(ch).subarray(startSample, endSample);
    stretchedChannels.push(wsolaTimeStretch(src, sr, atempo));
  }

  const outLen = stretchedChannels[0].length;
  const outBuf = ctx.createBuffer(channels, outLen, sr);
  for (let ch = 0; ch < channels; ch++) {
    outBuf.copyToChannel(new Float32Array(stretchedChannels[ch]), ch);
  }
  return outBuf;
}

/**
 * Renders the complete timeline (per-segment fitted dubbed dialogue + BGM gap-fill & smooth ducking)
 * into a 16-bit PCM WAV Blob using OfflineAudioContext.
 */
export async function renderMasterMixToWav(params: {
  segments: DubSegment[];
  masterDubBuffer: AudioBuffer | null;
  bgm: BgmConfig;
  totalDurationSec: number;
  pitchPreserve: boolean;
  onProgress?: (pct: number) => void;
}): Promise<Blob> {
  const { segments, masterDubBuffer, bgm, totalDurationSec, pitchPreserve, onProgress } = params;
  const sampleRate = 44100;
  const duration = Math.max(1, totalDurationSec);
  const totalSamples = Math.ceil(duration * sampleRate);

  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);
  onProgress?.(10);

  // 1. Schedule Dubbed Dialogue Segments
  const activeSegments = segments.filter((s) => !s.muted && s.hasAudio);
  for (let i = 0; i < activeSegments.length; i++) {
    const seg = activeSegments[i];
    const srcBuf = seg.clipBuffer || masterDubBuffer;
    if (!srcBuf) continue;

    const segBuffer = buildStretchedSegmentBuffer(
      offlineCtx,
      srcBuf,
      seg.sourceStartSec,
      seg.sourceEndSec,
      seg.atempo,
      pitchPreserve
    );

    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = segBuffer;

    if (!pitchPreserve) {
      sourceNode.playbackRate.value = seg.atempo;
    }

    const gainNode = offlineCtx.createGain();
    const targetDur = Math.max(0.05, seg.endSec - seg.startSec);
    // Short 12ms fade in/out to avoid clicks at segment boundaries
    gainNode.gain.setValueAtTime(0, seg.startSec);
    gainNode.gain.linearRampToValueAtTime(seg.gain, seg.startSec + 0.012);
    gainNode.gain.setValueAtTime(seg.gain, Math.max(seg.startSec + 0.012, seg.startSec + targetDur - 0.015));
    gainNode.gain.linearRampToValueAtTime(0, seg.startSec + targetDur);

    sourceNode.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    sourceNode.start(seg.startSec);

    onProgress?.(10 + Math.round(((i + 1) / Math.max(1, activeSegments.length)) * 40));
  }

  // 2. Schedule Background Music with Automatic Gap-Fill & Dialogue Ducking
  if (bgm.buffer && !bgm.muted) {
    const bgmGain = offlineCtx.createGain();
    const fadeSec = Math.max(0.02, bgm.duckFadeMs / 1000);

    // Start at full gap volume
    bgmGain.gain.setValueAtTime(bgm.gapVolume, 0);

    const sortedDialogue = [...activeSegments].sort((a, b) => a.startSec - b.startSec);
    for (const seg of sortedDialogue) {
      const duckStart = Math.max(0, seg.startSec - fadeSec);
      const duckHoldEnd = seg.endSec;
      const recoverEnd = Math.min(duration, seg.endSec + fadeSec);

      bgmGain.gain.setValueAtTime(bgm.gapVolume, duckStart);
      bgmGain.gain.linearRampToValueAtTime(bgm.duckVolume, seg.startSec);
      bgmGain.gain.setValueAtTime(bgm.duckVolume, duckHoldEnd);
      bgmGain.gain.linearRampToValueAtTime(bgm.gapVolume, recoverEnd);
    }

    const bgmSource = offlineCtx.createBufferSource();
    bgmSource.buffer = bgm.buffer;
    bgmSource.loop = bgm.loop;
    bgmSource.connect(bgmGain);
    bgmGain.connect(offlineCtx.destination);

    const startOffset = Math.min(bgm.offsetSec, Math.max(0, bgm.buffer.duration - 0.1));
    bgmSource.start(0, startOffset);
  }

  onProgress?.(65);
  const renderedBuffer = await offlineCtx.startRendering();
  onProgress?.(90);

  const wavBlob = encodeAudioBufferToWav(renderedBuffer);
  onProgress?.(100);
  return wavBlob;
}

/**
 * Encodes a stereo/mono AudioBuffer to standard 16-bit PCM WAV Blob.
 */
export function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const length = buffer.length;
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const ch0 = buffer.getChannelData(0);
  const ch1 = numChannels > 1 ? buffer.getChannelData(1) : ch0;

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s0 = Math.max(-1, Math.min(1, ch0[i]));
    view.setInt16(offset, s0 < 0 ? s0 * 0x8000 : s0 * 0x7fff, true);
    offset += 2;
    if (numChannels > 1) {
      const s1 = Math.max(-1, Math.min(1, ch1[i]));
      view.setInt16(offset, s1 < 0 ? s1 * 0x8000 : s1 * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
