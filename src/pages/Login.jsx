import { useState } from 'react';
import { api } from '../services/api';

const FEATURES = [
  {
    icon: (color) => (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="5" width="15" height="10" rx="2"/>
        <path d="M16 8h3l3 3v4h-3"/>
        <circle cx="5.5" cy="17.5" r="2.5"/>
        <circle cx="18.5" cy="17.5" r="2.5"/>
      </svg>
    ),
    title: 'Status flotă în timp real',
    desc: 'Monitorizare live a tuturor vehiculelor cu actualizare automată la fiecare 2 secunde',
  },
  {
    icon: (color) => (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: 'Gestionare curse',
    desc: 'Planifică transporturile cu CMR, documente atașate și facturare integrată',
  },
  {
    icon: (color) => (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'Rapoarte financiare',
    desc: 'Costuri, km parcurși, taxe rutiere și analiza profitabilității per cursă',
  },
  {
    icon: (color) => (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Roluri și permisiuni',
    desc: 'Admin, Dispecer și Contabil — acces granular configurat per utilizator',
  },
];

function Login({ onLogin }) {
  const [tab, setTab] = useState('login');

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regCompany, setRegCompany] = useState('');
  const [regVat, setRegVat] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.login(username, password);
      onLogin(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Utilizator sau parolă incorectă');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!regCompany.trim() || !regEmail.trim() || !regUsername.trim() || !regPassword) {
      setError('Toate câmpurile obligatorii trebuie completate');
      return;
    }
    if (regPassword !== regConfirm) {
      setError('Parolele nu coincid');
      return;
    }
    if (regPassword.length < 6) {
      setError('Parola trebuie să aibă cel puțin 6 caractere');
      return;
    }
    setLoading(true);
    try {
      const response = await api.register(regCompany.trim(), regVat.trim(), regEmail.trim(), regUsername.trim(), regPassword);
      onLogin(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare la înregistrare');
    } finally {
      setLoading(false);
    }
  };

  const iField = (field) => ({
    width: '100%',
    padding: '12px 16px 12px 44px',
    border: `1.5px solid ${focused === field ? '#ff7a3d' : 'rgba(255,255,255,0.09)'}`,
    borderRadius: '9px',
    fontSize: '14px',
    background: focused === field ? 'rgba(255,122,61,0.05)' : 'rgba(255,255,255,0.03)',
    color: '#ffffff',
    outline: 'none',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  });

  const lStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '7px',
    letterSpacing: '0.01em',
  };

  const iconAbsStyle = {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    transition: 'stroke 0.2s',
  };

  const ic = (field) => focused === field ? '#ff7a3d' : 'rgba(255,255,255,0.25)';

  const submitBtn = (isLoading) => ({
    width: '100%',
    padding: '13px',
    background: isLoading ? 'rgba(255,122,61,0.55)' : '#ff7a3d',
    border: 'none',
    borderRadius: '9px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    boxShadow: isLoading ? 'none' : '0 4px 16px rgba(255,122,61,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  });

  const Spinner = () => (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin-loader 0.65s linear infinite', transformOrigin: 'center', flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5"/>
      <path d="M12 3a9 9 0 0 1 9 9" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );

  const ErrorBlock = ({ msg }) => (
    <div style={{
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.25)',
      color: '#ef4444',
      padding: '10px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {msg}
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      zIndex: 9999,
    }}>
      {/* ─────────────── LEFT PANEL ─────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 44px',
        background: '#060606',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px',
              background: 'linear-gradient(135deg, #ff7a3d 0%, #ff4500 100%)',
              borderRadius: '9px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(255,122,61,0.4)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="5" width="15" height="10" rx="2"/>
                <path d="M16 8h3l3 3v4h-3"/>
                <circle cx="5.5" cy="17.5" r="2.5"/>
                <circle cx="18.5" cy="17.5" r="2.5"/>
              </svg>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
              Fleet Management
            </span>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: '26px' }}>
          <h1 style={{
            fontSize: '23px', fontWeight: 700, color: '#fff',
            letterSpacing: '-0.03em', marginBottom: '8px', lineHeight: 1.2,
          }}>
            {tab === 'login' ? 'Bine ai revenit' : 'Creează cont nou'}
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.55 }}>
            {tab === 'login'
              ? 'Introdu credențialele pentru a accesa platforma'
              : 'Înregistrează compania și creează-ți contul de administrator'}
          </p>
        </div>

        {/* Tab Switch */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '9px',
          padding: '3px',
          marginBottom: '26px',
          gap: '3px',
        }}>
          {[['login', 'Autentificare'], ['register', 'Înregistrare']].map(([t, label]) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: tab === t ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.38)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── LOGIN FORM ── */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label style={lStyle}>Utilizator</label>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ic('un')} strokeWidth="2" strokeLinecap="round" style={iconAbsStyle}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocused('un')}
                  onBlur={() => setFocused(null)}
                  placeholder="Introdu username"
                  autoFocus
                  required
                  style={iField('un')}
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={lStyle}>Parolă</label>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ic('pw')} strokeWidth="2" strokeLinecap="round" style={iconAbsStyle}>
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('pw')}
                  onBlur={() => setFocused(null)}
                  placeholder="Introdu parola"
                  required
                  style={iField('pw')}
                />
              </div>
            </div>

            {error && <ErrorBlock msg={error} />}

            <button
              type="submit"
              disabled={loading}
              style={submitBtn(loading)}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#ff8c52'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(255,122,61,0.5)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = '#ff7a3d'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,122,61,0.3)'; } }}
            >
              {loading ? <><Spinner />Se autentifică...</> : 'Autentificare →'}
            </button>
          </form>
        )}

        {/* ── REGISTER FORM ── */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            {/* Company */}
            <div style={{ marginBottom: '12px' }}>
              <label style={lStyle}>Numele companiei</label>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ic('rc')} strokeWidth="2" strokeLinecap="round" style={iconAbsStyle}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <input
                  type="text"
                  value={regCompany}
                  onChange={e => setRegCompany(e.target.value)}
                  onFocus={() => setFocused('rc')}
                  onBlur={() => setFocused(null)}
                  placeholder="Ex: Transport SRL"
                  autoFocus
                  required
                  style={iField('rc')}
                />
              </div>
            </div>

            {/* VAT / CUI */}
            <div style={{ marginBottom: '12px' }}>
              <label style={lStyle}>
                CUI / VAT
                <span style={{ marginLeft: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(opțional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ic('rv')} strokeWidth="2" strokeLinecap="round" style={iconAbsStyle}>
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <line x1="12" y1="12" x2="12" y2="16"/>
                  <line x1="10" y1="14" x2="14" y2="14"/>
                </svg>
                <input
                  type="text"
                  value={regVat}
                  onChange={e => setRegVat(e.target.value)}
                  onFocus={() => setFocused('rv')}
                  onBlur={() => setFocused(null)}
                  placeholder="Ex: RO12345678"
                  style={iField('rv')}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '12px' }}>
              <label style={lStyle}>Email</label>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ic('re')} strokeWidth="2" strokeLinecap="round" style={iconAbsStyle}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  onFocus={() => setFocused('re')}
                  onBlur={() => setFocused(null)}
                  placeholder="contact@companie.ro"
                  required
                  style={iField('re')}
                />
              </div>
            </div>

            {/* Username */}
            <div style={{ marginBottom: '12px' }}>
              <label style={lStyle}>Utilizator (cont admin)</label>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ic('ru')} strokeWidth="2" strokeLinecap="round" style={iconAbsStyle}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  onFocus={() => setFocused('ru')}
                  onBlur={() => setFocused(null)}
                  placeholder="Alege un username"
                  required
                  style={iField('ru')}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '12px' }}>
              <label style={lStyle}>Parolă</label>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ic('rp')} strokeWidth="2" strokeLinecap="round" style={iconAbsStyle}>
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  onFocus={() => setFocused('rp')}
                  onBlur={() => setFocused(null)}
                  placeholder="Minimum 6 caractere"
                  required
                  style={iField('rp')}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '22px' }}>
              <label style={lStyle}>Confirmă parola</label>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ic('rpc')} strokeWidth="2" strokeLinecap="round" style={iconAbsStyle}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  onFocus={() => setFocused('rpc')}
                  onBlur={() => setFocused(null)}
                  placeholder="Repetă parola"
                  required
                  style={iField('rpc')}
                />
              </div>
            </div>

            {error && <ErrorBlock msg={error} />}

            <button
              type="submit"
              disabled={loading}
              style={submitBtn(loading)}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#ff8c52'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(255,122,61,0.5)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = '#ff7a3d'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,122,61,0.3)'; } }}
            >
              {loading ? <><Spinner />Se creează contul...</> : 'Creează cont →'}
            </button>

            <p style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.28)',
              textAlign: 'center',
              marginTop: '14px',
              lineHeight: 1.5,
            }}>
              Contul creat va fi de tip <strong style={{ color: 'rgba(255,255,255,0.45)' }}>Administrator</strong> cu acces complet la platformă
            </p>
          </form>
        )}
        </div>{/* end inner wrapper */}
      </div>

      {/* ─────────────── RIGHT PANEL ─────────────── */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: '#17120d',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 64px',
        overflow: 'hidden',
      }}>
        {/* Dot grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />

        {/* Glow top-right */}
        <div style={{
          position: 'absolute', top: '-100px', right: '-60px',
          width: '580px', height: '580px',
          background: 'radial-gradient(circle, rgba(255,122,61,0.22) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Glow bottom-left */}
        <div style={{
          position: 'absolute', bottom: '-80px', left: '15%',
          width: '360px', height: '360px',
          background: 'radial-gradient(circle, rgba(255,122,61,0.1) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '560px' }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,122,61,0.1)',
            border: '1px solid rgba(255,122,61,0.2)',
            borderRadius: '20px', padding: '5px 14px',
            marginBottom: '28px',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#ff7a3d', display: 'inline-block',
              boxShadow: '0 0 6px #ff7a3d',
            }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#ff7a3d', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Fleet Management System
            </span>
          </div>

          {/* Headline */}
          <h2 style={{
            fontSize: '48px', fontWeight: 800, color: '#fff',
            letterSpacing: '-0.04em', lineHeight: 1.06, marginBottom: '18px',
          }}>
            Gestionează flota.<br />
            <span style={{
              background: 'linear-gradient(90deg, #ff7a3d 0%, #ff5500 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Eficient.
            </span>
          </h2>

          <p style={{
            fontSize: '15px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.7,
            marginBottom: '46px', maxWidth: '400px',
          }}>
            Platforma completă pentru monitorizarea vehiculelor, gestionarea curselor și analiza performanței flotei tale.
          </p>

          {/* Features list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '46px' }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '38px', height: '38px', flexShrink: 0,
                  background: 'rgba(255,122,61,0.08)',
                  border: '1px solid rgba(255,122,61,0.15)',
                  borderRadius: '9px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {f.icon('#ff7a3d')}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '3px' }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.36)', lineHeight: 1.5 }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats bar */}
          <div style={{
            paddingTop: '26px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', gap: '40px',
          }}>
            {[
              ['2s', 'Actualizare live'],
              ['3', 'Roluri utilizatori'],
              ['100%', 'Cloud-based'],
            ].map(([val, label]) => (
              <div key={label}>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{val}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.32)', marginTop: '3px' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
