import { useState } from "react";
import * as Tone from "tone";

export const useTrackOperations = (engineRef) => {
  const [tracks, setTracks] = useState([]);
  const [duration, setDuration] = useState(0);

  const initializeTracks = (engine) => {
    setTracks(
      engine.graph.buses.map((bus) => ({
        id: bus.id,
        name: bus.name,
        isEmpty: bus.isEmpty,
        volume: bus.volume,
        duration: 0,
        effects: [],
      }))
    );
  };

  const handleFileUpload = async (e, busId) => {
    const file = e.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);

    const bus = engineRef.current.graph.buses.find((b) => b.id === busId);
    if (bus) {
      bus.loadAudioFile(audioBuffer, file.name);

      setTracks((prev) =>
        prev.map((t) =>
          t.id === busId
            ? {
                ...t,
                name: file.name,
                isEmpty: false,
                duration: audioBuffer.duration,
              }
            : t
        )
      );

      setDuration(engineRef.current.graph.getMaxDuration());
      setTimeout(() => bus.drawWaveform(), 100);
    }
  };

  const handleVolumeChange = (busId, volume) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === busId ? { ...t, volume } : t))
    );

    const bus = engineRef.current.graph.buses.find((b) => b.id === busId);
    if (bus) bus.channelStrip.setGain(volume);
  };

  const handleRemoveEffect = (busId, effectName) => {
    const bus = engineRef.current.graph.buses.find((b) => b.id === busId);
    if (!bus) return;

    bus.channelStrip.removeEffect(effectName);

    setTracks((prev) =>
      prev.map((t) =>
        t.id === busId
          ? {
              ...t,
              effects: bus.channelStrip.audioFX.map((fx) => ({
                name: fx.name,
                enabled: fx.enabled,
              })),
            }
          : t
      )
    );
  };

  const handleAddEffect = (busId, effectType) => {
    const bus = engineRef.current.graph.buses.find((b) => b.id === busId);
    if (!bus) return;

    bus.channelStrip.addEffect(effectType);

    setTracks((prev) =>
      prev.map((t) =>
        t.id === busId
          ? {
              ...t,
              effects: bus.channelStrip.audioFX.map((fx) => ({
                name: fx.name,
                enabled: fx.enabled,
              })),
            }
          : t
      )
    );
  };

  const handleEffectParamChange = (busId, effectName, param, value) => {
    const bus = engineRef.current.graph.buses.find((b) => b.id === busId);
    if (!bus) return;

    const effect = bus.channelStrip.getEffect(effectName);
    if (effect) {
      const setterName = `set${param.charAt(0).toUpperCase() + param.slice(1)}`;
      if (effect[setterName]) {
        effect[setterName](value);
      }
    }
  };

  return {
    tracks,
    duration,
    setDuration,
    initializeTracks,
    handleFileUpload,
    handleVolumeChange,
    handleRemoveEffect,
    handleAddEffect,
    handleEffectParamChange,
  };
};
