import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Upload, Square } from "lucide-react";
import * as Tone from "tone";

const DAW = () => {
  const [tracks, setTracks] = useState([
    { id: "empty_1", name: "Track 1", isEmpty: true },
    { id: "empty_2", name: "Track 2", isEmpty: true },
    { id: "empty_3", name: "Track 3", isEmpty: true },
    { id: "empty_4", name: "Track 4", isEmpty: true },
  ]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPinkNoise, setShowPinkNoise] = useState({});

  const tracksRef = useRef({});
  const pinkNoiseRefs = useRef({});
  const animationFrameRef = useRef(null);
  const timelineRef = useRef(null);
  const waveformCanvasRefs = useRef({});
  const spectrumCanvasRefs = useRef({});

  useEffect(() => {
    return () => {
      Object.values(tracksRef.current).forEach((track) => {
        track.player?.dispose();
        track.eq?.dispose();
        track.analyser?.dispose();
      });
      Object.values(pinkNoiseRefs.current).forEach((noise) => {
        noise?.dispose();
      });
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const updateTime = () => {
        const maxDuration = Math.max(
          ...Object.values(tracksRef.current)
            .filter((t) => t.buffer)
            .map((t) => t.buffer.duration),
          0
        );

        setDuration(maxDuration);
        setCurrentTime(Tone.Transport.seconds);

        timelineRef.current = requestAnimationFrame(updateTime);
      };
      updateTime();
      startAnalysis();
    } else {
      if (timelineRef.current) {
        cancelAnimationFrame(timelineRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (timelineRef.current) cancelAnimationFrame(timelineRef.current);
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  const handleFileUpload = async (e, trackId) => {
    const file = e.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);

    if (tracksRef.current[trackId]) {
      tracksRef.current[trackId].player?.dispose();
      tracksRef.current[trackId].eq?.dispose();
      tracksRef.current[trackId].analyser?.dispose();
    }

    const player = new Tone.Player(audioBuffer);
    const eq = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
    const gain = new Tone.Gain(1);
    const analyser = new Tone.Analyser("fft", 2048);

    player.chain(eq, gain, analyser, Tone.Destination);
    player.sync().start(0);

    // Create pink noise for this track
    const pinkNoise = new Tone.Noise("pink").toDestination();
    pinkNoise.volume.value = -30;
    const pinkAnalyser = new Tone.Analyser("fft", 2048);
    pinkNoise.connect(pinkAnalyser);

    pinkNoiseRefs.current[trackId] = {
      noise: pinkNoise,
      analyser: pinkAnalyser,
    };

    tracksRef.current[trackId] = {
      player,
      eq,
      gain,
      analyser,
      buffer: audioBuffer,
    };

    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? {
              ...t,
              name: file.name,
              isEmpty: false,
              volume: 0,
              eq: { low: 0, mid: 0, high: 0 },
              duration: audioBuffer.duration,
            }
          : t
      )
    );

    setDuration((prev) => Math.max(prev, audioBuffer.duration));

    // Draw waveform
    drawWaveform(trackId, audioBuffer);
  };

  const drawWaveform = (trackId, audioBuffer) => {
    const canvas = waveformCanvasRefs.current[trackId];
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      const yMin = (1 + min) * amp;
      const yMax = (1 + max) * amp;

      ctx.fillRect(i, yMin, 1, yMax - yMin || 1);
    }
  };

  const drawSpectrum = (trackId) => {
    const canvas = spectrumCanvasRefs.current[trackId];
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#0f0f1e";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const trackData = tracksRef.current[trackId];
    if (trackData?.analyser) {
      const values = trackData.analyser.getValue();

      // Draw track spectrum
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const sliceWidth = width / values.length;
      let x = 0;

      for (let i = 0; i < values.length; i++) {
        const v = Math.max(-100, values[i]);
        const y = height - ((v + 100) / 100) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
    }

    // Draw pink noise overlay if enabled
    if (showPinkNoise[trackId] && pinkNoiseRefs.current[trackId]?.analyser) {
      const pinkValues = pinkNoiseRefs.current[trackId].analyser.getValue();

      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();

      const sliceWidth = width / pinkValues.length;
      let x = 0;

      for (let i = 0; i < pinkValues.length; i++) {
        const v = Math.max(-100, pinkValues[i]);
        const y = height - ((v + 100) / 100) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  const startAnalysis = () => {
    const analyze = () => {
      tracks.forEach((track) => {
        if (!track.isEmpty) {
          drawSpectrum(track.id);
        }
      });
      animationFrameRef.current = requestAnimationFrame(analyze);
    };
    analyze();
  };

  const togglePlayback = async () => {
    if (!isPlaying) {
      await Tone.start();
      Tone.Transport.start();

      // Start pink noise for tracks that have it enabled
      Object.entries(showPinkNoise).forEach(([trackId, enabled]) => {
        if (enabled && pinkNoiseRefs.current[trackId]) {
          pinkNoiseRefs.current[trackId].noise.start();
        }
      });

      setIsPlaying(true);
    } else {
      Tone.Transport.pause();
      Object.values(pinkNoiseRefs.current).forEach((ref) => {
        ref?.noise.stop();
      });
      setIsPlaying(false);
    }
  };

  const stopPlayback = () => {
    Tone.Transport.stop();
    Object.values(pinkNoiseRefs.current).forEach((ref) => {
      ref?.noise.stop();
    });
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const updateTrackVolume = (trackId, volume) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, volume } : t))
    );
    const track = tracksRef.current[trackId];
    if (track?.gain) {
      track.gain.gain.rampTo(Tone.dbToGain(volume), 0.1);
    }
  };

  const updateEQ = (trackId, band, value) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, eq: { ...t.eq, [band]: value } } : t
      )
    );
    const track = tracksRef.current[trackId];
    if (track?.eq) {
      track.eq[band].value = value;
    }
  };

  const togglePinkNoise = (trackId) => {
    const newState = !showPinkNoise[trackId];
    setShowPinkNoise((prev) => ({ ...prev, [trackId]: newState }));

    if (pinkNoiseRefs.current[trackId]) {
      if (newState && isPlaying) {
        pinkNoiseRefs.current[trackId].noise.start();
      } else {
        pinkNoiseRefs.current[trackId].noise.stop();
      }
    }
  };

  const seekTo = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;

    Tone.Transport.seconds = time;
    setCurrentTime(time);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-gray-900/80 backdrop-blur border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Browser DAW
              </h1>
            </div>

            <div className="flex gap-3">
              <button
                onClick={togglePlayback}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <button
                onClick={stopPlayback}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Square size={18} />
              </button>

              <div className="text-sm font-mono bg-gray-800 px-4 py-2 rounded-lg flex items-center">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        </header>

        {/* Timeline */}
        <div className="bg-gray-800 border-b border-gray-700 h-12 flex items-center px-4">
          <div className="w-48" />
          <div className="w-64" />
          <div
            className="flex-1 relative h-6 bg-gray-900 rounded cursor-pointer ml-4"
            onClick={seekTo}
          >
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-pink-500 z-10"
              style={{
                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />
            <div className="absolute inset-0 flex justify-between px-2 text-xs text-gray-500 pointer-events-none">
              {[...Array(11)].map((_, i) => (
                <div key={i}>{formatTime((duration / 10) * i)}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-y-auto">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="border-b border-gray-700 flex bg-gray-800/50 h-32"
            >
              {/* Track Name & Controls */}
              <div className="w-48 p-3 border-r border-gray-700 flex flex-col justify-between">
                <div>
                  <div className="font-semibold text-sm mb-2">{track.name}</div>
                  {track.isEmpty ? (
                    <label className="cursor-pointer bg-purple-600/50 hover:bg-purple-600 px-3 py-1.5 rounded text-xs flex items-center gap-1 transition justify-center">
                      <Upload size={14} />
                      <span>Load</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => handleFileUpload(e, track.id)}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div>
                      <label className="text-xs text-gray-400">
                        Vol: {track.volume.toFixed(1)} dB
                      </label>
                      <input
                        type="range"
                        min="-60"
                        max="12"
                        step="0.5"
                        value={track.volume}
                        onChange={(e) =>
                          updateTrackVolume(
                            track.id,
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Channel Strip - Spectrum & EQ */}
              <div className="w-64 border-r border-gray-700 bg-gray-900/50 p-2">
                {!track.isEmpty ? (
                  <div className="h-full flex flex-col">
                    <div className="flex-1 mb-2">
                      <canvas
                        ref={(el) =>
                          (spectrumCanvasRefs.current[track.id] = el)
                        }
                        width={240}
                        height={60}
                        className="w-full h-full rounded border border-gray-700"
                      />
                    </div>

                    <div className="flex gap-1 mb-1">
                      <button
                        onClick={() => togglePinkNoise(track.id)}
                        className={`flex-1 px-2 py-1 rounded text-xs transition ${
                          showPinkNoise[track.id]
                            ? "bg-pink-600 hover:bg-pink-700"
                            : "bg-gray-700 hover:bg-gray-600"
                        }`}
                      >
                        Pink
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      {["low", "mid", "high"].map((band) => (
                        <div key={band} className="text-center">
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            step="1"
                            value={track.eq?.[band] || 0}
                            onChange={(e) =>
                              updateEQ(
                                track.id,
                                band,
                                parseFloat(e.target.value)
                              )
                            }
                            className="w-full"
                            style={{
                              writingMode: "bt-lr",
                              WebkitAppearance: "slider-vertical",
                              height: "30px",
                            }}
                          />
                          <label className="text-xs text-gray-400">
                            {band[0].toUpperCase()}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-600 text-xs">
                    No audio loaded
                  </div>
                )}
              </div>

              {/* Waveform Display */}
              <div className="flex-1 relative bg-gray-900/30">
                {!track.isEmpty && track.duration && (
                  <>
                    <canvas
                      ref={(el) => (waveformCanvasRefs.current[track.id] = el)}
                      width={800}
                      height={128}
                      className="absolute inset-0 w-full h-full"
                    />

                    {/* Playhead */}
                    {duration > 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-pink-500 pointer-events-none"
                        style={{ left: `${(currentTime / duration) * 100}%` }}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DAW;
