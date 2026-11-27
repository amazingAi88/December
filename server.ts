import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapGeminiError(err: unknown, fallbackMsg: string): { status: number; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes('not configured') || lower.includes('api_key_invalid') || lower.includes('400')) {
    return { status: 400, error: message };
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return { status: 403, error: `Gemini permission denied. Check your API key in Settings > Secrets. (${message})` };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return { status: 429, error: `Gemini quota/rate limit reached (429). Switch to On-Device Free mode or wait and retry.` };
  }
  return { status: 500, error: `${fallbackMsg}: ${message}` };
}

const VALID_VOICES = new Set([
  'Charon',
  'Fenrir',
  'Orus',
  'Puck',
  'Kore',
  'Aoede',
  'Leda',
  'Zephyr',
]);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '45mb' }));

  app.use('/api', (_req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // 1. Transcribe & Diarize Movie Audio Chunk
  app.post('/api/dub/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType = 'audio/wav', chunkDurationMs = 30000, knownSpeakers = [] } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        chunkDurationMs?: number;
        knownSpeakers?: Array<{ speakerLabel: string; gender: string; traits: string }>;
      };

      if (!audioBase64) {
        res.status(400).json({ error: 'audioBase64 is required for transcription.' });
        return;
      }

      const ai = getGeminiClient();
      const knownHints =
        knownSpeakers.length > 0
          ? `Previously detected speakers in earlier chunks: ${knownSpeakers
              .map((s) => `${s.speakerLabel} (${s.gender}, ${s.traits})`)
              .join('; ')}. Reuse those speaker IDs if the same voices appear.`
          : '';

      const prompt = [
        `Analyze this ${chunkDurationMs}ms movie audio clip carefully.`,
        '1. Transcribe ALL spoken English dialogue accurately in strict chronological order.',
        '2. Identify distinct speakers (SPEAKER_1, SPEAKER_2, etc.) and infer their vocal gender (MALE, FEMALE, NEUTRAL) and traits.',
        `3. Provide exact startOffsetMs and endOffsetMs relative to the beginning of this clip (0 to ${chunkDurationMs}).`,
        '4. Mark overlapping dialogue with isOverlapping=true.',
        '5. Include significant non-speech intervals (MUSIC, SFX, SILENCE) so background music and effects are preserved.',
        knownHints,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              speakers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speakerId: { type: Type.STRING },
                    inferredGender: { type: Type.STRING },
                    traits: { type: Type.STRING },
                  },
                },
              },
              segments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    startOffsetMs: { type: Type.INTEGER },
                    endOffsetMs: { type: Type.INTEGER },
                    speakerId: { type: Type.STRING },
                    englishText: { type: Type.STRING },
                    emotion: { type: Type.STRING },
                    isOverlapping: { type: Type.BOOLEAN },
                    audioType: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err, 'English speech recognition failed');
      res.status(mapped.status).json({ error: mapped.error });
    }
  });

  // 2. Context-Aware Hindi Dialogue Translation
  app.post('/api/dub/translate', async (req: Request, res: Response) => {
    try {
      const {
        segments = [],
        dialogueStyle = 'Natural Conversational Hindi',
        glossarySection = '',
        rollingHistory = [],
      } = req.body as {
        segments?: Array<{
          segmentId: number;
          speaker: string;
          gender: string;
          emotion: string;
          targetDurationMs: number;
          englishText: string;
        }>;
        dialogueStyle?: string;
        glossarySection?: string;
        rollingHistory?: string[];
      };

      if (!Array.isArray(segments) || segments.length === 0) {
        res.status(400).json({ error: 'segments array is required.' });
        return;
      }

      const ai = getGeminiClient();
      const rollingSection =
        rollingHistory.length > 0
          ? `Recent Hindi dialogue continuity:\n${rollingHistory.slice(-6).join('\n')}`
          : '';

      const prompt = [
        'You are an expert Bollywood/cinema Hindi dialogue writer.',
        'Translate each English dialogue segment into natural spoken Hindi (Devanagari script) suitable for lip-sync movie dubbing.',
        `Style requested: ${dialogueStyle}.`,
        'Rules:',
        '- Keep Hindi line lengths naturally paced to fit targetDurationMs.',
        '- Preserve slang, emotion, humor, and colloquial intensity authentically according to the requested style.',
        '- Output valid Devanagari Hindi script only for hindiText (no English explanations).',
        rollingSection,
        glossarySection,
        `Segments JSON:\n${JSON.stringify(segments)}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    segmentId: { type: Type.INTEGER },
                    hindiText: { type: Type.STRING },
                    emotion: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err, 'Hindi translation failed');
      res.status(mapped.status).json({ error: mapped.error });
    }
  });

  // 3. Generate Hindi TTS Audio (WAV) using Gemini 3.8 Flash Lite TTS
  app.post('/api/dub/tts', async (req: Request, res: Response) => {
    try {
      const {
        hindiText,
        voicePreset = 'Charon',
        emotion = 'natural',
      } = req.body as {
        hindiText?: string;
        voicePreset?: string;
        emotion?: string;
      };

      if (!hindiText || !hindiText.trim()) {
        res.status(400).json({ error: 'hindiText cannot be blank for TTS.' });
        return;
      }

      const validVoice = VALID_VOICES.has(voicePreset) ? voicePreset : 'Kore';
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: hindiText.trim(),
                speechMetadata: {
                  style: `Hindi film dubbing actor, ${emotion} emotional tone, natural Devanagari pronunciation`,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: validVoice },
            },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!audioData?.data) {
        res.status(502).json({ error: 'Gemini TTS returned no audio payload.' });
        return;
      }

      res.json({
        audioBase64: audioData.data,
        mimeType: audioData.mimeType || 'audio/wav',
        voicePreset: validVoice,
      });
    } catch (err) {
      const mapped = mapGeminiError(err, 'Hindi TTS generation failed');
      res.status(mapped.status).json({ error: mapped.error });
    }
  });

  // 4. Test Gemini Cloud Connection Sample (from Studio Settings)
  app.post('/api/dub/test-sample', async (req: Request, res: Response) => {
    try {
      const {
        englishLine,
        dialogueStyle = 'Natural Conversational Hindi',
        glossarySection = '',
      } = req.body as {
        englishLine?: string;
        dialogueStyle?: string;
        glossarySection?: string;
      };

      if (!englishLine || !englishLine.trim()) {
        res.status(400).json({ error: 'Sample English dialogue cannot be blank.' });
        return;
      }

      const startMs = Date.now();
      const ai = getGeminiClient();

      const prompt = [
        'You are an expert Bollywood/cinema Hindi dialogue writer.',
        'Translate the English dialogue segment below into natural spoken Hindi (Devanagari script).',
        `Style requested: ${dialogueStyle}.`,
        glossarySection,
        `Segments JSON:\n${JSON.stringify([
          {
            segmentId: 1,
            speaker: 'SPEAKER_1',
            gender: 'MALE',
            sceneMood: 'dramatic',
            emotion: 'serious',
            targetDurationMs: 3500,
            englishText: englishLine.trim(),
          },
        ])}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    segmentId: { type: Type.INTEGER },
                    hindiText: { type: Type.STRING },
                    emotion: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const latencyMs = Math.max(1, Date.now() - startMs);
      const parsed = JSON.parse((response.text || '{}').trim()) as {
        translations?: Array<{ hindiText?: string; emotion?: string }>;
      };
      const first = parsed.translations?.[0];
      if (!first?.hindiText) {
        res.status(502).json({ error: 'Gemini returned no translated Hindi line.' });
        return;
      }

      res.json({
        hindiText: first.hindiText,
        emotion: first.emotion || 'serious',
        latencyMs,
      });
    } catch (err) {
      const mapped = mapGeminiError(err, 'Gemini Cloud connection test failed');
      res.status(mapped.status).json({ error: mapped.error });
    }
  });

  // Vite dev middleware or static dist serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Production build not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Hindi Movie Dubbing AI server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
