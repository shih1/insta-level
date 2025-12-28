export class AudioBuffer {
  constructor(size) {
    this.samples = new Float32Array(size);
  }

  clear() {
    this.samples.fill(0);
  }

  getLength() {
    return this.samples.length;
  }
}
