import { useEffect, useState } from 'react';
import Landscape from './Landscape';

type Point = [number, number];
type Drawing = { clean: Point[]; ridge: Point[]; contours: Point[][]; svg: string };
const stages = [
  {
    title: 'Start with a cosine curve.', label: 'Generate cosine',
    text: 'Take the upper arch of a cosine wave. Its centre rises into a summit and its ends fall toward the baseline. Width stretches it sideways; height lifts its peak.',
    formula: 'u = (i / 50 − ½)π\nx = 500 + (u / π)W\ny = 520 − H cos(u)',
    note: 'These are the 50 sample positions used by the original mountain routine. This first curve has no noise. Change its width or height before moving to the next step.',
  },
  {
    title: 'Shape the curve with noise.', label: 'Add noise',
    text: 'Smooth noise varies the height along that same cosine arch. Broad changes form shoulders and hollows; finer changes make the ridge irregular. The original generator combines four levels of Perlin noise.',
    formula: 'yₙ = 520 − H cos(u) N(u + 10, 0, 0) + b\ny = (1 − a)y_cosine + a yₙ',
    note: 'Noise amount a blends from the clean cosine to the original noisy ridge. At 100%, the points match the original generator’s first mountain profile. The seed repeats the same noise; changing the amount never rerolls it.',
  },
  {
    title: 'Let details grow from the terrain.', label: 'Add details',
    text: 'Trees grow from points on the mountain, following noise, elevation, and clustering rules. Rocks anchor its edges wherever the terrain allows.',
    formula: 'growth = noise threshold\n       + elevation rule\n       + neighbourhood rule',
    note: 'The ridge and its details share the same geometry and seed. Changing the noise reshapes the terrain that the trees and rocks grow from.',
  },
  {
    title: 'Find the smaller forms inside.', label: 'Inner contours',
    text: 'Nine smaller profiles sit inside the first ridge. Each contracts in width and height, with a related noise sample and a small vertical offset. Together they describe the mountain’s volume.',
    formula: 'pⱼ = 1 − j / 10\nxⱼ = 500 + (u / π)W pⱼ\nyⱼ = 520 − H cos(u)[1 − a + aN(u + 10, 0.15j, 0)]pⱼ + abⱼ',
    note: 'These light guide lines expose the actual profiles used by the texture routine. In the next step they disappear, replaced by the original ink marks.',
  },
  {
    title: 'Turn the profiles into ink.', label: 'Ink & shading',
    text: 'Short, irregular strokes follow and interpolate between the internal profiles. Tapered brush shapes, translucent greys, and strokes around the mountain’s feet turn the geometry into a finished ink mountain.',
    formula: 'texture = short paths between profiles\nbrush width ∝ sin(πt) × local variation\nink = overlapping translucent strokes',
    note: 'At 100% noise the mountain carries the original generator’s brush marks and drawing order. The teaching guides and the earlier plain curve are no longer drawn over it.',
  },
];

export default function App() {
  const [view, setView] = useState<'study' | 'landscape'>('study');
  const [seed, setSeed] = useState(1234);
  const [draftSeed, setDraftSeed] = useState('1234');
  const [width, setWidth] = useState(650);
  const [height, setHeight] = useState(520);
  const [amount, setAmount] = useState(100);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [drawing, setDrawing] = useState<Drawing>({ clean: [], ridge: [], contours: [], svg: '' });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const active = stages[stage];
  const visibleAmount = stage === 0 ? 0 : amount;
  const points = (stage === 0 ? drawing.clean : drawing.ridge).map(point => point.join(',')).join(' ');

  useEffect(() => {
    const generator = new Worker(`${import.meta.env.BASE_URL}generator.worker.js`);
    setBusy(true); setError('');
    generator.onmessage = ({ data }: MessageEvent<Drawing & { error?: string }>) => {
      setBusy(false);
      if (data.error) setError(data.error);
      else setDrawing(data);
    };
    generator.onerror = () => { setBusy(false); setError('The curve could not load. Please try again.'); };
    const timer = window.setTimeout(() => generator.postMessage({ id: 1, seed, mode: 'study', width, height, amount }), 80);
    return () => { window.clearTimeout(timer); generator.terminate(); };
  }, [seed, width, height, amount, retry]);

  useEffect(() => {
    if (!playing || busy || error) return;
    if (stage === stages.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setStage(current => current + 1), 2200);
    return () => window.clearTimeout(timer);
  }, [playing, busy, error, stage]);

  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);

  function applySeed(next: number) {
    if (next !== seed) setBusy(true);
    setSeed(next); setDraftSeed(String(next)); setPlaying(false);
  }

  return <main className="studio">
    <header className="masthead">
      <div><span className="eyebrow">MATHEMATICS INTO ART</span><h1>Cosine into contour</h1></div>
      <nav className="view-switch" aria-label="Views">
        <button aria-pressed={view === 'study'} onClick={() => setView('study')}>Mountain study</button>
        <button aria-pressed={view === 'landscape'} onClick={() => setView('landscape')}>Landscape</button>
      </nav>
      <p>A study of <a href="https://github.com/LingDong-/shan-shui-inf" target="_blank" rel="noreferrer">Lingdong Huang’s <i>Shan, Shui</i> ↗</a></p>
    </header>
    {view === 'study' ? <>
    <section className="painting" aria-label="Cosine to ink mountain study" aria-busy={busy}>
      <div className="painting-meta"><span>{active.label.toUpperCase()}</span><span>NOISE {visibleAmount}% / 0{stage + 1}</span></div>
      <div className="canvas">
        <svg viewBox="0 -120 1000 800" role="img" aria-label={`${active.label}, noise ${visibleAmount} percent`} className={`ink stage-${stage}`}>
          <title>{active.title}</title>
          {stage < 2 ? <polyline points={points} fill="none" stroke="#595d51" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            : <g className="mountain-art" dangerouslySetInnerHTML={{ __html: drawing.svg }} />}
          {stage === 3 && <g className="contour-guides" fill="none" stroke="#79786b" strokeWidth="0.8" opacity="0.55">
            {drawing.contours.slice(1).map((profile, index) => <polyline key={index} points={profile.map(point => point.join(',')).join(' ')} vectorEffect="non-scaling-stroke" />)}
          </g>}
        </svg>
      </div>
      <div className="painting-foot"><span>COSINE → NOISE → DETAILS → INK</span><span role="status">{busy ? 'Generating…' : error ? 'Generation interrupted' : 'Drawing ready'}</span></div>
      {error && <div className="error" role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    </section>
    <div className="panels">
      <section className="controls" aria-labelledby="controls-title">
        <div className="section-heading"><h2 id="controls-title">Control pane</h2><span>01 — MAKE</span></div>
        <div className="steps" role="group" aria-label="Construction stages">
          {stages.map((item, index) => <button key={item.label} aria-pressed={stage === index} onClick={() => { setPlaying(false); setStage(index); }}><span>0{index + 1}</span>{item.label}</button>)}
        </div>
        <div className="transport">
          <button onClick={() => { if (!playing && stage === stages.length - 1) setStage(0); setPlaying(!playing); }} disabled={busy || !!error}>{playing ? 'Pause' : stage === stages.length - 1 ? 'Replay stages' : 'Play stages'} <span aria-hidden="true">{playing ? 'Ⅱ' : '→'}</span></button>
          <button onClick={() => { setPlaying(false); setStage(0); }}>Back to cosine</button>
        </div>
        <div className="sliders">
          {[
            { label: 'Width', value: width, min: 400, max: 800, step: 10, set: setWidth },
            { label: 'Height', value: height, min: 200, max: 600, step: 10, set: setHeight },
          ].map(control => <label key={control.label}><span>{control.label}<output>{control.value}</output></span><input type="range" aria-label={control.label} min={control.min} max={control.max} step={control.step} value={control.value} onChange={event => { setBusy(true); control.set(Number(event.target.value)); setPlaying(false); }} /></label>)}
          <label><span>Noise amount<output>{visibleAmount}%</output></span><input type="range" aria-label="Noise amount" min="0" max="100" step="1" value={visibleAmount} onChange={event => { const next = Number(event.target.value); if (next !== amount) setBusy(true); setAmount(next); if (stage === 0) setStage(1); setPlaying(false); }} /></label>
        </div>
        <form className="seed-row" onSubmit={event => {
          event.preventDefault(); const next = Number(draftSeed);
          if (Number.isInteger(next) && next >= 1 && next <= 999999) applySeed(next);
        }}>
          <label htmlFor="seed">Noise seed</label>
          <input id="seed" type="number" min="1" max="999999" step="1" required value={draftSeed} onChange={event => setDraftSeed(event.target.value)} />
          <button type="submit">Apply</button>
          <button type="button" onClick={() => applySeed(crypto.getRandomValues(new Uint32Array(1))[0] % 999999 + 1)}>New seed</button>
        </form>
      </section>
      <section className="explanation" aria-labelledby="explanation-title">
        <div className="section-heading"><h2 id="explanation-title">Explanation panel</h2><span>02 — UNDERSTAND</span></div>
        <div aria-live="polite"><h3>{active.title}</h3><p>{active.text}</p><pre aria-label="Governing rule">{active.formula}</pre><p className="note">{active.note}</p></div>
        <details><summary>About this study</summary><p>W and H set width and height. N is the original smooth noise function, b is the small vertical offset, and a is the noise amount. All five views share one mountain. They reveal its construction for study, rather than replaying the original program’s execution order. At 100% noise the ridge and the brushwork come straight from the original generator; lower amounts adapt its terrain profiles. Only natural scenery is drawn here: mountains, trees, rocks, rivers and boats — the transmission towers, pavilions and huts upstream plants on the terrain are left out of this build.</p><p>Based on the generator © 2018 Lingdong Huang · <a href={`${import.meta.env.BASE_URL}vendor/LICENSE`}>MIT license</a> · <a href={`${import.meta.env.BASE_URL}vendor/NOTICE.md`}>Source & adaptation notes</a></p></details>
      </section>
    </div>
    </> : <Landscape />}
  </main>;
}
