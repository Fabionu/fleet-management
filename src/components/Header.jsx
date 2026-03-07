function Header({ user, onLogout }) {
  return (
    <div className="header">
      <div className="header-top">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="5" width="15" height="10" rx="2"/>
          <path d="M16 8h3l3 3v4h-3"/>
          <circle cx="5.5" cy="17.5" r="2.5"/>
          <circle cx="18.5" cy="17.5" r="2.5"/>
        </svg>
        <span className="org-name">{(user.organizationName && user.organizationName !== 'Default') ? user.organizationName.toUpperCase() : 'FLEET MANAGEMENT'}</span>
      </div>
      <h1><strong>Fleet Management System</strong></h1>
      
      <div className="user-menu">
        <span className="username">{user.username}</span>
        <span className="role">({user.role})</span>
        <button onClick={onLogout} className="btn-logout">Delogare</button>
      </div>
    </div>
  );
}

export default Header;