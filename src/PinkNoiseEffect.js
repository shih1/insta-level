import * as Tone from "tone";
import { AudioFX } from "./AudioFX";

export class PinkNoiseEffect extends AudioFX {
  constructor() {
    super("Pink Noise");
    this.pinkNoise = new Tone.Noise("pink");
    this.pinkNoise.volume.value = -30;
    this.pinkAnalyser = new Tone.Analyser("fft", 2048);
    this.pinkNoise.connect(this.pinkAnalyser);
    this.enabled = false;
    this.isOn = false;
  }

  process(buffer) {
    // Pink noise runs independently, just for visualization
  }

  getToneNodes() {
    // Pink noise doesn't go in the main signal chain
    return [];
  }

  start() {
    if (this.enabled && !this.bypass && this.isOn) {
      this.pinkNoise.start();
    }
  }

  stop() {
    this.pinkNoise.stop();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  toggleOn(isPlaying) {
    this.isOn = !this.isOn;
    if (this.isOn && isPlaying) {
      this.start();
    } else {
      this.stop();
    }
  }

  getAnalyserValues() {
    return this.pinkAnalyser.getValue();
  }

  setParam(paramName, value) {
    if (paramName === "volume") {
      this.pinkNoise.volume.value = value;
    } else if (paramName === "isOn") {
      this.isOn = value;
    }
  }

  getParams() {
    return {
      volume: this.pinkNoise.volume.value,
      enabled: this.enabled,
      isOn: this.isOn,
    };
  }

  // Returns the control configuration for App.js to render
  getControlsConfig() {
    return {
      type: "pinkNoise",
      isOn: this.isOn,
    };
  }

  dispose() {
    this.pinkNoise.dispose();
    this.pinkAnalyser.dispose();
  }
}
