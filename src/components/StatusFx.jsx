import { useState, useEffect } from 'react';

// Efect live în fundalul câmpului „Vehicul", în funcție de statusul camionului.
// Straturile apar și dispar treptat (crossfade), nu brusc.
const FX = {
  move: { color: '#60a5fa', k: 0.6 },   // tranzit — rapid, albastru
  load: { color: '#ff7a3d', k: 3.2 },   // încărcare / descărcare — lent, portocaliu
  wait: { color: '#4ade80', k: 1.6 },   // booked — în așteptare, verde, fără linii
};
const KIND = { tranzit: 'move', incarcare: 'load', descarcare: 'load', booked: 'wait' };

const rnd = (min, max) => min + Math.random() * (max - min);

// Parametri aleatorii pentru o linie: poziție verticală, lungime, durată.
// La fiecare ciclu (animationiteration) se aleg din nou, ca rândurile să nu
// repete același model.
const newStreak = () => { const d = rnd(1.4, 3.4); return { t: rnd(6, 94), w: rnd(45, 175), d, o: -rnd(0, d) }; };
const newMote = () => { const d = rnd(3.2, 5.4); return { t: rnd(10, 90), d, o: -rnd(0, d) }; };

function Streak() {
  const [p, setP] = useState(newStreak);
  return (
    <span
      className="fm-fx-streak"
      onAnimationIteration={() => setP(newStreak())}
      style={{ '--t': `${p.t}%`, '--w': `${p.w}px`, '--d': `${p.d}s`, '--o': `${p.o}s` }}
    />
  );
}

function Mote() {
  const [p, setP] = useState(newMote);
  return (
    <span
      className="fm-fx-mote"
      onAnimationIteration={() => setP(newMote())}
      style={{ '--t': `${p.t}%`, '--d': `${p.d}s`, '--o': `${p.o}s` }}
    />
  );
}

function Layer({ kind, on }) {
  const { color, k } = FX[kind];
  // număr de linii/particule și faza glow-ului diferă de la rând la rând
  const [shape] = useState(() => ({
    streaks: Math.round(rnd(4, 8)),
    motes: Math.round(rnd(2, 4)),
    washDelay: -rnd(0, 6),
    beamDelay: -rnd(0, 3),
  }));
  return (
    <span
      className={`fm-fx${on ? ' is-on' : ''}${kind === 'wait' ? ' fm-fx-wait' : ''}`}
      aria-hidden="true"
      style={{ '--fx': color, '--k': k }}
    >
      <span className="fm-fx-wash" style={{ animationDelay: `${shape.washDelay}s` }} />
      <span className="fm-fx-beam" style={{ animationDelay: `${shape.beamDelay}s` }} />
      {kind !== 'wait' && Array.from({ length: shape.streaks }, (_, i) => <Streak key={`s${i}`} />)}
      {kind !== 'wait' && Array.from({ length: shape.motes }, (_, i) => <Mote key={`m${i}`} />)}
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
