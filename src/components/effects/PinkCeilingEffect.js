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
      fftSize: new AudioParameter("FFT Size", 2048, 512, 16384, "", (val) => {
        // Ensure value is power of 2
        const pow2 = Math.pow(2, Math.round(Math.log2(val)));
        this.analyser.size = pow2;
        this.generatePinkReference();
      }),
      silenceThreshold: new AudioParameter("Gate", -60, -80, -20, "dB"),
      pinkLevel: new AudioParameter("Ref Level", -18, -100, 0, "dB", () => {
        this.generatePinkReference();
      }),
      pinkSlope: new AudioParameter("Slope", -3, -6, 0, "dB/oct", () => {
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
    const slopeDbPerOctave = this.params.pinkSlope.getValue();
    this.pinkReference = new Float32Array(fftSize / 2);

    for (let i = 0; i < this.pinkReference.length; i++) {
      const freq = (i * Tone.getContext().sampleRate) / fftSize;
      if (freq > 0) {
        // Adjustable slope in dB per octave relative to 1kHz
        const octavesFrom1k = Math.log2(freq / 1000);
        const pinkSlope = slopeDbPerOctave * octavesFrom1k;
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
    const hopSize = fftSize / 4; // 75% overlap

    const totalChunks = Math.floor((channelData.length - fftSize) / hopSize);
    let chunkCount = 0;

    // Process in batches to avoid blocking
    const batchSize = 50;

    for (let i = 0; i <= channelData.length - fftSize; i += hopSize) {
      const chunk = new Float32Array(fftSize);

      // Apply Hann window while copying
      for (let j = 0; j < fftSize; j++) {
        const window = 0.5 * (1 - Math.cos((2 * Math.PI * j) / fftSize));
        chunk[j] = channelData[i + j] * window;
      }

      // Fast FFT using Cooley-Tukey algorithm
      const fftResult = this.cooleyTukeyFFT(chunk);
      const spectrum = this.computeMagnitudeSpectrum(fftResult);
      this.updateMaxSpectrum(spectrum);

      chunkCount++;

      // Yield to UI every batch
      if (chunkCount % batchSize === 0) {
        if (onProgress) {
          onProgress(Math.round((chunkCount / totalChunks) * 100));
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    this.completeAnalysis();
    if (onProgress) onProgress(100);
  }

  cooleyTukeyFFT(x) {
    const N = x.length;

    // Base case
    if (N <= 1) {
      return [{ re: x[0] || 0, im: 0 }];
    }

    // Check if N is power of 2
    if (N & (N - 1)) {
      // Not a power of 2, pad to next power of 2
      const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
      const padded = new Float32Array(nextPow2);
      padded.set(x);
      return this.cooleyTukeyFFT(padded);
    }

    // Divide
    const even = new Float32Array(N / 2);
    const odd = new Float32Array(N / 2);
    for (let i = 0; i < N / 2; i++) {
      even[i] = x[i * 2];
      odd[i] = x[i * 2 + 1];
    }

    // Conquer
    const evenFFT = this.cooleyTukeyFFT(even);
    const oddFFT = this.cooleyTukeyFFT(odd);

    // Combine
    const result = new Array(N);
    for (let k = 0; k < N / 2; k++) {
      const angle = (-2 * Math.PI * k) / N;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const tRe = cos * oddFFT[k].re - sin * oddFFT[k].im;
      const tIm = cos * oddFFT[k].im + sin * oddFFT[k].re;

      result[k] = {
        re: evenFFT[k].re + tRe,
        im: evenFFT[k].im + tIm,
      };

      result[k + N / 2] = {
        re: evenFFT[k].re - tRe,
        im: evenFFT[k].im - tIm,
      };
    }

    return result;
  }

  computeMagnitudeSpectrum(fftResult) {
    const N = fftResult.length;
    const spectrum = new Float32Array(N / 2);

    for (let i = 0; i < N / 2; i++) {
      const magnitude =
        Math.sqrt(
          fftResult[i].re * fftResult[i].re + fftResult[i].im * fftResult[i].im
        ) / N;
      spectrum[i] = magnitude > 1e-10 ? 20 * Math.log10(magnitude) : -100;
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

    let minGainOffset = Infinity;

    for (let i = startBin; i < endBin; i++) {
      const measuredDb = this.maxSpectrum[i];
      const referenceDb = this.pinkReference[i];

      // Skip bins that never exceeded silence threshold
      if (measuredDb === -Infinity) continue;

      // Calculate gain needed to match reference (in dB)
      const gainOffsetDb = referenceDb - measuredDb;

      // Use the MINIMUM gain needed (peak matching - prevents clipping)
      if (gainOffsetDb < minGainOffset) {
        minGainOffset = gainOffsetDb;
      }
    }

    if (minGainOffset !== Infinity) {
      this.calculatedGain = minGainOffset;

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

      // Draw grid lines with frequency labels
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";

      [100, 1000, 10000].forEach((f) => {
        const x = (Math.log10(f / 20) / Math.log10(22050 / 20)) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Frequency labels at bottom
        ctx.fillText(f >= 1000 ? `${f / 1000}k` : f, x, height - 2);
      });

      // Draw horizontal dB lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.textAlign = "right";
      [-60, -40, -20, 0].forEach((db) => {
        const y = height - ((db + 100) / 100) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // dB labels on left
        ctx.fillText(`${db}dB`, width - 3, y - 2);
      });

      // Draw 0dB line more prominently
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
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
        ctx.strokeStyle = "rgba(236, 72, 153, 0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        let firstPoint = true;
        effect.pinkReference.forEach((val, i) => {
          const x = getX(i, effect.pinkReference.length);
          const y = height - ((val + 100) / 100) * height;
          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Label for pink reference line
        const labelFreq = 500; // Label at 500Hz
        const labelBin = Math.round(
          (labelFreq * effect.pinkReference.length * 2) / 44100
        );
        if (labelBin < effect.pinkReference.length) {
          const labelX = getX(labelBin, effect.pinkReference.length);
          const labelY =
            height - ((effect.pinkReference[labelBin] + 100) / 100) * height;
          ctx.fillStyle = "rgba(236, 72, 153, 0.9)";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "left";
          ctx.fillText("REF", labelX + 5, labelY - 5);
        }
      }

      // Draw Max Captured Spectrum (solid purple/blue line)
      if (effect.maxSpectrum && effect.analysisComplete) {
        ctx.beginPath();
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(139, 92, 246, 0.5)";
        let firstPoint = true;
        let maxY = -Infinity;
        let maxX = 0;
        effect.maxSpectrum.forEach((val, i) => {
          if (val === -Infinity) return;
          const x = getX(i, effect.maxSpectrum.length);
          const y = height - ((val + 100) / 100) * height;
          if (y < maxY || maxY === -Infinity) {
            maxY = y;
            maxX = x;
          }
          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Label for captured spectrum
        if (maxY !== -Infinity) {
          ctx.fillStyle = "#8b5cf6";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.fillText("CAPTURED", maxX, maxY - 5);
        }
      }

      // Draw Adjusted Spectrum (captured + output gain offset)
      if (effect.maxSpectrum && effect.analysisComplete) {
        const outputGainDb = effect.params.outputGain.getValue();
        ctx.beginPath();
        ctx.strokeStyle = "#10b981"; // green color
        ctx.lineWidth = 2;
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(16, 185, 129, 0.5)";
        let firstPoint = true;
        let maxY = -Infinity;
        let maxX = 0;
        effect.maxSpectrum.forEach((val, i) => {
          if (val === -Infinity) return;
          const adjustedVal = val + outputGainDb;
          const x = getX(i, effect.maxSpectrum.length);
          const y = height - ((adjustedVal + 100) / 100) * height;
          if (y < maxY || maxY === -Infinity) {
            maxY = y;
            maxX = x;
          }
          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Label for adjusted spectrum
        if (maxY !== -Infinity) {
          ctx.fillStyle = "#10b981";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.fillText("ADJUSTED", maxX, maxY - 5);
        }
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
        let firstPoint = true;
        liveSpectrum.forEach((val, i) => {
          const x = getX(i, liveSpectrum.length);
          const y = height - ((val + 100) / 100) * height;
          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
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
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <ParameterSlider param={effect.params.pinkLevel} label="Reference" />
          <ParameterSlider param={effect.params.pinkSlope} label="Slope" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ParameterSlider
            param={effect.params.silenceThreshold}
            label="Gate"
          />
          <ParameterSlider param={effect.params.fftSize} label="FFT Size" />
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
