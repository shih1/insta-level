export class AudioGraph {
  constructor() {
    this.buses = [];
  }

  addBus(bus) {
    this.buses.push(bus);
  }

  process(transportSeconds) {
    for (const bus of this.buses) {
      if (!bus.isEmpty) {
        bus.process(transportSeconds);
      }
    }
  }

  getMaxDuration() {
    return Math.max(...this.buses.map((b) => b.getDuration()), 0);
  }

  dispose() {
    this.buses.forEach((bus) => bus.dispose());
  }
}
