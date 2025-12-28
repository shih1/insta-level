import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";
import { AudioParameter } from "./AudioParameter";
import ParameterSlider from "./ParameterSlider";

export class ChorusEffect {
  constructor() {
    this.name = "Chorus";
    this.enabled = true;
    this.bypass = false;

    // Nodes
    this.chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      type: "sine",
    });

    this.wet = new Tone.CrossFade(0.5);
    this.inputGain = new Tone.Gain(1);
    this.outputGain = new Tone.Gain(1);
    this.analyser = new Tone.Analyser("fft", 512);

    // Chain: input splits to dry and wet paths
    this.inputGain.connect(this.wet.a); // Dry
    this.inputGain.connect(this.chorus);
    this.chorus.connect(this.wet.b); // Wet
    this.wet.connect(this.outputGain);
    this.outputGain.connect(this.analyser);

    this.input = this.inputGain;
    this.output = this.outputGain;

    // Start the LFO
    this.chorus.start();

    this.params = {
      rate: new AudioParameter("Rate", 1.5, 0.1, 10, "Hz", (val) => {
        this.chorus.frequency.value = val;
      }),
      depth: new AudioParameter("Depth", 70, 0, 100, "%", (val) => {
        this.chorus.depth = val / 100;
      }),
      delay: new AudioParameter("Delay", 3.5, 2, 20, "ms", (val) => {
        this.chorus.delayTime = val;
      }),
      wet: new AudioParameter("Mix", 50, 0, 100, "%", (val) => {
        this.wet.fade.value = val / 100;
      }),
      output: new AudioParameter("Output", 0, -12, 12, "dB", (val) => {
        this.outputGain.gain.rampTo(Tone.dbToGain(val), 0.1);
      }),
    };
  }

  process(buffer) {
    // Audio processing is handled by Tone.js signal chain
  }

  getFrequencyData() {
    return this.analyser.getValue();
  }

  dispose() {
    this.chorus.stop();
    [
      this.inputGain,
      this.chorus,
      this.wet,
      this.outputGain,
      this.analyser,
    ].forEach((n) => n.dispose());
  }
}

export const ChorusControls = ({ effect }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const phaseRef = useRef(0);
  const [params, setParams] = useState({
    rate: 1.5,
    depth: 70,
    delay: 3.5,
    wet: 50,
    output: 0,
  });

  useEffect(() => {
    const sync = () =>
      setParams({
        rate: effect.params.rate.getValue(),
        depth: effect.params.depth.getValue(),
        delay: effect.params.delay.getValue(),
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

      phaseRef.current += params.rate * 0.016; // Approximate frame time

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = "rgba(34, 197, 94, 0.1)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw modulation waves (3 voices)
      const voices = 3;
      const colors = [
        "rgba(34, 197, 94, 0.6)",
        "rgba(34, 197, 94, 0.4)",
        "rgba(34, 197, 94, 0.3)",
      ];

      for (let voice = 0; voice < voices; voice++) {
        const phaseOffset = (voice / voices) * Math.PI * 2;
        const points = [];

        for (let x = 0; x <= width; x += 3) {
          const t = (x / width) * Math.PI * 4;
          const modulation = Math.sin(t + phaseRef.current + phaseOffset);
          const amplitude = (params.depth / 100) * 0.35;
          const y = height / 2 + modulation * amplitude * height;
          points.push({ x, y });
        }

        // Draw fill
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(
          0,
          colors[voice]
            .replace("0.6", "0.2")
            .replace("0.4", "0.15")
            .replace("0.3", "0.1")
        );
        gradient.addColorStop(
          1,
          colors[voice]
            .replace("0.6", "0")
            .replace("0.4", "0")
            .replace("0.3", "0")
        );

        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(width, height / 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = colors[voice];
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = colors[voice];
        points.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
        );
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Center line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
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
            Modulation
          </h3>
          <div className="text-lg font-bold text-white leading-none">
            Chorus
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {params.rate.toFixed(1)} Hz
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
          <ParameterSlider param={effect.params.rate} label="LFO Rate" />
          <ParameterSlider param={effect.params.depth} label="LFO Depth" />
        </div>

        <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5 space-y-4">
          <ParameterSlider param={effect.params.delay} label="Voice Delay" />
          <ParameterSlider param={effect.params.wet} label="Wet/Dry Mix" />
        </div>

        <div className="pt-2 border-t border-slate-800">
          <ParameterSlider param={effect.params.output} label="Output Level" />
        </div>
      </div>
    </div>
  );
};
