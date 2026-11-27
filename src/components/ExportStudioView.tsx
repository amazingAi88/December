import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode, Film, Music } from 'lucide-react';
import { BgmConfig, DubSegment, ProjectMediaState, UILanguage } from '../types/dubbing';
import { renderMasterMixToWav } from '../utils/audioEngine';
import {
  downloadFile,
  generateFcpxml,
  generateFfmpegCommand,
  generateTimelineJson,
  generateUpdatedSrt,
} from '../utils/exportGenerators';

interface ExportStudioViewProps {
  media: ProjectMediaState;
  segments: DubSegment[];
  bgm: BgmConfig;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  lang: UILanguage;
}

export const ExportStudioView: React.FC<ExportStudioViewProps> = ({
  media,
  segments,
  bgm,
  lang,
}) => {
  const [useRubberband, setUseRubberband] = useState(false);
  const [wavProgress, setWavProgress] = useState<number | null>(null);
  const [wavPreviewUrl, setWavPreviewUrl] = useState<string | null>(null);
  const [webmRendering, setWebmRendering] = useState(false);
  const [webmStatus, setWebmStatus] = useState<string | null>(null);
  const [copiedFfmpeg, setCopiedFfmpeg] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const activeDubCount = segments.filter((s) => s.hasAudio && !s.muted).length;
  const totalDur = Math.max(
    media.videoDurationSec,
    segments.reduce((m, s) => Math.max(m, s.endSec), 0)
  );

  const ffmpegScript = useMemo(
    () =>
      generateFfmpegCommand({
        media,
        segments,
        bgm,
        useRubberband,
      }),
    [media, segments, bgm, useRubberband]
  );

  const handleExportWav = async () => {
    setExportError(null);
    if (activeDubCount === 0 && !bgm.buffer) {
      setExportError(
        lang === 'hi'
          ? 'एक्सपोर्ट करने से पहले कृपया डब ऑडियो या बैकग्राउंड म्यूजिक अपलोड करें (या डेमो सीन लोड करें)।'
          : 'Please load dubbed audio or background music (or load the Demo Scene) before rendering.'
      );
      return;
    }
    try {
      setWavProgress(5);
      const blob = await renderMasterMixToWav({
        segments,
        masterDubBuffer: media.dubMasterBuffer,
        bgm,
        totalDurationSec: totalDur,
        pitchPreserve: media.pitchPreserve,
        onProgress: setWavProgress,
      });

      const url = URL.createObjectURL(blob);
      setWavPreviewUrl(url);
      const baseName = (media.videoFileName || 'dubsync_master').replace(/\.[^.]+$/, '');
      downloadFile(blob, `${baseName}_dubbed_mix.wav`, 'audio/wav');
      setTimeout(() => setWavProgress(null), 1500);
    } catch (err) {
      setWavProgress(null);
      setExportError(err instanceof Error ? err.message : 'WAV render failed.');
    }
  };

  const handleExportMuxedWebm = async () => {
    setExportError(null);
    if (!media.videoUrl) {
      setExportError(
        lang === 'hi'
          ? 'वीडियो (.WebM) एक्सपोर्ट के लिए पहले MP4/WebM मूवी वीडियो अपलोड करें।'
          : 'Upload an MP4/WebM movie file first to render a muxed video export.'
      );
      return;
    }

    try {
      setWebmRendering(true);
      setWebmStatus(
        lang === 'hi'
          ? '1/2: डब ऑडियो + BGM मिक्स तैयार हो रहा है...'
          : 'Step 1/2: Mixing per-segment audio + BGM...'
      );

      // Step 1: Pre-render exact sample-accurate master WAV mix using OfflineAudioContext
      const wavBlob = await renderMasterMixToWav({
        segments,
        masterDubBuffer: media.dubMasterBuffer,
        bgm,
        totalDurationSec: totalDur,
        pitchPreserve: media.pitchPreserve,
      });

      const arrayBuf = await wavBlob.arrayBuffer();
      const audioCtx = new AudioContext();
      const mixedAudioBuffer = await audioCtx.decodeAudioData(arrayBuf);

      setWebmStatus(
        lang === 'hi'
          ? '2/2: वीडियो और सिंक ऑडियो रिकॉर्ड हो रहे हैं...'
          : 'Step 2/2: Capturing muxed video + synced audio...'
      );

      // Step 2: Play video offscreen + mixedAudioBuffer into MediaStreamDestination
      const tempVideo = document.createElement('video');
      tempVideo.src = media.videoUrl;
      tempVideo.muted = true;
      tempVideo.playsInline = true;
      await new Promise<void>((res) => {
        tempVideo.onloadeddata = () => res();
      });

      const captureVideo = tempVideo as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const videoStream = captureVideo.captureStream
        ? captureVideo.captureStream()
        : captureVideo.mozCaptureStream?.();

      if (!videoStream) {
        throw new Error('Browser does not support video captureStream(). Use FFmpeg script export instead.');
      }

      const dest = audioCtx.createMediaStreamDestination();
      const audioSrc = audioCtx.createBufferSource();
      audioSrc.buffer = mixedAudioBuffer;
      audioSrc.connect(dest);

      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(combinedStream, { mimeType: mime, videoBitsPerSecond: 2500000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        tempVideo.onended = () => {
          if (recorder.state !== 'inactive') recorder.stop();
        };
        recorder.start(250);
        audioSrc.start(0);
        void tempVideo.play();
      });

      const outBlob = new Blob(chunks, { type: 'video/webm' });
      const baseName = (media.videoFileName || 'movie').replace(/\.[^.]+$/, '');
      downloadFile(outBlob, `${baseName}_dubsync.webm`, 'video/webm');
      await audioCtx.close();
      setWebmRendering(false);
      setWebmStatus(null);
    } catch (err) {
      setWebmRendering(false);
      setWebmStatus(null);
      setExportError(err instanceof Error ? err.message : 'WebM export failed.');
    }
  };

  const handleCopyFfmpeg = async () => {
    await navigator.clipboard.writeText(ffmpegScript);
    setCopiedFfmpeg(true);
    setTimeout(() => setCopiedFfmpeg(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {exportError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {exportError}
        </div>
      )}

      {/* Primary Media Exports */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. WAV Audio Export */}
        <div className="rounded-xl border border-[#242B38] bg-[#12161F] p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Music className="h-4 w-4 text-teal-400" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                {lang === 'hi' ? 'मास्टर ऑडियो मिक्स (.WAV)' : 'Master Audio Mix (.WAV)'}
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {lang === 'hi'
                ? 'प्रति-डायलॉग WSOLA पिच-सुरक्षित स्ट्रेचिंग + खाली गैप में फुल बैकग्राउंड म्यूजिक के साथ 16-bit PCM WAV रेंडर।'
                : 'Offline renders all per-segment atempo dialogue clips (with WSOLA pitch preservation) plus smooth BGM gap-filling into a 16-bit PCM WAV.'}
            </p>
            <div className="mt-3 text-xs font-mono text-slate-400">
              {activeDubCount} dialogue cues · {bgm.buffer ? 'BGM Gap-Fill Active' : 'No BGM'}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {wavProgress !== null && (
              <div className="h-1.5 w-full rounded bg-[#0B0E14] overflow-hidden">
                <div
                  style={{ width: `${wavProgress}%` }}
                  className="h-full bg-teal-400 transition-all"
                />
              </div>
            )}
            <button
              type="button"
              onClick={handleExportWav}
              disabled={wavProgress !== null}
              className="min-h-[42px] w-full flex items-center justify-center gap-2 rounded-lg bg-teal-500 text-slate-950 font-semibold text-xs hover:bg-teal-400 disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>{wavProgress !== null ? `Rendering ${wavProgress}%` : 'Render & Download .WAV'}</span>
            </button>
            {wavPreviewUrl && (
              <audio controls src={wavPreviewUrl} className="w-full h-8 mt-1" />
            )}
          </div>
        </div>

        {/* 2. Muxed WebM Video Export */}
        <div className="rounded-xl border border-[#242B38] bg-[#12161F] p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Film className="h-4 w-4 text-amber-400" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                {lang === 'hi' ? 'डब मूवी वीडियो (.WebM)' : 'Muxed Video + Dub (.WebM)'}
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {lang === 'hi'
                ? 'ब्राउज़र के अंदर ही अपलोड की गई मूवी वीडियो और सिंक की गई ऑडियो + BGM को जोड़कर वीडियो फाइल डाउनलोड करें।'
                : 'Muxes your uploaded movie video with the fitted dialogue and BGM mix directly in the browser (ideal for short clips & Android).'}
            </p>
            <div className="mt-3 text-xs font-mono text-slate-400">
              {media.videoFileName ? media.videoFileName : 'Requires uploaded video'}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {webmStatus && (
              <p className="text-[11px] font-mono text-amber-300">{webmStatus}</p>
            )}
            <button
              type="button"
              onClick={handleExportMuxedWebm}
              disabled={webmRendering || !media.videoUrl}
              className="min-h-[42px] w-full flex items-center justify-center gap-2 rounded-lg bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300 disabled:opacity-40 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>{webmRendering ? 'Recording Muxed Video...' : 'Export Video (.WebM)'}</span>
            </button>
          </div>
        </div>

        {/* 3. NLE & Subtitle Formats (FCPXML, SRT, JSON) */}
        <div className="rounded-xl border border-[#242B38] bg-[#12161F] p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <FileCode className="h-4 w-4 text-indigo-400" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                {lang === 'hi' ? 'DaVinci / Premiere / SRT फाइलें' : 'NLE Timeline & Subtitle Files'}
              </h3>
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {lang === 'hi'
                ? 'DaVinci Resolve / Premiere Pro में आगे एडिटिंग के लिए FCPXML, अपडेटेड .SRT और टाइमलाइन JSON एक्सपोर्ट करें।'
                : 'Import aligned clips, speed maps, and BGM lanes straight into DaVinci Resolve, Premiere Pro, or subtitle editors.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() =>
                downloadFile(
                  generateFcpxml({ media, segments, bgm }),
                  'dubsync_timeline.fcpxml',
                  'application/xml'
                )
              }
              className="min-h-[38px] flex items-center justify-between rounded-lg border border-[#2A3343] bg-[#181D27] px-3 text-xs font-medium text-slate-200 hover:border-indigo-400 cursor-pointer"
            >
              <span>DaVinci / Premiere (.FCPXML)</span>
              <Download className="h-3.5 w-3.5 text-indigo-400" />
            </button>

            <button
              type="button"
              onClick={() =>
                downloadFile(generateUpdatedSrt(segments), 'dubsync_adjusted.srt', 'text/plain')
              }
              className="min-h-[38px] flex items-center justify-between rounded-lg border border-[#2A3343] bg-[#181D27] px-3 text-xs font-medium text-slate-200 hover:border-sky-400 cursor-pointer"
            >
              <span>Adjusted Subtitles (.SRT)</span>
              <Download className="h-3.5 w-3.5 text-sky-400" />
            </button>

            <button
              type="button"
              onClick={() =>
                downloadFile(
                  generateTimelineJson({ media, segments, bgm }),
                  'dubsync_project.json',
                  'application/json'
                )
              }
              className="min-h-[38px] flex items-center justify-between rounded-lg border border-[#2A3343] bg-[#181D27] px-3 text-xs font-medium text-slate-200 hover:border-slate-400 cursor-pointer"
            >
              <span>Timing Sheet (.JSON)</span>
              <Download className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Production FFmpeg Per-Segment atempo / rubberband Script */}
      <section className="rounded-xl border border-[#242B38] bg-[#12161F] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#242B38] px-5 py-3.5 bg-[#0F131B]">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-100">
              {lang === 'hi'
                ? 'FFmpeg Per-Segment atempo + BGM स्क्रिप्ट (PC व Android Termux के लिए)'
                : 'FFmpeg Per-Segment atempo + BGM Filtergraph Script (PC & Android Termux)'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'hi'
                ? 'पूरी मूवी को बिना वीडियो क्वालिटी खोए (`-c:v copy`) कुछ ही सेकंड में रेंडर करने के लिए चलाएं।'
                : 'Lossless video stream copy with exact millisecond adelay, chained atempo/rubberband, and BGM gap-fill.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useRubberband}
                onChange={(e) => setUseRubberband(e.target.checked)}
                className="accent-teal-400"
              />
              <span>Use librubberband (higher quality)</span>
            </label>

            <button
              type="button"
              onClick={handleCopyFfmpeg}
              className="min-h-[36px] flex items-center gap-1.5 rounded-lg border border-[#2A3343] bg-[#181D27] px-3 text-xs font-medium text-slate-200 hover:text-white cursor-pointer whitespace-nowrap"
            >
              {copiedFfmpeg ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedFfmpeg ? 'Copied' : 'Copy Command'}</span>
            </button>

            <button
              type="button"
              onClick={() => downloadFile(ffmpegScript, 'render_dubsync.sh', 'text/x-shellscript')}
              className="min-h-[36px] flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-semibold text-slate-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download .SH</span>
            </button>
          </div>
        </div>

        <pre className="p-4 overflow-x-auto font-mono text-xs text-slate-300 bg-[#080A0F] leading-relaxed max-h-80">
          <code>{ffmpegScript}</code>
        </pre>
      </section>
    </div>
  );
};
