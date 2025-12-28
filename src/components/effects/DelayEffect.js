import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";
import { AudioParameter } from "./AudioParameter";
import ParameterSlider from "./ParameterSlider";

export class DelayEffect {
  constructor() {
    this.name = "Delay";
    this.enabled = true;
    this.bypass = false;

    // Nodes
    this.feedbackDelay = new Tone.FeedbackDelay({
      delayTime: 0.25,
      feedback: 0.4,
    });

    this.filter = new Tone.Filter({
      type: "lowpass",
      frequency: 5000,
    });

    this.wet = new Tone.CrossFade(0.3);
    this.inputGain = new Tone.Gain(1);
    this.outputGain = new Tone.Gain(1);
    this.analyser = new Tone.Analyser("waveform", 512);

    // Chain: input splits to dry and wet paths
    this.inputGain.connect(this.wet.a); // Dry
    this.inputGain.connect(this.feedbackDelay);
    this.feedbackDelay.connect(this.filter);
    this.filter.connect(this.wet.b); // Wet
    this.wet.connect(this.outputGain);
    this.outputGain.connect(this.analyser);

    this.input = this.inputGain;
    this.output = this.outputGain;

    this.params = {
      time: new AudioParameter("Time", 250, 10, 2000, "ms", (val) => {
        this.feedbackDelay.delayTime.rampTo(val / 1000, 0.1);
      }),
      feedback: new AudioParameter("Feedback", 40, 0, 95, "%", (val) => {
        this.feedbackDelay.feedback.value = val / 100;
      }),
      tone: new AudioParameter("Tone", 5000, 500, 10000, "Hz", (val) => {
        this.filter.frequency.rampTo(val, 0.1);
      }),
      wet: new AudioParameter("Mix", 30, 0, 100, "%", (val) => {
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

  getWaveformData() {
    return this.analyser.getValue();
  }

  dispose() {
    [
      this.inputGain,
      this.feedbackDelay,
      this.filter,
      this.wet,
      this.outputGain,
      this.analyser,
    ].forEach((n) => n.dispose());
  }
}

export const DelayControls = ({ effect }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [params, setParams] = useState({
    time: 250,
    feedback: 40,
    tone: 5000,
    wet: 30,
    output: 0,
  });

  useEffect(() => {
    const sync = () =>
      setParams({
        time: effect.params.time.getValue(),
        feedback: effect.params.feedback.getValue(),
        tone: effect.params.tone.getValue(),
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

      // Draw grid
      ctx.strokeStyle = "rgba(168, 85, 247, 0.1)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw delay taps
      const numTaps = Math.min(8, Math.floor(2000 / params.time));
      const feedbackMult = params.feedback / 100;

      for (let i = 0; i < numTaps; i++) {
        const x = (((i + 1) * params.time) / 2000) * width;
        const amplitude = Math.pow(feedbackMult, i);
        const barHeight = amplitude * height * 0.7;

        // Draw bar
        const gradient = ctx.createLinearGradient(
          0,
          height,
          0,
          height - barHeight
        );
        gradient.addColorStop(0, "rgba(168, 85, 247, 0.6)");
        gradient.addColorStop(1, "rgba(168, 85, 247, 0.2)");

        ctx.fillStyle = gradient;
        ctx.fillRect(x - 4, height - barHeight, 8, barHeight);

        // Draw glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(168, 85, 247, 0.5)";
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, height - barHeight, 8, barHeight);
        ctx.shadowBlur = 0;
      }

      // Draw waveform overlay
      const waveformData = effect.getWaveformData();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(168, 85, 247, 0.3)";
      ctx.lineWidth = 1;
      waveformData.forEach((v, i) => {
        const x = (i / waveformData.length) * width;
        const y = ((v + 1) / 2) * height;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

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
            Echo
          </h3>
          <div className="text-lg font-bold text-white leading-none">Delay</div>
        </div>
        <div className="text-xs text-slate-400 font-mono">{params.time}ms</div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg blur opacity-20 group-hover:opacity-30 transition"></div>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="relative w-full h-32 bg-slate-950 rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-2 gap-4">
          <ParameterSlider param={effect.params.time} label="Delay Time" />
          <ParameterSlider param={effect.params.feedback} label="Feedback" />
        </div>

        <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5 space-y-4">
          <ParameterSlider param={effect.params.tone} label="Tone Filter" />
          <ParameterSlider param={effect.params.wet} label="Wet/Dry Mix" />
        </div>

        <div className="pt-2 border-t border-slate-800">
          <ParameterSlider param={effect.params.output} label="Output Level" />
        </div>
      </div>
    </div>
  );
};
