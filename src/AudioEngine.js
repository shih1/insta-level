import * as Tone from "tone";
import { AudioGraph } from "./AudioGraph";

export class AudioEngine {
  constructor() {
    this.graph = new AudioGraph();
    this.isRunning = false;
    this.processingLoop = null;
  }

  async start() {
    await Tone.start();
    Tone.Transport.start();
    this.isRunning = true;

    this.graph.buses.forEach((bus) => {
      const pinkNoise = bus.channelStrip.getEffect("Pink Noise");
      if (pinkNoise && pinkNoise.enabled) {
        pinkNoise.start();
      }
    });
  }

  stop() {
    Tone.Transport.stop();
    this.isRunning = false;

    this.graph.buses.forEach((bus) => {
      const pinkNoise = bus.channelStrip.getEffect("Pink Noise");
      if (pinkNoise) {
        pinkNoise.stop();
      }
    });
  }

  pause() {
    Tone.Transport.pause();
    this.isRunning = false;

    this.graph.buses.forEach((bus) => {
      const pinkNoise = bus.channelStrip.getEffect("Pink Noise");
      if (pinkNoise) {
        pinkNoise.stop();
      }
    });
  }

  processBlock() {
    const transportSeconds = Tone.Transport.seconds;
    this.graph.process(transportSeconds);
  }

  dispose() {
    this.stop();
    this.graph.dispose();
  }
}
