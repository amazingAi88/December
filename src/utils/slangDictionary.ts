import { DialogueStyle, SlangDictionaryConfig, SlangOverrideRule } from '../types/studio';

const SLANG_STORAGE_KEY = 'hindi_dub_slang_dictionary_v1';

export function getDefaultSlangConfig(): SlangDictionaryConfig {
  return {
    version: 1,
    enabled: true,
    rules: [
      {
        id: 'slang_wtf',
        sourceTerm: 'what the fuck',
        hindiReplacement: 'ये क्या बकचोदी है',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Shock / disbelief colloquial phrase',
      },
      {
        id: 'slang_fuck_off',
        sourceTerm: 'fuck off',
        hindiReplacement: 'चल निकल भोसड़ीके',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Aggressive street dismissal',
      },
      {
        id: 'slang_fuck_you',
        sourceTerm: 'fuck you',
        hindiReplacement: 'भाड़ में जा मादरचोद',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Confrontational curse',
      },
      {
        id: 'slang_mf',
        sourceTerm: 'motherfucker',
        hindiReplacement: 'मादरचोद',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Heavy crime / action cinema slang',
      },
      {
        id: 'slang_mf_spaced',
        sourceTerm: 'mother fucker',
        hindiReplacement: 'मादरचोद',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Spaced STT transcription variant',
      },
      {
        id: 'slang_fucker',
        sourceTerm: 'fucker',
        hindiReplacement: 'चुतिया',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Overrides textbook translation',
      },
      {
        id: 'slang_fuck_intimate',
        sourceTerm: 'fuck',
        hindiReplacement: 'चोदना',
        contextKeywords: ['bed', 'sex', 'wanna', 'want', 'baby', 'babe', 'tonight', 'hard', 'kiss', 'body', 'touch', 'naked', 'pussy', 'cock'],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Erotic / intimate scene context',
      },
      {
        id: 'slang_fuck_anger',
        sourceTerm: 'fuck',
        hindiReplacement: 'बकचोदी',
        contextKeywords: ['hell', 'shit', 'damn', 'wrong', 'happened', 'shut', 'man'],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Anger / frustration context',
      },
      {
        id: 'slang_fuck_default',
        sourceTerm: 'fuck',
        hindiReplacement: 'चोदना',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Uncensored fallback',
      },
      {
        id: 'slang_fucking_intimate',
        sourceTerm: 'fucking',
        hindiReplacement: 'चोदने',
        contextKeywords: ['bed', 'sex', 'hard', 'slow', 'fast', 'hot', 'her', 'him'],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Intimate scene action',
      },
      {
        id: 'slang_fucking_default',
        sourceTerm: 'fucking',
        hindiReplacement: 'बहनचोद',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Colloquial emphasis intensifier',
      },
      {
        id: 'slang_bullshit',
        sourceTerm: 'bullshit',
        hindiReplacement: 'बकचोदी',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Informal dismissal',
      },
      {
        id: 'slang_asshole',
        sourceTerm: 'asshole',
        hindiReplacement: 'गांडू',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Street insult',
      },
      {
        id: 'slang_sob',
        sourceTerm: 'son of a bitch',
        hindiReplacement: 'कुत्ते की औलाद',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Dramatic confrontation',
      },
      {
        id: 'slang_bitch_adult',
        sourceTerm: 'bitch',
        hindiReplacement: 'रंडी',
        contextKeywords: ['pay', 'money', 'bed', 'cheap', 'whore', 'slut', 'night', 'strip'],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Adult / nightlife scene context',
      },
      {
        id: 'slang_bitch_default',
        sourceTerm: 'bitch',
        hindiReplacement: 'कुतिया',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'General confrontation',
      },
      {
        id: 'slang_bastard',
        sourceTerm: 'bastard',
        hindiReplacement: 'हरामी',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'OTT crime / villain slang',
      },
      {
        id: 'slang_pussy_adult',
        sourceTerm: 'pussy',
        hindiReplacement: 'चूत',
        contextKeywords: ['wet', 'lick', 'fuck', 'tight', 'touch', 'eat', 'spread'],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Adult / intimate scene context',
      },
      {
        id: 'slang_pussy_coward',
        sourceTerm: 'pussy',
        hindiReplacement: 'फट्टू',
        contextKeywords: ['scared', 'afraid', 'coward', 'run', 'hide', 'weak', 'cry'],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Cowardice slang context',
      },
      {
        id: 'slang_cock',
        sourceTerm: 'cock',
        hindiReplacement: 'लंड',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Adult anatomical slang',
      },
      {
        id: 'slang_dick_adult',
        sourceTerm: 'dick',
        hindiReplacement: 'लंड',
        contextKeywords: ['suck', 'lick', 'hard', 'big', 'wet', 'mouth', 'throat'],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Adult / intimate context',
      },
      {
        id: 'slang_dick_insult',
        sourceTerm: 'dick',
        hindiReplacement: 'लौड़े',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Casual insult fallback',
      },
      {
        id: 'slang_screw_you',
        sourceTerm: 'screw you',
        hindiReplacement: 'भाड़ में जा',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Informal dismissal',
      },
      {
        id: 'slang_what_the_hell',
        sourceTerm: 'what the hell',
        hindiReplacement: 'ये क्या बकवास है',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Casual frustration',
      },
      {
        id: 'slang_badass',
        sourceTerm: 'badass',
        hindiReplacement: 'दबंग',
        contextKeywords: [],
        dialogueStyles: [],
        wholeWord: true,
        enabled: true,
        note: 'Bollywood action colloquialism',
      },
    ],
  };
}

export function loadSlangConfig(): SlangDictionaryConfig {
  try {
    const raw = localStorage.getItem(SLANG_STORAGE_KEY);
    if (!raw) {
      const defaults = getDefaultSlangConfig();
      localStorage.setItem(SLANG_STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw) as SlangDictionaryConfig;
    if (!parsed || !Array.isArray(parsed.rules)) {
      return getDefaultSlangConfig();
    }
    return parsed;
  } catch {
    return getDefaultSlangConfig();
  }
}

export function saveSlangConfig(config: SlangDictionaryConfig): SlangDictionaryConfig {
  localStorage.setItem(SLANG_STORAGE_KEY, JSON.stringify(config));
  return config;
}

export function resetSlangConfig(): SlangDictionaryConfig {
  return saveSlangConfig(getDefaultSlangConfig());
}

export interface MatchedSlangRule {
  rule: SlangOverrideRule;
  startIndex: number;
  endIndex: number;
  matchedText: string;
  contextMatchCount: number;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveSlangMatches(params: {
  config: SlangDictionaryConfig;
  englishText: string;
  prevContext?: string;
  nextContext?: string;
  emotion?: string;
  dialogueStyle?: string;
}): MatchedSlangRule[] {
  const { config, englishText, prevContext = '', nextContext = '', emotion = '', dialogueStyle = '' } = params;
  if (!config.enabled || !englishText.trim()) return [];

  const fullContext = `${prevContext} ${englishText} ${nextContext} ${emotion}`.toLowerCase();

  const candidateRules = config.rules.filter((rule) => {
    if (!rule.enabled) return false;
    if (rule.dialogueStyles.length > 0 && dialogueStyle) {
      if (!rule.dialogueStyles.includes(dialogueStyle)) return false;
    }
    return true;
  });

  // Sort by: context specificity first, then longer sourceTerm first
  const scored = candidateRules
    .map((rule) => {
      const ctxHits = rule.contextKeywords.filter((kw) =>
        fullContext.includes(kw.toLowerCase())
      ).length;
      if (rule.contextKeywords.length > 0 && ctxHits === 0) {
        return null;
      }
      return { rule, ctxHits };
    })
    .filter((x): x is { rule: SlangOverrideRule; ctxHits: number } => x !== null)
    .sort((a, b) => {
      if (b.ctxHits !== a.ctxHits) return b.ctxHits - a.ctxHits;
      return b.rule.sourceTerm.length - a.rule.sourceTerm.length;
    });

  const matches: MatchedSlangRule[] = [];
  const occupied: Array<[number, number]> = [];

  for (const { rule, ctxHits } of scored) {
    const escaped = escapeRegExp(rule.sourceTerm.trim());
    const pattern = rule.wholeWord ? `\\b${escaped}\\b` : escaped;
    const regex = new RegExp(pattern, 'gi');
    let m: RegExpExecArray | null;
    while ((m = regex.exec(englishText)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = occupied.some(([s, e]) => !(end <= s || start >= e));
      if (!overlaps) {
        occupied.push([start, end]);
        matches.push({
          rule,
          startIndex: start,
          endIndex: end,
          matchedText: m[0],
          contextMatchCount: ctxHits,
        });
      }
    }
  }

  return matches.sort((a, b) => a.startIndex - b.startIndex);
}

export function buildPromptGlossaryHints(matches: MatchedSlangRule[]): string {
  if (matches.length === 0) return '';
  const unique = new Map<string, SlangOverrideRule>();
  for (const m of matches) {
    unique.set(m.rule.sourceTerm.toLowerCase(), m.rule);
  }
  const lines = Array.from(unique.values()).map(
    (r) => `- "${r.sourceTerm}" => "${r.hindiReplacement}"${r.note ? ` (${r.note})` : ''}`
  );
  return `Mandatory Slang & Colloquial Override Glossary (use these exact Hindi Devanagari terms when these English expressions appear):\n${lines.join('\n')}`;
}

export function applyDirectSlangReplacement(
  englishText: string,
  matches: MatchedSlangRule[]
): string | null {
  if (matches.length === 0) return null;
  const trimmed = englishText.trim();
  if (
    matches.length === 1 &&
    matches[0].matchedText.trim().toLowerCase() === trimmed.toLowerCase()
  ) {
    return matches[0].rule.hindiReplacement;
  }
  return null;
}

/**
 * Fallback local rule-based Hindi translation when user selects On-Device / Dictionary mode without Cloud API
 */
export function localTranslateWithDictionary(
  englishText: string,
  config: SlangDictionaryConfig,
  dialogueStyle: string
): { hindiText: string; usedDictionary: boolean } {
  const matches = resolveSlangMatches({
    config,
    englishText,
    dialogueStyle,
  });
  const direct = applyDirectSlangReplacement(englishText, matches);
  if (direct) {
    return { hindiText: direct, usedDictionary: true };
  }

  if (matches.length > 0) {
    let out = '';
    let cursor = 0;
    for (const m of matches) {
      out += englishText.slice(cursor, m.startIndex);
      out += m.rule.hindiReplacement;
      cursor = m.endIndex;
    }
    out += englishText.slice(cursor);
    return { hindiText: out, usedDictionary: true };
  }

  // Basic conversational phrase map for quick offline testing
  const basicPhrases: Record<string, string> = {
    "don't worry, we will get out of here before sunset.": 'चिंता मत करो, हम सूरज ढलने से पहले यहाँ से निकल जाएंगे।',
    'what the hell are you doing, man?': 'ये क्या बकवास कर रहे हो यार?',
    'who are you?': 'कौन हो तुम?',
    'listen to me carefully.': 'मेरी बात ध्यान से सुनो।',
    'get out of here!': 'यहाँ से निकलो!',
    "it's too late now.": 'अब बहुत देर हो चुकी है।',
  };
  const key = englishText.trim().toLowerCase();
  if (basicPhrases[key]) {
    return { hindiText: basicPhrases[key], usedDictionary: false };
  }

  return {
    hindiText:
      dialogueStyle === DialogueStyle.CINEMATIC
        ? `(${englishText.trim()}) — [स्थानीय डब मोड: सटीक हिंदी अनुवाद के लिए Gemini Cloud चुनें]`
        : `${englishText.trim()}`,
    usedDictionary: false,
  };
}
