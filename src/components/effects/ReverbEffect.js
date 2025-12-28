import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";
import { AudioParameter } from "./AudioParameter";
import ParameterSlider from "./ParameterSlider";

export class ReverbEffect {
  constructor() {
    this.name = "Reverb";
    this.enabled = true;
    this.bypass = false;

    // Nodes
    this.reverb = new Tone.Reverb({
      decay: 1.5,
      preDelay: 0.01,
    });

    this.wet = new Tone.CrossFade(0.3);
    this.inputGain = new Tone.Gain(1);
    this.outputGain = new Tone.Gain(1);
    this.analyser = new Tone.Analyser("fft", 512);

    // Chain: input splits to dry and wet paths
    this.inputGain.connect(this.wet.a); // Dry
    this.inputGain.connect(this.reverb);
    this.reverb.connect(this.wet.b); // Wet
    this.wet.connect(this.outputGain);
    this.outputGain.connect(this.analyser);

    this.input = this.inputGain;
    this.output = this.outputGain;

    this.params = {
      decay: new AudioParameter("Decay", 1.5, 0.1, 10, "s", (val) => {
        this.reverb.decay = val;
      }),
      preDelay: new AudioParameter("Pre-Delay", 10, 0, 100, "ms", (val) => {
        this.reverb.preDelay = val / 1000;
      }),
      wet: new AudioParameter("Mix", 30, 0, 100, "%", (val) => {
        this.wet.fade.value = val / 100;
      }),
      output: new AudioParameter("Output", 0, -12, 12, "dB", (val) => {
        this.outputGain.gain.rampTo(Tone.dbToGain(val), 0.1);
      }),
    };

    // Generate reverb impulse
    this.reverb.generate();
  }

  process(buffer) {
    // Audio processing is handled by Tone.js signal chain
  }

  getFrequencyData() {
    return this.analyser.getValue();
  }

  dispose() {
    [
      this.inputGain,
      this.reverb,
      this.wet,
      this.outputGain,
      this.analyser,
    ].forEach((n) => n.dispose());
  }
}

export const ReverbControls = ({ effect }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [params, setParams] = useState({
    decay: 1.5,
    preDelay: 10,
    wet: 30,
    output: 0,
  });

  useEffect(() => {
    const sync = () =>
      setParams({
        decay: effect.params.decay.getValue(),
        preDelay: effect.params.preDelay.getValue(),
        wet: effect.params.wet.getValue(),
        output: effect.params.output.getValue(),
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

      // Draw decay visualization
      ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw reverb tail
      const decayTime = params.decay * 1000; // Convert to ms
      const tailPoints = [];

      for (let x = 0; x <= width; x += 2) {
        const time = (x / width) * Math.min(decayTime, 10000);
        const amplitude = Math.exp(-time / (decayTime * 0.3));
        const noise = Math.random() * 0.1 - 0.05;
        const y = height - (amplitude + noise) * height * 0.8;
        tailPoints.push({ x, y });
      }

      // Draw fill
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(59, 130, 246, 0.2)");
      gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx.beginPath();
      ctx.moveTo(0, height);
      tailPoints.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(width, height);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(59, 130, 246, 0.5)";
      tailPoints.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      );
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw pre-delay marker
      const preDelayX = (params.preDelay / 100) * width * 0.3;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(preDelayX, 0);
      ctx.lineTo(preDelayX, height);
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
            Space
          </h3>
          <div className="text-lg font-bold text-white leading-none">
            Reverb
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {params.decay.toFixed(1)}s
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-lg blur opacity-20 group-hover:opacity-30 transition"></div>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="relative w-full h-32 bg-slate-950 rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-2 gap-4">
          <ParameterSlider param={effect.params.decay} label="Decay Time" />
          <ParameterSlider param={effect.params.preDelay} label="Pre-Delay" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ParameterSlider param={effect.params.wet} label="Wet/Dry Mix" />
          <ParameterSlider param={effect.params.output} label="Output Level" />
        </div>
      </div>
    </div>
  );
};
