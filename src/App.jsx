import { useState, useEffect, useRef } from 'react';
import Login from './pages/Login';
import Tracking from './pages/Tracking';
import Admin from './pages/Admin';
import Curse from './pages/Curse';
import Soferi from './pages/Soferi';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(
    localStorage.getItem('currentPage') || 'tracking'
  );
  const [theme, setTheme] = useState('dark');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Helper function to change page and save to localStorage
  const changePage = (page) => {
    setCurrentPage(page);
    localStorage.setItem('currentPage', page);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('fleetUser');
    if (token && username) {
      setIsAuthenticated(true);
      setUser({
        username,
        role: localStorage.getItem('role'),
        permissions: JSON.parse(localStorage.getItem('permissions') || '{}'),
        organizationName: localStorage.getItem('organizationName')
      });
    }

    // Set theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleLogin = (data) => {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('fleetUser', data.username);
    localStorage.setItem('role', data.role);
    localStorage.setItem('permissions', JSON.stringify(data.permissions));
    localStorage.setItem('organizationName', data.organization_name);
    
    setIsAuthenticated(true);
    setUser({
      username: data.username,
      role: data.role,
      permissions: data.permissions,
      organizationName: data.organization_name
    });
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setUser(null);
    setCurrentPage('tracking');
    localStorage.setItem('currentPage', 'tracking');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-body)',
      padding: '20px',
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        maxWidth: '100%',
        margin: '0 auto',
        background: 'var(--bg-page)',
        border: '1px solid var(--gray-2)',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 8px 30px var(--shadow)',
        position: 'relative'
      }}>
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: 'var(--black)',
            transition: 'opacity 0.2s',
            padding: '8px'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.7'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          {theme === 'dark' ? '☼' : '☾'}
        </button>

        {/* User Menu - Absolute Position */}
        <div style={{ position: 'absolute', top: '32px', right: '80px', zIndex: 100 }} ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--gray-1)',
              border: '1px solid var(--gray-3)',
              borderRadius: '8px',
              padding: '10px 16px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--gray-2)';
              e.currentTarget.style.borderColor = 'var(--orange)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--gray-1)';
              e.currentTarget.style.borderColor = 'var(--gray-3)';
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#ff7a3d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
              fontSize: '14px'
            }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--black)'
              }}>
                {user.username}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--gray-4)'
              }}>
                {user.role === 'admin' ? 'Administrator' : user.role === 'dispatcher' ? 'Dispecer' : 'Contabil'}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              marginTop: '8px',
              background: 'var(--bg-page)',
              border: '1px solid var(--gray-2)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px var(--shadow)',
              width: '100%',
              minWidth: 'auto',
              zIndex: 1000,
              overflow: 'hidden'
            }}>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: 'var(--black)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--gray-1)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Delogare
              </button>
            </div>
          )}
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
           display: 'flex',
           alignItems: 'center',
           marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2">
                <rect x="1" y="5" width="15" height="10" rx="2"/>
                <path d="M16 8h3l3 3v4h-3"/>
                <circle cx="5.5" cy="17.5" r="2.5"/>
                <circle cx="18.5" cy="17.5" r="2.5"/>
              </svg>
              <div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#ff7a3d',
                  marginBottom: '2px'
                }}>
                  {user.organizationName?.toUpperCase() || 'FLEET MANAGEMENT'}
                </div>
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: 'var(--black)',
                  letterSpacing: '-0.02em'
                }}>
                  Fleet Management System
                </h1>
              </div>
            </div>
           </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--gray-2)' }}>
            <button
              onClick={() => changePage('tracking')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${currentPage === 'tracking' ? '#ff7a3d' : 'transparent'}`,
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: currentPage === 'tracking' ? '#ff7a3d' : 'var(--gray-4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px'
              }}
            >
              Status flotă
            </button>
            <button
              onClick={() => changePage('curse')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${currentPage === 'curse' ? '#ff7a3d' : 'transparent'}`,
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: currentPage === 'curse' ? '#ff7a3d' : 'var(--gray-4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px'
              }}
            >
              Curse
            </button>
            <button
              onClick={() => changePage('soferi')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${currentPage === 'soferi' ? '#ff7a3d' : 'transparent'}`,
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: currentPage === 'soferi' ? '#ff7a3d' : 'var(--gray-4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px'
              }}
            >
              Șoferi
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => changePage('admin')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${currentPage === 'admin' ? '#ff7a3d' : 'transparent'}`,
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: currentPage === 'admin' ? '#ff7a3d' : 'var(--gray-4)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '-2px'
                }}
              >
                Panou admin
              </button>
            )}
          </div>
        </div>

        {/* Page Content */}
        {currentPage === 'tracking' && <Tracking user={user} />}
        {currentPage === 'curse' && <Curse user={user} />}
        {currentPage === 'soferi' && <Soferi user={user} />}
        {currentPage === 'admin' && <Admin user={user} />}
      </div>
    </div>
  );
}

export default App;