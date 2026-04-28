/**
 * Transcription Service
 *
 * PRIMARY:  AssemblyAI — real speaker diarization
 * FALLBACK: OpenAI Whisper — no speaker labels, but fast
 */

const { AssemblyAI } = require('assemblyai');
const OpenAI = require('openai');
const fs = require('fs');

const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Transcribe audio file with speaker diarization.
 * Returns: [{speaker, text, start, end}]
 *
 * @param {string} localPath - path to audio file on disk
 * @param {string} audioUrl  - optional S3 URL (AssemblyAI can pull directly)
 */
async function transcribeAudio(localPath, audioUrl = null) {
  if (process.env.ASSEMBLYAI_API_KEY) {
    return transcribeWithAssemblyAI(localPath, audioUrl);
  }
  return transcribeWithWhisper(localPath);
}

/**
 * AssemblyAI — supports speaker diarization natively
 * Returns real speaker labels like "Speaker A", "Speaker B"
 */
async function transcribeWithAssemblyAI(localPath, audioUrl) {
  console.log('Transcribing with AssemblyAI (speaker diarization enabled)...');

  const speechModel = process.env.ASSEMBLYAI_SPEECH_MODEL;
  const params = {
    speech_models: [speechModel],
    speaker_labels: true,
    speakers_expected: null, // auto-detect
    punctuate: true,
    format_text: true,
  };

  // If we have an S3 URL, pass it directly — no re-upload needed
  if (audioUrl && audioUrl.startsWith('https://')) {
    params.audio_url = audioUrl;
  } else {
    // Upload local file to AssemblyAI
    const uploaded = await assemblyai.files.upload(fs.createReadStream(localPath));
    params.audio_url = uploaded;
  }

  const transcript = await assemblyai.transcripts.transcribe(params);

  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
  }

  // Map utterances to our segment format
  return (transcript.utterances || []).map((u, i) => ({
    id: i,
    speaker: `Speaker ${u.speaker}`,   // "Speaker A", "Speaker B", etc.
    text: u.text.trim(),
    start: u.start / 1000,             // ms → seconds
    end: u.end / 1000,
  }));
}

/**
 * OpenAI Whisper fallback — no speaker diarization
 * Segments are labeled "Speaker 1", "Speaker 2" (rotated by segment index)
 */
async function transcribeWithWhisper(localPath) {
  console.log('Transcribing with OpenAI Whisper (no speaker diarization)...');

  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(localPath),
    model: process.env.OPENAI_TRANSCRIPTION_MODEL,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  return (response.segments || []).map((seg, i) => ({
    id: i,
    speaker: `Speaker ${(i % 4) + 1}`,  // placeholder rotation
    text: seg.text.trim(),
    start: seg.start,
    end: seg.end,
  }));
}

module.exports = { transcribeAudio };
