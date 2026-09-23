import { useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, ChevronDown, CircleDot, Clock3, Crosshair, Gauge, Lightbulb, Magnet, Minus, MousePointer2, Play, Plus, Power, RotateCcw, Settings2, Sparkles, Wrench, Zap } from 'lucide-react'
import { hasContinuity, openCircuit, resistanceBetween, terminalVoltage, testPointsAreEnergized, voltageBetween, type Fault, type TerminalId } from './circuit'
import './App.css'

type MeterMode = 'V AC' | 'V DC' | 'Ohms' | 'Continuity' | 'Diode' | 'Hz'
type Lead = 'red' | 'black'
type Terminal = { id: TerminalId; label: string; x: number; y: number }

const terminals: Terminal[] = [
  { id: 'l1', label: 'L1 / F1 LINE', x: 76, y: 155 },
  { id: 'fuseOut', label: 'F1 LOAD', x: 170, y: 155 },
  { id: 'stopOut', label: 'STOP LOAD', x: 352, y: 155 },
  { id: 'coilA1', label: 'M1 A1', x: 475, y: 155 },
  { id: 'neutral', label: 'A2 / NEUTRAL', x: 550, y: 155 },
]

const meterModes: MeterMode[] = ['V AC', 'V DC', 'Ohms', 'Continuity', 'Diode', 'Hz']
const tools = [{ label: 'Select', icon: MousePointer2 }, { label: 'Wire', icon: Activity }, { label: 'Probe', icon: Crosshair }]
const components = [{ label: 'Supply', icon: Zap, accent: 'blue' }, { label: 'Fuse', icon: Minus, accent: 'orange' }, { label: 'Pushbutton', icon: CircleDot, accent: 'teal' }, { label: 'Contactor', icon: Magnet, accent: 'yellow' }, { label: 'Motor', icon: Settings2, accent: 'pink' }, { label: 'Lamp', icon: Lightbulb, accent: 'lime' }]

function App() {
  const [activeTool, setActiveTool] = useState('Probe')
  const [powerOn, setPowerOn] = useState(true)
  const [running, setRunning] = useState(false)
  const [fault, setFault] = useState<Fault>('None')
  const [meterMode, setMeterMode] = useState<MeterMode>('V AC')
  const [activeLead, setActiveLead] = useState<Lead>('red')
  const [leadTargets, setLeadTargets] = useState<Record<Lead, TerminalId>>({ red: 'coilA1', black: 'neutral' })
  const [zoom, setZoom] = useState(100)
  const [dragging, setDragging] = useState<Lead | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const audioContext = useRef<AudioContext | null>(null)

  const circuit = { running, fault, powerOn }
  const red = terminals.find((terminal) => terminal.id === leadTargets.red)!
  const black = terminals.find((terminal) => terminal.id === leadTargets.black)!
  const voltage = voltageBetween(circuit, red.id, black.id)
  const resistance = resistanceBetween(circuit, red.id, black.id)
  const probesLive = testPointsAreEnergized(circuit, red.id, black.id)
  const continuous = hasContinuity(circuit, red.id, black.id)
  const energized = running && powerOn && fault === 'None'
  const continuityTone = meterMode === 'Continuity' && !probesLive && continuous
  const sourceVoltage = terminalVoltage(circuit, 'l1')

  const reading = meterMode === 'V AC'
    ? `${voltage.toFixed(1)} V`
    : meterMode === 'V DC'
      ? '0.00 V'
      : meterMode === 'Ohms'
        ? probesLive ? 'LIVE' : resistance === openCircuit ? 'OL' : `${resistance.toFixed(1)} Ω`
        : meterMode === 'Continuity'
          ? probesLive ? 'LIVE' : resistance === openCircuit ? 'OPEN' : `${resistance.toFixed(1)} Ω`
          : meterMode === 'Diode'
            ? probesLive ? 'LIVE' : 'OL'
            : voltage > 2 ? '60.0 Hz' : '0.0 Hz'

  useEffect(() => {
    if (!continuityTone) return
    const context = audioContext.current ?? new AudioContext()
    audioContext.current = context
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 1850
    gain.gain.setValueAtTime(0.035, context.currentTime)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    return () => { oscillator.stop(); oscillator.disconnect(); gain.disconnect() }
  }, [continuityTone])

  function reset() {
    setPowerOn(true); setRunning(false); setFault('None'); setMeterMode('V AC'); setActiveLead('red'); setLeadTargets({ red: 'coilA1', black: 'neutral' }); setZoom(100)
  }

  function setLead(lead: Lead, terminal: TerminalId) {
    setActiveLead(lead)
    setLeadTargets((targets) => ({ ...targets, [lead]: terminal }))
  }

  function snapProbe(lead: Lead, clientX: number, clientY: number) {
    const bounds = boardRef.current?.getBoundingClientRect()
    if (!bounds) return
    const x = ((clientX - bounds.left) / bounds.width) * 620
    const y = ((clientY - bounds.top) / bounds.height) * 485
    const nearest = terminals.reduce((closest, terminal) => Math.hypot(terminal.x - x, terminal.y - y) < Math.hypot(closest.x - x, closest.y - y) ? terminal : closest)
    setLead(lead, nearest.id)
  }

  function beginProbeDrag(lead: Lead, event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    setActiveLead(lead)
    setDragging(lead)
  }

  const meterStatus = continuityTone
    ? 'BEEP - LOW RESISTANCE PATH'
    : meterMode === 'Continuity' && !probesLive
      ? resistance === openCircuit ? 'OPEN PATH - NO TONE' : 'ABOVE 35 OHM - NO TONE'
      : probesLive && ['Ohms', 'Continuity', 'Diode'].includes(meterMode)
        ? 'REMOVE POWER BEFORE TESTING'
        : `RED: ${red.label} / COM: ${black.label}`

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Zap size={18} /></span><span>TP <b>LIVEWIRE</b></span></div>
      <div className="lab-select">Motor Controls 101 <ChevronDown size={15} /></div>
      <div className="top-actions">
        <button className={powerOn ? 'power-state live-power' : 'power-state'} onClick={() => { setPowerOn((value) => !value); setRunning(false) }}><span></span>CTRL PWR</button>
        <span className="autosave"><span></span> Saved</span>
        <button className="icon-button" title="Reset circuit" onClick={reset}><RotateCcw size={18} /></button>
        <button className="avatar" title="Account">TA</button>
      </div>
    </header>

    <section className="lesson-bar">
      <div className="lesson-title"><span className="lesson-index">03</span><div><strong>Start / Stop Motor Control</strong><span>120 V seal-in circuit with a fused control branch</span></div></div>
      <div className="lesson-progress"><div className="progress-label"><span>Lab progress</span><b>3 / 5</b></div><div className="progress-track"><i></i></div></div>
      <button className="run-button" disabled={!powerOn} onClick={() => powerOn && setRunning((value) => !value)}><Play size={16} fill="currentColor" /> {running ? 'Stop simulation' : powerOn ? 'Run simulation' : 'Control power off'}</button>
    </section>

    <section className="workspace">
      <aside className="tool-rail">
        <div className="rail-section"><p>TOOLS</p>{tools.map(({ label, icon: Icon }) => <button className={activeTool === label ? 'tool active' : 'tool'} onClick={() => setActiveTool(label)} key={label}><Icon size={19} /><span>{label}</span></button>)}</div>
        <div className="rail-section"><p>COMPONENTS</p>{components.map(({ label, icon: Icon, accent }) => <button className="component-tool" key={label}><span className={`component-symbol ${accent}`}><Icon size={17} /></span><span>{label}</span></button>)}</div>
        <div className="rail-divider"></div><button className="tool"><Wrench size={19} /><span>Inspector</span></button>
      </aside>

      <section className="bench">
        <div className="bench-head"><div><span className="eyebrow">LADDER DIAGRAM</span><strong>Control circuit</strong></div><span className={energized ? 'status energized' : 'status'}><i></i>{energized ? 'M1 energized / seal-in closed' : fault !== 'None' ? 'Fault present' : powerOn ? 'Circuit stopped' : 'Control power isolated'}</span></div>
        <div className="probe-instruction">Select a lead, then tap any test point. Dragging works on touch devices. Active: <button className={activeLead === 'red' ? 'lead-chip red-chip active-chip' : 'lead-chip red-chip'} onClick={() => setActiveLead('red')}>VΩ</button><button className={activeLead === 'black' ? 'lead-chip black-chip active-chip' : 'lead-chip black-chip'} onClick={() => setActiveLead('black')}>COM</button></div>
        <div className="schematic-wrap">
          <div ref={boardRef} className="schematic" style={{ '--zoom': `${zoom / 100}` } as React.CSSProperties} onPointerMove={(event) => dragging && snapProbe(dragging, event.clientX, event.clientY)} onPointerUp={(event) => { if (dragging) snapProbe(dragging, event.clientX, event.clientY); setDragging(null) }}>
            <div className="schematic-content">
              <div className="rail left-rail"></div><div className="rail right-rail"></div>
              <div className="power-label line-label">L1<br/><b>{sourceVoltage.toFixed(0)}V</b></div><div className="power-label load-label">L2<br/><b>NEU</b></div>
              <div className={`wire rung top ${energized ? 'hot' : ''}`}></div>
              <div className="node fuse-node"><div className={fault === 'Blown fuse' ? 'fuse faulted' : 'fuse'}><span></span></div><small>F1</small><b>2A</b></div>
              <div className="node start-node"><button className={energized ? 'contact closed' : 'contact'} onClick={() => powerOn && fault === 'None' && setRunning(true)}><span></span><em>START</em></button><small>PB1</small><b>NO</b></div>
              <div className="node stop-node"><button className={fault === 'Open stop contact' ? 'contact open-fault' : 'contact closed'} onClick={() => setRunning(false)}><span></span><em>STOP</em></button><small>PB2</small><b>NC</b></div>
              <div className={`wire seal-wire ${energized ? 'hot' : ''}`}></div><div className="node aux-node"><div className={energized ? 'contact closed' : 'contact'}><span></span><em>M1</em></div><small>M1-AUX</small><b>NO</b></div>
              <div className={`wire coil-wire ${energized ? 'hot' : ''}`}></div><div className="node coil-node"><div className={energized ? 'coil live' : 'coil'}><Magnet size={29}/></div><small>M1 COIL</small><b>A1 / A2</b></div>
              {terminals.map((terminal) => <button key={terminal.id} className={`terminal ${meterMode === 'Continuity' && leadTargets.red === terminal.id ? 'red-target' : ''} ${meterMode === 'Continuity' && leadTargets.black === terminal.id ? 'black-target' : ''}`} style={{ left: terminal.x, top: terminal.y }} onClick={() => setLead(activeLead, terminal.id)}><span>{terminal.label}</span></button>)}
              <div className="note-card"><span><Sparkles size={14}/> PRACTICE SEQUENCE</span><p>Measure F1, STOP, M1-AUX, then the coil. Isolate control power before any resistance test.</p></div>
            </div>
            <button className={`probe-tip black-tip ${dragging === 'black' ? 'dragging' : ''}`} style={{ left: `${(black.x / 620) * 100}%`, top: `${(black.y / 485) * 100}%` }} onPointerDown={(event) => beginProbeDrag('black', event)}><i></i><span>COM</span></button>
            <button className={`probe-tip red-tip ${dragging === 'red' ? 'dragging' : ''}`} style={{ left: `${(red.x / 620) * 100}%`, top: `${(red.y / 485) * 100}%` }} onPointerDown={(event) => beginProbeDrag('red', event)}><i></i><span>VΩ</span></button>
          </div>
        </div>
        <div className="canvas-controls"><button onClick={() => setZoom((value) => Math.max(60, value - 10))}><Minus size={16}/></button><span>{zoom}%</span><button onClick={() => setZoom((value) => Math.min(140, value + 10))}><Plus size={16}/></button></div>
      </section>

      <aside className="right-panel">
        <section className="panel-card meter-card">
          <div className="panel-heading"><div><span className="eyebrow">INSTRUMENT</span><strong>Digital multimeter</strong></div><Gauge size={20}/></div>
          <div className="meter-body"><div className="meter-screen"><span>{meterMode === 'Continuity' ? 'CONTINUITY' : meterMode}</span><b>{reading}</b><i>{meterStatus}</i></div><div className="dial-wrap"><div className="dial-ring">{meterModes.map((mode, index) => <button key={mode} className={meterMode === mode ? 'dial-label chosen' : 'dial-label'} style={{ '--angle': `${index * 60}deg` } as React.CSSProperties} onClick={() => setMeterMode(mode)}>{mode}</button>)}<button className="meter-dial" style={{ '--rotation': `${meterModes.indexOf(meterMode) * 60}deg` } as React.CSSProperties} aria-label="Meter function dial"><i></i></button></div></div><div className="meter-jacks"><span className="jack com-jack"></span><small>COM</small><span className="jack volts-jack"></span><small>V Ω Hz</small></div></div>
          <div className="meter-help"><span>Probe the actual test points.</span><b>{meterMode === 'Continuity' ? 'Tone below 35 Ω' : meterMode === 'Ohms' ? 'De-energize first' : 'True RMS 120 V source'}</b></div>
        </section>
        <section className="panel-card live-card"><div className="panel-heading"><div><span className="eyebrow">SYSTEM</span><strong>Live values</strong></div><Activity size={20}/></div><div className="value-row"><span>Control source</span><b>{sourceVoltage.toFixed(1)} V</b></div><div className="value-row"><span>Coil current</span><b>{energized ? '0.48 A' : '0.00 A'}</b></div><div className="value-row"><span>M1 state</span><b className={energized ? 'good-text' : ''}>{energized ? 'PICKED UP' : 'DE-ENERGIZED'}</b></div></section>
        <section className="panel-card fault-card"><div className="panel-heading"><div><span className="eyebrow">INSTRUCTOR</span><strong>Fault injection</strong></div><AlertTriangle size={20}/></div><label>Active scenario<select value={fault} onChange={(event) => { setFault(event.target.value as Fault); setRunning(false) }}><option>None</option><option>Open stop contact</option><option>Blown fuse</option><option>Loose coil terminal</option></select></label>{fault !== 'None' ? <p className="fault-copy"><AlertTriangle size={14}/> Fault active. Diagnose it at the component terminals.</p> : <p className="hint-copy">Introduce a fault, then identify the voltage drop and open path.</p>}</section>
      </aside>
    </section>
    <footer><span><Clock3 size={15}/> Lab time <b>08:42</b></span><span>TruePhase Academy · Practice bench</span><button><Power size={15}/> End session</button></footer>
  </main>
}

export default App