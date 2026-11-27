import React, { useState } from 'react';
import { FileAudio, FileText, Film, Music, Sliders, Upload } from 'lucide-react';
import {
  BgmConfig,
  ContinuousAlignStrategy,
  DubSegment,
  DubUploadMode,
  ProjectMediaState,
  SilenceDetectionConfig,
  UILanguage,
} from '../types/dubbing';
import { formatCompactTime } from '../utils/srtParser';

interface MediaUploadPanelProps {
  media: ProjectMediaState;
  bgm: BgmConfig;
  silenceConfig: SilenceDetectionConfig;
  selectedSegment: DubSegment | null;
  detectedRegionsCount: number;
  cuesCount: number;
  onUploadVideo: (file: File) => void;
  onUploadSrt: (file: File) => void;
  onApplyRawSrtText: (rawText: string) => void;
  onChangeDubMode: (mode: DubUploadMode) => void;
  onChangeContinuousStrategy: (strategy: ContinuousAlignStrategy) => void;
  onUploadDubMaster: (file: File) => void;
  onUploadMultiLineClips: (files: FileList) => void;
  onUploadBgm: (file: File) => void;
  onUpdateBgm: (patch: Partial<BgmConfig>) => void;
  onUpdateSilenceConfig: (patch: Partial<SilenceDetectionConfig>) => void;
  onTogglePitchPreserve: (val: boolean) => void;
  onUpdateSegment: (id: string, patch: Partial<DubSegment>) => void;
  onAutoFitCue: (id: string) => void;
  lang: UILanguage;
}

export const MediaUploadPanel: React.FC<MediaUploadPanelProps> = ({
  media,
  bgm,
  silenceConfig,
  selectedSegment,
  detectedRegionsCount,
  cuesCount,
  onUploadVideo,
  onUploadSrt,
  onApplyRawSrtText,
  onChangeDubMode,
  onChangeContinuousStrategy,
  onUploadDubMaster,
  onUploadMultiLineClips,
  onUploadBgm,
  onUpdateBgm,
  onUpdateSilenceConfig,
  onTogglePitchPreserve,
  onUpdateSegment,
  onAutoFitCue,
  lang,
}) => {
  const [showSrtPaste, setShowSrtPaste] = useState(false);
  const [rawSrtInput, setRawSrtInput] = useState('');

  return (
    <aside className="flex flex-col gap-4">
      {/* 1. Source Media Uploads */}
      <div className="rounded-xl border border-[#242B38] bg-[#12161F] p-4 flex flex-col gap-3.5">
        <div className="flex items-center justify-between border-b border-[#242B38] pb-2.5">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            {lang === 'hi' ? 'मीडिया और सबटाइटल अपलोड' : 'Project Media Inputs'}
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {cuesCount} {lang === 'hi' ? 'क्यूज़' : 'cues'}
          </span>
        </div>

        {/* Video Upload */}
        <label className="flex items-center justify-between gap-3 rounded-lg border border-[#2A3343] bg-[#181D27] px-3 py-2.5 hover:border-slate-500 transition-colors cursor-pointer min-h-[48px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Film className="h-4 w-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate">
                {media.videoFileName || (lang === 'hi' ? 'मूवी वीडियो अपलोड करें' : 'Upload Movie Video')}
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate">
                {media.videoDurationSec > 0 ? `${formatCompactTime(media.videoDurationSec)} · MP4 / WebM` : 'MP4, WebM, MOV'}
              </div>
            </div>
          </div>
          <span className="text-xs font-medium text-amber-400 shrink-0 flex items-center gap-1">
            <Upload className="h-3.5 w-3.5" />
            <span>{lang === 'hi' ? 'चुनें' : 'Select'}</span>
          </span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadVideo(f);
            }}
          />
        </label>

        {/* SRT Upload + Paste */}
        <div className="flex flex-col gap-2">
          <div className="flex items-stretch gap-2">
            <label className="flex-1 flex items-center justify-between gap-2 rounded-lg border border-[#2A3343] bg-[#181D27] px-3 py-2.5 hover:border-slate-500 transition-colors cursor-pointer min-h-[48px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {media.srtFileName || (lang === 'hi' ? '.SRT फाइल अपलोड करें' : 'Upload .SRT Subtitle')}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    {cuesCount > 0 ? `${cuesCount} dialogue cues` : 'Standard .srt timing'}
                  </div>
                </div>
              </div>
              <Upload className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <input
                type="file"
                accept=".srt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadSrt(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setShowSrtPaste((s) => !s)}
              className="min-h-[48px] rounded-lg border border-[#2A3343] bg-[#181D27] px-3 text-xs font-medium text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
            >
              {lang === 'hi' ? 'पेस्ट SRT' : 'Paste SRT'}
            </button>
          </div>

          {showSrtPaste && (
            <div className="flex flex-col gap-2 rounded-lg border border-[#2A3343] bg-[#0F131B] p-2.5">
              <textarea
                rows={4}
                value={rawSrtInput}
                onChange={(e) => setRawSrtInput(e.target.value)}
                placeholder={'1\n00:00:01,000 --> 00:00:03,500\nSample dialogue text'}
                className="w-full rounded border border-[#242B38] bg-[#0B0E14] p-2 font-mono text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSrtPaste(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyRawSrtText(rawSrtInput);
                    setShowSrtPaste(false);
                  }}
                  className="rounded bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  {lang === 'hi' ? 'SRT लागू करें' : 'Apply SRT'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Dubbed Audio Upload (Continuous Time vs Concatenated Lines) */}
      <div className="rounded-xl border border-[#242B38] bg-[#12161F] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            {lang === 'hi' ? 'डब ऑडियो मोड' : 'Dubbed Audio Mode'}
          </h2>
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={media.pitchPreserve}
              onChange={(e) => onTogglePitchPreserve(e.target.checked)}
              className="accent-teal-400"
            />
            <span>{lang === 'hi' ? 'पिच सुरक्षित (WSOLA)' : 'Preserve Pitch'}</span>
          </label>
        </div>

        {/* Mode Segmented Toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#0B0E14] p-1 border border-[#242B38]">
          <button
            type="button"
            onClick={() => onChangeDubMode('continuous')}
            className={`min-h-[38px] rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              media.dubMode === 'continuous'
                ? 'bg-[#1E2634] text-teal-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {lang === 'hi' ? 'Continuous समय' : 'Continuous Time'}
          </button>
          <button
            type="button"
            onClick={() => onChangeDubMode('concatenated')}
            className={`min-h-[38px] rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              media.dubMode === 'concatenated'
                ? 'bg-[#1E2634] text-teal-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {lang === 'hi' ? 'Concatenated लाइनें' : 'Concatenated Lines'}
          </button>
        </div>

        {media.dubMode === 'continuous' ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">
                {lang === 'hi' ? 'स्लाइसिंग तरीका:' : 'Align Strategy:'}
              </span>
              <select
                value={media.continuousStrategy}
                onChange={(e) => onChangeContinuousStrategy(e.target.value as ContinuousAlignStrategy)}
                className="rounded border border-[#2A3343] bg-[#181D27] px-2 py-1 text-xs text-slate-200 focus:border-teal-400 focus:outline-none"
              >
                <option value="silence-split">
                  {lang === 'hi' ? 'साइलेंस से वाक्य पहचानें (Auto atempo)' : 'Auto Silence-Split + atempo Fit'}
                </option>
                <option value="srt-slice">
                  {lang === 'hi' ? 'सीधे SRT समय पर काटें (1.0x)' : 'Direct SRT Window Slice (1.0x)'}
                </option>
              </select>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-teal-500/30 bg-teal-500/5 px-3 py-2.5 hover:border-teal-400/60 transition-colors cursor-pointer min-h-[48px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileAudio className="h-4 w-4 text-teal-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-100 truncate">
                    {media.dubMasterFileName || (lang === 'hi' ? 'Continuous डब ऑडियो चुनें' : 'Upload Continuous Dub Audio')}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    {media.dubMasterBuffer
                      ? `${formatCompactTime(media.dubMasterBuffer.duration)} · ${detectedRegionsCount} detected`
                      : 'WAV, MP3, M4A, OGG'}
                  </div>
                </div>
              </div>
              <Upload className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadDubMaster(f);
                }}
              />
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs text-slate-400 leading-relaxed">
              {lang === 'hi'
                ? 'एक साथ जुड़ी ऑडियो अपलोड करें (साइलेंस से स्वतः कट जाएगी) या कई अलग-अलग लाइन फाइलें एक साथ चुनें।'
                : 'Upload one joined audio file (auto-split by silence) OR select multiple individual line clips at once.'}
            </p>

            {/* Option A: Single Joined Concatenated Audio */}
            <label className="flex items-center justify-between gap-3 rounded-lg border border-teal-500/30 bg-teal-500/5 px-3 py-2.5 hover:border-teal-400/60 transition-colors cursor-pointer min-h-[46px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileAudio className="h-4 w-4 text-teal-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-100 truncate">
                    {media.dubMasterFileName || (lang === 'hi' ? 'एक Concatenated ऑडियो फाइल' : 'Single Concatenated Audio')}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    {media.dubMasterBuffer
                      ? `${detectedRegionsCount} lines split → ${cuesCount} SRT cues`
                      : 'Auto-splits by silence gaps'}
                  </div>
                </div>
              </div>
              <Upload className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadDubMaster(f);
                }}
              />
            </label>

            {/* Option B: Batch Multi-Line Audio Clips */}
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[#2A3343] bg-[#181D27] px-3 py-2.5 hover:border-slate-500 transition-colors cursor-pointer min-h-[46px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <Upload className="h-4 w-4 text-slate-300 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {lang === 'hi' ? 'मल्टीपल लाइन फाइलें जोड़ें (Batch)' : 'Batch Upload Line Clips (Multi-File)'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {lang === 'hi' ? 'line_01.wav, line_02.wav...' : 'Maps sorted files 1-to-1 to SRT'}
                  </div>
                </div>
              </div>
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onUploadMultiLineClips(e.target.files);
                  }
                }}
              />
            </label>
          </div>
        )}

        {/* Automatic Silence Calibration Status + Optional Manual Override */}
        {(media.dubMode === 'concatenated' || media.continuousStrategy === 'silence-split') && (
          <div className="flex flex-col gap-2.5 pt-2 border-t border-[#242B38]">
            <div className="flex items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-2 text-slate-200 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={silenceConfig.autoCalibrate}
                  onChange={(e) => onUpdateSilenceConfig({ autoCalibrate: e.target.checked })}
                  className="accent-teal-400"
                />
                <span>
                  {lang === 'hi'
                    ? 'ऑटो-स्प्लिट और SRT फिट (Auto)'
                    : 'Auto-Split & Fit to SRT (Zero Manual)'}
                </span>
              </label>
              {silenceConfig.autoCalibrate && (
                <span className="font-mono text-[11px] text-teal-300">
                  {silenceConfig.thresholdDb} dB · {silenceConfig.minSilenceMs} ms
                </span>
              )}
            </div>

            {!silenceConfig.autoCalibrate && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>{lang === 'hi' ? 'साइलेंस सीमा' : 'Silence Thresh'}</span>
                    <span className="font-mono">{silenceConfig.thresholdDb} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-50}
                    max={-15}
                    step={1}
                    value={silenceConfig.thresholdDb}
                    onChange={(e) => onUpdateSilenceConfig({ thresholdDb: parseInt(e.target.value, 10) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>{lang === 'hi' ? 'न्यूनतम गैप' : 'Min Gap'}</span>
                    <span className="font-mono">{silenceConfig.minSilenceMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min={120}
                    max={1200}
                    step={20}
                    value={silenceConfig.minSilenceMs}
                    onChange={(e) => onUpdateSilenceConfig({ minSilenceMs: parseInt(e.target.value, 10) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Background Music / Song (Plays in Dialogue-Free Gaps & Ducks Under Dialogue) */}
      <div className="rounded-xl border border-[#242B38] bg-[#12161F] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#242B38] pb-2">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            {lang === 'hi' ? 'बैकग्राउंड म्यूजिक (गैप फिल)' : 'Background Music & Ducking'}
          </h2>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={!bgm.muted}
              onChange={(e) => onUpdateBgm({ muted: !e.target.checked })}
              className="accent-indigo-400"
            />
            <span>{lang === 'hi' ? 'चालू' : 'Active'}</span>
          </label>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-3 py-2.5 hover:border-indigo-400/60 transition-colors cursor-pointer min-h-[46px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Music className="h-4 w-4 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-100 truncate">
                {bgm.fileName || (lang === 'hi' ? 'BGM सॉन्ग / म्यूजिक अपलोड करें' : 'Upload Background Music / Song')}
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate">
                {bgm.buffer
                  ? `${formatCompactTime(bgm.buffer.duration)} · Plays in non-dialogue gaps`
                  : 'Plays automatically where no dialogue exists'}
              </div>
            </div>
          </div>
          <Upload className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadBgm(f);
            }}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>{lang === 'hi' ? 'गैप वॉल्यूम' : 'Gap Volume'}</span>
              <span className="font-mono text-indigo-300">{Math.round(bgm.gapVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bgm.gapVolume}
              onChange={(e) => onUpdateBgm({ gapVolume: parseFloat(e.target.value) })}
              className="w-full accent-indigo-400 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>{lang === 'hi' ? 'डायलॉग के नीचे' : 'Under Speech'}</span>
              <span className="font-mono text-indigo-300">{Math.round(bgm.duckVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.6}
              step={0.02}
              value={bgm.duckVolume}
              onChange={(e) => onUpdateBgm({ duckVolume: parseFloat(e.target.value) })}
              className="w-full accent-indigo-400 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={bgm.loop}
              onChange={(e) => onUpdateBgm({ loop: e.target.checked })}
              className="accent-indigo-400"
            />
            <span>{lang === 'hi' ? 'लूप बैकग्राउंड सॉन्ग' : 'Loop BGM Track'}</span>
          </label>
          <span className="font-mono">Fade: {bgm.duckFadeMs}ms</span>
        </div>
      </div>

      {/* 4. Selected Cue Inspector */}
      {selectedSegment && (
        <div className="rounded-xl border border-[#242B38] bg-[#12161F] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#242B38] pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5 text-amber-400" />
              <h3 className="font-display text-sm font-semibold text-slate-100">
                {lang === 'hi' ? `क्यू #${selectedSegment.index} एडजस्टमेंट` : `Cue #${selectedSegment.index} Inspector`}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onAutoFitCue(selectedSegment.id)}
              className="text-xs font-medium text-teal-300 hover:text-teal-200 cursor-pointer"
            >
              {lang === 'hi' ? 'ऑटो-फिट' : 'Auto-Fit'}
            </button>
          </div>

          <p className="text-xs text-slate-300 bg-[#0B0E14] rounded-md p-2.5 border border-[#242B38] leading-relaxed">
            {selectedSegment.text}
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
            <div>
              SRT: {formatCompactTime(selectedSegment.startSec)} → {formatCompactTime(selectedSegment.endSec)}
            </div>
            <div className="text-right">
              Src: {(selectedSegment.sourceEndSec - selectedSegment.sourceStartSec).toFixed(2)}s
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">atempo Speed</span>
              <span className="font-mono text-amber-300">{selectedSegment.atempo.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.2}
              step={0.02}
              value={selectedSegment.atempo}
              onChange={(e) =>
                onUpdateSegment(selectedSegment.id, {
                  atempo: parseFloat(e.target.value),
                  manualOverride: true,
                })
              }
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
        </div>
      )}
    </aside>
  );
};
