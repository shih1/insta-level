import React, { useEffect, useRef } from "react";
import { AudioEngine } from "./AudioEngine";
import { AudioBus } from "./AudioBus";
import { PlaybackControls } from "./components/PlaybackControls";
import { TimelineSeeker } from "./components/TimelineSeeker";
import { TrackRow } from "./components/TrackRow";
import { useTrackOperations } from "./hooks/useTrackOperations";
import { usePlaybackOperations } from "./hooks/usePlaybackOperations";

const DAW = () => {
  const engineRef = useRef(null);

  const {
    tracks,
    duration,
    setDuration,
    initializeTracks,
    handleFileUpload,
    handleVolumeChange,
    handleRemoveEffect,
    handleBypassEffect,
    handleAddEffect,
    handleEffectParamChange,
  } = useTrackOperations(engineRef);

  const {
    isPlaying,
    currentTime,
    handleTogglePlayback,
    handleStop,
    handleSeek,
    cleanup: cleanupPlayback,
  } = usePlaybackOperations(engineRef, setDuration);

  // Initialize engine
  useEffect(() => {
    const engine = new AudioEngine();

    for (let i = 1; i <= 4; i++) {
      const bus = new AudioBus(`bus_${i}`, `Track ${i}`);
      engine.graph.addBus(bus);
    }

    engineRef.current = engine;
    initializeTracks(engine);

    return () => {
      cleanupPlayback();
      engine.dispose();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="h-screen flex flex-col">
        <PlaybackControls
          isPlaying={isPlaying}
          onTogglePlayback={handleTogglePlayback}
          onStop={handleStop}
          currentTime={currentTime}
          duration={duration}
        />

        <TimelineSeeker
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
        />

        <div className="flex-1 overflow-y-auto">
          {tracks.map((track) => {
            const bus = engineRef.current?.graph.buses.find(
              (b) => b.id === track.id
            );

            return (
              <TrackRow
                key={track.id}
                track={track}
                onFileUpload={handleFileUpload}
                onVolumeChange={handleVolumeChange}
                onRemoveEffect={handleRemoveEffect}
                onBypassEffect={handleBypassEffect}
                onAddEffect={handleAddEffect}
                onEffectParamChange={handleEffectParamChange}
                engineRef={engineRef}
                waveformCanvasRef={(el) => {
                  if (bus && el) bus.setWaveformCanvas(el);
                }}
                currentTime={currentTime}
                duration={duration}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DAW;
