import { describe, expect, it } from 'vitest'
import { hasContinuity, openCircuit, resistanceBetween, terminalVoltage, voltageBetween, type CircuitState } from './circuit'

const stopped = (fault: CircuitState['fault'] = 'None'): CircuitState => ({ running: false, fault })
const latched = (fault: CircuitState['fault'] = 'None'): CircuitState => ({ running: true, fault })

describe('120 V start / stop seal-in circuit', () => {
  it('has line voltage through the healthy fuse and stop contact while stopped', () => {
    const state = stopped()
    expect(terminalVoltage(state, 'l1')).toBe(120)
    expect(terminalVoltage(state, 'fuseOut')).toBe(120)
    expect(terminalVoltage(state, 'stopOut')).toBe(120)
    expect(terminalVoltage(state, 'coilA1')).toBe(0)
    expect(voltageBetween(state, 'stopOut', 'coilA1')).toBe(120)
  })

  it('uses the maintained M1 auxiliary path after the contactor latches', () => {
    const state = latched()
    expect(terminalVoltage(state, 'coilA1')).toBe(120)
    expect(voltageBetween(state, 'coilA1', 'neutral')).toBe(120)
    expect(voltageBetween(state, 'stopOut', 'coilA1')).toBe(0)
  })

  it('reads the coil resistance when de-energized without a continuity tone', () => {
    const state = stopped()
    expect(resistanceBetween(state, 'coilA1', 'neutral')).toBe(248)
    expect(hasContinuity(state, 'coilA1', 'neutral')).toBe(false)
  })

  it('removes source voltage when control power is isolated', () => {
    const state: CircuitState = { running: false, fault: 'None', powerOn: false }
    expect(terminalVoltage(state, 'l1')).toBe(0)
    expect(voltageBetween(state, 'l1', 'neutral')).toBe(0)
    expect(resistanceBetween(state, 'coilA1', 'neutral')).toBe(248)
  })

  it('reads a blown fuse correctly at all device boundaries', () => {
    const state = stopped('Blown fuse')
    expect(voltageBetween(state, 'l1', 'fuseOut')).toBe(120)
    expect(voltageBetween(state, 'fuseOut', 'neutral')).toBe(0)
    expect(voltageBetween(state, 'fuseOut', 'stopOut')).toBe(0)
    expect(resistanceBetween(state, 'l1', 'fuseOut')).toBe(openCircuit)
    expect(hasContinuity(state, 'fuseOut', 'stopOut')).toBe(true)
  })

  it('reads an open stop contact correctly at all device boundaries', () => {
    const state = stopped('Open stop contact')
    expect(voltageBetween(state, 'l1', 'fuseOut')).toBe(0)
    expect(voltageBetween(state, 'fuseOut', 'stopOut')).toBe(120)
    expect(voltageBetween(state, 'stopOut', 'neutral')).toBe(0)
    expect(resistanceBetween(state, 'fuseOut', 'stopOut')).toBe(openCircuit)
  })

  it('holds line potential before a loose coil terminal and opens the winding', () => {
    const state = latched('Loose coil terminal')
    expect(terminalVoltage(state, 'stopOut')).toBe(120)
    expect(terminalVoltage(state, 'coilA1')).toBe(0)
    expect(voltageBetween(state, 'stopOut', 'coilA1')).toBe(120)
    expect(resistanceBetween(state, 'coilA1', 'neutral')).toBe(openCircuit)
  })
})