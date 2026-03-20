/**
 * Chat notification sounds — Web Audio API, fără fișiere externe.
 *
 * Problema browserelor moderne: AudioContext pornește în stare "suspended"
 * și NU poate reda sunete până când userul nu interacționează cu pagina
 * (click, tastă, touch). Aceasta este o politică de securitate a browserului.
 *
 * Soluție: la primul eveniment de interacțiune (oriunde pe pagină), deblocăm
 * contextul audio în avans, astfel încât sunetele funcționează pentru toți userii.
 */

let _ctx = null;

// ── Deblocare AudioContext la prima interacțiune ───────────
function unlockAudio() {
  if (_ctx) {
    if (_ctx.state === 'suspended') _ctx.resume();
    return;
  }
  try {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
  } catch (_) {}
}

// Ascultă primul eveniment de interacțiune și deblochează contextul audio
if (typeof document !== 'undefined') {
  const bootstrap = () => {
    unlockAudio();
    document.removeEventListener('click',      bootstrap);
    document.removeEventListener('keydown',    bootstrap);
    document.removeEventListener('touchstart', bootstrap);
  };
  document.addEventListener('click',      bootstrap, { once: true, passive: true });
  document.addEventListener('keydown',    bootstrap, { once: true, passive: true });
  document.addEventListener('touchstart', bootstrap, { once: true, passive: true });
}

function getCtx() {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Sinteză ────────────────────────────────────────────────

/**
 * Bell cu 3 parțiale armonice:
 *   - fundamentala   (100% vol, decay lung)     — corpul sunetului
 *   - octava 2×      (35%  vol, decay mediu)    — strălucire
 *   - parțiala 2.756× (18% vol, decay scurt)   — caracter metalic de clopot real
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

    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(amplitude, t + 0.009);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.start(t);
    osc.stop(t + decay + 0.06);
  });
}

// ── API publică ────────────────────────────────────────────

/**
 * Mesaj primit — două note ascendente: A5 → E6 (cvintă perfectă)
 * Sună cald, profesional, muzical.
 */
export function playReceived() {
  try {
    const ac = getCtx();
    const t  = ac.currentTime;
    chime(ac, 880,    t,        0.52, 0.44);  // A5 — nota principală
    chime(ac, 1318.5, t + 0.15, 0.62, 0.36); // E6 — cvintă perfectă
  } catch (_) {}
}

/**
 * Mesaj trimis — chime discret, confirmare subtilă.
 */
export function playSent() {
  try {
    const ac = getCtx();
    const t  = ac.currentTime;
    chime(ac, 880, t, 0.2, 0.18); // A5 scurt
  } catch (_) {}
}

/**
 * Comandă de transport primită — triada majoră C5→E5→G5, formală și distinctă.
 * Semnalează clar că a sosit ceva important, diferit de un mesaj obișnuit.
 */
export function playTripOrderReceived() {
  try {
    const ac = getCtx();
    const t  = ac.currentTime;
    chime(ac, 523.25, t,        0.55, 0.40); // C5
    chime(ac, 659.25, t + 0.13, 0.55, 0.48); // E5
    chime(ac, 783.99, t + 0.26, 0.62, 0.60); // G5 — nota de vârf, decay mai lung
  } catch (_) {}
}

/**
 * Comandă acceptată — G5→B5→G6 ascendent, rezolvare pozitivă.
 * Ultimul chime mai înalt și mai scurt, senzație de confirmare rapidă.
 */
export function playTripOrderAccepted() {
  try {
    const ac = getCtx();
    const t  = ac.currentTime;
    chime(ac, 783.99,  t,        0.50, 0.38); // G5
    chime(ac, 987.77,  t + 0.11, 0.50, 0.42); // B5
    chime(ac, 1567.98, t + 0.21, 0.42, 0.30); // G6 — scurt și cristalin
  } catch (_) {}
}

/**
 * Comandă refuzată — A5→E5 descendent, neutru și calm.
 * Nu deranjant, dar clar diferit de acceptare.
 */
export function playTripOrderRejected() {
  try {
    const ac = getCtx();
    const t  = ac.currentTime;
    chime(ac, 880,    t,        0.46, 0.40); // A5
    chime(ac, 659.25, t + 0.16, 0.38, 0.50); // E5 — coboară, decay lin
  } catch (_) {}
}
