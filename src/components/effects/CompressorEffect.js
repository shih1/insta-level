import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";
import { AudioParameter } from "./AudioParameter";
import ParameterSlider from "./ParameterSlider";

export class CompressorEffect {
  constructor() {
    this.name = "Compressor";
    this.enabled = true;
    this.bypass = false;

    // Nodes
    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
      knee: 30,
    });

    this.inputGain = new Tone.Gain(1);
    this.outputGain = new Tone.Gain(1);
    this.analyser = new Tone.Analyser("waveform", 512);

    // Chain: input -> compressor -> output -> analyser
    this.inputGain.chain(this.compressor, this.outputGain);
    this.outputGain.connect(this.analyser);

    this.input = this.inputGain;
    this.output = this.outputGain;

    this.params = {
      threshold: new AudioParameter("Threshold", -24, -60, 0, "dB", (val) => {
        this.compressor.threshold.value = val;
      }),
      ratio: new AudioParameter("Ratio", 4, 1, 20, ":1", (val) => {
        this.compressor.ratio.value = val;
      }),
      attack: new AudioParameter("Attack", 3, 0.1, 100, "ms", (val) => {
        this.compressor.attack.value = val / 1000; // Convert to seconds
      }),
      release: new AudioParameter("Release", 250, 10, 1000, "ms", (val) => {
        this.compressor.release.value = val / 1000; // Convert to seconds
      }),
      knee: new AudioParameter("Knee", 30, 0, 40, "dB", (val) => {
        this.compressor.knee.value = val;
      }),
      makeup: new AudioParameter("Makeup", 0, 0, 24, "dB", (val) => {
        this.outputGain.gain.rampTo(Tone.dbToGain(val), 0.1);
      }),
    };
  }

  process(buffer) {
    // Audio processing is handled by Tone.js signal chain
  }

  getWaveformData() {
    return this.analyser.getValue();
  }

  dispose() {
    [this.inputGain, this.compressor, this.outputGain, this.analyser].forEach(
      (n) => n.dispose()
    );
  }
}

export const CompressorControls = ({ effect }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [params, setParams] = useState({
    threshold: -24,
    ratio: 4,
    attack: 3,
    release: 250,
    knee: 30,
    makeup: 0,
  });

  useEffect(() => {
    const sync = () =>
      setParams({
        threshold: effect.params.threshold.getValue(),
        ratio: effect.params.ratio.getValue(),
        attack: effect.params.attack.getValue(),
        release: effect.params.release.getValue(),
        knee: effect.params.knee.getValue(),
        makeup: effect.params.makeup.getValue(),
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

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      // Draw compression curve
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;

      // Grid lines
      for (let i = 0; i <= 4; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        const x = (i / 4) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw waveform
      const waveformData = effect.getWaveformData();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(139, 92, 246, 0.5)";
      ctx.lineWidth = 2;
      waveformData.forEach((v, i) => {
        const x = (i / waveformData.length) * width;
        const y = ((v + 1) / 2) * height;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw compression curve
      const { threshold, ratio, knee } = params;
      ctx.beginPath();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(16, 185, 129, 0.5)";

      for (let inputDb = -60; inputDb <= 0; inputDb += 0.5) {
        let outputDb;

        if (inputDb < threshold - knee / 2) {
          // Below knee - no compression
          outputDb = inputDb;
        } else if (inputDb > threshold + knee / 2) {
          // Above knee - full compression
          outputDb = threshold + (inputDb - threshold) / ratio;
        } else {
          // Within knee - soft knee transition
          const kneeInput = inputDb - threshold + knee / 2;
          const kneeOutput = (kneeInput * kneeInput) / (2 * knee);
          outputDb = inputDb + (1 / ratio - 1) * kneeOutput;
        }

        const x = ((inputDb + 60) / 60) * width;
        const y = height - ((outputDb + 60) / 60) * height;

        inputDb === -60 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw threshold line
      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const thresholdX = ((threshold + 60) / 60) * width;
      ctx.beginPath();
      ctx.moveTo(thresholdX, 0);
      ctx.lineTo(thresholdX, height);
      ctx.stroke();
      ctx.setLineDash([]);

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
            Dynamics
          </h3>
          <div className="text-lg font-bold text-white leading-none">
            Compressor
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {params.ratio.toFixed(1)}:1
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-20 group-hover:opacity-30 transition"></div>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="relative w-full h-32 bg-slate-950 rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-2 gap-4">
          <ParameterSlider param={effect.params.threshold} label="Threshold" />
          <ParameterSlider param={effect.params.ratio} label="Ratio" />
        </div>

        <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5 space-y-4">
          <ParameterSlider param={effect.params.attack} label="Attack" />
          <ParameterSlider param={effect.params.release} label="Release" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ParameterSlider param={effect.params.knee} label="Knee" />
          <ParameterSlider param={effect.params.makeup} label="Makeup Gain" />
        </div>
      </div>
    </div>
  );
};
