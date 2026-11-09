import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import Login from './pages/Login';
import Tracking from './pages/Tracking';
import Admin from './pages/Admin';
import Curse from './pages/Curse';
import Dashboard from './pages/Dashboard';
import ChatPanel from './components/ChatPanel';
import GenerareComanda from './pages/GenerareComanda';
import { DesignToggleRow } from './pages/generareShared';
import { connectSocket, disconnectSocket, getSocket } from './services/socket';
import { api } from './services/api';

// Cheile de permisiuni pentru vizibilitatea paginilor
const VIEW_KEYS = ['viewTracking', 'viewRegistru', 'viewChat', 'viewReports', 'viewGenerare'];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(
    localStorage.getItem('currentPage') || 'tracking'
  );
  const [theme, setTheme] = useState('dark');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [trackingView, setTrackingView] = useState('standard');
  const [alerts, setAlerts]         = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const userMenuRef = useRef(null);
  const bellRef     = useRef(null);
  const navRef      = useRef(null);

  // Design Apple (comutator în meniul contului) — salvat per browser
  const [appleUI, setAppleUI] = useState(() => { try { return localStorage.getItem('generareDesign') === 'apple'; } catch { return false; } });
  const toggleDesign = () => setAppleUI(v => { const n = !v; try { localStorage.setItem('generareDesign', n ? 'apple' : 'classic'); } catch { /* ignore */ } return n; });
  const [pill, setPill] = useState({ x: 0, w: 0, ready: false });

  // Fundal pe toată pagina doar pentru Generare în Design Apple
  useEffect(() => {
    document.body.classList.toggle('generare-apple', appleUI && currentPage === 'generare');
    return () => document.body.classList.remove('generare-apple');
  }, [appleUI, currentPage]);

  // Pastila care alunecă sub tab-ul activ (Design Apple)
  useLayoutEffect(() => {
    if (!appleUI || !isAuthenticated) return;
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector('[aria-current="page"]');
      setPill(p => el ? { x: el.offsetLeft, w: el.offsetWidth, ready: p.ready } : { ...p, w: 0 });
    };
    measure();
    const raf = requestAnimationFrame(() => setPill(p => ({ ...p, ready: true })));
    window.addEventListener('resize', measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, [appleUI, isAuthenticated, currentPage, user]);


  // Helper function to change page and save to localStorage
  const changePage = (page) => {
    setCurrentPage(page);
    localStorage.setItem('currentPage', page);
    if (page === 'admin') {
      localStorage.removeItem('adminSection');
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Alerte documente — fetch la login + interval 5 min
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchAlerts = async () => {
      try { const res = await api.getDocumentAlerts(); setAlerts(res.data); } catch {}
    };
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [isAuthenticated]);

  useEffect(() => {
    // Check if user is logged in — verifică ambele storages (localStorage = "ține-mă minte", sessionStorage = sesiune temporară)
    const storage = localStorage.getItem('authToken') ? localStorage : sessionStorage;
    const token = storage.getItem('authToken');
    const username = storage.getItem('fleetUser');
    if (token && username) {
      // Conectează socket-ul ÎNAINTE de setIsAuthenticated
      // astfel încât getSocket() returnează instanța când Tracking.jsx se montează
      const sock = connectSocket();
      if (sock) {
        sock.on('connect', () => setSocketConnected(true));
        sock.on('disconnect', () => setSocketConnected(false));
        if (sock.connected) setSocketConnected(true);
      }
      setIsAuthenticated(true);
      const role = storage.getItem('role');
      setUser({
        username,
        role,
        permissions: JSON.parse(storage.getItem('permissions') || '{}'),
        organizationName: storage.getItem('organizationName'),
        first_name: storage.getItem('firstName') || '',
        last_name: storage.getItem('lastName') || '',
      });
      if (role === 'camion') setCurrentPage('chat');
      setTrackingView(localStorage.getItem(`trackingViewV2_${username}`) || 'standard');
    }

    // Set theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleLogin = (data, rememberMe = true) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('authToken', data.token);
    storage.setItem('fleetUser', data.username);
    storage.setItem('role', data.role);
    storage.setItem('permissions', JSON.stringify(data.permissions));
    storage.setItem('organizationName', data.organization_name);
    storage.setItem('firstName', data.first_name || '');
    storage.setItem('lastName', data.last_name || '');

    setIsAuthenticated(true);
    setUser({
      username: data.username,
      role: data.role,
      permissions: data.permissions,
      organizationName: data.organization_name,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
    });
    // Redirect la prima pagină permisă dacă pagina curentă nu e accesibilă
    const perms = data.permissions || {};
    const anyViewExplicit = VIEW_KEYS.some(k => k in perms);
    if (data.role !== 'admin' && anyViewExplicit) {
      const pageMap = [
        { page: 'tracking', key: 'viewTracking' },
        { page: 'curse',    key: 'viewRegistru' },
        { page: 'generare', key: 'viewGenerare' },
        { page: 'chat',     key: 'viewChat'     },
        { page: 'rapoarte', key: 'viewReports'  },
      ];
      const savedPage = localStorage.getItem('currentPage') || 'tracking';
      const savedAllowed = pageMap.find(p => p.page === savedPage && perms[p.key] === true);
      if (!savedAllowed) {
        const firstAllowed = pageMap.find(p => perms[p.key] === true);
        if (firstAllowed) setCurrentPage(firstAllowed.page);
      }
    }
    if (data.role === 'camion') setCurrentPage('chat');
    setTrackingView(localStorage.getItem(`trackingViewV2_${data.username}`) || 'standard');

    // Conectează socket după login
    const sock = connectSocket();
    if (sock) {
      sock.on('connect', () => setSocketConnected(true));
      sock.on('disconnect', () => setSocketConnected(false));
      if (sock.connected) setSocketConnected(true);
    }
  };

  // ── Helper permisiuni pagini ──────────────────────────────
  const canView = (key) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const perms = user.permissions || {};
    if (key in perms) return !!perms[key];
    const hasAnyExplicit = VIEW_KEYS.some(k => k in perms);
    return !hasAnyExplicit; // dacă nu are nicio restricție de view → arată totul
  };

  const handleLogout = () => {
    disconnectSocket();
    // Ștergem doar cheile de autentificare, păstrăm preferințele per user (trackingViewV2_*, theme)
    ['authToken', 'fleetUser', 'role', 'permissions', 'organizationName',
     'currentPage', 'adminSection', 'adminActiveSection'].forEach(k => {
      localStorage.removeItem(k);
    });
    sessionStorage.clear();
    window.location.reload();
  };

  // Actualizează starea socketConnected dacă socket-ul era deja conectat la mount
  useEffect(() => {
    if (isAuthenticated) {
      const sock = connectSocket();
      if (sock?.connected) setSocketConnected(true);
    }
  }, [isAuthenticated]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTrackingView = () => {
    const next = trackingView === 'card' ? 'standard' : 'card';
    setTrackingView(next);
    if (user) localStorage.setItem(`trackingViewV2_${user.username}`, next);
    setUserMenuOpen(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const tabStyle = (active) => appleUI ? ({
    position: 'relative', display: 'inline-flex', alignItems: 'center', minHeight: '34px', padding: '0 14px',
    borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '14px', fontWeight: active ? 600 : 500, background: 'transparent',
    color: active ? 'var(--ap-text)' : 'var(--ap-sub)',
  }) : ({
    display: 'inline-flex', alignItems: 'center', minHeight: '40px', padding: '0 16px',
    borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '14px', fontWeight: active ? 600 : 400,
    background: active ? 'var(--gray-1)' : 'transparent',
    color: active ? 'var(--black)' : 'var(--gray-4)',
  });

  return (
    <div className="fm-shell" style={{
      minHeight: '100vh',
      background: 'var(--bg-body)',
      padding: currentPage === 'chat' ? '20px 8px 0 8px' : '20px 8px',
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div className="fm-page" style={{
        maxWidth: '100%',
        margin: '0 auto',
        background: 'var(--bg-page)',
        border: '1px solid var(--gray-2)',
        borderRadius: currentPage === 'chat' ? '16px 16px 0 0' : '16px',
        padding: currentPage === 'chat' ? '32px 32px 0 32px' : currentPage === 'generare' ? '32px 20px' : '32px',
        boxShadow: '0 8px 30px var(--shadow)',
        position: 'relative',
      }}>
        {/* Header universal — wordmark, navigare, controale, efect live */}
        <header className={`fm-hero${appleUI ? ' ap-nav-header' : ''}`} style={appleUI ? {
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px 24px', padding: '8px 12px 8px 18px', marginBottom: '28px',
          border: '0.5px solid var(--ap-sep)', borderRadius: '16px', background: 'var(--ap-bar)',
          backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          position: 'sticky', top: '12px', zIndex: 100,
        } : {
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px 24px', padding: '10px 12px 10px 18px', marginBottom: '28px',
          border: '1px solid var(--gray-2)', borderRadius: '14px', background: 'var(--surface)',
          zIndex: 100,
        }}>
          {!appleUI && <div className="fm-hero-fx" aria-hidden="true"><span className="fm-sheen" /></div>}

          {(() => {
            const name = (user.organizationName && user.organizationName !== 'Default') ? user.organizationName : 'Fleet Management';
            const [first, ...rest] = name.split(' ');
            return (
              <button onClick={() => changePage('tracking')} aria-label={name} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', background: 'transparent', border: 'none', padding: '6px 0', cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit' }}>
                <span style={{ fontSize: '20px', fontWeight: appleUI ? 600 : 800, letterSpacing: appleUI ? '-0.02em' : '-0.03em', color: appleUI ? 'var(--ap-text)' : 'var(--black)' }}>{first}</span>
                <span style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '-0.02em', color: appleUI ? 'var(--ap-sub)' : 'var(--gray-4)' }}>
                  {rest.join(' ')}<span style={{ color: appleUI ? 'var(--ap-accent)' : 'var(--fm-accent)', fontWeight: appleUI ? 600 : 800 }}>.</span>
                </span>
              </button>
            );
          })()}

          <nav ref={navRef} aria-label="Principal" style={appleUI
            ? { position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px', padding: '3px', borderRadius: '12px', background: 'var(--ap-seg)' }
            : { display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {appleUI && (
              <span className="ap-pill" aria-hidden="true" style={{ position: 'absolute', top: '3px', bottom: '3px', left: 0, width: pill.w, opacity: pill.w ? 1 : 0, transform: `translateX(${pill.x}px)`, transition: pill.ready ? undefined : 'none' }} />
            )}
            {canView('viewTracking') && (
              <button className="fm-tab" onClick={() => changePage('tracking')} aria-current={currentPage === 'tracking' ? 'page' : undefined} style={tabStyle(currentPage === 'tracking')}>Status flotă</button>
            )}
            {canView('viewRegistru') && (
              <button className="fm-tab" onClick={() => changePage('curse')} aria-current={currentPage === 'curse' ? 'page' : undefined} style={tabStyle(currentPage === 'curse')}>Registru</button>
            )}
            {canView('viewGenerare') && (
              <button className="fm-tab" onClick={() => changePage('generare')} aria-current={currentPage === 'generare' ? 'page' : undefined} style={tabStyle(currentPage === 'generare')}>Generare</button>
            )}
            {canView('viewChat') && (
              <button className="fm-tab" onClick={() => changePage('chat')} aria-current={currentPage === 'chat' ? 'page' : undefined} style={tabStyle(currentPage === 'chat')}>Chat</button>
            )}
            {canView('viewReports') && (
              <button className="fm-tab" onClick={() => changePage('rapoarte')} aria-current={currentPage === 'rapoarte' ? 'page' : undefined} style={tabStyle(currentPage === 'rapoarte')}>Rapoarte</button>
            )}
            {(user.role === 'admin' || user.permissions?.accessAdmin) && (
              <button className="fm-tab" onClick={() => changePage('admin')} aria-current={currentPage === 'admin' ? 'page' : undefined} style={tabStyle(currentPage === 'admin')}>Panou admin</button>
            )}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={toggleTheme}
              aria-label="Schimbă tema"
              className={appleUI ? 'ap-icon' : undefined}
              style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'transparent', color: appleUI ? 'var(--ap-sub)' : 'var(--gray-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
              )}
            </button>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', borderRadius: '10px' }}>

          {/* ── Clopoțel alerte ── */}
          <div ref={bellRef} style={{ position: 'relative' }}>
            {(() => {
              const TYPE_LABEL = { driver: 'Șofer', truck: 'Camion', trailer: 'Remorcă' };
              const TYPE_COLOR = { driver: '#8b5cf6', truck: '#3b82f6', trailer: '#14b8a6' };
              const DOC_LABEL  = {
                pasaport:'Pașaport', permis:'Permis conducere', ci:'C.I.',
                tahograf:'Card tahograf', a1macron:'A1 Macron',
                itp:'ITP', rca:'RCA', casco:'CASCO', cemt:'CEMT',
                licenta:'Licență transport', ITP:'ITP', RCA:'RCA',
              };
              const expired    = alerts.filter(a => a.days_left < 0);
              const expiring   = alerts.filter(a => a.days_left >= 0);
              const sorted     = [...expired, ...expiring];
              const badgeCount = alerts.length;
              const badgeColor = expired.length > 0 ? 'var(--red)' : '#f59e0b';
              return (
                <>
                  <button
                    onClick={() => { setAlertsOpen(o => !o); setUserMenuOpen(false); }}
                    title="Alerte documente"
                    className={appleUI ? 'ap-icon' : undefined}
                    style={{
                      height: appleUI ? '40px' : '100%', width: appleUI ? '40px' : undefined, padding: appleUI ? 0 : '0 13px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: appleUI ? 'center' : undefined, position: 'relative',
                      color: alertsOpen ? (appleUI ? 'var(--ap-accent)' : '#ff7a3d') : (appleUI ? 'var(--ap-sub)' : 'var(--gray-4)'),
                      borderRadius: appleUI ? '50%' : '9px 0 0 9px',
                      transition: 'color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = alertsOpen ? '#ff7a3d' : 'var(--black)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = alertsOpen ? '#ff7a3d' : 'var(--gray-4)'; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 8a6 6 0 0 1 12 0c0 6 3 8 3 8H3s3-2 3-8"/>
                      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                    </svg>
                    {badgeCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        background: badgeColor, color: '#fff',
                        borderRadius: '50%', minWidth: 16, height: 16,
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px', boxSizing: 'border-box',
                        border: '1.5px solid var(--surface)', lineHeight: 1,
                      }}>
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </button>

                  {alertsOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                      width: 340, maxHeight: 440, overflowY: 'auto',
                      background: 'var(--bg-page)', border: '1px solid var(--gray-2)',
                      borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                      zIndex: 9998, fontFamily: "'SF Pro Display',-apple-system,sans-serif",
                    }}>
                      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-page)', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 8a6 6 0 0 1 12 0c0 6 3 8 3 8H3s3-2 3-8"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                          </svg>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)' }}>Alerte documente</span>
                        </div>
                        {badgeCount > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: expired.length > 0 ? 'rgba(220,38,38,0.12)' : 'rgba(245,158,11,0.12)', color: badgeColor }}>
                            {expired.length > 0 && `${expired.length} expirat${expired.length > 1 ? 'e' : ''}`}
                            {expired.length > 0 && expiring.length > 0 && ' · '}
                            {expiring.length > 0 && `${expiring.length} curând`}
                          </span>
                        )}
                      </div>

                      {sorted.length === 0 ? (
                        <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 10px' }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                          <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>Toate documentele sunt în regulă</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 4 }}>Nicio expirare în următoarele 30 de zile</div>
                        </div>
                      ) : (
                        sorted.map((a, i) => {
                          const isExp    = a.days_left < 0;
                          const dotColor = isExp ? 'var(--red)' : a.days_left <= 7 ? '#f97316' : '#f59e0b';
                          const dayLabel = isExp
                            ? `Expirat${Math.abs(a.days_left) > 0 ? ` acum ${Math.abs(a.days_left)}z` : ''}`
                            : a.days_left === 0 ? 'Expiră azi' : `${a.days_left} zi${a.days_left === 1 ? '' : 'le'}`;
                          return (
                            <div key={i}
                              onClick={() => { changePage('admin'); setAlertsOpen(false); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < sorted.length - 1 ? '1px solid var(--gray-2)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }}/>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.entity_name}</span>
                                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, flexShrink: 0, letterSpacing: '0.02em', background: TYPE_COLOR[a.type] + '18', color: TYPE_COLOR[a.type] }}>{TYPE_LABEL[a.type]}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>{DOC_LABEL[a.doc_type] || a.doc_type}</div>
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: dotColor }}>{dayLabel}</div>
                            </div>
                          );
                        })
                      )}

                      {sorted.length > 0 && (
                        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--gray-2)', textAlign: 'center', position: 'sticky', bottom: 0, background: 'var(--bg-page)' }}>
                          <button onClick={() => { changePage('admin'); setAlertsOpen(false); }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#ff7a3d', fontWeight: 600, fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6 }}>
                            Mergi la Admin →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* ── Separator vertical ── */}
          <div style={appleUI ? { width: '0.5px', height: '24px', alignSelf: 'center', margin: '0 8px', background: 'var(--ap-sep)' } : { width: '1px', background: 'var(--gray-3)', margin: '8px 0' }} />

          {/* ── Buton user ── */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setUserMenuOpen(!userMenuOpen); setAlertsOpen(false); }}
              className={appleUI ? 'ap-icon' : undefined}
              style={appleUI ? {
                display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px',
                background: 'transparent', border: 'none', borderRadius: '999px',
                padding: '4px 10px 4px 4px', cursor: 'pointer', transition: 'background 0.2s',
              } : {
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'transparent', border: 'none',
                borderRadius: '0 9px 9px 0',
                padding: '6px 10px', cursor: 'pointer', transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: appleUI ? 'linear-gradient(180deg, #5e5ce6, var(--ap-accent))' : 'var(--gray-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: appleUI ? '#ffffff' : 'var(--black)', fontWeight: 600, fontSize: '13px' }}>
                  {user.first_name ? user.first_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                  {user.last_name ? user.last_name.charAt(0).toUpperCase() : ''}
                </div>
                <div
                  title={socketConnected ? 'Timp real activ' : 'Reconectare...'}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: socketConnected ? '#22c55e' : '#f59e0b', border: '2px solid var(--surface)', transition: 'background 0.4s' }}
                />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: appleUI ? 'var(--ap-text)' : 'var(--black)', whiteSpace: 'nowrap' }}>
                  {(user.first_name || user.last_name)
                    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
                    : user.username}
                </div>
                <div style={{ fontSize: '12px', color: appleUI ? 'var(--ap-sub)' : 'var(--gray-4)', whiteSpace: 'nowrap' }}>
                  {appleUI ? '' : `@${user.username} · `}{user.role === 'admin' ? 'Administrator' : user.role === 'dispatcher' ? 'Dispecer' : 'Contabil'}
                </div>
              </div>
              {appleUI ? (
                <svg aria-hidden="true" width="10" height="12" viewBox="0 0 10 14" fill="none" stroke="var(--ap-sub)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l3-3 3 3M2 9l3 3 3-3"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </button>

            {/* Dropdown Menu — Design Apple */}
            {userMenuOpen && appleUI && (
              <div role="menu" aria-label="Cont" className="ap-menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000, width: 248, boxSizing: 'border-box', padding: 6, borderRadius: 14, background: 'var(--ap-menu-bg)', backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)', border: '0.5px solid var(--ap-menu-border)', boxShadow: 'var(--ap-menu-shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 12px' }}>
                  <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(180deg, #5e5ce6, var(--ap-accent))', color: '#fff', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(user.first_name || user.username || '?').charAt(0).toUpperCase()}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ap-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(user.first_name || user.last_name) ? [user.first_name, user.last_name].filter(Boolean).join(' ') : user.username}</span>
                    <span style={{ fontSize: 12, color: 'var(--ap-sub)' }}>@{user.username} · {user.role === 'admin' ? 'Administrator' : user.role === 'dispatcher' ? 'Dispecer' : 'Contabil'}</span>
                  </span>
                </div>
                <div className="ap-menu-sep" style={{ margin: '0 4px 6px' }} />
                {currentPage === 'tracking' && (
                  <button type="button" role="menuitem" className="ap-menu-item" onClick={toggleTrackingView}>
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {trackingView === 'card'
                        ? <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>
                        : <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>}
                    </svg>
                    {trackingView === 'card' ? 'Standard View' : 'Card View'}
                  </button>
                )}
                <DesignToggleRow apple on={appleUI} onToggle={toggleDesign} />
                <div className="ap-menu-sep" style={{ margin: '6px 4px' }} />
                <button type="button" role="menuitem" className="ap-menu-item ap-menu-danger" onClick={handleLogout}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Delogare
                </button>
              </div>
            )}

            {/* Dropdown Menu — clasic */}
            {userMenuOpen && !appleUI && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: '0', background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '8px', boxShadow: '0 4px 12px var(--shadow)', minWidth: '100%', zIndex: 1000, overflow: 'hidden' }}>
                {currentPage === 'tracking' && (
                  <button
                    onClick={toggleTrackingView}
                    style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '14px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {trackingView === 'card' ? (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                        Standard View
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                        </svg>
                        Card View
                      </>
                    )}
                  </button>
                )}
                <DesignToggleRow on={appleUI} onToggle={toggleDesign} />
                <div style={{ height: '1px', background: 'var(--gray-2)' }} />
                <button
                  onClick={handleLogout}
                  style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '14px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Delogare
                </button>
              </div>
            )}
          </div>

            </div>
          </div>
        </header>

        {/* Page Content */}
        {currentPage === 'generare' && canView('viewGenerare') && <GenerareComanda user={user} appleUI={appleUI} />}
        {currentPage === 'tracking' && canView('viewTracking') && <Tracking user={user} viewMode={trackingView} />}
        {currentPage === 'curse'    && canView('viewRegistru') && <Curse user={user} />}
        {currentPage === 'rapoarte' && canView('viewReports')  && <Dashboard user={user} />}
        {currentPage === 'admin'    && (user.role === 'admin' || user.permissions?.accessAdmin) && <Admin user={user} />}
        {canView('viewChat') && <ChatPanel user={user} currentPage={currentPage} />}
      </div>
    </div>
  );
}

export default App;