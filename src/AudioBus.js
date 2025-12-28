import * as Tone from "tone";
import { AudioFile } from "./AudioFile";
import { ChannelStrip } from "./ChannelStrip";
import { AudioBuffer } from "./AudioBuffer";

export class AudioBus {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.audioFile = null;
    this.channelStrip = new ChannelStrip();
    this.buffer = new AudioBuffer(512);
    this.isEmpty = true;
    this.tonePlayer = null;
    this.volume = 0;
    this.waveformCanvas = null;
  }

  loadAudioFile(toneBuffer, fileName) {
    this.audioFile = new AudioFile(toneBuffer);
    this.name = fileName;
    this.isEmpty = false;

    if (this.tonePlayer) {
      this.tonePlayer.dispose();
    }

    this.tonePlayer = new Tone.Player(toneBuffer);
    this.tonePlayer.connect(this.channelStrip.toneGain);
    this.tonePlayer.sync().start(0);
  }

  setWaveformCanvas(canvas) {
    this.waveformCanvas = canvas;
  }

  drawWaveform() {
    if (!this.waveformCanvas || !this.audioFile) return;

    const canvas = this.waveformCanvas;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    const audioBuffer = this.audioFile.toneBuffer;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum !== undefined) {
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
      }

      const yMin = (1 + min) * amp;
      const yMax = (1 + max) * amp;
      const height_bar = Math.max(yMax - yMin, 1);

      ctx.fillRect(i, yMin, 1, height_bar);
    }
  }

  process(transportSeconds) {
    this.buffer.clear();

    if (this.audioFile) {
      this.audioFile.process(this.buffer, transportSeconds);
    }

    this.channelStrip.process(this.buffer);
  }

  getDuration() {
    return this.audioFile ? this.audioFile.getDuration() : 0;
  }

  dispose() {
    if (this.tonePlayer) {
      this.tonePlayer.dispose();
    }
    this.channelStrip.dispose();
  }
}
