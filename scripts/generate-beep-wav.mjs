// Génère un fichier WAV beep court (880Hz, 250ms, 8kHz mono 16-bit signed PCM).
// iOS 9 Safari accepte ce format. Output : apps/display/public/lib/beep.wav
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sampleRate = 8000;
const durationSec = 0.25;
const frequency = 880;
const amplitude = 0.4; // 0..1

const numSamples = Math.floor(sampleRate * durationSec);
const samples = new Int16Array(numSamples);
const fadeSamples = Math.floor(sampleRate * 0.01); // 10ms fade in/out

for (let i = 0; i < numSamples; i++) {
  let env = 1;
  if (i < fadeSamples) env = i / fadeSamples;
  if (i > numSamples - fadeSamples) env = (numSamples - i) / fadeSamples;
  const t = i / sampleRate;
  samples[i] = Math.round(Math.sin(2 * Math.PI * frequency * t) * amplitude * env * 32767);
}

const dataSize = samples.length * 2; // 16-bit = 2 bytes/sample
const fileSize = 44 + dataSize;
const buffer = Buffer.alloc(fileSize);

// RIFF header
buffer.write("RIFF", 0, "ascii");
buffer.writeUInt32LE(fileSize - 8, 4); // ChunkSize
buffer.write("WAVE", 8, "ascii");

// fmt subchunk
buffer.write("fmt ", 12, "ascii");
buffer.writeUInt32LE(16, 16); // Subchunk1Size (PCM = 16)
buffer.writeUInt16LE(1, 20); // AudioFormat (PCM = 1)
buffer.writeUInt16LE(1, 22); // NumChannels (mono)
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate (sampleRate * NumChannels * BitsPerSample/8)
buffer.writeUInt16LE(2, 32); // BlockAlign (NumChannels * BitsPerSample/8)
buffer.writeUInt16LE(16, 34); // BitsPerSample

// data subchunk
buffer.write("data", 36, "ascii");
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < samples.length; i++) {
  buffer.writeInt16LE(samples[i], 44 + i * 2);
}

const outPath = resolve("apps/display/public/lib/beep.wav");
writeFileSync(outPath, buffer);
console.log(`Wrote ${outPath} (${fileSize} bytes)`);
