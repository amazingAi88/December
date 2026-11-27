export interface ToolAnalysisItem {
  id: string;
  name: string;
  category: 'Open Source' | 'CLI Engine' | 'Mobile & Desktop NLE' | 'Pro NLE' | 'Free Companion';
  cost: string;
  androidSupport: 'Native App' | 'Termux CLI' | 'Web / Browser' | 'Desktop Only';
  bestFor: string;
  strengthsEn: string[];
  strengthsHi: string[];
  limitationsEn: string[];
  limitationsHi: string[];
  speedRating: string;
  verdictEn: string;
  verdictHi: string;
}

export const ANALYZED_TOOLS: ToolAnalysisItem[] = [
  {
    id: 'pyvideotrans',
    name: 'pyVideoTrans',
    category: 'Open Source',
    cost: '100% Free (GPLv3)',
    androidSupport: 'Desktop Only',
    bestFor: 'Full automated movie translation (Whisper + Translate + TTS + Auto-fit)',
    strengthsEn: [
      'Complete end-to-end pipeline: Speech-to-Text, SRT generation, TTS dubbing, and automatic speed alignment.',
      'Built-in FFmpeg atempo acceleration & audio-video duration matching.',
      'Supports local models (Faster-Whisper, Edge-TTS, GPT-SoVITS) with zero API cost.',
    ],
    strengthsHi: [
      'पूरी तरह ऑटोमेटिक पाइपलाइन: वीडियो से SRT बनाना, अनुवाद करना, TTS डबिंग और स्पीड फिटिंग एक साथ।',
      'इन-बिल्ट FFmpeg atempo सपोर्ट जिससे डायलॉग अपने आप सीन के समय में फिट होते हैं।',
      'पूरी तरह फ्री और ऑफलाइन लोकल मॉडल (Whisper, Edge-TTS) के साथ बिना API खर्च के चलता है।',
    ],
    limitationsEn: [
      'Requires Windows/Linux PC (heavy Python + CUDA dependencies); cannot run natively on Android phones.',
      'Manual custom dub-track replacement & fine BGM gap-ducking control is limited compared to an NLE timeline.',
    ],
    limitationsHi: [
      'केवल PC/Windows/Linux पर चलता है (Python व CUDA सेटअप भारी है); Android मोबाइल पर सीधे नहीं चलता।',
      'पहले से रिकॉर्ड की गई कस्टम डब ऑडियो और BGM गैप-डकिंग को बारीकी से एडिट करने की सुविधा सीमित है।',
    ],
    speedRating: 'Fast batch (PC GPU)',
    verdictEn: 'Best open-source PC automation when generating new AI dubs from scratch; pair with DubSync when fitting your own recorded dub files.',
    verdictHi: 'PC पर शुरू से AI डबिंग बनाने के लिए सर्वश्रेष्ठ ओपन-सोर्स टूल; अपनी रिकॉर्ड की हुई डब फाइल फिट करने के लिए इस ऐप के साथ उपयोग करें।',
  },
  {
    id: 'ffmpeg-atempo',
    name: 'FFmpeg + Per-Segment atempo',
    category: 'CLI Engine',
    cost: '100% Free (LGPL/GPL)',
    androidSupport: 'Termux CLI',
    bestFor: 'Lossless video stream copy + millisecond-accurate SRT audio fitting on PC & Android',
    strengthsEn: [
      'Copies original video stream (`-c:v copy`) without re-encoding — exports a 2-hour movie in under 30 seconds.',
      'Chained `atempo` + `adelay` + `amix` places every SRT dialogue segment with 1ms precision.',
      'Runs directly on Android inside Termux (`pkg install ffmpeg`) with zero watermarks or cloud upload.',
    ],
    strengthsHi: [
      'वीडियो को बिना री-एन्कोड किए (`-c:v copy`) 2 घंटे की मूवी 30 सेकंड में एक्सपोर्ट कर देता है।',
      '`atempo` + `adelay` + `amix` से हर SRT डायलॉग 1 मिलीसेकंड सटीकता के साथ फिट होता है।',
      'Android फोन पर Termux के जरिए बिना किसी वॉटरमार्क या इंटरनेट अपलोड के मुफ्त चलता है।',
    ],
    limitationsEn: [
      'Pure command-line tool: writing `filter_complex` manually for 500+ SRT cues is error-prone (solved by DubSync Export!).',
      'Standard `atempo` slightly shifts timbre above 1.4x unless compiled with `librubberband`.',
    ],
    limitationsHi: [
      'केवल कमांड-लाइन टूल है: 500+ SRT लाइनों के लिए मैन्युअल कमांड लिखना कठिन है (जिसे हमारा ऐप अपने आप जनरेट करता है)।',
      '1.4x से ज्यादा स्पीड पर साधारण `atempo` में आवाज थोड़ी बदल सकती है (`rubberband` से बेहतर परिणाम मिलते हैं)।',
    ],
    speedRating: 'Fastest (10x–30x realtime)',
    verdictEn: 'The gold-standard rendering engine underneath almost every dubbing tool. Use DubSync to visually align and export the exact FFmpeg script.',
    verdictHi: 'लगभग हर डबिंग टूल का असली इंजन। टाइमलाइन पर एडिट करके यहाँ से FFmpeg स्क्रिप्ट एक्सपोर्ट करना सबसे तेज तरीका है।',
  },
  {
    id: 'capcut',
    name: 'CapCut',
    category: 'Mobile & Desktop NLE',
    cost: 'Freemium (Pro features paid)',
    androidSupport: 'Native App',
    bestFor: 'Quick short-form reels & manual touch editing on Android',
    strengthsEn: [
      'Polished Android touch timeline with easy BGM keyframing and basic voice effects.',
      'Good visual preview and fast hardware-accelerated MP4 export on mobile.',
    ],
    strengthsHi: [
      'Android मोबाइल पर टच टाइमलाइन, आसान BGM वॉल्यूम एडजस्टमेंट और तेज MP4 एक्सपोर्ट।',
      'छोटी रील्स और 2-5 मिनट के क्लिप मैन्युअल एडिट करने के लिए बहुत सरल।',
    ],
    limitationsEn: [
      'Cannot auto-split & auto-stretch a continuous/concatenated dub track to 300+ SRT cue timestamps.',
      'Many useful features (auto-captions, vocal isolation, higher exports) are locked behind CapCut Pro subscription.',
    ],
    limitationsHi: [
      '300+ SRT लाइनों के हिसाब से एक लंबी या Concatenated डब ऑडियो को ऑटो-फिट नहीं कर सकता।',
      'वोकल आइसोलेशन और कई एडिटिंग टूल्स अब Pro सब्सक्रिप्शन के पीछे लॉक हैं।',
    ],
    speedRating: 'Manual (slow for full movies)',
    verdictEn: 'Great for final visual polish on Android shorts, but inefficient for syncing long SRT dialogue tracks manually.',
    verdictHi: 'शॉर्ट वीडियो के फाइनल टच के लिए अच्छा, लेकिन लंबी मूवी के SRT डायलॉग सिंक करने में बहुत समय लगता है।',
  },
  {
    id: 'premiere-davinci',
    name: 'Premiere Pro / DaVinci Resolve',
    category: 'Pro NLE',
    cost: 'DaVinci Free / Premiere Paid ($22.99/mo)',
    androidSupport: 'Desktop Only',
    bestFor: 'Cinema-grade mixing, Fairlight / Essential Sound auto-ducking & FCPXML workflows',
    strengthsEn: [
      'DaVinci Resolve Free has Fairlight audio mixer with studio-grade automatic BGM ducking & Elastique pitch-preserving stretch.',
      'Both Premiere & Resolve import FCPXML timelines (which DubSync exports directly!) so all SRT-aligned clips appear on tracks instantly.',
    ],
    strengthsHi: [
      'DaVinci Resolve (फ्री वर्जन) में Fairlight ऑटो-डकिंग और स्टूडियो-क्वालिटी पिच-प्रिजर्विंग टाइम स्ट्रेच मिलता है।',
      'दोनों FCPXML टाइमलाइन इम्पोर्ट करते हैं — इस ऐप से FCPXML एक्सपोर्ट कर सीधे सभी डायलॉग ट्रैक पर लाए जा सकते हैं।',
    ],
    limitationsEn: [
      'No Android version; requires high-RAM PC/Mac.',
      'Neither software natively reads a single concatenated dub audio + SRT and auto-slices + stretches every sentence without XML/scripts.',
    ],
    limitationsHi: [
      'Android पर उपलब्ध नहीं; भारी PC/Mac की आवश्यकता होती है।',
      'बिना XML या स्क्रिप्ट के खुद-ब-खुद concatenated ऑडियो को SRT से ऑटो-स्लाइस नहीं कर सकते।',
    ],
    speedRating: 'Pro Precision (Desktop)',
    verdictEn: 'Use DaVinci Resolve Free for final cinema audio mastering by importing the FCPXML timeline generated here.',
    verdictHi: 'प्रोफेशनल मूवी मिक्सिंग के लिए यहाँ से FCPXML एक्सपोर्ट करके DaVinci Resolve Free में खोलें।',
  },
];

export const FREE_COMPANION_TOOLS: ToolAnalysisItem[] = [
  {
    id: 'uvr5',
    name: 'UVR5 / Demucs (Vocal & BGM Separator)',
    category: 'Free Companion',
    cost: '100% Free & Open Source',
    androidSupport: 'Web / Browser',
    bestFor: 'Extracting clean original Background Music & Sound Effects (M&E track) from any movie',
    strengthsEn: [
      'Removes original actors’ voices cleanly while keeping original movie music, footsteps, and explosions intact!',
      'Upload the extracted instrumental track directly into DubSync’s Background Music slot for authentic cinema dubbing.',
    ],
    strengthsHi: [
      'असली मूवी से पुराने डायलॉग हटाकर सिर्फ बैकग्राउंड म्यूजिक और साउंड इफेक्ट्स (M&E ट्रैक) अलग कर देता है!',
      'निकाले गए इस म्यूजिक ट्रैक को सीधे इस ऐप के Background Music ट्रैक में डालकर असली थिएटर जैसा डब बना सकते हैं।',
    ],
    limitationsEn: [
      'AI stem separation takes 1–3 minutes per 10-minute clip on CPU (faster on GPU).',
    ],
    limitationsHi: [
      'लंबे वीडियो में AI से म्यूजिक अलग करने में PC CPU पर कुछ मिनट लगते हैं।',
    ],
    speedRating: 'Moderate (AI Stem Split)',
    verdictEn: 'Essential free companion: solves the biggest dubbing headache ("where do I get background music without original voice?").',
    verdictHi: 'सबसे जरूरी फ्री टूल: यह असली मूवी से ही बिना आवाज वाला बैकग्राउंड म्यूजिक निकाल कर देता है।',
  },
  {
    id: 'subtitle-edit',
    name: 'Subtitle Edit',
    category: 'Free Companion',
    cost: '100% Free & Open Source',
    androidSupport: 'Desktop Only',
    bestFor: 'Fixing shifted SRT timings, frame-rate sync, and visual waveform subtitle trimming',
    strengthsEn: [
      'Syncs an entire movie’s `.srt` file in 2 clicks using visual point-sync or Whisper speech recognition.',
      'Merges overly short subtitle lines so dubbing voices have natural breathing room without rushing.',
    ],
    strengthsHi: [
      'सिर्फ 2 क्लिक में पूरी मूवी की `.srt` टाइमिंग या FPS मिसमैच को ठीक कर देता है।',
      'बहुत छोटे डायलॉग को मर्ज करके डबिंग के लिए सही समय गैप तैयार करता है।',
    ],
    limitationsEn: ['Windows/Linux native (web viewer available).'],
    limitationsHi: ['मुख्य रूप से Windows/Linux सॉफ्टवेयर है।'],
    speedRating: 'Instant',
    verdictEn: 'Clean up your `.srt` lines in Subtitle Edit before loading into DubSync for dramatically better pacing.',
    verdictHi: 'डबिंग से पहले `.srt` को साफ और सही करने के लिए बेहतरीन फ्री सॉफ्टवेयर।',
  },
  {
    id: 'audacity',
    name: 'Audacity (Silence Finder & Truncate)',
    category: 'Free Companion',
    cost: '100% Free & Open Source',
    androidSupport: 'Desktop Only',
    bestFor: 'Batch-cleaning pauses, normalizing loudness (-16 LUFS), and splitting concatenated voice lines',
    strengthsEn: [
      'Analyze → Label Sounds detects all dialogue gaps in seconds; Export Multiple saves numbered `line_01.wav` clips.',
      'Built-in Compressor & Loudness Normalization makes amateur mic recordings sound studio-consistent.',
    ],
    strengthsHi: [
      'Label Sounds फीचर से लंबी डब रिकॉर्डिंग के सारे डायलॉग सेकंडों में अलग-अलग क्लिप (`line_01.wav`) बन जाते हैं।',
      'नॉइज रिमूवल और लाउडनेस नॉर्मलाइजेशन से आवाज बिल्कुल क्लियर हो जाती है।',
    ],
    limitationsEn: ['Does not auto-stretch clips to `.srt` timestamps on its own.'],
    limitationsHi: ['अपने आप `.srt` टाइमस्टैम्प से क्लिप को स्ट्रेच नहीं करता।'],
    speedRating: 'Fast',
    verdictEn: 'Best free audio pre-processor for cleaning noise & exporting individual lines.',
    verdictHi: 'डब ऑडियो की नॉइज हटाने और अलग-अलग लाइनें काटने के लिए सर्वश्रेष्ठ।',
  },
  {
    id: 'whisperx-aeneas',
    name: 'Aeneas / WhisperX (Forced Alignment)',
    category: 'Free Companion',
    cost: '100% Free & Open Source',
    androidSupport: 'Desktop Only',
    bestFor: 'Aligning a single continuous dubbed narration file to exact SRT timestamps automatically',
    strengthsEn: [
      'Given an audio recording + `.srt` text, Aeneas/WhisperX finds the exact millisecond each sentence starts & ends.',
      'Prevents drift across 1-hour+ continuous recordings where speakers pause differently.',
    ],
    strengthsHi: [
      'एक लंबी Continuous ऑडियो और `.srt` टेक्स्ट देने पर हर वाक्य का सटीक मिलीसेकंड टाइम खुद ढूंढ लेता है।',
      '1 घंटे से लंबी ऑडियो में भी टाइमिंग ड्रिफ्ट नहीं होने देता।',
    ],
    limitationsEn: ['Python CLI setup required.'],
    limitationsHi: ['Python CLI सेटअप की जरूरत होती है।'],
    speedRating: 'Fast',
    verdictEn: 'Best free forced-aligner when working with continuous unsplit voiceover recordings.',
    verdictHi: 'बिना कटी हुई लंबी Continuous डब ऑडियो को सटीक मैच करने के लिए बेहतरीन।',
  },
];
