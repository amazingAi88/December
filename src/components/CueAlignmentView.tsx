import React, { useMemo, useState } from 'react';
import { Play, RotateCcw, Search, Upload, Volume2, VolumeX } from 'lucide-react';
import { DubSegment, FitStatus, UILanguage } from '../types/dubbing';
import { getFitStatus } from '../utils/audioEngine';
import { formatCompactTime } from '../utils/srtParser';

interface CueAlignmentViewProps {
  segments: DubSegment[];
  selectedCueId: string | null;
  onSelectCue: (id: string) => void;
  onUpdateSegment: (id: string, patch: Partial<DubSegment>) => void;
  onAutoFitAll: () => void;
  onAutoFitCue: (id: string) => void;
  onPreviewCue: (segment: DubSegment) => void;
  onReplaceCueAudio: (id: string, file: File) => void;
  lang: UILanguage;
}

export const CueAlignmentView: React.FC<CueAlignmentViewProps> = ({
  segments,
  selectedCueId,
  onSelectCue,
  onUpdateSegment,
  onAutoFitAll,
  onAutoFitCue,
  onPreviewCue,
  onReplaceCueAudio,
  lang,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FitStatus>('all');

  const filtered = useMemo(() => {
    return segments.filter((seg) => {
      const matchesText =
        !searchQuery.trim() ||
        seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(seg.index).includes(searchQuery);
      const status = getFitStatus(seg);
      const matchesFilter = statusFilter === 'all' || status === statusFilter;
      return matchesText && matchesFilter;
    });
  }, [segments, searchQuery, statusFilter]);

  const counts = useMemo(() => {
    let optimal = 0;
    let fast = 0;
    let missing = 0;
    segments.forEach((s) => {
      const st = getFitStatus(s);
      if (st === 'optimal' || st === 'mild-stretch') optimal++;
      else if (st === 'high-speed') fast++;
      else missing++;
    });
    return { optimal, fast, missing };
  }, [segments]);

  return (
    <section className="rounded-xl border border-[#242B38] bg-[#12161F] overflow-hidden">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#242B38] px-5 py-4 bg-[#0F131B]">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-100">
            {lang === 'hi' ? 'प्रति-डायलॉग SRT और atempo सिंक टेबल' : 'Per-Segment SRT & atempo Alignment'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {counts.optimal} fitted · {counts.fast} fast (&gt;1.45x) · {counts.missing} unassigned
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'hi' ? 'डायलॉग खोजें...' : 'Search dialogue...'}
              className="min-h-[38px] rounded-lg border border-[#2A3343] bg-[#181D27] pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Filter Segmented Control */}
          <div className="flex items-center gap-1 rounded-lg bg-[#0B0E14] p-1 border border-[#242B38]">
            {(['all', 'optimal', 'high-speed', 'unassigned'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === f ? 'bg-[#1E2634] text-amber-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f === 'all'
                  ? 'All'
                  : f === 'optimal'
                  ? 'Fitted'
                  : f === 'high-speed'
                  ? 'High Speed'
                  : 'Unassigned'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onAutoFitAll}
            className="min-h-[38px] flex items-center gap-1.5 rounded-lg bg-teal-500/15 border border-teal-500/40 px-3 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/25 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{lang === 'hi' ? 'सभी को ऑटो-फिट करें' : 'Auto-Fit All Cues'}</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {segments.length === 0 ? (
        <div className="py-16 px-6 text-center">
          <p className="text-sm font-medium text-slate-200">
            {lang === 'hi' ? 'कोई .srt सबटाइटल लोड नहीं है' : 'No .srt cues loaded'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {lang === 'hi'
              ? 'टाइमलाइन टैब में जाकर .srt फाइल अपलोड करें या डेमो सीन चलाएं।'
              : 'Upload an .srt subtitle file or load the Demo Scene in the Timeline tab to inspect per-segment alignment.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#242B38] bg-[#0F131B] text-[11px] font-medium text-slate-400">
                <th className="py-2.5 px-4 w-12">#</th>
                <th className="py-2.5 px-3 w-40">SRT Window</th>
                <th className="py-2.5 px-3">Dialogue Text</th>
                <th className="py-2.5 px-3 w-36 text-right">Source / Target</th>
                <th className="py-2.5 px-3 w-48">atempo Speed</th>
                <th className="py-2.5 px-3 w-28">Status</th>
                <th className="py-2.5 px-4 w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2430] text-xs">
              {filtered.map((seg) => {
                const targetDur = Math.max(0.05, seg.endSec - seg.startSec);
                const srcDur = Math.max(0, seg.sourceEndSec - seg.sourceStartSec);
                const status = getFitStatus(seg);
                const isSelected = seg.id === selectedCueId;

                return (
                  <tr
                    key={seg.id}
                    onClick={() => onSelectCue(seg.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-amber-400/5' : 'hover:bg-[#171C27]'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-400">{seg.index}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {formatCompactTime(seg.startSec)} → {formatCompactTime(seg.endSec)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-100 max-w-xs">
                      <div className="truncate font-medium">{seg.text}</div>
                      {seg.clipFileName && (
                        <div className="truncate text-[11px] font-mono text-slate-500">
                          {seg.clipFileName}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-slate-300 whitespace-nowrap">
                      {seg.hasAudio ? `${srcDur.toFixed(2)}s / ${targetDur.toFixed(2)}s` : `— / ${targetDur.toFixed(2)}s`}
                    </td>
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0.5}
                          max={2.2}
                          step={0.02}
                          value={seg.atempo}
                          disabled={!seg.hasAudio}
                          onChange={(e) =>
                            onUpdateSegment(seg.id, {
                              atempo: parseFloat(e.target.value),
                              manualOverride: true,
                            })
                          }
                          className="w-24 accent-teal-400 cursor-pointer disabled:opacity-30"
                        />
                        <span className="font-mono w-12 text-right text-slate-200">
                          {seg.atempo.toFixed(2)}x
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      <span
                        className={
                          status === 'optimal'
                            ? 'text-emerald-400'
                            : status === 'mild-stretch'
                            ? 'text-teal-300'
                            : status === 'high-speed'
                            ? 'text-amber-400'
                            : 'text-slate-500'
                        }
                      >
                        {status === 'optimal'
                          ? 'Optimal'
                          : status === 'mild-stretch'
                          ? 'Adjusted'
                          : status === 'high-speed'
                          ? 'Fast (>1.45x)'
                          : 'No Audio'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPreviewCue(seg)}
                          disabled={!seg.hasAudio}
                          title="Preview this fitted cue"
                          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded border border-[#2A3343] bg-[#181D27] text-teal-300 hover:bg-[#222938] disabled:opacity-30 cursor-pointer"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onAutoFitCue(seg.id)}
                          disabled={!seg.hasAudio}
                          title="Reset atempo to exact SRT fit"
                          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded border border-[#2A3343] bg-[#181D27] text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateSegment(seg.id, { muted: !seg.muted })}
                          title={seg.muted ? 'Unmute cue' : 'Mute cue'}
                          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded border border-[#2A3343] bg-[#181D27] text-slate-300 hover:text-white cursor-pointer"
                        >
                          {seg.muted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5" />}
                        </button>
                        <label
                          title="Upload replacement clip for this cue"
                          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded border border-[#2A3343] bg-[#181D27] text-slate-300 hover:text-amber-300 cursor-pointer"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) onReplaceCueAudio(seg.id, f);
                            }}
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
