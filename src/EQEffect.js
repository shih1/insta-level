import * as Tone from "tone";
import { AudioFX } from "./AudioFX";

export class EQEffect extends AudioFX {
  constructor() {
    super("EQ");
    this.eq = { low: 0, mid: 0, high: 0 };
    this.toneEQ = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
    this.enabled = true;
  }

  process(buffer) {
    if (this.bypass) return;
    this.applyEQ();
  }

  applyEQ() {
    this.toneEQ.low.value = this.eq.low;
    this.toneEQ.mid.value = this.eq.mid;
    this.toneEQ.high.value = this.eq.high;
  }

  getToneNodes() {
    return [this.toneEQ];
  }

  setParam(paramName, value) {
    if (paramName === "low" || paramName === "mid" || paramName === "high") {
      this.eq[paramName] = value;
      this.toneEQ[paramName].value = value;
    }
  }

  getParams() {
    return { ...this.eq };
  }

  // Returns the control configuration for App.js to render
  getControlsConfig() {
    return {
      type: "eq",
      bands: ["low", "mid", "high"],
      values: this.eq,
    };
  }

  dispose() {
    this.toneEQ.dispose();
  }
}
