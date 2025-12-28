import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";
import { AudioParameter } from "./AudioParameter";
import ParameterSlider from "./ParameterSlider";

export class PinkCeilingEffect {
  constructor() {
    this.name = "Pink Ceiling";
    this.enabled = true;
    this.bypass = false;

    this.outputGain = new Tone.Gain(1);
    this.analyser = new Tone.Analyser("fft", 2048);
    this.outputGain.connect(this.analyser);

    this.input = this.outputGain;
    this.output = this.analyser;

    this.isAnalyzing = false;
    this.analysisComplete = false;
    this.maxSpectrum = null;
    this.pinkReference = null;
    this.calculatedGain = 0;

    this.params = {
      fftSize: new AudioParameter("FFT Size", 2048, 512, 8192, "", (val) => {
        this.analyser.size = val;
        this.generatePinkReference();
      }),
      silenceThreshold: new AudioParameter("Gate", -60, -80, -20, "dB"),
      pinkLevel: new AudioParameter("Ref Level", -18, -40, 0, "dB", () => {
        this.generatePinkReference();
      }),
      outputGain: new AudioParameter("Output", 0, -60, 12, "dB", (val) => {
        this.outputGain.gain.rampTo(Tone.dbToGain(val), 0.1);
      }),
    };

    this.generatePinkReference();
  }

  generatePinkReference() {
    const fftSize = this.params.fftSize.getValue();
    const refDb = this.params.pinkLevel.getValue();
    this.pinkReference = new Float32Array(fftSize / 2);

    for (let i = 0; i < this.pinkReference.length; i++) {
      const freq = (i * Tone.getContext().sampleRate) / fftSize;
      if (freq > 0) {
        // Pink noise falls off at -3dB per octave (1/sqrt(freq))
        // Store in dB for direct comparison with FFT output
        const pinkSlope = -10 * Math.log10(freq / 1000); // -3dB per octave relative to 1kHz
        this.pinkReference[i] = refDb + pinkSlope;
      } else {
        this.pinkReference[i] = refDb;
      }
    }
  }

  startAnalysis() {
    this.isAnalyzing = true;
    this.analysisComplete = false;
    this.maxSpectrum = new Float32Array(
      this.params.fftSize.getValue() / 2
    ).fill(-Infinity);
  }

  async analyzeFullBuffer(audioBuffer, onProgress) {
    if (!audioBuffer) return;
    this.startAnalysis();

    const fftSize = this.params.fftSize.getValue();
    const channelData = audioBuffer.getChannelData(0);
    const hopSize = fftSize / 2; // 50% overlap
    const totalChunks = Math.floor((channelData.length - fftSize) / hopSize);
    let chunkCount = 0;

    // Perform manual FFT analysis
    for (let i = 0; i <= channelData.length - fftSize; i += hopSize) {
      const chunk = channelData.slice(i, i + fftSize);

      // Apply Hann window to reduce spectral leakage
      const windowed = new Float32Array(fftSize);
      for (let j = 0; j < fftSize; j++) {
        const window = 0.5 * (1 - Math.cos((2 * Math.PI * j) / (fftSize - 1)));
        windowed[j] = chunk[j] * window;
      }

      // Compute FFT manually using the Web Audio API approach
      const spectrum = this.computeFFT(windowed);
      this.updateMaxSpectrum(spectrum);

      chunkCount++;
      if (onProgress && chunkCount % 50 === 0) {
        onProgress(Math.round((chunkCount / totalChunks) * 100));
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    this.completeAnalysis();
    if (onProgress) onProgress(100);
  }

  computeFFT(timeData) {
    const fftSize = timeData.length;
    const spectrum = new Float32Array(fftSize / 2);

    // Simple DFT for magnitude spectrum
    for (let k = 0; k < fftSize / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let n = 0; n < fftSize; n++) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        real += timeData[n] * Math.cos(angle);
        imag -= timeData[n] * Math.sin(angle);
      }

      // Magnitude in linear scale
      const magnitude = Math.sqrt(real * real + imag * imag) / fftSize;

      // Convert to dB (with floor to avoid log(0))
      spectrum[k] = magnitude > 0 ? 20 * Math.log10(magnitude + 1e-10) : -100;
    }

    return spectrum;
  }

  updateMaxSpectrum(freqData) {
    const silenceThresholdDb = this.params.silenceThreshold.getValue();

    for (let i = 0; i < freqData.length; i++) {
      // Only update if signal is above silence threshold
      if (freqData[i] > silenceThresholdDb) {
        if (freqData[i] > this.maxSpectrum[i]) {
          this.maxSpectrum[i] = freqData[i];
        }
      }
    }
  }

  completeAnalysis() {
    if (!this.maxSpectrum) return;

    const fftSize = this.params.fftSize.getValue();
    const sampleRate = Tone.getContext().sampleRate;

    // Start at 20Hz (skip DC offset and sub-bass)
    const startBin = Math.ceil((20 * fftSize) / sampleRate);
    // End at 16kHz (avoid noise in high frequencies)
    const endBin = Math.min(
      Math.floor((16000 * fftSize) / sampleRate),
      this.maxSpectrum.length
    );

    let sumGainOffset = 0;
    let validBins = 0;

    for (let i = startBin; i < endBin; i++) {
      const measuredDb = this.maxSpectrum[i];
      const referenceDb = this.pinkReference[i];

      // Skip bins that never exceeded silence threshold
      if (measuredDb === -Infinity) continue;

      // Calculate gain needed to match reference (in dB)
      const gainOffsetDb = referenceDb - measuredDb;

      sumGainOffset += gainOffsetDb;
      validBins++;
    }

    if (validBins > 0) {
      // Use average offset across all valid bins
      this.calculatedGain = sumGainOffset / validBins;

      // Clamp to parameter limits
      const minGain = this.params.outputGain.min;
      const maxGain = this.params.outputGain.max;
      this.calculatedGain = Math.max(
        minGain,
        Math.min(maxGain, this.calculatedGain)
      );

      this.params.outputGain.setValue(this.calculatedGain);
    }

    this.isAnalyzing = false;
    this.analysisComplete = true;
  }

  process(buffer) {
    // Audio processing is handled by Tone.js signal chain
    // This method exists to satisfy the AudioFX interface
    // The actual processing happens through the connected Tone nodes
  }

  getLiveSpectrum() {
    // Get current FFT data from the analyser
    return this.analyser.getValue();
  }

  getToneNodes() {
    return [this.outputGain, this.analyser];
  }
  dispose() {
    this.analyser.dispose();
    this.outputGain.dispose();
  }
}

export const PinkCeilingControls = ({ effect, trackId, engineRef }) => {
  const canvasRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFullCapture = async () => {
    if (!engineRef?.current) return;
    setIsAnalyzing(true);
    setProgress(0);

    // FIXED PATH: b.tonePlayer.buffer based on AudioBus.js
    const bus = engineRef.current.graph.buses.find((b) => b.id === trackId);
    const buffer = bus?.tonePlayer?.buffer;

    if (buffer && buffer.loaded) {
      await effect.analyzeFullBuffer(buffer.get(), (p) => setProgress(p));
    } else {
      alert("Audio file not found or not yet loaded on this bus.");
    }
    setIsAnalyzing(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const { width, height } = canvas;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      const getX = (i, len) => {
        const freq = (i / len) * 22050;
        return (
          (Math.log10(Math.max(20, freq) / 20) / Math.log10(22050 / 20)) * width
        );
      };

      // Draw grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      [100, 1000, 10000].forEach((f) => {
        const x = (Math.log10(f / 20) / Math.log10(22050 / 20)) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      });

      // Draw 0dB line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.setLineDash([2, 2]);
      const zeroDbY = height - ((0 + 100) / 100) * height;
      ctx.beginPath();
      ctx.moveTo(0, zeroDbY);
      ctx.lineTo(width, zeroDbY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Pink Reference (dashed pink line)
      if (effect.pinkReference) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(236, 72, 153, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        effect.pinkReference.forEach((val, i) => {
          const x = getX(i, effect.pinkReference.length);
          const y = height - ((val + 100) / 100) * height;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Max Captured Spectrum (solid purple/blue line)
      if (effect.maxSpectrum && effect.analysisComplete) {
        ctx.beginPath();
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(139, 92, 246, 0.5)";
        effect.maxSpectrum.forEach((val, i) => {
          if (val === -Infinity) return;
          const x = getX(i, effect.maxSpectrum.length);
          const y = height - ((val + 100) / 100) * height;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw Live Spectrum (bright cyan, semi-transparent)
      const liveSpectrum = effect.getLiveSpectrum();
      if (liveSpectrum && liveSpectrum.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = isAnalyzing
          ? "rgba(251, 113, 133, 0.6)"
          : "rgba(34, 211, 238, 0.7)";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = isAnalyzing
          ? "rgba(251, 113, 133, 0.3)"
          : "rgba(34, 211, 238, 0.3)";
        liveSpectrum.forEach((val, i) => {
          const x = getX(i, liveSpectrum.length);
          const y = height - ((val + 100) / 100) * height;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [effect, isAnalyzing]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-6 shadow-2xl w-80">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-[10px] font-black text-pink-500 uppercase tracking-widest">
            Ceiling
          </h3>
          <div className="text-lg font-bold text-white leading-none tracking-tight">
            Capture
          </div>
        </div>
        <button
          onClick={handleFullCapture}
          disabled={isAnalyzing}
          className={`relative overflow-hidden px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${
            isAnalyzing
              ? "bg-slate-800 text-pink-400"
              : "bg-pink-600 text-white hover:bg-pink-500 active:scale-95"
          }`}
        >
          <span className="relative z-10">
            {isAnalyzing ? `Scanning ${progress}%` : "Analyze File"}
          </span>
          {isAnalyzing && (
            <div
              className="absolute left-0 top-0 h-full bg-pink-500/20 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          )}
        </button>
      </div>

      <div className="bg-slate-950 rounded-lg overflow-hidden border border-white/5 h-32 shadow-inner relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={128}
          className="w-full h-full"
        />
        <div className="absolute top-2 right-2 text-[9px] font-mono space-y-1">
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-sm">
            <div
              className="w-3 h-0.5 bg-pink-500 opacity-50"
              style={{ borderTop: "2px dashed" }}
            ></div>
            <span className="text-pink-400">Reference</span>
          </div>
          {effect.analysisComplete && (
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-sm">
              <div className="w-3 h-0.5 bg-purple-500"></div>
              <span className="text-purple-400">Captured</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-sm">
            <div className="w-3 h-0.5 bg-cyan-400"></div>
            <span className="text-cyan-400">Live</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <ParameterSlider param={effect.params.pinkLevel} label="Reference" />
          <ParameterSlider
            param={effect.params.silenceThreshold}
            label="Gate"
          />
        </div>
        <div className="pt-3 border-t border-slate-800">
          <ParameterSlider
            param={effect.params.outputGain}
            label="Target Offset"
          />
        </div>
      </div>
    </div>
  );
};
