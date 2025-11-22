import React, { useState } from "react";
import { Upload, X, Music, Activity } from "lucide-react";

const App = () => {
  const [stems, setStems] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [diagnostics, setDiagnostics] = useState("");

  const PINK_NOISE_TARGET = -12; // dBFS
  const SILENCE_THRESHOLD = -60; // dBFS

  const addDiagnostic = (msg) => {
    setDiagnostics((prev) => prev + msg + "\n");
  };

  const categorizeFile = (filename) => {
    const lower = filename.toLowerCase();
    if (/kick|snare|hat|cymbal|perc|beat|drum/.test(lower)) return "Drums";
    if (/bass|sub|808|low/.test(lower)) return "Bass";
    if (/vocal|vox|voice|lead|sing/.test(lower)) return "Vocals";
    if (/synth|pad|keys|piano/.test(lower)) return "Synth";
    if (/guitar|gtr|acoustic|electric/.test(lower)) return "Guitar";
    if (/fx|effect|riser|sweep|impact/.test(lower)) return "FX";
    return "Misc";
  };

  const cleanFilename = (filename) => {
    return filename
      .replace(/\.[^/.]+$/, "") // Remove extension
      .replace(/[_-]+/g, " ") // Replace underscores/dashes with spaces
      .replace(/\d+/g, "") // Remove numbers
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .trim();
  };

  const analyzeAudioBuffer = (audioBuffer, filename) => {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Silence detection and RMS calculation
    let sumSquares = 0;
    let nonSilentSamples = 0;
    let peak = 0;

    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.abs(channelData[i]);
      peak = Math.max(peak, sample);

      const sampleDb = 20 * Math.log10(sample + 1e-10);
      if (sampleDb > SILENCE_THRESHOLD) {
        sumSquares += channelData[i] * channelData[i];
        nonSilentSamples++;
      }
    }

    const rms = Math.sqrt(sumSquares / (nonSilentSamples || 1));
    const rmsDb = 20 * Math.log10(rms + 1e-10);
    const peakDb = 20 * Math.log10(peak + 1e-10);
    const crestFactor = peakDb - rmsDb;

    // Spectral analysis (simplified)
    const fftSize = 2048;
    const numBins = Math.floor(channelData.length / fftSize);
    let spectralCentroid = 0;
    let totalMagnitude = 0;

    for (let bin = 0; bin < Math.min(numBins, 100); bin++) {
      const start = bin * fftSize;
      let magnitude = 0;
      for (let i = start; i < start + fftSize && i < channelData.length; i++) {
        magnitude += Math.abs(channelData[i]);
      }
      const frequency = (bin * sampleRate) / fftSize;
      spectralCentroid += frequency * magnitude;
      totalMagnitude += magnitude;
    }

    spectralCentroid =
      totalMagnitude > 0 ? spectralCentroid / totalMagnitude : 0;
    const brightness = Math.min(100, (spectralCentroid / 5000) * 100);

    let spectralTilt;
    if (brightness < 30) spectralTilt = "dark";
    else if (brightness > 60) spectralTilt = "bright";
    else spectralTilt = "balanced";

    // Calculate gain adjustment
    const gainNeeded = PINK_NOISE_TARGET - rmsDb;
    let recommendation;
    if (Math.abs(gainNeeded) < 1) recommendation = "MINIMAL";
    else if (gainNeeded > 0) recommendation = "BOOST";
    else recommendation = "REDUCE";

    const category = categorizeFile(filename);
    const cleanName = cleanFilename(filename);

    addDiagnostic(`\n━━━ Processing: ${filename} ━━━`);
    addDiagnostic(`Category: ${category}`);
    addDiagnostic(
      `Duration: ${duration.toFixed(2)}s | Sample Rate: ${sampleRate}Hz`
    );
    addDiagnostic(`RMS Level: ${rmsDb.toFixed(2)} dBFS`);
    addDiagnostic(`Peak Level: ${peakDb.toFixed(2)} dBFS`);
    addDiagnostic(`Crest Factor: ${crestFactor.toFixed(2)} dB`);
    addDiagnostic(`Spectral Centroid: ${spectralCentroid.toFixed(0)} Hz`);
    addDiagnostic(`Brightness: ${brightness.toFixed(0)}% (${spectralTilt})`);
    addDiagnostic(`Target: ${PINK_NOISE_TARGET} dBFS`);
    addDiagnostic(
      `Gain Adjustment: ${gainNeeded > 0 ? "+" : ""}${gainNeeded.toFixed(
        2
      )} dB (${recommendation})`
    );
    addDiagnostic(`✓ Ready for mixing\n`);

    return {
      id: Date.now() + Math.random(),
      filename,
      cleanName,
      category,
      duration,
      sampleRate,
      rmsDb,
      peakDb,
      crestFactor,
      spectralCentroid,
      brightness,
      spectralTilt,
      gainNeeded,
      recommendation,
    };
  };

  const processFile = async (file) => {
    try {
      addDiagnostic(`\n>>> Loading: ${file.name}...`);

      // Use shared AudioContext
      if (!window.audioContextInstance) {
        window.audioContextInstance = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      const audioContext = window.audioContextInstance;

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const analysis = analyzeAudioBuffer(audioBuffer, file.name);
      setStems((prev) => [...prev, analysis]);
    } catch (error) {
      addDiagnostic(`✗ Error processing ${file.name}: ${error.message}`);
      console.error(error);
    }
  };

  const handleFiles = async (files) => {
    setProcessing(true);
    addDiagnostic("\n═══════════════════════════════════════");
    addDiagnostic("Starting batch analysis...");
    addDiagnostic("═══════════════════════════════════════");

    for (const file of files) {
      if (file.type.includes("audio") || file.name.match(/\.(mp3|wav)$/i)) {
        await processFile(file);
      } else {
        addDiagnostic(`✗ Skipped: ${file.name} (not audio)`);
      }
    }

    addDiagnostic("\n═══════════════════════════════════════");
    addDiagnostic(`✓ Analysis complete! ${files.length} file(s) processed.`);
    addDiagnostic("═══════════════════════════════════════\n");
    setProcessing(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const removeStem = (id) => {
    setStems((prev) => prev.filter((s) => s.id !== id));
  };

  const getCategoryColor = (category) => {
    const colors = {
      Drums: "bg-red-500",
      Bass: "bg-orange-500",
      Vocals: "bg-blue-500",
      Synth: "bg-purple-500",
      Guitar: "bg-yellow-500",
      FX: "bg-green-500",
      Misc: "bg-gray-500",
    };
    return colors[category] || colors.Misc;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Activity className="w-12 h-12 text-purple-400" />
            Pink Noise Stem Leveler
          </h1>
          <p className="text-purple-300">
            DSP Analysis & Gain Staging Tool for Ableton Live
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column: Upload & Stems */}
          <div className="space-y-6">
            {/* Upload Area */}
            <div
              className="bg-slate-800 rounded-lg p-8 border-2 border-dashed border-purple-400 hover:border-purple-300 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="text-center">
                <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  Drop Audio Files
                </h2>
                <p className="text-purple-300 mb-4">
                  MP3 or WAV files supported
                </p>
                <label className="inline-block">
                  <input
                    type="file"
                    multiple
                    accept="audio/*,.mp3,.wav"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <span className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg cursor-pointer inline-block transition-colors">
                    Browse Files
                  </span>
                </label>
              </div>
            </div>

            {/* Stems List */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Music className="w-6 h-6" />
                Loaded Stems ({stems.length})
              </h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {stems.length === 0 && (
                  <p className="text-purple-300 text-center py-8">
                    No stems loaded yet
                  </p>
                )}
                {stems.map((stem) => (
                  <div
                    key={stem.id}
                    className="bg-slate-700 rounded-lg p-4 relative"
                  >
                    <button
                      onClick={() => removeStem(stem.id)}
                      className="absolute top-2 right-2 text-red-400 hover:text-red-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="mb-2">
                      <span
                        className={`${getCategoryColor(
                          stem.category
                        )} text-white text-xs px-2 py-1 rounded`}
                      >
                        {stem.category}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold mb-2">
                      {stem.cleanName || stem.filename}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-purple-300">RMS:</span>
                        <span className="text-white ml-2">
                          {stem.rmsDb.toFixed(1)} dB
                        </span>
                      </div>
                      <div>
                        <span className="text-purple-300">Peak:</span>
                        <span className="text-white ml-2">
                          {stem.peakDb.toFixed(1)} dB
                        </span>
                      </div>
                      <div>
                        <span className="text-purple-300">Gain:</span>
                        <span
                          className={`ml-2 font-semibold ${
                            stem.gainNeeded > 0
                              ? "text-green-400"
                              : "text-orange-400"
                          }`}
                        >
                          {stem.gainNeeded > 0 ? "+" : ""}
                          {stem.gainNeeded.toFixed(1)} dB
                        </span>
                      </div>
                      <div>
                        <span className="text-purple-300">Spectral:</span>
                        <span className="text-white ml-2">
                          {stem.spectralTilt}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs">
                      <span
                        className={`px-2 py-1 rounded ${
                          stem.recommendation === "BOOST"
                            ? "bg-green-900 text-green-200"
                            : stem.recommendation === "REDUCE"
                            ? "bg-orange-900 text-orange-200"
                            : "bg-blue-900 text-blue-200"
                        }`}
                      >
                        {stem.recommendation}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Diagnostics */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              Diagnostic Output
            </h2>
            <div className="bg-black rounded-lg p-4 h-[600px] overflow-y-auto font-mono text-sm">
              <pre className="text-green-400 whitespace-pre-wrap">
                {diagnostics ||
                  "> Ready to process audio files...\n> Drop or select files to begin analysis."}
              </pre>
              {processing && (
                <div className="text-yellow-400 animate-pulse">
                  > Processing...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
