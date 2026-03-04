import { useState, useEffect, useRef } from 'react';
import Tracking from '../pages/Tracking';
import Dashboard from '../pages/Dashboard';
import Admin from '../pages/Admin';

function MainLayout({ user, onLogout }) {
  const [currentPage, setCurrentPage] = useState('tracking');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const showPage = (page) => {
    setCurrentPage(page);
    setUserMenuOpen(false);
  };

  const getInitials = (username) => {
    return username ? username.charAt(0).toUpperCase() : 'U';
  };

  const roleNames = {
    admin: 'Administrator',
    dispatcher: 'Dispecer',
    contabil: 'Contabil'
  };

  return (
    <div className="page visible">
      <button className="theme-toggle" onClick={toggleTheme} id="themeIcon">
        {theme === 'dark' ? '☼' : '☾'}
      </button>

      {/* User menu */}
      <div className="user-menu-wrap" id="userMenuWrap" ref={menuRef}>
        <button
          className="user-menu-btn"
          id="userMenuBtn"
          onClick={() => setUserMenuOpen(!userMenuOpen)}
        >
          <div className="user-avatar" id="userAvatar">
            {getInitials(user.username)}
          </div>
          <span className="user-chevron">▼</span>
        </button>
        {userMenuOpen && (
          <div className="user-dropdown show" id="userDropdown">
            <div className="user-dropdown-header">
              <div className="user-dropdown-name">{user.username}</div>
              <div className="user-dropdown-role">{roleNames[user.role] || user.role}</div>
            </div>
            <div style={{ height: '1px', background: 'var(--gray-2)', margin: '4px 0' }}></div>
            <button className="user-dropdown-item logout" onClick={onLogout}>
              <span>⎋</span> Delogare
            </button>
          </div>
        )}
      </div>

      <div className="header">
        <div className="header-top">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }}>
            <rect x="1" y="5" width="15" height="10" rx="2"></rect>
            <path d="M16 8h3l3 3v4h-3"></path>
            <circle cx="5.5" cy="17.5" r="2.5"></circle>
            <circle cx="18.5" cy="17.5" r="2.5"></circle>
          </svg>
          <span className="app-name" id="orgName">
            {user.organizationName?.toUpperCase() || 'FLEET MANAGEMENT'}
          </span>
        </div>
        <h1><strong>Fleet Management System</strong></h1>
      </div>

      <div className="nav-tabs">
        <button 
          className={`nav-tab ${currentPage === 'tracking' ? 'active' : ''}`}
          onClick={() => showPage('tracking')}
        >
          Tracking
        </button>
        <button 
          className={`nav-tab ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => showPage('dashboard')}
        >
          Dashboard
        </button>
        {user.role === 'admin' && (
          <button 
            className={`nav-tab ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => showPage('admin')}
          >
            Admin
          </button>
        )}
      </div>

      {/* Page Content */}
      {currentPage === 'tracking' && <Tracking user={user} />}
      {currentPage === 'dashboard' && <Dashboard user={user} />}
      {currentPage === 'admin' && <Admin user={user} />}
    </div>
  );
}

export default MainLayout;