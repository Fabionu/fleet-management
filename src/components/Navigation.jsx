import { Link, useLocation } from 'react-router-dom';

function Navigation({ user }) {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;
  
  return (
    <div className="tabs">
      <Link 
        to="/tracking" 
        className={`tab ${isActive('/tracking') ? 'active' : ''}`}
      >
        📍 Tracking
      </Link>
      
      <Link 
        to="/dashboard" 
        className={`tab ${isActive('/dashboard') ? 'active' : ''}`}
      >
        📊 Dashboard
      </Link>
      
      {user.role === 'admin' && (
        <Link 
          to="/admin" 
          className={`tab ${isActive('/admin') ? 'active' : ''}`}
        >
          ⚙️ Admin
        </Link>
      )}
    </div>
  );
}

export default Navigation;