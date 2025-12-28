import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";
import { AudioParameter, BooleanParameter } from "./AudioParameter";

export class EQEffect {
  constructor() {
    this.name = "EQ";
    this.enabled = true;
    this.bypass = false;

    // High-pass filter at 80 Hz
    this.highPass = new Tone.Filter({
      type: "highpass",
      frequency: 80,
      rolloff: -12,
    });

    // Low shelf at 100 Hz
    this.lowShelf = new Tone.Filter({
      type: "lowshelf",
      frequency: 100,
      gain: 0,
    });

    // Mid peak filter (sweepable 120 Hz - 7.5 kHz)
    this.midPeak = new Tone.Filter({
      type: "peaking",
      frequency: 1000,
      Q: 1,
      gain: 0,
    });

    // High shelf + low-pass combo
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

    // Output gain
    this.outputGain = new Tone.Gain(1);

    // FFT Analyser for spectrum visualization
    this.analyser = new Tone.Analyser("fft", 512);

    // Chain: highPass -> lowShelf -> midPeak -> highShelf -> lowPass -> outputGain
    this.highPass.chain(
      this.lowShelf,
      this.midPeak,
      this.highShelf,
      this.lowPass,
      this.outputGain
    );

    // Also connect to analyser for visualization
    this.outputGain.connect(this.analyser);

    this.input = this.highPass;
    this.output = this.outputGain;

    // Create AudioParameters
    this.params = {
      hpEnabled: new BooleanParameter("HP 80Hz", false, (value) => {
        this.highPass.frequency.value = value ? 80 : 20;
      }),
      lowGain: new AudioParameter("Low", 0, -15, 15, "dB", (value) => {
        this.lowShelf.gain.value = value;
      }),
      midGain: new AudioParameter("Mid", 0, -12, 12, "dB", (value) => {
        this.midPeak.gain.value = value;
      }),
      midFreq: new AudioParameter(
        "Mid Freq",
        1000,
        120,
        7500,
        "Hz",
        (value) => {
          this.midPeak.frequency.value = value;
        }
      ),
      highGain: new AudioParameter("High", 0, -15, 15, "dB", (value) => {
        this.highShelf.gain.value = value;
        // Adjust low-pass when attenuating
        if (value < 0) {
          const normalized = (value + 15) / 15;
          const cutoff = 8000 + normalized * 12000;
          this.lowPass.frequency.value = cutoff;
        } else {
          this.lowPass.frequency.value = 20000;
        }
      }),
      output: new AudioParameter("Output", 0, -12, 12, "dB", (value) => {
        this.outputGain.gain.value = Tone.dbToGain(value);
      }),
    };
  }

  getParameter(name) {
    return this.params[name];
  }

  setParameter(name, value) {
    if (this.params[name]) {
      this.params[name].setValue(value);
    }
  }

  getBypass(bypass) {
    this.bypass = bypass;
  }

  getFrequencyData() {
    return this.analyser.getValue();
  }

  getToneNodes() {
    return [this.highPass, this.outputGain];
  }

  process(buffer) {
    // Processing happens automatically through Tone.js chain
  }

  dispose() {
    this.highPass.dispose();
    this.lowShelf.dispose();
    this.midPeak.dispose();
    this.highShelf.dispose();
    this.lowPass.dispose();
    this.outputGain.dispose();
    this.analyser.dispose();
  }
}

// UI Component for Channel EQ controls
export const EQControls = ({ effect, onParamChange }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [paramValues, setParamValues] = useState({});

  // Subscribe to parameter changes
  useEffect(() => {
    if (!effect) return;

    const listeners = {};

    Object.entries(effect.params).forEach(([key, param]) => {
      const listener = (value) => {
        setParamValues((prev) => ({ ...prev, [key]: value }));
      };
      param.addListener(listener);
      listeners[key] = listener;
      // Initialize with current value
      setParamValues((prev) => ({ ...prev, [key]: param.getValue() }));
    });

    return () => {
      Object.entries(effect.params).forEach(([key, param]) => {
        if (listeners[key]) {
          param.removeListener(listeners[key]);
        }
      });
    };
  }, [effect]);

  const handleChange = (paramName, value) => {
    effect.setParameter(paramName, parseFloat(value));
  };

  const handleToggle = (paramName) => {
    const param = effect.getParameter(paramName);
    if (param) {
      param.toggle();
    }
  };

  // Draw spectrum
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !effect) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      // Get FFT data
      const freqData = effect.getFrequencyData();

      // Clear canvas
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, width, height);

      // Draw frequency spectrum
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 2;
      ctx.beginPath();

      const barWidth = width / freqData.length;

      for (let i = 0; i < freqData.length; i++) {
        const value = freqData[i];
        const normalizedValue = (value + 100) / 100; // Normalize from -100 to 0
        const barHeight = normalizedValue * height;
        const x = i * barWidth;
        const y = height - barHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      // Draw EQ curve overlay
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();

      // Simplified EQ curve visualization
      for (let i = 0; i < width; i++) {
        const freq = 20 * Math.pow(20000 / 20, i / width); // Log scale
        let gain = 0;

        // Low shelf influence at 100 Hz
        if (freq < 200) {
          gain += paramValues.lowGain * (1 - freq / 200);
        }

        // Mid peak influence
        const midDist = Math.abs(Math.log(freq / paramValues.midFreq));
        if (midDist < 1) {
          gain += paramValues.midGain * (1 - midDist);
        }

        // High shelf influence
        if (freq > 4000) {
          gain += paramValues.highGain * ((freq - 4000) / 16000);
        }

        const y = height / 2 - (gain * height) / 40; // Scale gain to pixels

        if (i === 0) {
          ctx.moveTo(i, y);
        } else {
          ctx.lineTo(i, y);
        }
      }

      ctx.stroke();
      ctx.globalAlpha = 1;

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [effect, paramValues]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="text-sm font-bold text-pink-400">CHANNEL EQ</div>

      {/* Spectrum Visualization */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <canvas ref={canvasRef} width={300} height={120} className="w-full" />
      </div>

      {/* HP 80 Hz Switch */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-700">
        <label className="text-xs text-gray-400">HP 80 Hz</label>
        <button
          onClick={() => handleToggle("hpEnabled")}
          className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
            paramValues.hpEnabled
              ? "bg-pink-500 text-white"
              : "bg-gray-700 text-gray-400"
          }`}
        >
          {paramValues.hpEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* Low Shelf (100 Hz) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-400">LOW (100 Hz)</label>
          <span className="text-xs text-white font-mono">
            {effect.params.lowGain.getDisplayValue()}
          </span>
        </div>
        <input
          type="range"
          min="-15"
          max="15"
          step="0.5"
          value={paramValues.lowGain || 0}
          onChange={(e) => handleChange("lowGain", e.target.value)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
        />
      </div>

      {/* Mid Peak (Sweepable) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-400">MID</label>
          <span className="text-xs text-white font-mono">
            {effect.params.midGain.getDisplayValue()}
          </span>
        </div>
        <input
          type="range"
          min="-12"
          max="12"
          step="0.5"
          value={paramValues.midGain || 0}
          onChange={(e) => handleChange("midGain", e.target.value)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
        />
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-500">Freq</label>
          <span className="text-xs text-gray-400 font-mono">
            {effect.params.midFreq.getDisplayValue()}
          </span>
        </div>
        <input
          type="range"
          min="120"
          max="7500"
          step="10"
          value={paramValues.midFreq || 1000}
          onChange={(e) => handleChange("midFreq", e.target.value)}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-400"
        />
      </div>

      {/* High Shelf + Low-pass combo */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-400">HIGH</label>
          <span className="text-xs text-white font-mono">
            {effect.params.highGain.getDisplayValue()}
          </span>
        </div>
        <input
          type="range"
          min="-15"
          max="15"
          step="0.5"
          value={paramValues.highGain || 0}
          onChange={(e) => handleChange("highGain", e.target.value)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
        />
        {paramValues.highGain < 0 && (
          <div className="text-xs text-gray-500 italic">
            LP cutoff:{" "}
            {(8000 + ((paramValues.highGain + 15) / 15) * 12000).toFixed(0)} Hz
          </div>
        )}
      </div>

      {/* Output Gain */}
      <div className="space-y-2 pt-3 border-t border-gray-700">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-400">OUTPUT</label>
          <span className="text-xs text-white font-mono">
            {effect.params.output.getDisplayValue()}
          </span>
        </div>
        <input
          type="range"
          min="-12"
          max="12"
          step="0.5"
          value={paramValues.output || 0}
          onChange={(e) => handleChange("output", e.target.value)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
        />
      </div>
    </div>
  );
};
