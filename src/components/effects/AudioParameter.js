export class AudioParameter {
  constructor(name, defaultValue, min, max, unit = "", onChange = null) {
    this.name = name;
    this.value = defaultValue;
    this.defaultValue = defaultValue;
    this.min = min;
    this.max = max;
    this.unit = unit;
    this.onChange = onChange; // Callback when value changes
    this.listeners = [];
  }

  setValue(value) {
    // Clamp value to min/max
    const clampedValue = Math.max(this.min, Math.min(this.max, value));

    if (this.value !== clampedValue) {
      this.value = clampedValue;

      // Call onChange callback if provided
      if (this.onChange) {
        this.onChange(clampedValue);
      }

      // Notify all listeners
      this.listeners.forEach((listener) => listener(clampedValue));
    }

    return this.value;
  }

  getValue() {
    return this.value;
  }

  reset() {
    this.setValue(this.defaultValue);
  }

  // Add listener for UI updates
  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  // Format value for display
  getDisplayValue() {
    if (this.unit === "dB") {
      return `${this.value > 0 ? "+" : ""}${this.value.toFixed(1)} ${
        this.unit
      }`;
    } else if (this.unit === "Hz" && this.value >= 1000) {
      return `${(this.value / 1000).toFixed(1)} kHz`;
    } else if (this.unit === "Hz") {
      return `${this.value.toFixed(0)} ${this.unit}`;
    } else if (this.unit === "%") {
      return `${this.value.toFixed(0)}${this.unit}`;
    }
    return `${this.value.toFixed(1)}${this.unit}`;
  }
}

// Boolean parameter for switches
export class BooleanParameter extends AudioParameter {
  constructor(name, defaultValue, onChange = null) {
    super(name, defaultValue, 0, 1, "", onChange);
  }

  setValue(value) {
    const boolValue = Boolean(value);
    if (this.value !== boolValue) {
      this.value = boolValue;

      if (this.onChange) {
        this.onChange(boolValue);
      }

      this.listeners.forEach((listener) => listener(boolValue));
    }
    return this.value;
  }

  toggle() {
    this.setValue(!this.value);
  }

  getDisplayValue() {
    return this.value ? "ON" : "OFF";
  }
}
