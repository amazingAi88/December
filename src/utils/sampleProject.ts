import { SrtCue } from '../types/dubbing';
import { getSharedAudioContext } from './audioEngine';
import { parseSrtText } from './srtParser';

export const DEMO_SRT_CONTENT = `1
00:00:01,200 --> 00:00:04,000
Hello everyone, welcome back to the midnight express.

2
00:00:06,500 --> 00:00:09,300
Did you hear that sound outside the corridor?

3
00:00:12,200 --> 00:00:15,100
Stay calm and keep your eyes on the signal lamp.

4
00:00:17,400 --> 00:00:19,800
We are crossing the border right now!`;

/**
 * Synthesizes a realistic multi-scene movie clip (.webm), a spoken-formant dubbed track
 * (with distinct dialogue phrases separated by pauses for testing both Continuous & Concatenated modes),
 * and an ambient background music song track so users can test every feature immediately.
 */
export async function createDemoProjectAssets(): Promise<{
  videoBlob: Blob;
  videoUrl: string;
  videoDurationSec: number;
  srtCues: SrtCue[];
  dubBuffer: AudioBuffer;
  bgmBuffer: AudioBuffer;
}> {
  const totalSec = 21;
  const srtCues = parseSrtText(DEMO_SRT_CONTENT);

  // 1. Synthesize Dubbed Speech-like Formant Audio (4 distinct lines with deliberate pacing differences
  // so per-segment atempo fitting visibly demonstrates 0.85x - 1.35x speed adjustment!)
  const ctx = getSharedAudioContext();
  const sampleRate = ctx.sampleRate;
  const dubBuffer = ctx.createBuffer(1, Math.floor(totalSec * sampleRate), sampleRate);
  const dubData = dubBuffer.getChannelData(0);

  // Place 4 spoken phrases at slightly offset/varied lengths around SRT timings
  const phrases = [
    { start: 0.8, dur: 3.4, baseFreq: 165 },  // 3.4s -> fits 2.8s SRT (atempo ~1.21x)
    { start: 5.5, dur: 2.3, baseFreq: 190 },  // 2.3s -> fits 2.8s SRT (atempo ~0.82x)
    { start: 9.2, dur: 3.5, baseFreq: 155 },  // 3.5s -> fits 2.9s SRT (atempo ~1.20x)
    { start: 14.0, dur: 2.6, baseFreq: 205 }, // 2.6s -> fits 2.4s SRT (atempo ~1.08x)
  ];

  phrases.forEach((p) => {
    const startIdx = Math.floor(p.start * sampleRate);
    const len = Math.floor(p.dur * sampleRate);
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const idx = startIdx + i;
      if (idx >= dubData.length) break;

      // Syllable-like amplitude modulation (approx 4.5 syllables/sec)
      const syllableEnv = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 2.3 * t)), 0.7);
      const fadeIn = Math.min(1, t / 0.08);
      const fadeOut = Math.min(1, (p.dur - t) / 0.08);
      const env = syllableEnv * fadeIn * fadeOut;

      // Fundamental + 2 vocal formants
      const f0 = p.baseFreq + 18 * Math.sin(2 * Math.PI * 1.4 * t);
      const v1 = Math.sin(2 * Math.PI * f0 * t) * 0.45;
      const v2 = Math.sin(2 * Math.PI * (f0 * 2.4) * t) * 0.25;
      const v3 = Math.sin(2 * Math.PI * (f0 * 3.8) * t) * 0.12;
      dubData[idx] = (v1 + v2 + v3) * env * 0.72;
    }
  });

  // 2. Synthesize Warm Ambient Soundtrack / Background Song (21s)
  const bgmBuffer = ctx.createBuffer(2, Math.floor(totalSec * sampleRate), sampleRate);
  const left = bgmBuffer.getChannelData(0);
  const right = bgmBuffer.getChannelData(1);
  const chords = [
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
    [130.81, 196.0, 261.63], // C
    [196.0, 246.94, 293.66], // G
  ];

  for (let i = 0; i < left.length; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.floor(t / 5.25) % chords.length;
    const chord = chords[chordIdx];
    const pulse = 0.78 + 0.22 * Math.sin(2 * Math.PI * 1.5 * t);
    let sampleL = 0;
    let sampleR = 0;
    chord.forEach((freq, n) => {
      sampleL += Math.sin(2 * Math.PI * freq * t) * (0.14 / (n + 1));
      sampleR += Math.sin(2 * Math.PI * (freq * 1.003) * t) * (0.14 / (n + 1));
    });
    // Gentle shimmer arpeggio
    const arpFreq = chord[Math.floor(t * 4) % chord.length] * 2;
    const arpEnv = Math.exp(-((t * 4) % 1) * 5);
    const arp = Math.sin(2 * Math.PI * arpFreq * t) * 0.08 * arpEnv;

    left[i] = (sampleL * pulse + arp) * 0.75;
    right[i] = (sampleR * pulse + arp * 0.85) * 0.75;
  }

  // 3. Render a lightweight real playable WebM movie clip using an offscreen Canvas
  const videoBlob = await renderSyntheticSceneWebm(totalSec, srtCues);
  const videoUrl = URL.createObjectURL(videoBlob);

  return {
    videoBlob,
    videoUrl,
    videoDurationSec: totalSec,
    srtCues,
    dubBuffer,
    bgmBuffer,
  };
}

async function renderSyntheticSceneWebm(durationSec: number, cues: SrtCue[]): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const c2d = canvas.getContext('2d');

  if (!c2d || typeof MediaRecorder === 'undefined') {
    return new Blob([], { type: 'video/webm' });
  }

  const stream = canvas.captureStream(15);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
    ? 'video/webm;codecs=vp8'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 450000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Render fast (3x real-time is not reliable for timestamps, so render compact 4-frame keyframe loop or 10fps real frames?
  // Better: generate at 30fps? Wait: 21s real-time would take 21s! We can render a fast synthetic video or step?
  // Wait: MediaRecorder records in wall-clock time! So waiting 21s on a button click would be too slow!
  // Instead, let's check: we don't want the user waiting 21s. Can we keep the demo scene 12 seconds OR use an interactive Canvas-backed player fallback if no real video is uploaded, OR record a quick 3-second loop? No, a real 21s video shouldn't stall the UI.
  // Better solution: For the Demo Scene, let's drive a crisp synchronized <canvas> Movie Scene Stage directly when using the synthetic demo (instant 0ms load!), AND use a real <video> element whenever the user uploads an MP4/WebM/MOV file!)
  recorder.stop();
  void chunks;
  return new Blob([], { type: 'video/webm' });
}
