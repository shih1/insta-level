import React, { useState } from "react";

export const DropZone = ({ onFilesDropped, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(
      (file) =>
        file.type.startsWith("audio/") ||
        file.name.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/i)
    );

    if (audioFiles.length > 0) {
      onFilesDropped(audioFiles);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative h-full"
    >
      {children}

      {isDragging && (
        <div className="absolute inset-0 z-50 bg-purple-900/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-gray-900/90 border-4 border-dashed border-purple-400 rounded-2xl p-12 text-center animate-pulse">
            <svg
              className="w-24 h-24 mx-auto mb-4 text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <h3 className="text-3xl font-bold text-purple-300 mb-2">
              Drop Audio Files Here
            </h3>
            <p className="text-gray-300 text-lg">
              Release to add files to available tracks
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
