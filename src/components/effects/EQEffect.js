import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";
import { AudioParameter, BooleanParameter } from "./AudioParameter";
import ParameterSlider from "./ParameterSlider";

export class EQEffect {
  constructor() {
    this.name = "EQ";
    this.enabled = true;
    this.bypass = false;

    // Nodes
    this.highPass = new Tone.Filter({
      type: "highpass",
      frequency: 20,
      rolloff: -12,
    });
    this.lowShelf = new Tone.Filter({
      type: "lowshelf",
      frequency: 100,
      gain: 0,
    });
    this.midPeak = new Tone.Filter({
      type: "peaking",
      frequency: 1000,
      Q: 1.5,
      gain: 0,
    });
    this.highShelf = new Tone.Filter({
      type: "highshelf",
      frequency: 8000,
      gain: 0,
    });
    this.lowPass = new Tone.Filter({
      type: "lowpass",
      frequency: 20000,
      rolloff: -12,
    });
    this.outputGain = new Tone.Gain(1);
    this.analyser = new Tone.Analyser("fft", 512);

    this.highPass.chain(
      this.lowShelf,
      this.midPeak,
      this.highShelf,
      this.lowPass,
      this.outputGain
    );
    this.outputGain.connect(this.analyser);

    this.input = this.highPass;
    this.output = this.outputGain;

    this.params = {
      hpEnabled: new BooleanParameter("HP 80Hz", false, (val) => {
        this.highPass.frequency.rampTo(val ? 80 : 20, 0.1);
      }),
      lowGain: new AudioParameter("Low", 0, -15, 15, "dB", (val) => {
        this.lowShelf.gain.value = val;
      }),
      midGain: new AudioParameter("Mid", 0, -12, 12, "dB", (val) => {
        this.midPeak.gain.value = val;
      }),
      midFreq: new AudioParameter("Mid Freq", 1000, 120, 7500, "Hz", (val) => {
        this.midPeak.frequency.value = val;
      }),
      highGain: new AudioParameter("High", 0, -15, 15, "dB", (val) => {
        this.highShelf.gain.value = val;
        const lpFreq = val < 0 ? 8000 + ((val + 15) / 15) * 12000 : 20000;
        this.lowPass.frequency.value = lpFreq;
      }),
      output: new AudioParameter("Output", 0, -12, 12, "dB", (val) => {
        this.outputGain.gain.rampTo(Tone.dbToGain(val), 0.1);
      }),
    };
  }

  process(buffer) {
    // Audio processing is handled by Tone.js signal chain
    // This method exists to satisfy the AudioFX interface
    // The actual processing happens through the connected Tone nodes
  }

  getToneNodes() {
    return [this.highPass, this.outputGain];
  }
  getFrequencyData() {
    return this.analyser.getValue();
  }
  dispose() {
    [
      this.highPass,
      this.lowShelf,
      this.midPeak,
      this.highShelf,
      this.lowPass,
      this.outputGain,
      this.analyser,
    ].forEach((n) => n.dispose());
  }
}

export const EQControls = ({ effect }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [params, setParams] = useState({
    low: 0,
    mid: 0,
    midF: 1000,
    high: 0,
    hp: false,
  });

  useEffect(() => {
    const sync = () =>
      setParams({
        low: effect.params.lowGain.getValue(),
        mid: effect.params.midGain.getValue(),
        midF: effect.params.midFreq.getValue(),
        high: effect.params.highGain.getValue(),
        hp: effect.params.hpEnabled.getValue(),
      });
    Object.values(effect.params).forEach((p) => p.addListener(sync));
    return () =>
      Object.values(effect.params).forEach((p) => p.removeListener(sync));
  }, [effect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const { width, height } = canvas;
      const center = height / 2;

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      // Draw Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      [100, 1000, 10000].forEach((f) => {
        const x = (Math.log10(f / 20) / Math.log10(20000 / 20)) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(0, center);
      ctx.lineTo(width, center);
      ctx.stroke();

      // Spectrum
      const freqData = effect.getFrequencyData();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(139, 92, 246, 0.3)";
      freqData.forEach((v, i) => {
        const x = (i / freqData.length) * width;
        const y = height - ((v + 100) / 100) * height;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Calculate EQ Curve
      const points = [];
      for (let x = 0; x <= width; x += 2) {
        const freq = 20 * Math.pow(20000 / 20, x / width);
        let response = 0;

        // HP Logic
        if (params.hp) {
          const hpFactor = freq / 80;
          response -= 20 * Math.log10(Math.sqrt(1 + Math.pow(1 / hpFactor, 4)));
        }
        // Low Shelf
        response += params.low * (1 / (1 + Math.pow(freq / 100, 2)));
        // Mid Peak (Bell)
        const bw = 1.5;
        const dist = Math.abs(Math.log2(freq / params.midF));
        response += params.mid * Math.exp(-Math.pow(dist / (bw / 2), 2));
        // High Shelf
        response += params.high * (1 / (1 + Math.pow(8000 / freq, 2)));

        const y = center - response * (height / 40);
        points.push({ x, y });
      }

      // Draw Fill
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(236, 72, 153, 0.1)");
      gradient.addColorStop(1, "rgba(236, 72, 153, 0)");
      ctx.beginPath();
      ctx.moveTo(0, height);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(width, height);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw Line
      ctx.beginPath();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(236, 72, 153, 0.5)";
      points.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      );
      ctx.stroke();
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, [effect, params]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-6 shadow-2xl">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
            Analog EQ
          </h3>
          <div className="text-lg font-bold text-white leading-none">
            Channel One
          </div>
        </div>
        <button
          onClick={() => effect.params.hpEnabled.toggle()}
          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
            params.hp
              ? "bg-pink-500 border-pink-400 text-white"
              : "bg-slate-800 border-slate-700 text-slate-400"
          }`}
        >
          HP 80Hz
        </button>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg blur opacity-20 group-hover:opacity-30 transition"></div>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="relative w-full h-32 bg-slate-950 rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-2 gap-4">
          <ParameterSlider param={effect.params.lowGain} label="Low Shelf" />
          <ParameterSlider param={effect.params.highGain} label="High Shelf" />
        </div>

        <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5 space-y-4">
          <ParameterSlider param={effect.params.midGain} label="Mid Punch" />
          <ParameterSlider
            param={effect.params.midFreq}
            label="Mid Frequency"
          />
        </div>

        <div className="pt-2 border-t border-slate-800">
          <ParameterSlider param={effect.params.output} label="Level Out" />
        </div>
      </div>
    </div>
  );
};
