import React, { useState } from 'react';
import { ANALYZED_TOOLS, FREE_COMPANION_TOOLS, ToolAnalysisItem } from '../data/toolsAnalysis';
import { UILanguage } from '../types/dubbing';

interface ToolsAnalysisViewProps {
  lang: UILanguage;
}

export const ToolsAnalysisView: React.FC<ToolsAnalysisViewProps> = ({ lang }) => {
  const [device, setDevice] = useState<'android' | 'pc'>('android');
  const [audioSource, setAudioSource] = useState<'continuous' | 'concatenated'>('concatenated');
  const [needBgmExtract, setNeedBgmExtract] = useState<boolean>(true);

  const recommendedSteps =
    device === 'android'
      ? [
          needBgmExtract
            ? lang === 'hi'
              ? '1. मूवी से बैकग्राउंड म्यूजिक अलग करने के लिए ऑनलाइन या PC पर UVR5 / Demucs (फ्री) से M&E (Instrumental) ट्रैक निकालें।'
              : '1. Extract clean Background Music & SFX from the original movie using UVR5 / Demucs (100% Free).'
            : lang === 'hi'
            ? '1. अपनी .srt फाइल और डब की हुई ऑडियो (Continuous या Concatenated) तैयार रखें।'
            : '1. Prepare your .srt file and dubbed audio (Continuous or Concatenated lines).',
          audioSource === 'concatenated'
            ? lang === 'hi'
              ? '2. DubSync Studio (इसी ऐप) में "Concatenated Lines" चुनकर डब ऑडियो अपलोड करें — साइलेंस से हर लाइन अपने आप कटकर SRT टाइम में फिट हो जाएगी।'
              : '2. Upload your joined lines into DubSync Studio ("Concatenated Lines") to auto-split by silence and compute per-segment atempo.'
            : lang === 'hi'
            ? '2. DubSync Studio में "Continuous Time" + Auto Silence-Split से हर वाक्य को SRT के साथ सिंक करें।'
            : '2. Upload your recording into DubSync Studio ("Continuous Time" + Auto Silence-Split) to align each sentence to SRT.',
          lang === 'hi'
            ? '3. बैकग्राउंड म्यूजिक अपलोड करें (डायलॉग के बीच के खाली समय में BGM अपने आप 100% वॉल्यूम पर चलेगा)।'
            : '3. Load your Background Music track so dialogue-free gaps automatically fill with full-volume music and duck smoothly under speech.',
          lang === 'hi'
            ? '4. छोटी क्लिप के लिए सीधे .WAV/.WebM एक्सपोर्ट करें, या पूरी 2-घंटे की मूवी के लिए यहां से FFmpeg .sh स्क्रिप्ट डाउनलोड करके Android Termux (`pkg install ffmpeg`) में 30 सेकंड में बिना वीडियो क्वालिटी घटाए मर्ज करें।'
            : '4. Export .WAV / .WebM directly for short clips, or download the generated FFmpeg .sh script and run it inside Android Termux (`pkg install ffmpeg`) for lossless `-c:v copy` movie rendering in seconds.',
        ]
      : [
          needBgmExtract
            ? lang === 'hi'
              ? '1. मूवी से असली म्यूजिक निकालने के लिए UVR5 / Demucs (ओपन-सोर्स, फ्री) चलाएं और Subtitle Edit से .srt की टाइमिंग जांच लें।'
              : '1. Run UVR5 / Demucs (free open-source) to extract the movie’s original M&E music track, and verify .srt cues in Subtitle Edit.'
            : lang === 'hi'
            ? '1. Subtitle Edit (फ्री) से .srt फाइल चेक करें या pyVideoTrans से नई AI डबिंग जनरेट करें।'
            : '1. Clean your .srt cues in Subtitle Edit (free) or generate AI voice tracks via pyVideoTrans.',
          audioSource === 'concatenated'
            ? lang === 'hi'
              ? '2. Audacity के "Label Sounds" या सीधे DubSync Studio से सभी डब लाइनों को .srt के अनुसार फिट करें।'
              : '2. Split and fit your concatenated lines to SRT slots directly inside DubSync Studio (with WSOLA pitch preservation).'
            : lang === 'hi'
            ? '2. लंबी Continuous ऑडियो को Aeneas/WhisperX या DubSync Silence-Split से SRT टाइमस्टैम्प से जोड़ें।'
            : '2. Align your continuous dub track using DubSync Silence-Split or Aeneas/WhisperX forced alignment.',
          lang === 'hi'
            ? '3. तेज और बिना लॉस वाले आउटपुट के लिए FFmpeg (`rubberband` / `atempo`) स्क्रिप्ट चलाएं, या प्रीमियर/DaVinci Resolve (फ्री) में फाइन-मिक्स करने के लिए FCPXML एक्सपोर्ट करें।'
            : '3. Run the exported FFmpeg (`rubberband` / `atempo`) script for instant lossless MP4 muxing, OR export FCPXML directly into DaVinci Resolve Free / Premiere Pro for Fairlight cinema mastering.',
        ];

  const renderToolCard = (tool: ToolAnalysisItem) => (
    <article
      key={tool.id}
      className="rounded-xl border border-[#242B38] bg-[#12161F] p-5 flex flex-col justify-between gap-4"
    >
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#242B38] pb-3">
          <h3 className="font-display text-base font-semibold text-slate-100">{tool.name}</h3>
          <span className="text-xs font-mono text-slate-400">
            {tool.category} · {tool.cost} · {tool.androidSupport}
          </span>
        </div>

        <p className="mt-3 text-xs font-medium text-amber-300">
          {tool.bestFor}
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-teal-300 mb-1.5">
              {lang === 'hi' ? 'मजबूत पक्ष (Strengths)' : 'Strengths'}
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed list-disc pl-4">
              {(lang === 'hi' ? tool.strengthsHi : tool.strengthsEn).map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-rose-300 mb-1.5">
              {lang === 'hi' ? 'सीमाएं (Limitations)' : 'Limitations'}
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-400 leading-relaxed list-disc pl-4">
              {(lang === 'hi' ? tool.limitationsHi : tool.limitationsEn).map((l, idx) => (
                <li key={idx}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-[#242B38] pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-200 leading-relaxed">
          <strong className="text-slate-100">{lang === 'hi' ? 'निष्कर्ष: ' : 'Verdict: '}</strong>
          {lang === 'hi' ? tool.verdictHi : tool.verdictEn}
        </span>
        <span className="font-mono text-slate-400 shrink-0">{tool.speedRating}</span>
      </div>
    </article>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Interactive Free Workflow Recommender */}
      <section className="rounded-xl border border-[#242B38] bg-[#12161F] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#242B38] pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-100">
              {lang === 'hi'
                ? 'आपके काम के लिए सबसे तेज फ्री वर्कफ़्लो सलाहकार'
                : 'Fastest Free Dubbing Workflow Advisor'}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {lang === 'hi'
                ? 'अपना डिवाइस और ऑडियो प्रकार चुनें — कम समय में बिना पैसे खर्च किए बेहतरीन मूवी डबिंग पाएं।'
                : 'Select your device and dub audio format to get the fastest zero-cost pipeline.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-[#0B0E14] p-1 border border-[#242B38]">
              <button
                type="button"
                onClick={() => setDevice('android')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  device === 'android' ? 'bg-[#1E2634] text-amber-300' : 'text-slate-400'
                }`}
              >
                Android Phone
              </button>
              <button
                type="button"
                onClick={() => setDevice('pc')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  device === 'pc' ? 'bg-[#1E2634] text-amber-300' : 'text-slate-400'
                }`}
              >
                Windows / Mac / Linux
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-[#0B0E14] p-1 border border-[#242B38]">
              <button
                type="button"
                onClick={() => setAudioSource('concatenated')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  audioSource === 'concatenated' ? 'bg-[#1E2634] text-teal-300' : 'text-slate-400'
                }`}
              >
                Concatenated Lines
              </button>
              <button
                type="button"
                onClick={() => setAudioSource('continuous')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                  audioSource === 'continuous' ? 'bg-[#1E2634] text-teal-300' : 'text-slate-400'
                }`}
              >
                Continuous Audio
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={needBgmExtract}
                onChange={(e) => setNeedBgmExtract(e.target.checked)}
                className="accent-indigo-400"
              />
              <span>{lang === 'hi' ? 'मूवी से BGM अलग करना है' : 'Extract BGM from Movie'}</span>
            </label>
          </div>
        </div>

        <ol className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {recommendedSteps.map((step, i) => (
            <li
              key={i}
              className="rounded-lg border border-[#242B38] bg-[#0B0E14] px-4 py-3 text-xs text-slate-200 leading-relaxed"
            >
              {step}
            </li>
          ))}
        </ol>
      </section>

      {/* Main Comparison: User's Listed Tools */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-100">
            {lang === 'hi'
              ? 'आपके द्वारा देखे गए टूल्स का तकनीकी विश्लेषण'
              : 'Technical Analysis of Selected Dubbing & Editing Tools'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {lang === 'hi'
              ? 'pyVideoTrans, FFmpeg + atempo, CapCut और Premiere / DaVinci Resolve की तुलना।'
              : 'Comparison across automation, Android compatibility, SRT audio fitting, and export speed.'}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ANALYZED_TOOLS.map(renderToolCard)}
        </div>
      </section>

      {/* Additional Free Open-Source Tools */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-100">
            {lang === 'hi'
              ? 'अन्य बेहतरीन 100% फ्री टूल्स (कम समय और बेहतर क्वालिटी के लिए)'
              : 'Additional 100% Free & Open-Source Tools to Speed Up Your Workflow'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {lang === 'hi'
              ? 'ये फ्री टूल्स बैकग्राउंड म्यूजिक निकालने, SRT सुधारने और ऑडियो क्लियर करने में आपका 80% समय बचाते हैं।'
              : 'Zero-cost companion utilities for M&E music extraction, SRT cleanup, and forced alignment.'}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {FREE_COMPANION_TOOLS.map(renderToolCard)}
        </div>
      </section>
    </div>
  );
};
