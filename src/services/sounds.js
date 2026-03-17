/**
 * Chat notification sounds — generate via Web Audio API.
 * Fără fișiere externe, totul sintetizat în browser.
 */

let _ctx = null;

function getCtx() {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/**
 * Bell cu 3 parțiale armonice:
 *   - fundamentala  (100% volum, decay lung)
 *   - octava 2x     (35% volum, decay mediu) — strălucire
 *   - parțiala 2.756x (20% volum, decay scurt) — caracter metalic de clopot real
 */
function chime(ac, freq, t, duration, vol) {
  const master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);

  const partials = [
    { ratio: 1,     amplitude: vol,        decay: duration },
    { ratio: 2,     amplitude: vol * 0.35, decay: duration * 0.42 },
    { ratio: 2.756, amplitude: vol * 0.18, decay: duration * 0.22 },
  ];

  partials.forEach(({ ratio, amplitude, decay }) => {
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    osc.connect(env);
    env.connect(master);

    // Atac rapid (9ms), decay exponențial
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(amplitude, t + 0.009);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.start(t);
    osc.stop(t + decay + 0.06);
  });
}

/**
 * Mesaj primit — două note ascendente: A5 → E6 (interval de cvintă perfectă)
 * Sună cald, profesional, muzical. Primul ton anunță, al doilea confirmă.
 */
export function playReceived() {
  try {
    const ac = getCtx();
    const t  = ac.currentTime;
    chime(ac, 880,    t,        0.52, 0.44);  // A5 — nota principală
    chime(ac, 1318.5, t + 0.15, 0.62, 0.36); // E6 — cvintă perfectă, rezoluție plăcută
  } catch (_) {}
}

/**
 * Mesaj trimis — un singur chime discret (A5, volum redus).
 * Subtil, confirmă fără a deranja.
 */
export function playSent() {
  try {
    const ac = getCtx();
    const t  = ac.currentTime;
    chime(ac, 880, t, 0.2, 0.18); // A5 — scurt și discret
  } catch (_) {}
}
