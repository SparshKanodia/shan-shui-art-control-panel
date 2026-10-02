import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

const CHUNK = 512;
const WORLD_HEIGHT = 700; // upstream's vertical window (MEM.windy)
const TILE_TOP = -1536;
const TILE_HEIGHT = 4096;
const SETTLE_MS = 220;
const LIMIT_X = 65536;

type Status = 'idle' | 'generating' | 'ready' | 'error';
type Message = {
  type: 'chunk' | 'done' | 'error';
  index?: number;
  svg?: string;
  source?: 'generated' | 'archive';
  warning?: string;
  error?: string;
};

// Mirrors visibleChunks() in public/landscape-core.js; the worker validates again.
function visibleChunks(x: number, width: number): number[] {
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0 || width > 16384 ||
      !Number.isSafeInteger(Math.floor(x / CHUNK)) || Math.abs(x) > 2 ** 42) {
    throw new Error('The viewing area is outside the supported coordinate range.');
  }
  const first = Math.floor(x / CHUNK), last = Math.ceil((x + width) / CHUNK) - 1;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

const clamp = (value: number) => Math.max(-LIMIT_X, Math.min(LIMIT_X, value));

export default function Landscape() {
  const [seed, setSeed] = useState(1234);
  const [draftSeed, setDraftSeed] = useState('1234');
  const [camX, setCamX] = useState(-256);
  const [box, setBox] = useState({ w: 1440, h: 560 });
  const [chunks, setChunks] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [work, setWork] = useState({ done: 0, total: 0, restored: 0 });
  const [epoch, setEpoch] = useState(0);

  const viewW = Math.min(4000, Math.max(480, (WORLD_HEIGHT * box.w) / Math.max(1, box.h)));

  const frameRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const liveRef = useRef<Record<number, string>>({});
  const liveSeedRef = useRef(seed);
  const wantRef = useRef<number[]>([]);
  const unitRef = useRef(1);

  unitRef.current = viewW / Math.max(1, box.w);

  // A new world invalidates every resident tile and the work in flight.
  useEffect(() => {
    if (liveSeedRef.current === seed) return;
    liveSeedRef.current = seed;
    liveRef.current = {};
    setChunks({});
    if (pendingRef.current) {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current = false;
    }
  }, [seed]);

  useEffect(() => {
    let indices: number[];
    try {
      indices = visibleChunks(camX, viewW);
    } catch (cause) {
      liveRef.current = {};
      setChunks({});
      window.clearTimeout(timerRef.current);
      if (pendingRef.current) {
        workerRef.current?.terminate();
        workerRef.current = null;
        pendingRef.current = false;
      }
      setError(cause instanceof Error ? cause.message : 'The viewing area is unsupported.');
      setStatus('error');
      return;
    }
    // Navigation, resizing, seed changes and returning to the tab all supersede
    // whatever the worker was doing: stale tiles are never shown.
    wantRef.current = indices;
    if (pendingRef.current) {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current = false;
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      request(indices, camX, viewW, seed);
    }, SETTLE_MS);
    return () => window.clearTimeout(timerRef.current);
  }, [camX, viewW, seed, epoch]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setBox({ w: Math.max(1, rect.width), h: Math.max(1, rect.height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pause = () => {
      if (!document.hidden) { setEpoch(value => value + 1); return; }
      // Hidden tabs stop generating; visible tabs ask again.
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
      if (pendingRef.current) {
        workerRef.current?.terminate();
        workerRef.current = null;
        pendingRef.current = false;
      }
      setStatus(current => (current === 'generating' ? 'idle' : current));
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    workerRef.current?.terminate();
    workerRef.current = null;
    pendingRef.current = false;
  }, []);

  function request(indices: number[], x: number, width: number, worldSeed: number) {
    // Only tiles intersecting the settled camera are resident; the rest live in
    // the archive (or nowhere, and are rebuilt from their seed and coordinates).
    const keep: Record<number, string> = {};
    if (liveSeedRef.current === worldSeed) {
      for (const index of indices) if (index in liveRef.current) keep[index] = liveRef.current[index];
    }
    liveRef.current = keep;
    setChunks(keep);
    const missing = indices.filter(index => !(index in keep));
    if (!missing.length) {
      setWarning(''); setError(''); setWork({ done: 0, total: 0, restored: 0 });
      setStatus('ready');
      return;
    }
    setError(''); setWarning(''); setWork({ done: 0, total: missing.length, restored: 0 });
    setStatus('generating');
    const worker = workerRef.current ?? new Worker(`${import.meta.env.BASE_URL}landscape.worker.js`);
    workerRef.current = worker;
    pendingRef.current = true;
    worker.onmessage = ({ data }: MessageEvent<Message>) => {
      if (worker !== workerRef.current) return; // superseded by later navigation
      if (data.type === 'error') {
        worker.terminate();
        workerRef.current = null;
        pendingRef.current = false;
        setStatus('error');
        setError(data.error ?? 'Landscape generation failed.');
        return;
      }
      if (data.type === 'chunk') {
        const { index, svg, source, warning: notice } = data;
        if (typeof index !== 'number' || typeof svg !== 'string') return;
        if (!wantRef.current.includes(index)) return; // no longer on screen
        liveRef.current[index] = svg;
        setChunks(current => ({ ...current, [index]: svg }));
        if (notice) setWarning(notice);
        setWork(current => ({
          done: current.done + 1,
          total: current.total,
          restored: current.restored + (source === 'archive' ? 1 : 0),
        }));
        return;
      }
      if (data.type === 'done') {
        pendingRef.current = false;
        if (data.warning) setWarning(data.warning);
        setStatus('ready');
      }
    };
    worker.onerror = () => {
      if (worker !== workerRef.current) return;
      worker.terminate();
      workerRef.current = null;
      pendingRef.current = false;
      setStatus('error');
      setError('The landscape could not be generated. Please try again.');
    };
    worker.postMessage({ seed: worldSeed, x, width, indices: missing });
  }

  const dragRef = useRef<{ id: number; start: number; from: number } | null>(null);

  function travel(delta: number) {
    setCamX(current => clamp(current + delta));
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = viewW * 0.35;
    if (event.key === 'ArrowRight' || event.key === 'PageUp') { event.preventDefault(); travel(step); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageDown') { event.preventDefault(); travel(-step); }
    else if (event.key === 'Home') { event.preventDefault(); setCamX(0); }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = { id: event.pointerId, start: event.clientX, from: camX };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const width = event.currentTarget.getBoundingClientRect().width || 1;
    setCamX(clamp(drag.from - (event.clientX - drag.start) * (viewW / width)));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
      // A plain vertical wheel still scrolls the page unless the canvas has focus.
      if (!sideways && document.activeElement !== node) return;
      event.preventDefault();
      const delta = sideways
        ? (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY)
        : event.deltaY;
      travel(delta * unitRef.current);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const tileCount = Object.keys(chunks).length;
  const label = status === 'generating'
    ? `Generating ${work.done}/${work.total}…`
    : status === 'error' ? 'Generation interrupted'
      : status === 'ready' ? 'Landscape ready' : 'Travelling…';

  return <>
    <section className="painting landscape" aria-label="Landscape" aria-busy={status === 'generating'}>
      <div className="painting-meta">
        <span>WORLD {seed}</span>
        <span>{tileCount} TILE{tileCount === 1 ? '' : 'S'}{work.restored ? ` / ${work.restored} FROM ARCHIVE` : ''}</span>
      </div>
      <div
        className="canvas landscape-frame" ref={frameRef} tabIndex={0} role="group"
        aria-label={`Landscape canvas, world seed ${seed}. Use the left and right arrow keys to travel.`}
        aria-busy={status === 'generating'}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={endDrag} onPointerCancel={endDrag}
      >
        <svg className="ink landscape-art" viewBox={`${camX} 0 ${viewW} ${WORLD_HEIGHT}`}
          preserveAspectRatio="xMidYMid slice" role="img"
          aria-label={`Deterministic landscape, world seed ${seed}`}>
          <title>A deterministic landscape of mountains, water and boats</title>
          {Object.keys(chunks).map(Number).sort((a, b) => a - b).map(index =>
            <svg key={index} x={index * CHUNK} y={TILE_TOP} width={CHUNK} height={TILE_HEIGHT}
              viewBox={`${index * CHUNK} ${TILE_TOP} ${CHUNK} ${TILE_HEIGHT}`}
              dangerouslySetInnerHTML={{ __html: chunks[index] }} />)}
        </svg>
      </div>
      <div className="painting-foot">
        <span>512-UNIT TILES · DRAG, SCROLL OR ARROW TO TRAVEL</span>
        <span role="status">{label}</span>
      </div>
      {error && <div className="error" role="alert">
        {error} <button onClick={() => { setError(''); setStatus('idle'); setEpoch(value => value + 1); }}>Try again</button>
      </div>}
      {!error && warning && <div className="notice" role="status">{warning}</div>}
    </section>
    <div className="panels landscape-panels">
      <section className="controls" aria-labelledby="travel-title">
        <div className="section-heading"><h2 id="travel-title">Travel pane</h2><span>01 — MOVE</span></div>
        <div className="transport">
          <button onClick={() => travel(-viewW * 0.4)} aria-label="Travel left">← <span>West</span></button>
          <button onClick={() => travel(viewW * 0.4)} aria-label="Travel right">East <span>→</span></button>
          <button onClick={() => setCamX(0)}>Back to origin</button>
        </div>
        <label className="position-row">
          <span>Position<output>{Math.round(camX)}</output></span>
          <input type="range" aria-label="Horizontal position" min={-LIMIT_X} max={LIMIT_X} step={16}
            value={Math.round(camX)} onChange={event => setCamX(clamp(Number(event.target.value)))} />
        </label>
        <form className="seed-row" onSubmit={event => {
          event.preventDefault();
          const next = Number(draftSeed);
          if (Number.isInteger(next) && next >= 1 && next <= 999999) { setSeed(next); setDraftSeed(String(next)); }
        }}>
          <label htmlFor="world-seed">World seed</label>
          <input id="world-seed" type="number" min="1" max="999999" step="1" required
            value={draftSeed} onChange={event => setDraftSeed(event.target.value)} />
          <button type="submit">Apply</button>
          <button type="button" onClick={() => {
            const next = crypto.getRandomValues(new Uint32Array(1))[0] % 999999 + 1;
            setSeed(next); setDraftSeed(String(next));
          }}>New seed</button>
        </form>
      </section>
      <section className="explanation" aria-labelledby="landscape-title">
        <div className="section-heading"><h2 id="landscape-title">Explanation panel</h2><span>02 — UNDERSTAND</span></div>
        <div aria-live="polite">
          <h3>Travel across a fixed world</h3>
          <p>The camera spans exactly the canvas, so only the 512-unit tiles it touches are drawn, and only once
            navigation has settled. Every tile is placed by its coordinates alone: world, cell and object seeds are
            derived from the seed and the tile index, so the same stretch of country returns unchanged however you
            travel to it.</p>
          <pre aria-label="Governing rule">{`tile = floor(x / 512)
seed = hash(world, cell, object)
view = { x … x + canvas }`}</pre>
          <p className="note">Finished tiles are compressed into a local archive of at most 64 entries of 2 MiB each;
            leaving the view releases them from memory and revisits read them back. Anything evicted, unreadable or
            over the limit is simply drawn again from its seed and coordinates. Work stops when you hide the tab, change
            the world seed, keep moving or leave the landscape.</p>
        </div>
        <details><summary>About this landscape</summary>
          <p>Placement and drawing come from Lingdong Huang’s original planner and routines, driven by coordinate-derived
            random streams instead of one sequential global stream, so composition does not depend on travel order.
            Nothing is fetched from a server and no background exploring happens.</p>
          <p>Based on the generator © 2018 Lingdong Huang · <a href={`${import.meta.env.BASE_URL}vendor/LICENSE`}>MIT license</a> · <a href={`${import.meta.env.BASE_URL}vendor/NOTICE.md`}>Source &amp; adaptation notes</a></p>
        </details>
      </section>
    </div>
  </>;
}
