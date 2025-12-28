import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";
import { AudioParameter } from "./AudioParameter";
import ParameterSlider from "./ParameterSlider";

export class DistortionEffect {
  constructor() {
    this.name = "Distortion";
    this.enabled = true;
    this.bypass = false;

    // Nodes
    this.preGain = new Tone.Gain(1);
    this.distortion = new Tone.Distortion({
      distortion: 0.4,
      oversample: "4x",
    });
    this.filter = new Tone.Filter({
      type: "lowpass",
      frequency: 8000,
    });
    this.wet = new Tone.CrossFade(0.5);
    this.inputGain = new Tone.Gain(1);
    this.outputGain = new Tone.Gain(0.7); // Reduce output to compensate for distortion
    this.analyser = new Tone.Analyser("waveform", 512);

    // Chain: input splits to dry and wet paths
    this.inputGain.connect(this.wet.a); // Dry
    this.inputGain.connect(this.preGain);
    this.preGain.connect(this.distortion);
    this.distortion.connect(this.filter);
    this.filter.connect(this.wet.b); // Wet
    this.wet.connect(this.outputGain);
    this.outputGain.connect(this.analyser);

    this.input = this.inputGain;
    this.output = this.outputGain;

    this.params = {
      drive: new AudioParameter("Drive", 40, 0, 100, "%", (val) => {
        // Map 0-100% to reasonable distortion range
        this.distortion.distortion = (val / 100) * 0.95;
        // Adjust pre-gain for more apparent drive
        this.preGain.gain.value = 1 + (val / 100) * 2;
      }),
      tone: new AudioParameter("Tone", 8000, 500, 12000, "Hz", (val) => {
        this.filter.frequency.rampTo(val, 0.1);
      }),
      wet: new AudioParameter("Mix", 50, 0, 100, "%", (val) => {
        this.wet.fade.value = val / 100;
      }),
      output: new AudioParameter("Output", -3, -24, 12, "dB", (val) => {
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
      this.preGain,
      this.distortion,
      this.filter,
      this.wet,
      this.outputGain,
      this.analyser,
    ].forEach((n) => n.dispose());
  }
}

export const DistortionControls = ({ effect }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [params, setParams] = useState({
    drive: 40,
    tone: 8000,
    wet: 50,
    output: -3,
  });

  useEffect(() => {
    const sync = () =>
      setParams({
        drive: effect.params.drive.getValue(),
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
      ctx.strokeStyle = "rgba(239, 68, 68, 0.1)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw transfer curve showing clipping
      const points = [];
      const distAmount = (params.drive / 100) * 0.95;

      for (let x = 0; x <= width; x += 2) {
        // Input range from -1 to 1
        const input = (x / width) * 2 - 1;

        // Soft clipping transfer function
        let output;
        if (Math.abs(input) < distAmount) {
          output = input / distAmount;
        } else {
          output = Math.sign(input);
        }

        // Apply some waveshaping
        output = Math.tanh(output * (1 + distAmount * 2));

        const y = height / 2 - output * height * 0.4;
        points.push({ x, y });
      }

      // Draw fill
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(239, 68, 68, 0.2)");
      gradient.addColorStop(0.5, "rgba(239, 68, 68, 0.1)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0)");

      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(width, height / 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
      points.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      );
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw waveform overlay
      const waveformData = effect.getWaveformData();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
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
            Overdrive
          </h3>
          <div className="text-lg font-bold text-white leading-none">
            Distortion
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono">{params.drive}%</div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-600 rounded-lg blur opacity-20 group-hover:opacity-30 transition"></div>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="relative w-full h-32 bg-slate-950 rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-2 gap-4">
          <ParameterSlider param={effect.params.drive} label="Drive Amount" />
          <ParameterSlider param={effect.params.tone} label="Tone Filter" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ParameterSlider param={effect.params.wet} label="Wet/Dry Mix" />
          <ParameterSlider param={effect.params.output} label="Output Level" />
        </div>
      </div>
    </div>
  );
};
