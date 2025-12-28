import * as Tone from "tone";
import { EQEffect } from "./components/effects/EQEffect";
import { PinkCeilingEffect } from "./components/effects/PinkCeilingEffect";
import { CompressorEffect } from "./components/effects/CompressorEffect";
import { ReverbEffect } from "./components/effects/ReverbEffect";
import { DelayEffect } from "./components/effects/DelayEffect";
import { ChorusEffect } from "./components/effects/ChorusEffect";
import { DistortionEffect } from "./components/effects/DistortionEffect";

export class ChannelStrip {
  constructor() {
    this.gain = 1.0;
    this.audioFX = [];

    this.toneGain = new Tone.Gain(1);
    this.toneGain.toDestination();
  }

  addEffect(effectType) {
    let effect;

    switch (effectType) {
      case "eq":
        effect = new EQEffect();
        break;
      case "pinkceil":
        effect = new PinkCeilingEffect();
        break;
      case "compressor":
        effect = new CompressorEffect();
        break;
      case "reverb":
        effect = new ReverbEffect();
        break;
      case "delay":
        effect = new DelayEffect();
        break;
      case "chorus":
        effect = new ChorusEffect();
        break;
      case "distortion":
        effect = new DistortionEffect();
        break;
      default:
        console.warn(`Unknown effect type: ${effectType}`);
        return;
    }

    this.audioFX.push(effect);
    this.rebuildChain();
  }

  removeEffect(effectName) {
    const index = this.audioFX.findIndex((fx) => fx.name === effectName);
    if (index !== -1) {
      this.audioFX[index].dispose();
      this.audioFX.splice(index, 1);
      this.rebuildChain();
    }
  }

  getEffect(effectName) {
    return this.audioFX.find((fx) => fx.name === effectName);
  }

  rebuildChain() {
    this.toneGain.disconnect();

    let currentNode = this.toneGain;

    for (const effect of this.audioFX) {
      if (effect.enabled && !effect.bypass) {
        currentNode.connect(effect.input); // Connect to effect input
        currentNode = effect.output; // Get effect output
      }
    }

    currentNode.toDestination();
  }

  process(buffer) {
    this.toneGain.gain.value = this.gain;

    for (const effect of this.audioFX) {
      if (effect.enabled && !effect.bypass) {
        effect.process(buffer);
      }
    }
  }

  setGain(dbValue) {
    this.gain = Tone.dbToGain(dbValue);
    this.toneGain.gain.rampTo(this.gain, 0.1);
  }

  dispose() {
    this.toneGain.dispose();

    for (const effect of this.audioFX) {
      effect.dispose();
    }
  }
}
