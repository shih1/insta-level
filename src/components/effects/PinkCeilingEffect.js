import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";
import { AudioParameter } from "./AudioParameter";

export class PinkCeilingEffect {
  constructor() {
    this.name = "Pink Ceiling";
    this.enabled = true;
    this.bypass = false;

    // Create gain node for output
    this.outputGain = new Tone.Gain(1);

    // FFT Analyser
    this.analyser = new Tone.Analyser("fft", 2048);

    // Connect analyser before gain
    this.analyser.connect(this.outputGain);

    this.input = this.analyser;
    this.output = this.outputGain;

    // Analysis state
    this.isAnalyzing = false;
    this.analysisComplete = false;
    this.maxSpectrum = null;
    this.pinkReference = null;
    this.calculatedGain = 0;

    // Create AudioParameters
    this.params = {
      fftSize: new AudioParameter("FFT Size", 2048, 512, 8192, "", (value) => {
        this.analyser.size = value;
      }),
      silenceThreshold: new AudioParameter("Silence Gate", -60, -80, -20, "dB"),
      pinkLevel: new AudioParameter("Pink Reference", -18, -30, -6, "dB"),
      outputGain: new AudioParameter(
        "Output Gain",
        0,
        -60,
        12,
        "dB",
        (value) => {
          this.outputGain.gain.value = Tone.dbToGain(value);
        }
      ),
    };

    // Generate pink noise reference on creation
    this.generatePinkReference();
  }

  generatePinkReference() {
    const fftSize = this.params.fftSize.getValue();
    this.pinkReference = new Float32Array(fftSize / 2);

    // Pink noise has 1/f characteristic (-3dB per octave)
    for (let i = 0; i < this.pinkReference.length; i++) {
      const freq = (i * Tone.getContext().sampleRate) / fftSize;
      if (freq > 0) {
        // Pink noise magnitude proportional to 1/sqrt(f)
        this.pinkReference[i] = 1.0 / Math.sqrt(freq);
      } else {
        this.pinkReference[i] = 1.0;
      }
    }

    // Normalize to reference level
    const refLevel = this.params.pinkLevel.getValue();
    const refLinear = Tone.dbToGain(refLevel);
    for (let i = 0; i < this.pinkReference.length; i++) {
      this.pinkReference[i] *= refLinear;
    }
  }

  startAnalysis() {
    this.isAnalyzing = true;
    this.analysisComplete = false;
    const fftSize = this.params.fftSize.getValue();
    this.maxSpectrum = new Float32Array(fftSize / 2).fill(-Infinity);
  }

  processAnalysisFrame() {
    if (!this.isAnalyzing) return;

    const freqData = this.analyser.getValue();
    const silenceThreshold = this.params.silenceThreshold.getValue();

    // Check if frame is above silence threshold
    let rms = 0;
    for (let i = 0; i < freqData.length; i++) {
      rms += Math.pow(10, freqData[i] / 20);
    }
    rms = 20 * Math.log10(Math.sqrt(rms / freqData.length));

    if (rms < silenceThreshold) return;

    // Update max spectrum (take maximum per bin)
    for (let i = 0; i < freqData.length; i++) {
      if (freqData[i] > this.maxSpectrum[i]) {
        this.maxSpectrum[i] = freqData[i];
      }
    }
  }

  completeAnalysis() {
    if (!this.maxSpectrum || !this.pinkReference) return;

    // Calculate gain needed so no bin exceeds pink reference
    let minGainOffset = Infinity;

    for (let i = 0; i < this.maxSpectrum.length; i++) {
      const measured = Tone.dbToGain(this.maxSpectrum[i]);
      const reference = this.pinkReference[i];

      if (measured > 0) {
        const gainNeeded = reference / measured;
        const gainDb = 20 * Math.log10(gainNeeded);
        minGainOffset = Math.min(minGainOffset, gainDb);
      }
    }

    this.calculatedGain = minGainOffset;
    this.params.outputGain.setValue(minGainOffset);
    this.isAnalyzing = false;
    this.analysisComplete = true;
  }

  getParameter(name) {
    return this.params[name];
  }

  setParameter(name, value) {
    if (this.params[name]) {
      this.params[name].setValue(value);
    }
  }

  setBypass(bypass) {
    this.bypass = bypass;
  }

  getFrequencyData() {
    return this.analyser.getValue();
  }

  getMaxSpectrum() {
    return this.maxSpectrum;
  }

  getPinkReference() {
    return this.pinkReference;
  }

  getToneNodes() {
    return [this.analyser, this.outputGain];
  }

  process(buffer) {
    if (this.isAnalyzing) {
      this.processAnalysisFrame();
    }
  }

  dispose() {
    this.analyser.dispose();
    this.outputGain.dispose();
  }
}

// UI Component
export const PinkCeilingControls = ({ effect }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [paramValues, setParamValues] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const handleAnalyze = () => {
    effect.startAnalysis();
    setIsAnalyzing(true);

    // Run analysis for 10 seconds or until stopped
    setTimeout(() => {
      effect.completeAnalysis();
      setIsAnalyzing(false);
    }, 10000);
  };

  const handleStop = () => {
    effect.completeAnalysis();
    setIsAnalyzing(false);
  };

  // Draw spectrum
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !effect) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, width, height);

      // Draw pink reference curve
      const pinkRef = effect.getPinkReference();
      if (pinkRef) {
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
          const binIndex = Math.floor((i / width) * pinkRef.length);
          const value = pinkRef[binIndex];
          const db = value > 0 ? 20 * Math.log10(value) : -100;
          const normalized = (db + 100) / 100;
          const y = height - normalized * height;

          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Draw measured max spectrum
      const maxSpec = effect.getMaxSpectrum();
      if (maxSpec) {
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
          const binIndex = Math.floor((i / width) * maxSpec.length);
          const value = maxSpec[binIndex];
          const normalized = (value + 100) / 100;
          const y = height - normalized * height;

          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
      }

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
      <div className="text-sm font-bold text-pink-400">PINK CEILING</div>

      {/* Spectrum Visualization */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <canvas ref={canvasRef} width={300} height={120} className="w-full" />
        <div className="p-2 text-xs text-gray-400">
          <span className="text-pink-400">■</span> Pink Reference
          <span className="ml-3 text-purple-400">■</span> Measured Max
        </div>
      </div>

      {/* Analysis Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="flex-1 px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-semibold transition-colors"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze"}
        </button>
        <button
          onClick={handleStop}
          disabled={!isAnalyzing}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded text-xs font-semibold transition-colors"
        >
          Stop
        </button>
      </div>

      {effect.analysisComplete && (
        <div className="bg-green-900/30 border border-green-700 rounded p-2 text-xs text-green-400">
          Analysis complete! Calculated gain: {effect.calculatedGain.toFixed(1)}{" "}
          dB
        </div>
      )}

      {/* FFT Size */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-400">FFT Window Size</label>
          <span className="text-xs text-white font-mono">
            {paramValues.fftSize}
          </span>
        </div>
        <select
          value={paramValues.fftSize || 2048}
          onChange={(e) => handleChange("fftSize", e.target.value)}
          className="w-full bg-gray-700 text-white rounded px-2 py-1 text-xs"
        >
          <option value="512">512</option>
          <option value="1024">1024</option>
          <option value="2048">2048</option>
          <option value="4096">4096</option>
          <option value="8192">8192</option>
        </select>
      </div>

      {/* Silence Threshold */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-400">Silence Gate</label>
          <span className="text-xs text-white font-mono">
            {effect.params.silenceThreshold?.getDisplayValue
              ? effect.params.silenceThreshold.getDisplayValue()
              : `${(paramValues.silenceThreshold || -60).toFixed(1)} dB`}
          </span>
        </div>
        <input
          type="range"
          min="-80"
          max="-20"
          step="1"
          value={paramValues.silenceThreshold || -60}
          onChange={(e) => handleChange("silenceThreshold", e.target.value)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
        />
      </div>

      {/* Pink Reference Level */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-400">Pink Reference Level</label>
          <span className="text-xs text-white font-mono">
            {effect.params.pinkLevel?.getDisplayValue
              ? effect.params.pinkLevel.getDisplayValue()
              : `${(paramValues.pinkLevel || -18).toFixed(1)} dB`}
          </span>
        </div>
        <input
          type="range"
          min="-30"
          max="-6"
          step="1"
          value={paramValues.pinkLevel || -18}
          onChange={(e) => handleChange("pinkLevel", e.target.value)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
        />
      </div>

      {/* Output Gain */}
      <div className="space-y-2 pt-3 border-t border-gray-700">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-400">Output Gain</label>
          <span className="text-xs text-white font-mono">
            {effect.params.outputGain?.getDisplayValue
              ? effect.params.outputGain.getDisplayValue()
              : `${paramValues.outputGain > 0 ? "+" : ""}${(
                  paramValues.outputGain || 0
                ).toFixed(1)} dB`}
          </span>
        </div>
        <input
          type="range"
          min="-60"
          max="12"
          step="0.5"
          value={paramValues.outputGain || 0}
          onChange={(e) => handleChange("outputGain", e.target.value)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
        />
      </div>
    </div>
  );
};
