import * as Tone from "tone";
import { EQEffect } from "./components/effects/EQEffect";
import { PinkCeilingEffect } from "./components/effects/PinkCeilingEffect";

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
      case "reverb":
        // TODO: implement
        console.warn("Reverb not implemented yet");
        return;
      case "delay":
        // TODO: implement
        console.warn("Delay not implemented yet");
      case "pinkceil":
        effect = new PinkCeilingEffect();
        break;
        return;
      // ... other effects
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
        const nodes = effect.getToneNodes();
        for (const node of nodes) {
          currentNode.connect(node);
          currentNode = node;
        }
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
