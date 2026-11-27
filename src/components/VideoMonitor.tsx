import React, { useEffect, useRef } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { DubSegment, UILanguage } from '../types/dubbing';
import { formatCompactTime } from '../utils/srtParser';

interface VideoMonitorProps {
  videoUrl: string | null;
  isDemoScene: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (timeSec: number) => void;
  onLoadedMetadata: (durationSec: number) => void;
  activeCue: DubSegment | null;
  originalVideoMuted: boolean;
  onToggleOriginalMute: () => void;
  originalVideoVolume: number;
  onOriginalVolumeChange: (v: number) => void;
  bgmPlayingInGap: boolean;
  hasBgm: boolean;
  lang: UILanguage;
}

export const VideoMonitor: React.FC<VideoMonitorProps> = ({
  videoUrl,
  isDemoScene,
  videoRef,
  currentTime,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
  onLoadedMetadata,
  activeCue,
  originalVideoMuted,
  onToggleOriginalMute,
  originalVideoVolume,
  onOriginalVolumeChange,
  bgmPlayingInGap,
  hasBgm,
  lang,
}) => {
  const demoCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = originalVideoMuted;
      videoRef.current.volume = originalVideoVolume;
    }
  }, [originalVideoMuted, originalVideoVolume, videoRef]);

  // Draw crisp synthetic movie scene stage when Demo Scene is active without an uploaded MP4
  useEffect(() => {
    if (!isDemoScene || videoUrl) return;
    const canvas = demoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const sceneIdx = Math.min(3, Math.floor(currentTime / 5.25));
    const palettes = [
      ['#0F172A', '#1E293B', '#38BDF8'],
      ['#111827', '#1F2937', '#F59E0B'],
      ['#0C1420', '#162436', '#14B8A6'],
      ['#171422', '#262038', '#818CF8'],
    ];
    const [bg1, bg2, accent] = palettes[sceneIdx];

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, bg1);
    grad.addColorStop(1, bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle moving horizon / train window light bars
    const shift = (currentTime * 65) % 160;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = -160; x < w + 160; x += 160) {
      ctx.fillRect(x + shift, 48, 64, h - 96);
    }

    // Center film frame guides
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    // Scene label
    ctx.fillStyle = accent;
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText(`DEMO SCENE 0${sceneIdx + 1} · ${formatCompactTime(currentTime)}`, 40, 54);

    // Visual speaking indicator bars when cue active
    if (activeCue && !activeCue.muted) {
      const bars = 12;
      for (let i = 0; i < bars; i++) {
        const amp = 10 + Math.abs(Math.sin(currentTime * 14 + i * 0.9)) * 28;
        ctx.fillStyle = '#14B8A6';
        ctx.fillRect(40 + i * 10, h - 76 - amp, 6, amp);
      }
    }
  }, [isDemoScene, videoUrl, currentTime, activeCue]);

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <section className="flex flex-col rounded-xl border border-[#242B38] bg-[#12161F] overflow-hidden">
      {/* Monitor Header */}
      <div className="flex items-center justify-between gap-4 border-b border-[#242B38] px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-display text-sm font-semibold text-slate-100 whitespace-nowrap">
            {lang === 'hi' ? 'वीडियो और सबटाइटल प्रीव्यू' : 'Scene Monitor & Audio Preview'}
          </h2>
          <span className="text-xs text-slate-400 font-mono truncate">
            {activeCue
              ? `Cue #${activeCue.index} · ${activeCue.atempo.toFixed(2)}x`
              : hasBgm && bgmPlayingInGap
              ? lang === 'hi'
                ? 'डायलॉग गैप · बैकग्राउंड म्यूजिक सक्रिय'
                : 'Dialogue Gap · BGM Active'
              : lang === 'hi'
              ? 'तैयार'
              : 'Idle'}
          </span>
        </div>

        {/* Original Movie Audio Control */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleOriginalMute}
            className="min-h-[34px] flex items-center gap-1.5 rounded-md border border-[#2A3343] bg-[#181D27] px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            title="Mute or unmute original video audio"
          >
            {originalVideoMuted ? <VolumeX className="h-3.5 w-3.5 text-slate-400" /> : <Volume2 className="h-3.5 w-3.5 text-amber-400" />}
            <span>{originalVideoMuted ? (lang === 'hi' ? 'मूल आवाज बंद' : 'Orig Muted') : (lang === 'hi' ? 'मूल आवाज' : 'Orig Audio')}</span>
          </button>
          {!originalVideoMuted && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={originalVideoVolume}
              onChange={(e) => onOriginalVolumeChange(parseFloat(e.target.value))}
              aria-label="Original video volume"
              className="w-16 accent-amber-400 cursor-pointer"
            />
          )}
        </div>
      </div>

      {/* Video / Stage Viewport */}
      <div className="relative aspect-video w-full bg-[#07090D] flex items-center justify-center overflow-hidden">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration;
              if (Number.isFinite(dur) && dur > 0) {
                onLoadedMetadata(dur);
              }
            }}
            className="h-full w-full object-contain"
            onClick={onTogglePlay}
          />
        ) : isDemoScene ? (
          <canvas
            ref={demoCanvasRef}
            width={640}
            height={360}
            onClick={onTogglePlay}
            className="h-full w-full object-contain cursor-pointer"
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 text-center max-w-md">
            <p className="text-sm font-medium text-slate-200">
              {lang === 'hi'
                ? 'कोई वीडियो लोड नहीं है'
                : 'No movie video loaded yet'}
            </p>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              {lang === 'hi'
                ? 'दाईं ओर से MP4/WebM मूवी, .srt फाइल, डब ऑडियो और बैकग्राउंड म्यूजिक अपलोड करें — या डेमो सीन चलाएं।'
                : 'Upload an MP4/WebM video, .srt subtitle file, dubbed audio, and background music from the panel — or load the demo scene to test immediately.'}
            </p>
          </div>
        )}

        {/* Active SRT Subtitle Overlay with Measured Scrim */}
        {activeCue && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
            <div className="max-w-xl rounded-lg bg-black/80 px-4 py-2 text-center backdrop-blur-sm border border-white/10">
              <p className="text-sm md:text-base font-medium text-white leading-snug">
                {activeCue.text}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Transport Controls */}
      <div className="flex flex-col gap-2 border-t border-[#242B38] bg-[#0F131B] px-4 py-3">
        {/* Scrub Bar */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-300 w-16 shrink-0">
            {formatCompactTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.02}
            value={Math.min(currentTime, Math.max(1, duration))}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            aria-label="Timeline seek"
            className="h-2 flex-1 accent-amber-400 cursor-pointer"
          />
          <span className="font-mono text-xs text-slate-400 w-16 text-right shrink-0">
            {formatCompactTime(duration)}
          </span>
        </div>

        {/* Play/Pause & Live Track Telemetry */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={!videoUrl && !isDemoScene && duration <= 0}
              className="min-h-[40px] min-w-[44px] flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? (lang === 'hi' ? 'रोकें' : 'Pause') : (lang === 'hi' ? 'चलाएं' : 'Play')}</span>
            </button>

            <button
              type="button"
              onClick={() => onSeek(0)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-[#242B38] bg-[#181D27] text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Restart from 00:00"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 font-mono">
            <span>{progressPct.toFixed(0)}%</span>
            <span aria-hidden="true">·</span>
            <span>
              {activeCue
                ? `Dub: ${activeCue.atempo.toFixed(2)}x`
                : hasBgm
                ? lang === 'hi'
                  ? 'BGM: फुल वॉल्यूम (गैप)'
                  : 'BGM: Full (Gap)'
                : 'No Audio'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
