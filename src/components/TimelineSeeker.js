import React from "react";

export const TimelineSeeker = ({ currentTime, duration, onSeek }) => {
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;
    onSeek(time);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 h-12 flex items-center px-4">
      <div className="w-48" />
      <div className="w-64" />
      <div
        className="flex-1 relative h-6 bg-gray-900 rounded cursor-pointer ml-4"
        onClick={handleClick}
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
  );
};
