import * as Tone from "tone";

export class AudioFile {
  constructor(toneBuffer) {
    this.toneBuffer = toneBuffer;
    this.readPosition = 0;
  }

  process(buffer, transportSeconds) {
    const sampleRate = Tone.getContext().sampleRate;
    const startSample = Math.floor(transportSeconds * sampleRate);

    if (startSample >= this.toneBuffer.length * sampleRate) {
      buffer.clear();
      return;
    }

    const channelData = this.toneBuffer.getChannelData(0);
    const samplesToRead = Math.min(
      buffer.getLength(),
      channelData.length - startSample
    );

    for (let i = 0; i < samplesToRead; i++) {
      buffer.samples[i] = channelData[startSample + i] || 0;
    }
  }

  getDuration() {
    return this.toneBuffer.duration;
  }
}
