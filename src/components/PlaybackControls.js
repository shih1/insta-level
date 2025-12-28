import React from "react";
import { Play, Pause, Square } from "lucide-react";

export const PlaybackControls = ({
  isPlaying,
  onTogglePlayback,
  onStop,
  currentTime,
  duration,
}) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <header className="bg-gray-900/80 backdrop-blur border-b border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Yoshih Digital Audio Workstation
        </h1>

        <div className="flex gap-3">
          <button
            onClick={onTogglePlayback}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            onClick={onStop}
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
  );
};
