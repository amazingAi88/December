import {
  getMediaBlob,
  loadChunksForProject,
  loadSegmentsForProject,
  loadSpeakersForProject,
  putMediaBlob,
  saveChunksForProject,
  saveSegmentsForProject,
  saveSpeakersForProject,
  upsertProject,
} from '../data/studioStorage';
import {
  AudioChunk,
  ChunkStatus,
  DialogueSegment,
  EngineMode,
  HINDI_VOICE_PRESETS,
  MovieProject,
  ProcessingStage,
  ProjectStatus,
  SegmentStatus,
  SpeakerProfile,
  SubtitleLanguage,
  TranslationSource,
} from '../types/studio';
import {
  applyDirectSlangReplacement,
  buildPromptGlossaryHints,
  loadSlangConfig,
  localTranslateWithDictionary,
  resolveSlangMatches,
} from '../utils/slangDictionary';
import {
  base64ToBlob,
  decodeMediaAudio,
  renderMasterDubMixWav,
  sliceAudioBufferToMonoWavBase64,
  synthesizeDemoSoundtrackBuffer,
} from '../utils/studioAudioDsp';
import { parseSubtitleText } from '../utils/subtitleParser';
import { apiGenerateHindiTts, apiTranscribeChunk, apiTranslateBatch } from './dubbingApi';

export interface PipelineCallbacks {
  onProjectUpdate: (p: MovieProject) => void;
  onChunksUpdate: (c: AudioChunk[]) => void;
  onSpeakersUpdate: (s: SpeakerProfile[]) => void;
  onSegmentsUpdate: (seg: DialogueSegment[]) => void;
}

function defaultVoiceForGender(gender: string, idx = 0): string {
  const pool = HINDI_VOICE_PRESETS.filter((v) => v.gender === gender.toUpperCase());
  const list = pool.length > 0 ? pool : HINDI_VOICE_PRESETS;
  return list[idx % list.length].id;
}

export async function generateAndStoreSegmentTts(
  project: MovieProject,
  segment: DialogueSegment,
  voicePreset: string,
  signal?: AbortSignal
): Promise<DialogueSegment> {
  const cleanText = segment.hindiText.trim();
  if (!cleanText) {
    return {
      ...segment,
      status: SegmentStatus.FAILED,
      errorMessage: 'Hindi text is empty.',
    };
  }

  const res = await apiGenerateHindiTts(
    {
      hindiText: cleanText,
      voicePreset,
      emotion: segment.emotion || project.defaultEmotionBias || 'natural',
    },
    signal
  );

  const blob = base64ToBlob(res.audioBase64, res.mimeType || 'audio/wav');
  const ttsKey = `proj_${project.id}_seg_${segment.id}_tts`;
  await putMediaBlob(ttsKey, blob);

  const decoded = await decodeMediaAudio(blob);
  const ttsDurationMs = decoded ? Math.round(decoded.duration * 1000) : Math.max(800, segment.endMs - segment.startMs);

  return {
    ...segment,
    ttsAudioKey: ttsKey,
    ttsDurationMs,
    status: SegmentStatus.TTS_DONE,
    errorMessage: null,
  };
}

export async function runDubbingPipeline(
  initialProject: MovieProject,
  callbacks: PipelineCallbacks,
  signal: AbortSignal
): Promise<void> {
  let project: MovieProject = {
    ...initialProject,
    status: ProjectStatus.PROCESSING,
    currentStage: ProcessingStage.EXTRACTING,
    progressPercent: 4,
    lastError: null,
  };
  upsertProject(project);
  callbacks.onProjectUpdate(project);

  const throwIfAborted = () => {
    if (signal.aborted) {
      throw new DOMException('Pipeline paused by user', 'AbortError');
    }
  };

  try {
    // 1. Decode or synthesize source audio buffer
    const videoBlob = await getMediaBlob(`proj_${project.id}_source_video`);
    let sourceBuffer = videoBlob ? await decodeMediaAudio(videoBlob) : null;
    if (!sourceBuffer) {
      sourceBuffer = synthesizeDemoSoundtrackBuffer(Math.max(10, project.durationMs / 1000));
    }

    const totalMs = Math.max(project.durationMs, Math.round(sourceBuffer.duration * 1000));
    const chunkMs = Math.max(30_000, project.chunkDurationSec * 1000);
    const existingChunks = loadChunksForProject(project.id);
    const chunks: AudioChunk[] =
      existingChunks.length > 0
        ? existingChunks
        : Array.from({ length: Math.max(1, Math.ceil(totalMs / chunkMs)) }, (_, idx) => ({
            id: `${project.id}_chunk_${idx}`,
            projectId: project.id,
            chunkIndex: idx,
            startMs: idx * chunkMs,
            endMs: Math.min(totalMs, (idx + 1) * chunkMs),
            status: ChunkStatus.PENDING,
            processingTimeMs: 0,
            errorMessage: null,
          }));

    saveChunksForProject(project.id, chunks);
    callbacks.onChunksUpdate([...chunks]);

    let speakers = loadSpeakersForProject(project.id);
    let segments = loadSegmentsForProject(project.id);
    const slangConfig = loadSlangConfig();

    const hindiSubRaw =
      project.hindiSubtitleRawText ||
      (project.subtitleLanguage === SubtitleLanguage.HINDI ? project.subtitleRawText : null);
    const englishSubRaw =
      project.englishSubtitleRawText ||
      (project.subtitleLanguage !== SubtitleLanguage.HINDI ? project.subtitleRawText : null);

    const hindiSubCues = hindiSubRaw?.trim() ? parseSubtitleText(hindiSubRaw) : [];
    const englishSubCues = englishSubRaw?.trim() ? parseSubtitleText(englishSubRaw) : [];
    const hasHindiSrt = hindiSubCues.length > 0;
    const hasEnglishSrt = englishSubCues.length > 0;

    // 2. Process chunk by chunk
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      throwIfAborted();
      const chunk = chunks[cIdx];
      const chunkStartTime = Date.now();

      if (chunk.status === ChunkStatus.MIXED && segments.some((s) => s.chunkIndex === cIdx && s.status === SegmentStatus.TTS_DONE)) {
        continue;
      }

      const updateChunk = (patch: Partial<AudioChunk>) => {
        chunks[cIdx] = { ...chunks[cIdx], ...patch };
        saveChunksForProject(project.id, chunks);
        callbacks.onChunksUpdate([...chunks]);
      };

      const updateProjectProgress = (stage: string, pct: number) => {
        project = {
          ...project,
          currentStage: stage,
          progressPercent: Math.min(98, Math.max(project.progressPercent, pct)),
        };
        upsertProject(project);
        callbacks.onProjectUpdate(project);
      };

      try {
        updateChunk({ status: ChunkStatus.EXTRACTED, errorMessage: null });
        const basePct = Math.round((cIdx / chunks.length) * 85);
        updateProjectProgress(
          hasHindiSrt
            ? 'Loading Hindi .SRT Timings (Direct Dub)'
            : hasEnglishSrt
              ? 'Loading English .SRT Timings'
              : ProcessingStage.TRANSCRIBING,
          basePct + 8
        );

        // Stage A: Transcribe or Use Attached English/Hindi SRT
        let chunkSegs = segments.filter((s) => s.chunkIndex === cIdx);

        if (chunkSegs.length === 0) {
          if (hasHindiSrt || hasEnglishSrt) {
            if (speakers.length === 0) {
              speakers = [
                {
                  id: `${project.id}_sp1`,
                  projectId: project.id,
                  speakerLabel: 'SPEAKER_1',
                  displayName: 'Lead Voice 1',
                  gender: project.defaultVoiceGender,
                  voicePresetName: project.defaultVoicePreset,
                  speedMultiplier: project.defaultSpeechSpeed,
                  defaultEmotion: project.defaultEmotionBias,
                  traits: 'Primary movie dialogue speaker',
                },
              ];
              saveSpeakersForProject(project.id, speakers);
              callbacks.onSpeakersUpdate([...speakers]);
            }

            if (hasHindiSrt) {
              // Hindi .SRT takes direct priority: NO translation needed, dub straight to TTS at SRT timings
              const chunkHindiCues = hindiSubCues.filter(
                (cue) => cue.startMs >= chunk.startMs && cue.startMs < chunk.endMs
              );
              chunkSegs = chunkHindiCues.map((cue, idx) => {
                const matchingEn = englishSubCues.find(
                  (en) => Math.min(en.endMs, cue.endMs) > Math.max(en.startMs, cue.startMs)
                );
                return {
                  id: `${project.id}_c${cIdx}_s${idx}_${Date.now()}`,
                  projectId: project.id,
                  chunkIndex: cIdx,
                  orderIndex: segments.length + idx,
                  startMs: cue.startMs,
                  endMs: cue.endMs,
                  speakerLabel: speakers[0].speakerLabel,
                  englishText: matchingEn?.text || '',
                  hindiText: cue.text,
                  emotion: project.defaultEmotionBias || 'natural',
                  isOverlapping: false,
                  audioType: 'SPEECH',
                  speechSpeed: project.defaultSpeechSpeed,
                  ttsAudioKey: null,
                  ttsDurationMs: 0,
                  status: SegmentStatus.TRANSLATED,
                  errorMessage: null,
                  translationSource: TranslationSource.SUBTITLE,
                };
              });
            } else {
              // English .SRT attached: needs English -> Hindi translation before TTS
              const chunkEnCues = englishSubCues.filter(
                (cue) => cue.startMs >= chunk.startMs && cue.startMs < chunk.endMs
              );
              chunkSegs = chunkEnCues.map((cue, idx) => ({
                id: `${project.id}_c${cIdx}_s${idx}_${Date.now()}`,
                projectId: project.id,
                chunkIndex: cIdx,
                orderIndex: segments.length + idx,
                startMs: cue.startMs,
                endMs: cue.endMs,
                speakerLabel: speakers[0].speakerLabel,
                englishText: cue.text,
                hindiText: '',
                emotion: project.defaultEmotionBias || 'natural',
                isOverlapping: false,
                audioType: 'SPEECH',
                speechSpeed: project.defaultSpeechSpeed,
                ttsAudioKey: null,
                ttsDurationMs: 0,
                status: SegmentStatus.TRANSCRIBED,
                errorMessage: null,
                translationSource: '',
              }));
            }
          } else {
            // Audio transcription via Gemini multimodal STT
            const wavBase64 = sliceAudioBufferToMonoWavBase64(
              sourceBuffer,
              chunk.startMs / 1000,
              chunk.endMs / 1000
            );
            const sttRes = await apiTranscribeChunk(
              {
                audioBase64: wavBase64,
                mimeType: 'audio/wav',
                chunkDurationMs: chunk.endMs - chunk.startMs,
                knownSpeakers: speakers.map((s) => ({
                  speakerLabel: s.speakerLabel,
                  gender: s.gender,
                  traits: s.traits,
                })),
              },
              signal
            );

            // Merge speakers
            for (const sp of sttRes.speakers || []) {
              const label = sp.speakerId || 'SPEAKER_1';
              if (!speakers.some((existing) => existing.speakerLabel === label)) {
                const gender =
                  sp.inferredGender === 'FEMALE' || sp.inferredGender === 'NEUTRAL'
                    ? sp.inferredGender
                    : 'MALE';
                speakers.push({
                  id: `${project.id}_${label}`,
                  projectId: project.id,
                  speakerLabel: label,
                  displayName: label.replace('_', ' '),
                  gender,
                  voicePresetName:
                    speakers.length === 0
                      ? project.defaultVoicePreset
                      : defaultVoiceForGender(gender, speakers.length),
                  speedMultiplier: project.defaultSpeechSpeed,
                  defaultEmotion: 'natural',
                  traits: sp.traits || '',
                });
              }
            }
            if (speakers.length === 0) {
              speakers.push({
                id: `${project.id}_SPEAKER_1`,
                projectId: project.id,
                speakerLabel: 'SPEAKER_1',
                displayName: 'Speaker 1',
                gender: project.defaultVoiceGender,
                voicePresetName: project.defaultVoicePreset,
                speedMultiplier: project.defaultSpeechSpeed,
                defaultEmotion: 'natural',
                traits: 'Default speaker',
              });
            }
            saveSpeakersForProject(project.id, speakers);
            callbacks.onSpeakersUpdate([...speakers]);

            chunkSegs = (sttRes.segments || []).map((seg, idx) => {
              const audioType =
                seg.audioType === 'MUSIC' || seg.audioType === 'SFX' || seg.audioType === 'SILENCE'
                  ? seg.audioType
                  : 'SPEECH';
              return {
                id: `${project.id}_c${cIdx}_s${idx}_${Date.now()}`,
                projectId: project.id,
                chunkIndex: cIdx,
                orderIndex: segments.length + idx,
                startMs: chunk.startMs + Math.max(0, seg.startOffsetMs),
                endMs: chunk.startMs + Math.max(seg.startOffsetMs + 300, seg.endOffsetMs),
                speakerLabel: seg.speakerId || 'SPEAKER_1',
                englishText: seg.englishText || '',
                hindiText: '',
                emotion: seg.emotion || 'natural',
                isOverlapping: Boolean(seg.isOverlapping),
                audioType,
                speechSpeed: project.defaultSpeechSpeed,
                ttsAudioKey: null,
                ttsDurationMs: 0,
                status: SegmentStatus.TRANSCRIBED,
                errorMessage: null,
                translationSource: '',
              };
            });
          }

          segments = [...segments, ...chunkSegs];
          saveSegmentsForProject(project.id, segments);
          callbacks.onSegmentsUpdate([...segments]);
        }

        updateChunk({ status: ChunkStatus.TRANSCRIBED });
        throwIfAborted();

        // Stage B: Translate English SPEECH lines to Hindi (skipped if Hindi .SRT is provided)
        const toTranslate = chunkSegs.filter(
          (s) => s.audioType === 'SPEECH' && !s.hindiText.trim() && s.englishText.trim()
        );
        updateProjectProgress(
          toTranslate.length === 0 && hasHindiSrt
            ? 'Hindi .SRT Direct Dub (Translation Skipped)'
            : ProcessingStage.TRANSLATING,
          basePct + 25
        );

        if (toTranslate.length > 0) {
          const speakerMap = new Map(speakers.map((sp) => [sp.speakerLabel, sp]));
          const directUpdatedIds = new Set<string>();

          // First apply exact Slang Dictionary overrides if whole line matches
          for (const seg of toTranslate) {
            const matches = resolveSlangMatches({
              config: slangConfig,
              englishText: seg.englishText,
              emotion: seg.emotion,
              dialogueStyle: project.dialogueStyle,
            });
            const direct = applyDirectSlangReplacement(seg.englishText, matches);
            if (direct) {
              seg.hindiText = direct;
              seg.status = SegmentStatus.TRANSLATED;
              seg.translationSource = TranslationSource.DICTIONARY;
              directUpdatedIds.add(seg.id);
            }
          }

          const remaining = toTranslate.filter((s) => !directUpdatedIds.has(s.id));

          if (remaining.length > 0) {
            if (project.engineMode === EngineMode.ON_DEVICE_FREE || project.engineMode === EngineMode.ON_DEVICE_LLM) {
              for (const seg of remaining) {
                const localRes = localTranslateWithDictionary(
                  seg.englishText,
                  slangConfig,
                  project.dialogueStyle
                );
                seg.hindiText = localRes.hindiText;
                seg.status = SegmentStatus.TRANSLATED;
                seg.translationSource = localRes.usedDictionary
                  ? TranslationSource.DICTIONARY
                  : TranslationSource.ML_KIT;
              }
            } else {
              // Batch Gemini translation with slang glossary hints + rolling context
              const batchSize = 12;
              const rollingHistory: string[] = [];
              for (let i = 0; i < remaining.length; i += batchSize) {
                throwIfAborted();
                const batch = remaining.slice(i, i + batchSize);
                const allMatches = batch.flatMap((seg, bIdx) =>
                  resolveSlangMatches({
                    config: slangConfig,
                    englishText: seg.englishText,
                    prevContext: batch[bIdx - 1]?.englishText || '',
                    nextContext: batch[bIdx + 1]?.englishText || '',
                    emotion: seg.emotion,
                    dialogueStyle: project.dialogueStyle,
                  })
                );
                const glossarySection = buildPromptGlossaryHints(allMatches);

                const res = await apiTranslateBatch(
                  {
                    segments: batch.map((s, idx) => {
                      const sp = speakerMap.get(s.speakerLabel);
                      return {
                        segmentId: idx + 1,
                        speaker: s.speakerLabel,
                        gender: sp?.gender || project.defaultVoiceGender,
                        emotion: s.emotion,
                        targetDurationMs: Math.max(500, s.endMs - s.startMs),
                        englishText: s.englishText,
                      };
                    }),
                    dialogueStyle: project.dialogueStyle,
                    glossarySection,
                    rollingHistory,
                  },
                  signal
                );

                for (const tr of res.translations || []) {
                  const target = batch[tr.segmentId - 1];
                  if (target && tr.hindiText?.trim()) {
                    target.hindiText = tr.hindiText.trim();
                    target.emotion = tr.emotion || target.emotion;
                    target.status = SegmentStatus.TRANSLATED;
                    target.translationSource = TranslationSource.GEMINI;
                    rollingHistory.push(target.hindiText.slice(0, 80));
                  }
                }
              }
            }
          }

          segments = segments.map((s) => chunkSegs.find((cs) => cs.id === s.id) || s);
          saveSegmentsForProject(project.id, segments);
          callbacks.onSegmentsUpdate([...segments]);
        }

        updateChunk({ status: ChunkStatus.TRANSLATED });
        throwIfAborted();

        // Stage C: Generate Hindi Voice TTS for each SPEECH line
        updateProjectProgress(ProcessingStage.GENERATING_TTS, basePct + 50);

        const speakerMap = new Map(speakers.map((sp) => [sp.speakerLabel, sp]));
        const speechSegs = chunkSegs.filter((s) => s.audioType === 'SPEECH' && s.hindiText.trim());
        for (let i = 0; i < speechSegs.length; i++) {
          throwIfAborted();
          const seg = speechSegs[i];
          if (seg.status === SegmentStatus.TTS_DONE && seg.ttsAudioKey) {
            const existingBlob = await getMediaBlob(seg.ttsAudioKey);
            if (existingBlob) continue;
          }

          const voicePreset = speakerMap.get(seg.speakerLabel)?.voicePresetName || project.defaultVoicePreset;
          try {
            const updatedSeg = await generateAndStoreSegmentTts(project, seg, voicePreset, signal);
            segments = segments.map((s) => (s.id === updatedSeg.id ? updatedSeg : s));
            saveSegmentsForProject(project.id, segments);
            callbacks.onSegmentsUpdate([...segments]);
          } catch (ttsErr) {
            if ((ttsErr as Error).name === 'AbortError') throw ttsErr;
            const errMsg = ttsErr instanceof Error ? ttsErr.message : 'TTS generation failed';
            segments = segments.map((s) =>
              s.id === seg.id ? { ...s, status: SegmentStatus.FAILED, errorMessage: errMsg } : s
            );
            saveSegmentsForProject(project.id, segments);
            callbacks.onSegmentsUpdate([...segments]);
          }
        }

        updateChunk({ status: ChunkStatus.TTS_DONE });
        throwIfAborted();

        // Stage D: Mix Audio & Preserve BGM
        updateProjectProgress(ProcessingStage.MIXING, basePct + 75);
        const ttsMap = new Map<string, AudioBuffer>();
        for (const seg of segments) {
          if (seg.ttsAudioKey) {
            const b = await getMediaBlob(seg.ttsAudioKey);
            if (b) {
              const decoded = await decodeMediaAudio(b);
              if (decoded) ttsMap.set(seg.id, decoded);
            }
          }
        }

        const { wavBlob } = await renderMasterDubMixWav({
          durationMs: totalMs,
          sourceBuffer,
          segments,
          ttsBuffersBySegId: ttsMap,
          preserveBgm: project.preserveBgm,
          removeEnglishDialogue: project.removeEnglishDialogue,
          separationMode: project.separationMode,
          hindiVolume: project.hindiVolume,
          bgmVolume: project.bgmVolume,
          originalVolume: project.originalVolume,
        });

        await putMediaBlob(`proj_${project.id}_mixed_master_wav`, wavBlob);

        updateChunk({
          status: ChunkStatus.MIXED,
          processingTimeMs: Date.now() - chunkStartTime,
          errorMessage: null,
        });
      } catch (chunkErr) {
        if ((chunkErr as Error).name === 'AbortError') throw chunkErr;
        const msg = chunkErr instanceof Error ? chunkErr.message : 'Chunk processing failed';
        updateChunk({ status: ChunkStatus.FAILED, errorMessage: msg });
        throw chunkErr;
      }
    }

    project = {
      ...project,
      status: ProjectStatus.READY_FOR_REVIEW,
      currentStage: ProcessingStage.READY,
      progressPercent: 100,
      lastError: null,
    };
    upsertProject(project);
    callbacks.onProjectUpdate(project);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      project = {
        ...project,
        status: ProjectStatus.PAUSED,
        currentStage: 'Paused',
      };
      upsertProject(project);
      callbacks.onProjectUpdate(project);
      return;
    }

    const msg = err instanceof Error ? err.message : 'Dubbing pipeline encountered an error.';
    project = {
      ...project,
      status: ProjectStatus.ERROR,
      currentStage: 'Error',
      lastError: msg,
    };
    upsertProject(project);
    callbacks.onProjectUpdate(project);
  }
}
