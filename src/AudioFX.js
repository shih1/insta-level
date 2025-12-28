export class AudioFX {
  constructor(name) {
    this.name = name;
    this.enabled = true;
    this.bypass = false;
  }

  process(buffer) {
    throw new Error("process() must be implemented by subclass");
  }

  getToneNodes() {
    return [];
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setBypass(bypass) {
    this.bypass = bypass;
  }

  dispose() {
    // Override in subclasses
  }

  getParams() {
    return {};
  }

  setParam(paramName, value) {
    // Override in subclasses
  }

  getControlsConfig() {
    return null;
  }
}
