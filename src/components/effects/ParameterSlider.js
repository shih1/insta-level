import React, { useState, useEffect, memo } from "react";

const ParameterSlider = memo(({ param, label }) => {
  const [value, setValue] = useState(param.getValue());

  useEffect(() => {
    const update = (v) => setValue(v);
    param.addListener(update);
    return () => param.removeListener(update);
  }, [param]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center px-0.5">
        <label className="text-[10px] uppercase text-gray-400 font-bold tracking-tight">
          {label || param.name}
        </label>
        <span className="text-[10px] text-pink-400 font-mono">
          {param.getDisplayValue()}
        </span>
      </div>
      <input
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={(e) => param.setValue(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400 transition-all"
      />
    </div>
  );
});

ParameterSlider.displayName = "ParameterSlider";
export default ParameterSlider;
