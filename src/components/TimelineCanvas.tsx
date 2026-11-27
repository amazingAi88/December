import React, { useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { BgmConfig, DubSegment, GapInterval, UILanguage } from '../types/dubbing';
import { getFitStatus } from '../utils/audioEngine';
import { formatCompactTime } from '../utils/srtParser';

interface TimelineCanvasProps {
  durationSec: number;
  currentTime: number;
  segments: DubSegment[];
  gaps: GapInterval[];
  bgm: BgmConfig;
  selectedCueId: string | null;
  onSelectCue: (id: string) => void;
  onSeek: (timeSec: number) => void;
  onNudgeCue: (id: string, deltaSec: number) => void;
  lang: UILanguage;
}

export const TimelineCanvas: React.FC<TimelineCanvasProps> = ({
  durationSec,
  currentTime,
  segments,
  gaps,
  bgm,
  selectedCueId,
  onSelectCue,
  onSeek,
  onNudgeCue,
  lang,
}) => {
  const [pxPerSec, setPxPerSec] = useState<number>(48);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const safeDuration = Math.max(10, durationSec);
  const trackWidthPx = Math.max(820, Math.ceil(safeDuration * pxPerSec));
  const playheadLeftPx = Math.min(trackWidthPx, Math.max(0, currentTime * pxPerSec));

  // Ruler tick spacing adapts to zoom
  const tickIntervalSec = pxPerSec >= 70 ? 1 : pxPerSec >= 35 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= safeDuration; t += tickIntervalSec) {
    ticks.push(t);
  }

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const clickedTime = Math.min(safeDuration, x / pxPerSec);
    onSeek(clickedTime);
  };

  const selectedSegment = segments.find((s) => s.id === selectedCueId) || null;

  return (
    <section className="rounded-xl border border-[#242B38] bg-[#12161F] overflow-hidden">
      {/* Timeline Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#242B38] px-4 py-2.5 bg-[#0F131B]">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-display text-sm font-semibold text-slate-100 whitespace-nowrap">
            {lang === 'hi' ? 'मल्टी-ट्रैक एडिटिंग टाइमलाइन' : 'Multi-Track Sync Timeline'}
          </h2>
          <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
            {segments.length} {lang === 'hi' ? 'डायलॉग' : 'cues'} · {gaps.length} {lang === 'hi' ? 'BGM गैप' : 'BGM gaps'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedSegment && (
            <div className="flex items-center gap-1.5 mr-2 border-r border-[#242B38] pr-3">
              <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                Cue #{selectedSegment.index}
              </span>
              <button
                type="button"
                onClick={() => onNudgeCue(selectedSegment.id, -0.1)}
                className="min-h-[32px] rounded border border-[#2A3343] bg-[#181D27] px-2 text-xs font-mono text-slate-200 hover:bg-[#222938] cursor-pointer whitespace-nowrap"
              >
                -0.1s
              </button>
              <button
                type="button"
                onClick={() => onNudgeCue(selectedSegment.id, 0.1)}
                className="min-h-[32px] rounded border border-[#2A3343] bg-[#181D27] px-2 text-xs font-mono text-slate-200 hover:bg-[#222938] cursor-pointer whitespace-nowrap"
              >
                +0.1s
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPxPerSec((z) => Math.max(20, z - 12))}
            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-md border border-[#2A3343] bg-[#181D27] text-slate-300 hover:text-white cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-xs text-slate-400 w-12 text-center">
            {Math.round((pxPerSec / 48) * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setPxPerSec((z) => Math.min(120, z + 12))}
            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-md border border-[#2A3343] bg-[#181D27] text-slate-300 hover:text-white cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Track Labels + Scrollable Timeline Body */}
      <div className="flex">
        {/* Left Fixed Track Headers */}
        <div className="w-28 sm:w-36 shrink-0 border-r border-[#242B38] bg-[#0F131B] select-none">
          <div className="h-8 border-b border-[#242B38] px-3 flex items-center text-[11px] font-mono text-slate-500">
            TIMECODE
          </div>
          <div className="h-14 border-b border-[#242B38] px-3 flex flex-col justify-center">
            <span className="text-xs font-medium text-slate-200 truncate">
              {lang === 'hi' ? 'SRT डायलॉग' : 'SRT Cues'}
            </span>
            <span className="text-[11px] text-slate-500 truncate">Scene Timing</span>
          </div>
          <div className="h-16 border-b border-[#242B38] px-3 flex flex-col justify-center">
            <span className="text-xs font-medium text-teal-300 truncate">
              {lang === 'hi' ? 'डब ऑडियो' : 'Dubbed Audio'}
            </span>
            <span className="text-[11px] text-slate-500 truncate">Per-cue atempo</span>
          </div>
          <div className="h-16 px-3 flex flex-col justify-center">
            <span className="text-xs font-medium text-indigo-300 truncate">
              {lang === 'hi' ? 'BGM / गाना' : 'BGM Track'}
            </span>
            <span className="text-[11px] text-slate-500 truncate">
              {bgm.buffer ? `${Math.round(bgm.gapVolume * 100)}% / ${Math.round(bgm.duckVolume * 100)}%` : 'Auto Gap-Fill'}
            </span>
          </div>
        </div>

        {/* Horizontally Scrollable Tracks Area */}
        <div ref={scrollContainerRef} className="relative flex-1 overflow-x-auto bg-[#0B0E14]">
          <div style={{ width: `${trackWidthPx}px` }} className="relative">
            {/* Playhead Vertical Line */}
            <div
              style={{ transform: `translateX(${playheadLeftPx}px)` }}
              className="pointer-events-none absolute top-0 bottom-0 z-20 w-[2px] bg-amber-400"
            >
              <div className="h-3 w-3 -translate-x-[5px] bg-amber-400 rotate-45 -translate-y-1" />
            </div>

            {/* Ruler Row */}
            <div
              onClick={handleRulerClick}
              className="relative h-8 border-b border-[#242B38] bg-[#10141C] cursor-pointer select-none"
            >
              {ticks.map((t) => (
                <div
                  key={t}
                  style={{ left: `${t * pxPerSec}px` }}
                  className="absolute top-0 bottom-0 border-l border-[#242B38] pl-1.5 flex items-center"
                >
                  <span className="font-mono text-[10px] text-slate-400">
                    {formatCompactTime(t)}
                  </span>
                </div>
              ))}
            </div>

            {/* Track 1: SRT Subtitle Cues */}
            <div className="relative h-14 border-b border-[#242B38]">
              {segments.map((seg) => {
                const left = seg.startSec * pxPerSec;
                const width = Math.max(24, (seg.endSec - seg.startSec) * pxPerSec);
                const isSelected = seg.id === selectedCueId;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => {
                      onSelectCue(seg.id);
                      onSeek(seg.startSec);
                    }}
                    style={{ left: `${left}px`, width: `${width}px` }}
                    className={`absolute top-2 bottom-2 rounded-md border px-2 text-left transition-colors overflow-hidden cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/15 text-amber-100'
                        : 'border-[#2E384A] bg-[#181E29] text-slate-200 hover:border-slate-500'
                    }`}
                    title={`#${seg.index}: ${seg.text}`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-400">
                      <span>#{seg.index}</span>
                      <span>{(seg.endSec - seg.startSec).toFixed(1)}s</span>
                    </div>
                    <div className="truncate text-xs font-medium leading-tight">
                      {seg.text}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Track 2: Dubbed Audio Segments with atempo indicators */}
            <div className="relative h-16 border-b border-[#242B38]">
              {segments.map((seg) => {
                const left = seg.startSec * pxPerSec;
                const width = Math.max(24, (seg.endSec - seg.startSec) * pxPerSec);
                const fit = getFitStatus(seg);
                const isSelected = seg.id === selectedCueId;

                const statusColor =
                  fit === 'unassigned'
                    ? 'border-slate-700 bg-slate-800/40 text-slate-400'
                    : fit === 'high-speed'
                    ? 'border-amber-500/70 bg-amber-500/15 text-amber-200'
                    : 'border-teal-500/70 bg-teal-500/15 text-teal-100';

                return (
                  <button
                    key={`dub-${seg.id}`}
                    type="button"
                    onClick={() => {
                      onSelectCue(seg.id);
                      onSeek(seg.startSec);
                    }}
                    style={{ left: `${left}px`, width: `${width}px` }}
                    className={`absolute top-2 bottom-2 rounded-md border px-2 flex flex-col justify-between overflow-hidden cursor-pointer ${statusColor} ${
                      isSelected ? 'ring-1 ring-amber-400' : ''
                    } ${seg.muted ? 'opacity-45' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono w-full">
                      <span className="truncate">
                        {seg.hasAudio ? `${seg.atempo.toFixed(2)}x` : 'No Audio'}
                      </span>
                      <span className="shrink-0">
                        {seg.muted
                          ? 'Muted'
                          : fit === 'high-speed'
                          ? 'Fast'
                          : fit === 'optimal'
                          ? 'Fit OK'
                          : fit === 'mild-stretch'
                          ? 'Stretched'
                          : 'Empty'}
                      </span>
                    </div>
                    {/* Mini visual waveform bars inside segment */}
                    <div className="flex items-end gap-[2px] h-5 w-full opacity-75">
                      {Array.from({ length: Math.max(4, Math.floor(width / 6)) }).map((_, i) => {
                        const hPct = seg.hasAudio
                          ? 25 + Math.abs(Math.sin((seg.index * 3 + i) * 1.4)) * 75
                          : 10;
                        return (
                          <span
                            key={i}
                            style={{ height: `${hPct}%` }}
                            className={`flex-1 rounded-[1px] ${
                              fit === 'high-speed' ? 'bg-amber-400' : 'bg-teal-400'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Track 3: Background Music / Song (Full height in Gaps, Ducked under Dialogue) */}
            <div className="relative h-16 bg-[#0C1018]">
              {/* Gap segments highlighted */}
              {gaps.map((gap) => {
                const left = gap.startSec * pxPerSec;
                const width = Math.max(8, gap.durationSec * pxPerSec);
                return (
                  <div
                    key={gap.id}
                    style={{ left: `${left}px`, width: `${width}px` }}
                    className="absolute top-1.5 bottom-1.5 rounded border border-indigo-500/50 bg-indigo-500/20 px-1.5 flex flex-col justify-between overflow-hidden"
                    title={`BGM Gap: ${gap.durationSec.toFixed(1)}s`}
                  >
                    <span className="text-[10px] font-mono text-indigo-200 truncate">
                      {bgm.buffer ? `BGM ${Math.round(bgm.gapVolume * 100)}%` : 'BGM Gap'}
                    </span>
                    <div className="flex items-end gap-[2px] h-6 opacity-80">
                      {Array.from({ length: Math.max(3, Math.floor(width / 6)) }).map((_, idx) => {
                        const peak = bgm.peaks.length
                          ? bgm.peaks[Math.floor(((gap.startSec + idx * 0.15) / safeDuration) * bgm.peaks.length) % bgm.peaks.length]
                          : 0.55;
                        return (
                          <span
                            key={idx}
                            style={{ height: `${Math.max(20, peak * 100)}%` }}
                            className="flex-1 bg-indigo-400 rounded-[1px]"
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Ducked regions under active dialogue */}
              {segments
                .filter((s) => !s.muted)
                .map((seg) => {
                  const left = seg.startSec * pxPerSec;
                  const width = Math.max(12, (seg.endSec - seg.startSec) * pxPerSec);
                  return (
                    <div
                      key={`duck-${seg.id}`}
                      style={{ left: `${left}px`, width: `${width}px` }}
                      className="absolute bottom-1.5 h-4 rounded-sm border border-indigo-500/25 bg-indigo-500/10 flex items-center px-1 overflow-hidden"
                    >
                      <span className="text-[9px] font-mono text-indigo-300/70 truncate">
                        Duck {Math.round(bgm.duckVolume * 100)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
