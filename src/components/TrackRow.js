import React from "react";
import { Upload } from "lucide-react";

import { EffectsSection } from "./EffectsSection";

export const TrackRow = ({
  track,
  onFileUpload,
  onVolumeChange,
  onRemoveEffect,
  onAddEffect,
  onEffectParamChange,
  engineRef,
  waveformCanvasRef,
  currentTime,
  duration,
}) => {
  return (
    <div className="border-b border-gray-700 flex bg-gray-800/50 h-32">
      {/* Track Info & Volume */}
      <div className="w-48 p-3 border-r border-gray-700 flex flex-col justify-between">
        <div>
          <div className="font-semibold text-sm mb-2">{track.name}</div>
          {track.isEmpty ? (
            <label className="cursor-pointer bg-purple-600/50 hover:bg-purple-600 px-3 py-1.5 rounded text-xs flex items-center gap-1 transition justify-center">
              <Upload size={14} />
              <span>Load Audio</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => onFileUpload(e, track.id)}
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
                  onVolumeChange(track.id, parseFloat(e.target.value))
                }
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>

      <EffectsSection
        trackId={track.id}
        effects={track.effects}
        onAddEffect={onAddEffect}
        onRemoveEffect={onRemoveEffect}
        onEffectParamChange={onEffectParamChange}
        engineRef={engineRef}
      />
      {/* Channel Strip - FX Chain */}
      <div className="w-64 border-r border-gray-700 bg-gray-900/50 p-2">
        {!track.isEmpty ? (
          <div className="h-full flex flex-col">
            {/* FX Chain */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {track.effects.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                  No effects
                </div>
              ) : (
                track.effects.map((effect, index) => (
                  <div
                    key={`${effect.name}-${index}`}
                    className="bg-gray-800 rounded p-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{effect.name}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => onRemoveEffect(track.id, effect.name)}
                          className="px-1 py-0.5 bg-red-700 hover:bg-red-600 rounded"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
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
              ref={waveformCanvasRef}
              width={800}
              height={128}
              className="absolute inset-0 w-full h-full"
            />

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
  );
};
