import { useState, useEffect } from 'react';

// Efect live în fundalul câmpului „Vehicul", în funcție de statusul camionului.
// Straturile apar și dispar treptat (crossfade), nu brusc.
const FX = {
  move: { color: '#60a5fa', k: 0.6 },   // tranzit — rapid, albastru
  load: { color: '#ff7a3d', k: 3.2 },   // încărcare / descărcare — lent, portocaliu
  wait: { color: '#4ade80', k: 1.6 },   // booked — în așteptare, verde, fără linii
};
const KIND = { tranzit: 'move', incarcare: 'load', descarcare: 'load', booked: 'wait' };

const STREAKS = [
  [12, 120, 1.6, 0], [26, 70, 2.4, -0.9], [41, 160, 1.9, -0.4],
  [57, 90, 2.9, -1.7], [72, 140, 2.1, -1.1], [88, 60, 2.6, -2.0],
];
const MOTES = [[20, 3.8, -0.5], [50, 4.6, -2.2], [80, 4.1, -1.4]];

function Layer({ kind, on }) {
  const { color, k } = FX[kind];
  return (
    <span
      className={`fm-fx${on ? ' is-on' : ''}${kind === 'wait' ? ' fm-fx-wait' : ''}`}
      aria-hidden="true"
      style={{ '--fx': color, '--k': k }}
    >
      <span className="fm-fx-wash" />
      <span className="fm-fx-beam" />
      {kind !== 'wait' && STREAKS.map(([t, w, d, o], i) => (
        <span key={`s${i}`} className="fm-fx-streak" style={{ '--t': `${t}%`, '--w': `${w}px`, '--d': `${d}s`, '--o': `${o}s` }} />
      ))}
      {kind !== 'wait' && MOTES.map(([t, d, o], i) => (
        <span key={`m${i}`} className="fm-fx-mote" style={{ '--t': `${t}%`, '--d': `${d}s`, '--o': `${o}s` }} />
      ))}
    </span>
  );
}

export default function StatusFx({ status }) {
  const target = KIND[status] || null;
  const [prevTarget, setPrevTarget] = useState(target);
  const [layers, setLayers] = useState(() => (target ? [{ kind: target, on: true }] : []));

  // Când statusul se schimbă: stratul vechi începe fade-out, cel nou este montat (încă invizibil).
  if (target !== prevTarget) {
    setPrevTarget(target);
    setLayers(prev => {
      const next = prev.map(l => ({ ...l, on: false }));
      if (target) {
        const existing = next.find(l => l.kind === target);
        if (existing) existing.on = false; // reapare treptat în pasul următor
        else next.push({ kind: target, on: false });
      }
      return next;
    });
  }

  useEffect(() => {
    if (!target) return undefined;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setLayers(prev => prev.map(l => (l.kind === target ? { ...l, on: true } : l))));
    });
    return () => cancelAnimationFrame(raf);
  }, [target]);

  useEffect(() => {
    if (layers.every(l => l.on)) return undefined;
    const t = setTimeout(() => setLayers(prev => prev.filter(l => l.on || l.kind === target)), 2000);
    return () => clearTimeout(t);
  }, [layers, target]);

  return layers.map(l => <Layer key={l.kind} kind={l.kind} on={l.on} />);
}
