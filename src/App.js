import React, { useEffect, useRef, useState } from "react";
import { AudioEngine } from "./AudioEngine";
import { AudioBus } from "./AudioBus";
import { PlaybackControls } from "./components/PlaybackControls";
import { TimelineSeeker } from "./components/TimelineSeeker";
import { TrackRow } from "./components/TrackRow";
import { DropZone } from "./components/DropZone";
import { useTrackOperations } from "./hooks/useTrackOperations";
import { usePlaybackOperations } from "./hooks/usePlaybackOperations";

const DAW = () => {
  const engineRef = useRef(null);
  const [notification, setNotification] = useState(null);

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

    for (let i = 1; i <= 10; i++) {
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

  // Show notification helper
  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle multiple files dropped
  const handleFilesDropped = (files) => {
    const emptyTracks = tracks.filter((t) => t.isEmpty);

    if (emptyTracks.length === 0) {
      showNotification(
        "All tracks are full! Remove files to add new ones.",
        "error"
      );
      return;
    }

    const filesToLoad = files.slice(0, emptyTracks.length);
    const skippedCount = files.length - filesToLoad.length;

    // Load each file into an empty track
    filesToLoad.forEach((file, index) => {
      const targetTrack = emptyTracks[index];

      // Create a DataTransfer object to properly wrap the file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Create a synthetic event object that mimics a real input change event
      const syntheticEvent = {
        target: {
          files: dataTransfer.files,
        },
        preventDefault: () => {},
        stopPropagation: () => {},
      };

      // Note: handleFileUpload expects (event, busId) - event FIRST, then busId
      handleFileUpload(syntheticEvent, targetTrack.id);
    });

    // Show success notification
    const message =
      skippedCount > 0
        ? `Loaded ${filesToLoad.length} file(s). ${skippedCount} skipped (no empty tracks).`
        : `Successfully loaded ${filesToLoad.length} file(s)!`;

    showNotification(message, skippedCount > 0 ? "warning" : "success");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <DropZone onFilesDropped={handleFilesDropped}>
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

          {/* Empty state hint when no files loaded */}
          {tracks.every((t) => t.isEmpty) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center opacity-30">
                <svg
                  className="w-32 h-32 mx-auto mb-4 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                <p className="text-2xl font-semibold text-gray-400">
                  Drag & Drop Audio Files to Get Started
                </p>
                <p className="text-gray-500 mt-2">
                  Or click the upload button on any track
                </p>
              </div>
            </div>
          )}

          {/* Notification Toast */}
          {notification && (
            <div className="fixed bottom-8 right-8 z-50 animate-slide-up">
              <div
                className={`px-6 py-4 rounded-lg shadow-2xl border-2 flex items-center gap-3 ${
                  notification.type === "success"
                    ? "bg-green-900/90 border-green-500 text-green-100"
                    : notification.type === "warning"
                    ? "bg-yellow-900/90 border-yellow-500 text-yellow-100"
                    : notification.type === "error"
                    ? "bg-red-900/90 border-red-500 text-red-100"
                    : "bg-blue-900/90 border-blue-500 text-blue-100"
                }`}
              >
                {notification.type === "success" && (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {notification.type === "warning" && (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
                {notification.type === "error" && (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
                <span className="font-medium">{notification.message}</span>
              </div>
            </div>
          )}
        </div>
      </DropZone>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default DAW;
