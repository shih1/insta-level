import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

export const usePlaybackOperations = (engineRef, setDuration) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const timelineRef = useRef(null);

  // Playback loop
  useEffect(() => {
    if (isPlaying && engineRef.current) {
      const updateTime = () => {
        const maxDuration = engineRef.current.graph.getMaxDuration();
        setDuration(maxDuration);
        setCurrentTime(Tone.Transport.seconds);

        engineRef.current.processBlock();

        timelineRef.current = requestAnimationFrame(updateTime);
      };
      updateTime();
    } else {
      if (timelineRef.current) cancelAnimationFrame(timelineRef.current);
    }

    return () => {
      if (timelineRef.current) cancelAnimationFrame(timelineRef.current);
    };
  }, [isPlaying, engineRef, setDuration]);

  const handleTogglePlayback = async () => {
    if (!isPlaying) {
      await engineRef.current.start();
      setIsPlaying(true);
    } else {
      engineRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    engineRef.current.stop();
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleSeek = (time) => {
    Tone.Transport.seconds = time;
    setCurrentTime(time);
  };

  const cleanup = () => {
    if (timelineRef.current) cancelAnimationFrame(timelineRef.current);
  };

  return {
    isPlaying,
    currentTime,
    handleTogglePlayback,
    handleStop,
    handleSeek,
    cleanup,
  };
};
