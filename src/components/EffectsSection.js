import React, { useState, useRef, useEffect } from "react";
import { Plus, X, Power } from "lucide-react";
import { EQControls } from "./effects/EQEffect";

const AVAILABLE_EFFECTS = [
  { id: "reverb", name: "Reverb", color: "bg-blue-500" },
  { id: "delay", name: "Delay", color: "bg-purple-500" },
  { id: "chorus", name: "Chorus", color: "bg-green-500" },
  { id: "distortion", name: "Distortion", color: "bg-red-500" },
  { id: "compressor", name: "Compressor", color: "bg-yellow-500" },
  { id: "eq", name: "EQ", color: "bg-pink-500" },
  { id: "pinkceil", name: "Pink Ceiling", color: "bg-fuchsia-500" },
];

export const EffectsSection = ({
  trackId,
  effects = [],
  onAddEffect,
  onRemoveEffect,
  onBypassEffect,
  onEffectParamChange,
  engineRef,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuIndex, setMenuIndex] = useState(null);
  const [openEffects, setOpenEffects] = useState({});
  const [closingEffects, setClosingEffects] = useState({});
  const [panelPositions, setPanelPositions] = useState({});
  const buttonRefs = useRef({});

  // Create slots: all existing effects + one empty slot for the + button
  const slots = [...effects, null];

  const handleAddClick = (index) => {
    setMenuIndex(index);
    setShowMenu(true);
  };

  const handleSelectEffect = (effectType) => {
    onAddEffect(trackId, effectType);
    setShowMenu(false);
    setMenuIndex(null);
  };

  const toggleEffectPanel = (effectName, index) => {
    const effectKey = `${trackId}-${effectName}-${index}`;
    const isCurrentlyOpen = openEffects[effectKey];

    if (!isCurrentlyOpen) {
      // Opening - calculate position
      const buttonRef = buttonRefs.current[effectKey];
      if (buttonRef) {
        const rect = buttonRef.getBoundingClientRect();
        const panelHeight = 450; // Approximate height of EQ panel
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;

        let position;
        if (spaceAbove >= panelHeight) {
          // Enough space above - open upwards
          position = {
            bottom: window.innerHeight - rect.top + 8,
            left: rect.left,
            direction: "up",
          };
        } else if (spaceBelow >= panelHeight) {
          // Not enough space above, but enough below - open downwards
          position = {
            top: rect.bottom + 8,
            left: rect.left,
            direction: "down",
          };
        } else {
          // Not enough space either way - open downwards and let it scroll
          position = {
            top: rect.bottom + 8,
            left: rect.left,
            direction: "down",
          };
        }

        setPanelPositions((prev) => ({
          ...prev,
          [effectKey]: position,
        }));
      }

      setOpenEffects((prev) => ({
        ...prev,
        [effectKey]: true,
      }));
    } else {
      // Closing - trigger animation first
      setClosingEffects((prev) => ({
        ...prev,
        [effectKey]: true,
      }));

      // Remove from open state after animation completes
      setTimeout(() => {
        setOpenEffects((prev) => {
          const newState = { ...prev };
          delete newState[effectKey];
          return newState;
        });
        setClosingEffects((prev) => {
          const newState = { ...prev };
          delete newState[effectKey];
          return newState;
        });
      }, 200); // Match animation duration
    }
  };

  const usedEffects = effects.map((e) => e.name.toLowerCase());
  const availableToAdd = AVAILABLE_EFFECTS.filter(
    (fx) => !usedEffects.includes(fx.id)
  );

  return (
    <div className="mt-2 space-y-2">
      <div className="text-xs text-gray-400 font-semibold">EFFECTS</div>

      <div className="flex flex-wrap gap-2">
        {slots.map((effect, index) => {
          const effectKey = effect
            ? `${trackId}-${effect.name}-${index}`
            : null;
          const isOpen = effectKey ? openEffects[effectKey] : false;

          return (
            <div key={index} className="relative">
              {effect ? (
                <>
                  <div
                    ref={(el) => {
                      if (el) buttonRefs.current[effectKey] = el;
                    }}
                    onClick={() => toggleEffectPanel(effect.name, index)}
                    className={`w-20 h-20 rounded-lg ${
                      AVAILABLE_EFFECTS.find(
                        (fx) => fx.id === effect.name.toLowerCase()
                      )?.color || "bg-gray-600"
                    } ${effect.bypass ? "opacity-40" : "opacity-100"} ${
                      isOpen ? "ring-2 ring-white" : ""
                    } flex flex-col items-center justify-center relative group cursor-pointer hover:ring-2 hover:ring-white`}
                  >
                    <div className="text-xs font-bold text-white text-center px-1">
                      {effect.name}
                    </div>

                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onBypassEffect(trackId, effect.name);
                        }}
                        className="w-5 h-5 bg-black bg-opacity-60 rounded flex items-center justify-center hover:bg-opacity-80"
                        title={effect.bypass ? "Enable" : "Bypass"}
                      >
                        <Power size={12} className="text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveEffect(trackId, effect.name);
                        }}
                        className="w-5 h-5 bg-black bg-opacity-60 rounded flex items-center justify-center hover:bg-opacity-80"
                        title="Remove"
                      >
                        <X size={12} className="text-white" />
                      </button>
                    </div>

                    {effect.bypass && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-red-500 rotate-45"></div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                availableToAdd.length > 0 && (
                  <button
                    onClick={() => handleAddClick(index)}
                    className="w-20 h-20 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center hover:border-purple-500 hover:bg-purple-500 hover:bg-opacity-10 transition-all group"
                  >
                    <Plus
                      size={24}
                      className="text-gray-600 group-hover:text-purple-500"
                    />
                  </button>
                )
              )}

              {showMenu && menuIndex === index && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg shadow-xl z-20 p-2 w-40">
                    {availableToAdd.length > 0 ? (
                      availableToAdd.map((fx) => (
                        <button
                          key={fx.id}
                          onClick={() => handleSelectEffect(fx.id)}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 rounded flex items-center gap-2"
                        >
                          <div className={`w-3 h-3 rounded ${fx.color}`} />
                          {fx.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No effects available
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Render open effect panels using fixed positioning */}
      {Object.entries(openEffects).map(([key, isOpen]) => {
        if (!isOpen) return null;

        const position = panelPositions[key];
        if (!position) return null;

        const effectName = key.split("-")[1]; // Extract effect name from key
        const isClosing = closingEffects[key];

        const positionStyle =
          position.direction === "up"
            ? { bottom: `${position.bottom}px`, left: `${position.left}px` }
            : { top: `${position.top}px`, left: `${position.left}px` };

        return (
          <div
            key={key}
            className={`fixed z-50 ${
              isClosing ? "animate-slideOut" : "animate-slideIn"
            }`}
            style={positionStyle}
          >
            {effectName === "EQ" && engineRef?.current ? (
              <div className="w-80 max-h-96 overflow-y-auto">
                <div className="bg-gray-900 rounded-lg shadow-2xl p-4 border border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-white">
                      EQ Controls
                    </h3>
                    <button
                      onClick={() => {
                        const [tId, name, index] = key.split("-");
                        toggleEffectPanel(name, parseInt(index));
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <EQControls
                    effect={engineRef.current.graph.buses
                      .find((b) => b.id === trackId)
                      ?.channelStrip.getEffect("EQ")}
                    onParamChange={(effectName, param, value) =>
                      onEffectParamChange(trackId, effectName, param, value)
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="w-64 max-h-96 overflow-y-auto">
                <div className="bg-gray-900 rounded-lg shadow-2xl p-4 border border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-white">
                      {effectName} Controls
                    </h3>
                    <button
                      onClick={() => {
                        const [trackId, name, index] = key.split("-");
                        toggleEffectPanel(name, parseInt(index));
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="text-gray-400 text-sm">
                    Controls for this effect are not yet implemented.
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
