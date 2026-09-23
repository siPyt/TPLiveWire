export type Fault = 'None' | 'Open stop contact' | 'Blown fuse' | 'Loose coil terminal'
export type TerminalId = 'l1' | 'fuseOut' | 'stopOut' | 'coilA1' | 'neutral'

export type CircuitState = {
  running: boolean
  fault: Fault
  powerOn?: boolean
}

type Component = {
  from: TerminalId
  to: TerminalId
  closed: boolean
  resistance: number
}

const sourceVoltage = 120
const openCircuit = Infinity
const wireResistance = 0.2
const coilResistance = 248
const continuityThreshold = 35

function components(state: CircuitState): Component[] {
  const contactorAuxiliaryClosed = state.running && state.fault === 'None'

  return [
    { from: 'l1', to: 'fuseOut', closed: state.fault !== 'Blown fuse', resistance: wireResistance },
    { from: 'fuseOut', to: 'stopOut', closed: state.fault !== 'Open stop contact', resistance: wireResistance },
    { from: 'stopOut', to: 'coilA1', closed: contactorAuxiliaryClosed, resistance: wireResistance },
    { from: 'coilA1', to: 'neutral', closed: state.fault !== 'Loose coil terminal', resistance: coilResistance },
  ]
}

function reachable(state: CircuitState, start: TerminalId): Map<TerminalId, number> {
  const distances = new Map<TerminalId, number>([
    ['l1', openCircuit], ['fuseOut', openCircuit], ['stopOut', openCircuit], ['coilA1', openCircuit], ['neutral', openCircuit],
  ])
  distances.set(start, 0)
  const unvisited = new Set<TerminalId>(distances.keys())

  while (unvisited.size) {
    const current = [...unvisited].reduce((closest, terminal) => distances.get(terminal)! < distances.get(closest)! ? terminal : closest)
    const currentDistance = distances.get(current)!
    unvisited.delete(current)
    if (currentDistance === openCircuit) break

    for (const component of components(state)) {
      if (!component.closed) continue
      const neighbor = component.from === current ? component.to : component.to === current ? component.from : null
      if (!neighbor || !unvisited.has(neighbor)) continue
      const nextDistance = currentDistance + component.resistance
      if (nextDistance < distances.get(neighbor)!) distances.set(neighbor, nextDistance)
    }
  }

  return distances
}

export function resistanceBetween(state: CircuitState, from: TerminalId, to: TerminalId): number {
  if (from === to) return 0
  return reachable(state, from).get(to)!
}

export function terminalVoltage(state: CircuitState, terminal: TerminalId): number {
  if (state.powerOn === false) return 0
  if (terminal === 'l1') return sourceVoltage
  if (terminal === 'neutral') return 0

  const fromLine = resistanceBetween(state, 'l1', terminal) < openCircuit
  const fromNeutral = resistanceBetween(state, 'neutral', terminal) < openCircuit

  if (fromLine) return sourceVoltage
  if (fromNeutral) return 0
  return 0
}

export function voltageBetween(state: CircuitState, from: TerminalId, to: TerminalId): number {
  return Math.abs(terminalVoltage(state, from) - terminalVoltage(state, to))
}

export function testPointsAreEnergized(state: CircuitState, from: TerminalId, to: TerminalId): boolean {
  return terminalVoltage(state, from) > 2 || terminalVoltage(state, to) > 2
}

export function hasContinuity(state: CircuitState, from: TerminalId, to: TerminalId): boolean {
  return resistanceBetween(state, from, to) <= continuityThreshold
}

export { coilResistance, continuityThreshold, openCircuit, sourceVoltage }