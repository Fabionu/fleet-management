import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import useStore from '../store/useStore';
import InfoVehicleModal from '../components/InfoVehicleModal';
import WeekendModal from '../components/WeekendModal';
import EditTripModal from '../components/EditTripModal';
import AddTripModal from '../components/AddTripModal';

// Funcție pentru a obține numărul săptămânii
const getWeekNumber = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

function Tracking({ user, viewMode = 'card' }) {
  const { trucks, setTrucks } = useStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const [searchText, setSearchText] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [statusDropdownId, setStatusDropdownId] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [hoveredTruckId, setHoveredTruckId] = useState(null);
  const [pauseEditId, setPauseEditId] = useState(null);
  const menuRef = useRef(null);
  const autoClearedPauses = useRef(new Set());
  const [showToast, setShowToast] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editNextTrip, setEditNextTrip] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [rowHoverId, setRowHoverId] = useState(null);
  const [etaValues, setEtaValues] = useState({});
  const [pauseTimeValues, setPauseTimeValues] = useState({});

  const handleCopyCoords = (key, lat, lng) => {
    if (!lat || !lng) return;
    navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const CopyIcon = () => (
    <svg width="12" height="12" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8.5 4.5V3C8.5 2.17 7.83 1.5 7 1.5H3C2.17 1.5 1.5 2.17 1.5 3V7C1.5 7.83 2.17 8.5 3 8.5H4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );

  const CheckIcon = () => (
    <svg width="12" height="12" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 6.5L5.5 9.5L10.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const getPauseStatus = (pause_date, pause_time) => {
    if (!pause_date && !pause_time) return null;
    const now = new Date();
    let pauseEnd = null;
    if (pause_date) {
      const timeStr = pause_time || '00:00';
      pauseEnd = new Date(`${pause_date}T${timeStr}:00`);
    }
    if (!pauseEnd || isNaN(pauseEnd.getTime())) return 'active';
    const diffMs = now - pauseEnd;
    if (diffMs < 0) return 'active';
    if (diffMs < 15 * 60 * 1000) return 'ready'; // primele 15 minute după expirare
    return 'expired'; // mai mult de 15 minute → auto-clear
  };

useEffect(() => {
  const handleClickOutside = (event) => {
    if (menuRef.current && !menuRef.current.contains(event.target)) {
      setOpenMenuId(null);
    }
  };

  if (openMenuId !== null) {
    document.addEventListener('mousedown', handleClickOutside);
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [openMenuId]);

  const loadTrucks = async () => {
    try {
      const response = await api.getTrucks();
      if (Array.isArray(response.data)) {
        setTrucks(response.data);
      }
    } catch (error) {
      console.error('Error loading trucks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrucks();
    const interval = setInterval(loadTrucks, 2000); // 2 secunde
    return () => clearInterval(interval);
  }, []);

const handleUpdate = async (truck, field, value) => {
  try {
    // Update optimist local
    setTrucks(trucks.map(t => 
      t.id === truck.id ? { ...t, [field]: value } : t
    ));

    // Prepare data for backend
    const truckData = {
      ...truck,
      [field]: value,
      vignettes: typeof truck.vignettes === 'string' 
        ? truck.vignettes 
        : JSON.stringify(truck.vignettes || []),
      next_trip: typeof truck.next_trip === 'string'
        ? truck.next_trip
        : JSON.stringify(truck.next_trip || null),
      amazon_account: truck.amazon_account ? 1 : 0
    };
    
    await api.updateTruck(truck.id, truckData);
    // Nu mai facem loadTrucks() aici - update-ul local e suficient
  } catch (error) {
    console.error('Error updating:', error);
    // La eroare, reîncarcă din backend
    loadTrucks();
  }
};

const handleDeleteTrip = async (truck) => {
  try {
    let nextTrips = [];
    try {
      nextTrips = typeof truck.next_trip === 'string' 
        ? JSON.parse(truck.next_trip) 
        : (truck.next_trip || []);
    } catch (e) {
      nextTrips = [];
    }

    let truckData;
    
    if (nextTrips && nextTrips.length > 0) {
      // Promovează prima cursă următoare
      const nextTrip = nextTrips[0];
      const remainingTrips = nextTrips.slice(1);
      
      truckData = {
        ...truck,
        status: 'incarcare',
        client: nextTrip.client,
        order_number: nextTrip.order_number,
        load_location: nextTrip.load_location,
        load_date: nextTrip.load_date,
        load_time: nextTrip.load_time,
        load_lat: nextTrip.load_lat,
        load_lng: nextTrip.load_lng,
        unload_location: nextTrip.unload_location,
        unload_date: nextTrip.unload_date,
        unload_time: nextTrip.unload_time,
        unload_lat: nextTrip.unload_lat,
        unload_lng: nextTrip.unload_lng,
        observations: nextTrip.observations || '',
        next_trip: JSON.stringify(remainingTrips),
        vignettes: typeof truck.vignettes === 'string' 
          ? truck.vignettes 
          : JSON.stringify(truck.vignettes || []),
        amazon_account: truck.amazon_account === true || truck.amazon_account === 1 ? 1 : 0
      };
    } else {
      // Setează liber
      truckData = {
        ...truck,
        status: 'liber',
        client: null,
        order_number: null,
        load_location: null,
        load_date: null,
        load_time: null,
        load_lat: null,
        load_lng: null,
        unload_location: null,
        unload_date: null,
        unload_time: null,
        unload_lat: null,
        unload_lng: null,
        observations: '',
        next_trip: JSON.stringify([]),
        vignettes: typeof truck.vignettes === 'string' 
          ? truck.vignettes 
          : JSON.stringify(truck.vignettes || []),
        amazon_account: truck.amazon_account === true || truck.amazon_account === 1 ? 1 : 0
      };
    }
    
    await api.updateTruck(truck.id, truckData);

    setShowToast('delete');
    setTimeout(() => setShowToast(false), 2000);

    loadTrucks();
  } catch (error) {
    console.error('Error deleting trip:', error);
  }
};

  const filterTracking = (status) => {
    setFilter(status);
    setFilterDropdownOpen(false);
  };

  const statusOptions = [
    { value: 'all',       label: 'Toate statusurile' },
    { value: 'liber',     label: 'Liber' },
    { value: 'incarcare', label: 'La Încărcare' },
    { value: 'descarcare',label: 'La Descărcare' },
    { value: 'tranzit',   label: 'În Tranzit' },
    { value: 'booked',    label: 'Booked' },
    { value: 'service',   label: 'Service' },
    { value: 'acasa',     label: 'Acasă' },
  ];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setFilterDropdownOpen(false);
      }
      // Închide și dropdown-urile de status/meniu la click în afara lor
      setOpenMenuId(null);
      setStatusDropdownId(null);
      setPauseEditId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTrucks = (Array.isArray(trucks) ? trucks : []).filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const haystack = [t.number, t.client, t.order_number, t.driver_1, t.driver_2, t.drivers, t.load_location, t.unload_location]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (a.number || '').localeCompare(b.number || '', undefined, { numeric: true, sensitivity: 'base' }));

  // Auto-clear pauze expirate (mai mult de 15 minute)
  useEffect(() => {
    const expiredTrucks = trucks.filter(truck => {
      if (!truck.pause_date && !truck.pause_time) return false;
      return getPauseStatus(truck.pause_date, truck.pause_time) === 'expired';
    });
    expiredTrucks.forEach(truck => {
      if (autoClearedPauses.current.has(truck.id)) return;
      autoClearedPauses.current.add(truck.id);
      const truckData = {
        ...truck,
        pause_date: '',
        pause_time: '',
        vignettes: typeof truck.vignettes === 'string' ? truck.vignettes : JSON.stringify(truck.vignettes || []),
        next_trip: typeof truck.next_trip === 'string' ? truck.next_trip : JSON.stringify(truck.next_trip || null),
        amazon_account: truck.amazon_account ? 1 : 0
      };
      setTrucks(prev => prev.map(t => t.id === truck.id ? { ...t, pause_date: '', pause_time: '' } : t));
      api.updateTruck(truck.id, truckData).catch(console.error);
    });
  }, [trucks]);

  const getStatusClass = (status) => {
    return `status-${status}`;
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '80px', 
        textAlign: 'center',
        color: 'var(--gray-4)',
        fontSize: '14px'
      }}>
        Se încarcă...
      </div>
    );
  }

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Filter Bar: search + dropdown */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '24px',
        alignItems: 'center',
      }}>
        {/* Search field */}
        <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
          <svg
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--gray-4)' }}
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Caută după nr. camion, client, comandă, șofer, locație..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 10px 10px 34px',
              border: '1px solid var(--gray-3)',
              borderRadius: '8px',
              background: 'var(--gray-1)',
              color: 'var(--black)',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = '#ff7a3d'}
            onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--gray-4)', fontSize: '16px', lineHeight: 1, padding: '2px 4px',
              }}
            >×</button>
          )}
        </div>

        {/* Status dropdown */}
        <div style={{ position: 'relative', flexShrink: 0 }} ref={filterDropdownRef}>
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px 10px 32px',
              border: `1px solid ${filter !== 'all' ? '#ff7a3d' : 'var(--gray-3)'}`,
              borderRadius: '8px',
              background: filter !== 'all' ? '#ff7a3d18' : 'var(--gray-1)',
              color: filter !== 'all' ? '#ff7a3d' : 'var(--black)',
              fontSize: '13px', fontWeight: filter !== 'all' ? 600 : 400,
              cursor: 'pointer', outline: 'none', minWidth: '160px',
              textAlign: 'left',
            }}
          >
            <svg style={{ position: 'absolute', left: '10px', pointerEvents: 'none', color: filter !== 'all' ? '#ff7a3d' : 'var(--gray-4)' }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span style={{ flex: 1 }}>{statusOptions.find(o => o.value === filter)?.label}</span>
            <svg style={{ flexShrink: 0, transition: 'transform 0.15s', transform: filterDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {filterDropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%',
              background: 'var(--bg-page)', border: '1px solid var(--gray-2)',
              borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              zIndex: 50, overflow: 'hidden',
            }}>
              {statusOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => filterTracking(opt.value)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 14px', border: 'none', cursor: 'pointer',
                    fontSize: '13px',
                    background: filter === opt.value ? '#ff7a3d18' : 'transparent',
                    color: filter === opt.value ? '#ff7a3d' : 'var(--black)',
                    fontWeight: filter === opt.value ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (filter !== opt.value) e.currentTarget.style.background = 'var(--gray-1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = filter === opt.value ? '#ff7a3d18' : 'transparent'; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results count */}
        <div style={{ fontSize: '12px', color: 'var(--gray-4)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {filteredTrucks.length} / {trucks.length} vehicule
        </div>
      </div>

      {/* Table */}
      {viewMode === 'standard' ? (
        /* ══════════════════════════════════════════
           STANDARD VIEW
        ══════════════════════════════════════════ */
        <div style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: '12px', overflow: 'visible' }}>
          <table id="fleetTable" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--gray-1)', borderBottom: '2px solid var(--gray-2)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-4)', width: '185px' }}>Vehicul</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-4)', width: '170px' }}>Repaus</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-4)', width: '200px' }}>Client / Comandă</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-4)' }}>Încărcare</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-4)' }}>Descărcare</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-4)' }}>Observații</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrucks.map((truck, idx) => {
                const statusColor =
                  truck.status === 'liber'      ? '#ef4444' :
                  truck.status === 'incarcare'  ? '#ff7a3d' :
                  truck.status === 'descarcare' ? '#ff7a3d' :
                  truck.status === 'tranzit'    ? '#60a5fa' :
                  truck.status === 'booked'     ? '#4ade80' :
                  truck.status === 'service'    ? '#a8a8a8' :
                  truck.status === 'acasa'      ? '#a8a8a8' : '#505050';
                const isOpen = statusDropdownId === truck.id;
                const isMenuOpen = openMenuId === truck.id;
                const statusLabel = statusOptions.find(o => o.value === truck.status)?.label || truck.status;
                const hasPause = !!(truck.pause_date || truck.pause_time);
                const pauseStatus = hasPause ? getPauseStatus(truck.pause_date, truck.pause_time) : null;
                const isActivePause = pauseStatus === 'active';
                const isPauseReady = pauseStatus === 'ready';
                const isPauseOpen = pauseEditId === truck.id;
                let dateDisplay = '';
                if (truck.pause_date) {
                  const parts = truck.pause_date.split('-');
                  if (parts.length === 3) dateDisplay = `${parts[2]}.${parts[1]}`;
                }
                const pauseText = [dateDisplay, truck.pause_time].filter(Boolean).join(' · ');
                const hasWeekend = truck.weekend_week === `W${getWeekNumber()}` && truck.weekend_duration;
                const isNotLast = idx < filteredTrucks.length - 1;

                return (
                  <tr key={truck.id}
                    style={{ borderBottom: isNotLast ? '1px solid var(--gray-2)' : 'none', userSelect: 'none', cursor: 'default' }}
                    onMouseEnter={() => setRowHoverId(truck.id)}
                    onMouseLeave={() => setRowHoverId(null)}
                  >
                    {/* ── Vehicul TD ── */}
                    <td style={{ padding: '8px 12px 8px 0', width: '185px', verticalAlign: 'top', borderLeft: `4px solid ${statusColor}`, position: 'relative', background: rowHoverId === truck.id ? 'var(--gray-2)' : 'var(--surface)', transition: 'background 0.15s' }}>
                      <div style={{ position: 'relative', paddingLeft: '12px' }}>
                        {/* Număr + meniu */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--black)', letterSpacing: '0.02em' }}>{truck.number}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : truck.id); setStatusDropdownId(null); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '7px 10px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: '6px' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                          </button>
                        </div>
                        {/* Status trigger */}
                        <div
                          onClick={(e) => { e.stopPropagation(); setStatusDropdownId(isOpen ? null : truck.id); setOpenMenuId(null); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', padding: '3px 6px', borderRadius: '6px', background: isOpen ? 'var(--gray-1)' : 'transparent', transition: 'background 0.15s', userSelect: 'none' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                          onMouseLeave={e => e.currentTarget.style.background = isOpen ? 'var(--gray-1)' : 'transparent'}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 0 2px ${statusColor}30` }} />
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: statusColor }}>{statusLabel}</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2.5" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', marginLeft: 'auto' }}><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                        {/* Status dropdown */}
                        {isOpen && (
                          <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 1000, overflow: 'hidden', minWidth: '160px' }}>
                            {statusOptions.filter(o => o.value !== 'all').map(opt => {
                              const optColor = opt.value === 'liber' ? '#ef4444' : opt.value === 'incarcare' ? '#ff7a3d' : opt.value === 'descarcare' ? '#ff7a3d' : opt.value === 'tranzit' ? '#60a5fa' : opt.value === 'booked' ? '#4ade80' : '#a8a8a8';
                              const isActive = truck.status === opt.value;
                              return (
                                <button key={opt.value} onClick={(e) => { e.stopPropagation(); handleUpdate(truck, 'status', opt.value); setStatusDropdownId(null); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', background: isActive ? 'var(--gray-1)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--black)', cursor: 'pointer', borderLeft: isActive ? `3px solid ${optColor}` : '3px solid transparent', transition: 'background 0.15s', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}
                                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--gray-1)'; }}
                                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: optColor, flexShrink: 0 }} />
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {/* 3-dot menu dropdown */}
                        {isMenuOpen && (
                          <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: '100%', marginLeft: '4px', background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 1000, overflow: 'hidden', minWidth: '180px' }}>
                            {user?.permissions?.editVehicleInfo && <button onClick={() => { setSelectedTruck(truck); setModalType('info'); setOpenMenuId(null); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: "'SF Pro Display',-apple-system,sans-serif" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>Info Vehicul</button>}
                            {user?.permissions?.addTrip && <button onClick={() => { setSelectedTruck(truck); setModalType('edit'); setOpenMenuId(null); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: "'SF Pro Display',-apple-system,sans-serif" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editare Cursă</button>}
                            {user?.permissions?.addNextTrip && <button onClick={() => { setSelectedTruck(truck); setModalType('addNext'); setOpenMenuId(null); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: "'SF Pro Display',-apple-system,sans-serif" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Adaugă Cursă</button>}
                            <div style={{ height: '1px', background: 'var(--gray-2)', margin: '4px 0' }} />
                            {user?.permissions?.clearTruckData && <button onClick={() => { setDeleteConfirm(truck); setOpenMenuId(null); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: "'SF Pro Display',-apple-system,sans-serif" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--red-light)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Șterge Date Cursă</button>}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* ── Repaus TD ── */}
                    <td style={{ padding: '8px 14px', verticalAlign: 'top', width: '170px', background: rowHoverId === truck.id ? 'var(--gray-2)' : 'var(--surface)', transition: 'background 0.15s' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', position: 'relative' }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ border: isActivePause ? '1px solid var(--orange)' : isPauseReady ? '1px solid var(--green)' : '1px dashed var(--gray-3)', borderLeft: isActivePause ? '3px solid var(--orange)' : isPauseReady ? '3px solid var(--green)' : '1px dashed var(--gray-3)', borderRadius: '8px', padding: '3px 6px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '4px', minHeight: '30px', width: '100%' }}>
                            {isActivePause ? (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>) : isPauseReady ? (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>) : null}
                            <button onClick={(e) => { e.stopPropagation(); setPauseEditId(isPauseOpen ? null : truck.id); setStatusDropdownId(null); setOpenMenuId(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: isActivePause ? 'var(--orange)' : isPauseReady ? 'var(--green)' : 'var(--gray-3)', padding: '2px', flexShrink: 0, fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}>{dateDisplay || 'dată'}</button>
                            {dateDisplay && <span style={{ color: 'var(--gray-3)', fontSize: '10px', flexShrink: 0 }}>·</span>}
                            <input type="text" value={pauseTimeValues[truck.id] !== undefined ? pauseTimeValues[truck.id] : (truck.pause_time || '')} onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); let formatted = digits.slice(0, 2); if (digits.length >= 3) formatted += ':' + digits.slice(2, 4); setPauseTimeValues(prev => ({...prev, [truck.id]: formatted})); }} onFocus={() => setPauseTimeValues(prev => ({...prev, [truck.id]: truck.pause_time || ''}))} onBlur={() => { const val = pauseTimeValues[truck.id] ?? truck.pause_time ?? ''; handleUpdate(truck, 'pause_time', val); setPauseTimeValues(prev => { const n={...prev}; delete n[truck.id]; return n; }); }} placeholder="HH:MM" maxLength={5} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontWeight: 700, color: isActivePause ? 'var(--orange)' : isPauseReady ? 'var(--green)' : 'var(--gray-4)', width: '40px', flexShrink: 0, fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", userSelect: 'text', cursor: 'text' }} />
                            {hasPause && (<button onClick={async () => { const truckData = { ...truck, pause_date: '', pause_time: '', vignettes: typeof truck.vignettes === 'string' ? truck.vignettes : JSON.stringify(truck.vignettes || []), next_trip: typeof truck.next_trip === 'string' ? truck.next_trip : JSON.stringify(truck.next_trip || null), amazon_account: truck.amazon_account ? 1 : 0 }; setTrucks(trucks.map(t => t.id === truck.id ? { ...t, pause_date: '', pause_time: '' } : t)); await api.updateTruck(truck.id, truckData); setPauseEditId(null); }} onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-3)'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-3)', fontSize: '14px', padding: '0 2px', marginLeft: 'auto', lineHeight: 1, fontFamily: 'system-ui', flexShrink: 0 }}>×</button>)}
                          </div>
                          {isPauseOpen && (
                            <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 1000, padding: '14px' }}>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-4)', marginBottom: '5px' }}>Pana la data</label>
                              <input type="date" value={truck.pause_date || ''} onChange={(e) => { handleUpdate(truck, 'pause_date', e.target.value); setPauseEditId(null); }} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--gray-2)', color: 'var(--black)', fontSize: '13px', padding: '4px 0', outline: 'none' }} />
                            </div>
                          )}
                        </div>
                        <button onClick={() => { setSelectedTruck(truck); setModalType('weekend'); }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = hasWeekend ? 'rgba(34,197,94,0.08)' : 'var(--gray-1)'; setHoveredTruckId(truck.id); }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; setHoveredTruckId(null); }}
                          style={{ width: '100%', background: 'transparent', border: hasWeekend ? '1px solid var(--green)' : '1px dashed var(--gray-3)', borderLeft: hasWeekend ? '3px solid var(--green)' : '1px dashed var(--gray-3)', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', display: 'block', textAlign: 'left', transition: 'background 0.15s', boxSizing: 'border-box' }}>
                          {hasWeekend ? (<div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '12px' }}><span style={{ fontWeight: 700, color: 'var(--green)' }}>{truck.weekend_duration}</span><span style={{ color: 'var(--gray-3)', fontSize: '10px' }}>|</span><span style={{ color: 'var(--gray-4)' }}>{truck.weekend_day || '—'} {truck.weekend_time || '—'}</span></div>) : (<div style={{ fontSize: '12px', color: 'var(--gray-3)', textAlign: 'center' }}>Pauza sapt.</div>)}
                        </button>
                      </div>
                    </td>

                    {/* ── Client TD ── */}
                    <td style={{ padding: '8px 14px', verticalAlign: 'top', width: '200px', background: rowHoverId === truck.id ? 'var(--gray-2)' : 'var(--surface)', transition: 'background 0.15s' }}>
                      {truck.client ? (<div><div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--black)', marginBottom: '1px' }}>{truck.client}</div><div style={{ fontSize: '12px', color: 'var(--gray-4)' }}>{truck.order_number}</div></div>) : <span style={{ color: 'var(--gray-3)', fontStyle: 'italic', fontSize: '13px' }}>—</span>}
                    </td>

                    {/* ── Încărcare TD ── */}
                    <td style={{ padding: '8px 14px', verticalAlign: 'top', background: rowHoverId === truck.id ? 'var(--gray-2)' : 'var(--surface)', transition: 'background 0.15s' }}>
                      {truck.load_location ? (<div><div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '1px' }}><div style={{ fontSize: '13px', color: 'var(--black)' }}>{truck.load_location}</div><button type="button" onClick={() => handleCopyCoords(`${truck.id}-load`, truck.load_lat, truck.load_lng)} style={{ background: 'none', border: 'none', cursor: truck.load_lat && truck.load_lng ? 'pointer' : 'default', padding: '2px', display: 'flex', alignItems: 'center', color: copiedKey === `${truck.id}-load` ? '#22c55e' : 'var(--gray-4)', opacity: truck.load_lat && truck.load_lng ? 1 : 0.3, transition: 'color 0.2s', flexShrink: 0 }}>{copiedKey === `${truck.id}-load` ? <CheckIcon /> : <CopyIcon />}</button></div><div style={{ fontSize: '12px', color: 'var(--gray-4)', marginBottom: '4px' }}>{truck.load_date}</div><input type="text" value={etaValues[`${truck.id}-load`] !== undefined ? `ETA: ${etaValues[`${truck.id}-load`]}` : (truck.load_eta ? `ETA: ${truck.load_eta}` : '')} onChange={(e) => { const raw = e.target.value.replace(/^ETA: ?/, '').replace(/[^0-9.:/ \-]/g, ''); setEtaValues(prev => ({ ...prev, [`${truck.id}-load`]: raw })); }} onFocus={() => setEtaValues(prev => ({ ...prev, [`${truck.id}-load`]: truck.load_eta || '' }))} onBlur={(e) => { const val = etaValues[`${truck.id}-load`] ?? truck.load_eta ?? ''; handleUpdate(truck, 'load_eta', val); setEtaValues(prev => { const n = {...prev}; delete n[`${truck.id}-load`]; return n; }); e.target.style.borderColor = 'transparent'; }} placeholder="ETA: --.--.-- --:--" style={{ fontSize: '13px', color: 'var(--eta-text)', background: 'var(--eta-bg)', border: '1px solid transparent', padding: '3px 4px', borderRadius: '8px', outline: 'none', width: '140px', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", transition: 'border-color 0.2s', userSelect: 'text', cursor: 'text' }} onMouseEnter={(e) => { e.target.style.borderColor = '#60a5fa'; }} onMouseLeave={(e) => { if (document.activeElement !== e.target) e.target.style.borderColor = 'transparent'; }} /></div>) : <span style={{ color: 'var(--gray-3)', fontStyle: 'italic', fontSize: '13px' }}>—</span>}
                    </td>

                    {/* ── Descărcare TD ── */}
                    <td style={{ padding: '8px 14px', verticalAlign: 'top', background: rowHoverId === truck.id ? 'var(--gray-2)' : 'var(--surface)', transition: 'background 0.15s' }}>
                      {truck.unload_location ? (<div><div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '1px' }}><div style={{ fontSize: '13px', color: 'var(--black)' }}>{truck.unload_location}</div><button type="button" onClick={() => handleCopyCoords(`${truck.id}-unload`, truck.unload_lat, truck.unload_lng)} style={{ background: 'none', border: 'none', cursor: truck.unload_lat && truck.unload_lng ? 'pointer' : 'default', padding: '2px', display: 'flex', alignItems: 'center', color: copiedKey === `${truck.id}-unload` ? '#22c55e' : 'var(--gray-4)', opacity: truck.unload_lat && truck.unload_lng ? 1 : 0.3, transition: 'color 0.2s', flexShrink: 0 }}>{copiedKey === `${truck.id}-unload` ? <CheckIcon /> : <CopyIcon />}</button></div><div style={{ fontSize: '12px', color: 'var(--gray-4)', marginBottom: '4px' }}>{truck.unload_date}</div><input type="text" value={etaValues[`${truck.id}-unload`] !== undefined ? `ETA: ${etaValues[`${truck.id}-unload`]}` : (truck.eta ? `ETA: ${truck.eta}` : '')} onChange={(e) => { const raw = e.target.value.replace(/^ETA: ?/, '').replace(/[^0-9.:/ \-]/g, ''); setEtaValues(prev => ({ ...prev, [`${truck.id}-unload`]: raw })); }} onFocus={() => setEtaValues(prev => ({ ...prev, [`${truck.id}-unload`]: truck.eta || '' }))} onBlur={(e) => { const val = etaValues[`${truck.id}-unload`] ?? truck.eta ?? ''; handleUpdate(truck, 'eta', val); setEtaValues(prev => { const n = {...prev}; delete n[`${truck.id}-unload`]; return n; }); e.target.style.borderColor = 'transparent'; }} placeholder="ETA: --.--.-- --:--" style={{ fontSize: '13px', color: 'var(--eta-text)', background: 'var(--eta-bg)', border: '1px solid transparent', padding: '3px 4px', borderRadius: '8px', outline: 'none', width: '140px', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", transition: 'border-color 0.2s', userSelect: 'text', cursor: 'text' }} onMouseEnter={(e) => { e.target.style.borderColor = '#60a5fa'; }} onMouseLeave={(e) => { if (document.activeElement !== e.target) e.target.style.borderColor = 'transparent'; }} /></div>) : <span style={{ color: 'var(--gray-3)', fontStyle: 'italic', fontSize: '13px' }}>—</span>}
                    </td>

                    {/* ── Observații TD ── */}
                    <td style={{ padding: '8px 14px', verticalAlign: 'top', background: rowHoverId === truck.id ? 'var(--gray-2)' : 'var(--surface)', transition: 'background 0.15s' }}>
                      <textarea value={truck.observations || ''} onChange={(e) => handleUpdate(truck, 'observations', e.target.value)} rows="2"
                        style={{ width: '100%', minWidth: '160px', padding: '4px 6px', border: 'none', borderBottom: '1px solid transparent', borderRadius: '0', fontSize: '13px', background: 'transparent', color: 'var(--gray-4)', resize: 'none', outline: 'none', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", transition: 'border-color 0.2s, color 0.2s' }}
                        onFocus={(e) => { e.target.style.borderBottom = '1px solid var(--gray-3)'; e.target.style.color = 'var(--black)'; }}
                        onBlur={(e) => { e.target.style.borderBottom = '1px solid transparent'; e.target.style.color = 'var(--gray-4)'; }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTrucks.length === 0 && (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--gray-4)', fontSize: '14px' }}>
              Nu există camioane {filter !== 'all' && `cu statusul "${filter}"`}.
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════
           CARD VIEW (existent)
        ══════════════════════════════════════════ */
      <div>
        <table id="fleetTable" style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: '0 0',
          fontSize: '13px',
        }}>
          <tbody>
            {filteredTrucks.map((truck) => [
              <tr
                key={truck.id}
                style={{ userSelect: 'none', cursor: 'default' }}
                onMouseEnter={() => setRowHoverId(truck.id)}
                onMouseLeave={() => setRowHoverId(null)}
              >
                {/* ── LEFT: Vehicul ── */}
                <td style={{ padding: '5px 4px 5px 12px', width: '185px', verticalAlign: 'middle', height: '1px' }}>
                  {(() => {
                    const statusColor =
                      truck.status === 'liber'      ? '#ef4444' :
                      truck.status === 'incarcare'  ? '#ff7a3d' :
                      truck.status === 'descarcare' ? '#ff7a3d' :
                      truck.status === 'tranzit'    ? '#60a5fa' :
                      truck.status === 'booked'     ? '#4ade80' :
                      truck.status === 'service'    ? '#a8a8a8' :
                      truck.status === 'acasa'      ? '#a8a8a8' : '#505050';
                    const isOpen = statusDropdownId === truck.id;
                    const isMenuOpen = openMenuId === truck.id;
                    const statusLabel = statusOptions.find(o => o.value === truck.status)?.label || truck.status;
                    return (
                      <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: (isOpen || isMenuOpen) ? 10 : 'auto' }}>
                        {/* Card cu accent stânga colorat */}
                        <div style={{
                          borderRadius: '10px',
                          background: rowHoverId === truck.id ? 'var(--gray-1)' : 'var(--surface)',
                          borderTop: `1px solid ${rowHoverId === truck.id ? 'var(--gray-3)' : 'var(--gray-2)'}`,
                          borderRight: `1px solid ${rowHoverId === truck.id ? 'var(--gray-3)' : 'var(--gray-2)'}`,
                          borderBottom: `1px solid ${rowHoverId === truck.id ? 'var(--gray-3)' : 'var(--gray-2)'}`,
                          borderLeft: `4px solid ${statusColor}`,
                          boxShadow: rowHoverId === truck.id ? '0 2px 8px rgba(0,0,0,0.13)' : '0 1px 4px rgba(0,0,0,0.07)',
                          overflow: 'hidden',
                          cursor: 'default',
                          transition: 'box-shadow 0.15s, border-color 0.15s, background 0.15s',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                        }}>
                          {/* Număr auto + buton ⋮ */}
                          <div style={{ padding: '5px 8px 3px 8px', display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '22px', flexShrink: 0 }} />
                            <div style={{
                              flex: 1,
                              fontWeight: 800,
                              fontSize: '15px',
                              color: 'var(--black)',
                              letterSpacing: '0.02em',
                              whiteSpace: 'nowrap',
                              textAlign: 'center',
                            }}>
                              {truck.number}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : truck.id);
                                setStatusDropdownId(null);
                                setPauseEditId(null);
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-2)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--gray-4)',
                                width: '30px',
                                height: '22px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'background 0.15s',
                                padding: 0,
                              }}
                            >⋮</button>
                          </div>
                          {/* Separator */}
                          <div style={{ height: '1px', background: 'var(--gray-2)', margin: '0 10px' }} />
                          {/* Status trigger */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusDropdownId(isOpen ? null : truck.id);
                              setOpenMenuId(null);
                              setPauseEditId(null);
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = isOpen ? 'var(--gray-2)' : 'transparent'}
                            style={{
                              padding: '5px 10px 5px 12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.07em',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              userSelect: 'none',
                              background: isOpen ? 'var(--gray-2)' : 'transparent',
                              transition: 'background 0.15s',
                              gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: statusColor, flexShrink: 0,
                                boxShadow: `0 0 0 2px ${statusColor}30`,
                              }} />
                              <span style={{ color: statusColor }}>{statusLabel}</span>
                            </div>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="2.5"
                              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </div>
                        </div>
                        {/* Dropdown — în afara overflow:hidden, dar în position:relative */}
                        {isOpen && (
                          <div onMouseDown={e => e.stopPropagation()} style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            background: 'var(--bg-page)',
                            border: '1px solid var(--gray-2)',
                            borderRadius: '10px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                            zIndex: 1000,
                            overflow: 'hidden',
                            minWidth: '160px',
                          }}>
                            {statusOptions.filter(o => o.value !== 'all').map(opt => {
                              const optColor =
                                opt.value === 'liber'      ? '#ef4444' :
                                opt.value === 'incarcare'  ? '#ff7a3d' :
                                opt.value === 'descarcare' ? '#ff7a3d' :
                                opt.value === 'tranzit'    ? '#60a5fa' :
                                opt.value === 'booked'     ? '#4ade80' : '#a8a8a8';
                              const isActive = truck.status === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdate(truck, 'status', opt.value);
                                    setStatusDropdownId(null);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 14px',
                                    background: isActive ? `${optColor}15` : 'transparent',
                                    border: 'none',
                                    borderLeft: isActive ? `3px solid ${optColor}` : '3px solid transparent',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? optColor : 'var(--black)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    textAlign: 'left',
                                    transition: 'background 0.1s',
                                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                                  }}
                                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--gray-1)'; }}
                                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: optColor, flexShrink: 0 }} />
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {/* Meniu ⋮ — în afara overflow:hidden */}
                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            onMouseDown={e => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              left: 0,
                              right: 0,
                              background: 'var(--bg-page)',
                              border: '1px solid var(--gray-2)',
                              borderRadius: '8px',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                              zIndex: 1001,
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              onClick={() => { setSelectedTruck(truck); setModalType('info'); setOpenMenuId(null); }}
                              style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-1)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                              Info Vehicul
                            </button>
                            <button
                              onClick={() => { setSelectedTruck(truck); setModalType('edit'); setOpenMenuId(null); }}
                              style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-1)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              Editare Cursă
                            </button>
                            <button
                              onClick={() => { setSelectedTruck(truck); setModalType('addNext'); setOpenMenuId(null); }}
                              style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-1)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              Adaugă Cursă
                            </button>
                            <div style={{ height: '1px', background: 'var(--gray-2)', margin: '4px 0' }} />
                            <button
                              onClick={() => { setDeleteConfirm(truck); setOpenMenuId(null); }}
                              style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '13px', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--red-light)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              Șterge Date Cursă
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>

                {/* ── RIGHT: Date cursă ── */}
                <td style={{ padding: '5px 12px 5px 4px', verticalAlign: 'middle', height: '1px' }}>
                  <div style={{
                    display: 'flex',
                    flex: 1,
                    alignItems: 'stretch',
                    borderRadius: '10px',
                    border: `1px solid ${rowHoverId === truck.id ? 'var(--gray-3)' : 'var(--gray-2)'}`,
                    background: rowHoverId === truck.id ? 'var(--gray-1)' : 'var(--surface)',
                    transition: 'border-color 0.15s, background 0.15s',
                    overflow: 'hidden',
                    height: '100%',
                  }}>

                    {/* ── Repaus ── */}
                    {(() => {
                      const hasPause = !!(truck.pause_date || truck.pause_time);
                      const pauseStatus = hasPause ? getPauseStatus(truck.pause_date, truck.pause_time) : null;
                      const isActivePause = pauseStatus === 'active';
                      const isReady = pauseStatus === 'ready';
                      const isPauseOpen = pauseEditId === truck.id;
                      let dateDisplay = '';
                      if (truck.pause_date) {
                        const parts = truck.pause_date.split('-');
                        if (parts.length === 3) dateDisplay = `${parts[2]}.${parts[1]}`;
                      }
                      const pauseText = [dateDisplay, truck.pause_time].filter(Boolean).join(' · ');
                      const hasWeekend = truck.weekend_week === `W${getWeekNumber()}` && truck.weekend_duration;
                      return (
                        <div style={{ padding: '5px 10px', width: '155px', flexShrink: 0, borderRight: '1px solid var(--gray-2)', display: 'flex', flexDirection: 'column', gap: '5px', position: 'relative' }}>
                          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-4)', marginBottom: '2px' }}>Repaus</div>

                          {/* Pauza badge */}
                          <div style={{ position: 'relative' }}>
                            <div style={{ border: isActivePause ? '1px solid var(--orange)' : isReady ? '1px solid var(--green)' : '1px dashed var(--gray-3)', borderLeft: isActivePause ? '3px solid var(--orange)' : isReady ? '3px solid var(--green)' : '1px dashed var(--gray-3)', borderRadius: '8px', padding: '3px 6px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '4px', minHeight: '30px', width: '100%' }}>
                              {isActivePause ? (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>) : isReady ? (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>) : null}
                              <button onClick={(e) => { e.stopPropagation(); setPauseEditId(isPauseOpen ? null : truck.id); setStatusDropdownId(null); setOpenMenuId(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: isActivePause ? 'var(--orange)' : isReady ? 'var(--green)' : 'var(--gray-3)', padding: '2px', flexShrink: 0, fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}>{dateDisplay || 'dată'}</button>
                              {dateDisplay && <span style={{ color: 'var(--gray-3)', fontSize: '10px', flexShrink: 0 }}>·</span>}
                              <input type="text" value={pauseTimeValues[truck.id] !== undefined ? pauseTimeValues[truck.id] : (truck.pause_time || '')} onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); let formatted = digits.slice(0, 2); if (digits.length >= 3) formatted += ':' + digits.slice(2, 4); setPauseTimeValues(prev => ({...prev, [truck.id]: formatted})); }} onFocus={() => setPauseTimeValues(prev => ({...prev, [truck.id]: truck.pause_time || ''}))} onBlur={() => { const val = pauseTimeValues[truck.id] ?? truck.pause_time ?? ''; handleUpdate(truck, 'pause_time', val); setPauseTimeValues(prev => { const n={...prev}; delete n[truck.id]; return n; }); }} placeholder="HH:MM" maxLength={5} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontWeight: 700, color: isActivePause ? 'var(--orange)' : isReady ? 'var(--green)' : 'var(--gray-4)', width: '40px', flexShrink: 0, fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", userSelect: 'text', cursor: 'text' }} />
                              {hasPause && (<button onClick={async () => { const truckData = { ...truck, pause_date: '', pause_time: '', vignettes: typeof truck.vignettes === 'string' ? truck.vignettes : JSON.stringify(truck.vignettes || []), next_trip: typeof truck.next_trip === 'string' ? truck.next_trip : JSON.stringify(truck.next_trip || null), amazon_account: truck.amazon_account ? 1 : 0 }; setTrucks(trucks.map(t => t.id === truck.id ? { ...t, pause_date: '', pause_time: '' } : t)); await api.updateTruck(truck.id, truckData); setPauseEditId(null); }} onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-3)'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-3)', fontSize: '14px', padding: '0 2px', marginLeft: 'auto', lineHeight: 1, fontFamily: 'system-ui', flexShrink: 0 }}>×</button>)}
                            </div>
                            {isPauseOpen && (
                              <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 1000, padding: '14px' }}>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-4)', marginBottom: '5px' }}>Pana la data</label>
                                <input type="date" value={truck.pause_date || ''} onChange={(e) => { handleUpdate(truck, 'pause_date', e.target.value); setPauseEditId(null); }} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--gray-2)', color: 'var(--black)', fontSize: '13px', padding: '4px 0', outline: 'none' }} />
                              </div>
                            )}
                          </div>

                          {/* Weekend badge */}
                          <button
                            onClick={() => { setSelectedTruck(truck); setModalType('weekend'); }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = hasWeekend ? 'rgba(34,197,94,0.08)' : 'var(--gray-1)'; setHoveredTruckId(truck.id); }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; setHoveredTruckId(null); }}
                            style={{ width: '100%', background: 'transparent', border: hasWeekend ? '1px solid var(--green)' : '1px dashed var(--gray-3)', borderLeft: hasWeekend ? '3px solid var(--green)' : '1px dashed var(--gray-3)', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', display: 'block', textAlign: 'left', transition: 'background 0.15s', boxSizing: 'border-box' }}
                          >
                            {hasWeekend ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                                <span style={{ fontWeight: 700, color: 'var(--green)' }}>{truck.weekend_duration}</span>
                                <span style={{ color: 'var(--gray-3)', fontSize: '10px', lineHeight: 1 }}>|</span>
                                <span style={{ color: 'var(--gray-4)' }}>{truck.weekend_day || '—'} {truck.weekend_time || '—'}</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', color: 'var(--gray-3)', textAlign: 'center' }}>Pauza sapt.</div>
                            )}
                          </button>

                          {/* Tooltip weekend */}
                          {hoveredTruckId === truck.id && (() => {
                            const history = Array.isArray(truck.weekend_history) ? truck.weekend_history : [];
                            const currentWeek = `W${getWeekNumber()}`;
                            const pastWeeks = history.filter(h => h.week !== currentWeek);
                            if (pastWeeks.length === 0) return null;
                            return (
                              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px', background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '8px', padding: '8px 14px', boxShadow: '0 4px 12px var(--shadow)', zIndex: 1000, whiteSpace: 'nowrap', fontSize: '12px', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                                {pastWeeks.map((item, idx) => (
                                  <div key={idx} style={{ marginBottom: idx < pastWeeks.length - 1 ? '4px' : '0', color: 'var(--black)' }}>
                                    <span style={{ fontWeight: 700 }}>{item.week}</span> — {item.duration}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* ── Client / Comandă ── */}
                    <div style={{ padding: '5px 14px', width: '190px', flexShrink: 0, borderRight: '1px solid var(--gray-2)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-4)', marginBottom: '6px' }}>Client / Comandă</div>
                      {truck.client ? (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--black)', marginBottom: '1px' }}>{truck.client}</div>
                          <div style={{ fontSize: '12px', color: 'var(--gray-4)' }}>{truck.order_number}</div>
                        </div>
                      ) : <span style={{ color: 'var(--gray-3)', fontStyle: 'italic', fontSize: '13px' }}>—</span>}
                    </div>

                    {/* ── Încărcare ── */}
                    <div style={{ padding: '5px 14px', flex: 1, borderRight: '1px solid var(--gray-2)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-4)', marginBottom: '6px' }}>Încărcare</div>
                      {truck.load_location ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '1px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--black)' }}>{truck.load_location}</div>
                            <button type="button" onClick={() => handleCopyCoords(`${truck.id}-load`, truck.load_lat, truck.load_lng)} title={truck.load_lat && truck.load_lng ? 'Copiază coordonate' : 'Fără coordonate'} style={{ background: 'none', border: 'none', cursor: truck.load_lat && truck.load_lng ? 'pointer' : 'default', padding: '2px', display: 'flex', alignItems: 'center', color: copiedKey === `${truck.id}-load` ? '#22c55e' : 'var(--gray-4)', opacity: truck.load_lat && truck.load_lng ? 1 : 0.3, transition: 'color 0.2s', flexShrink: 0 }}>
                              {copiedKey === `${truck.id}-load` ? <CheckIcon /> : <CopyIcon />}
                            </button>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--gray-4)', marginBottom: '6px' }}>{truck.load_date}</div>
                          <input type="text" value={etaValues[`${truck.id}-load`] !== undefined ? `ETA: ${etaValues[`${truck.id}-load`]}` : (truck.load_eta ? `ETA: ${truck.load_eta}` : '')} onChange={(e) => { const raw = e.target.value.replace(/^ETA: ?/, '').replace(/[^0-9.:/ \-]/g, ''); setEtaValues(prev => ({ ...prev, [`${truck.id}-load`]: raw })); }} onFocus={() => setEtaValues(prev => ({ ...prev, [`${truck.id}-load`]: truck.load_eta || '' }))} onBlur={(e) => { const val = etaValues[`${truck.id}-load`] ?? truck.load_eta ?? ''; handleUpdate(truck, 'load_eta', val); setEtaValues(prev => { const n = {...prev}; delete n[`${truck.id}-load`]; return n; }); e.target.style.borderColor = 'transparent'; }} placeholder="ETA: --.--.-- --:--" style={{ fontSize: '13px', color: 'var(--eta-text)', background: 'var(--eta-bg)', border: '1px solid transparent', padding: '3px 4px', borderRadius: '8px', outline: 'none', width: '140px', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", transition: 'border-color 0.2s', userSelect: 'text', cursor: 'text' }} onMouseEnter={(e) => { e.target.style.borderColor = '#60a5fa'; }} onMouseLeave={(e) => { if (document.activeElement !== e.target) e.target.style.borderColor = 'transparent'; }} />
                        </div>
                      ) : <span style={{ color: 'var(--gray-3)', fontStyle: 'italic', fontSize: '13px' }}>—</span>}
                    </div>

                    {/* ── Descărcare ── */}
                    <div style={{ padding: '5px 14px', flex: 1, borderRight: '1px solid var(--gray-2)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-4)', marginBottom: '6px' }}>Descărcare</div>
                      {truck.unload_location ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '1px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--black)' }}>{truck.unload_location}</div>
                            <button type="button" onClick={() => handleCopyCoords(`${truck.id}-unload`, truck.unload_lat, truck.unload_lng)} title={truck.unload_lat && truck.unload_lng ? 'Copiază coordonate' : 'Fără coordonate'} style={{ background: 'none', border: 'none', cursor: truck.unload_lat && truck.unload_lng ? 'pointer' : 'default', padding: '2px', display: 'flex', alignItems: 'center', color: copiedKey === `${truck.id}-unload` ? '#22c55e' : 'var(--gray-4)', opacity: truck.unload_lat && truck.unload_lng ? 1 : 0.3, transition: 'color 0.2s', flexShrink: 0 }}>
                              {copiedKey === `${truck.id}-unload` ? <CheckIcon /> : <CopyIcon />}
                            </button>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--gray-4)', marginBottom: '6px' }}>{truck.unload_date}</div>
                          <input type="text" value={etaValues[`${truck.id}-unload`] !== undefined ? `ETA: ${etaValues[`${truck.id}-unload`]}` : (truck.eta ? `ETA: ${truck.eta}` : '')} onChange={(e) => { const raw = e.target.value.replace(/^ETA: ?/, '').replace(/[^0-9.:/ \-]/g, ''); setEtaValues(prev => ({ ...prev, [`${truck.id}-unload`]: raw })); }} onFocus={() => setEtaValues(prev => ({ ...prev, [`${truck.id}-unload`]: truck.eta || '' }))} onBlur={(e) => { const val = etaValues[`${truck.id}-unload`] ?? truck.eta ?? ''; handleUpdate(truck, 'eta', val); setEtaValues(prev => { const n = {...prev}; delete n[`${truck.id}-unload`]; return n; }); e.target.style.borderColor = 'transparent'; }} placeholder="ETA: --.--.-- --:--" style={{ fontSize: '13px', color: 'var(--eta-text)', background: 'var(--eta-bg)', border: '1px solid transparent', padding: '3px 4px', borderRadius: '8px', outline: 'none', width: '140px', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", transition: 'border-color 0.2s', userSelect: 'text', cursor: 'text' }} onMouseEnter={(e) => { e.target.style.borderColor = '#60a5fa'; }} onMouseLeave={(e) => { if (document.activeElement !== e.target) e.target.style.borderColor = 'transparent'; }} />
                        </div>
                      ) : <span style={{ color: 'var(--gray-3)', fontStyle: 'italic', fontSize: '13px' }}>—</span>}
                    </div>

                    {/* ── Observații ── */}
                    <div style={{ padding: '5px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-4)', marginBottom: '4px' }}>Observații</div>
                      <textarea
                        value={truck.observations || ''}
                        onChange={(e) => handleUpdate(truck, 'observations', e.target.value)}
                        rows="3"
                        style={{ width: '100%', minWidth: '200px', padding: '6px 8px', border: 'none', borderBottom: '1px solid transparent', borderRadius: '0', fontSize: '13px', background: 'transparent', color: 'var(--gray-4)', resize: 'none', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", transition: 'border-color 0.2s, color 0.2s' }}
                        onFocus={(e) => { e.target.style.borderBottom = '1px solid var(--gray-3)'; e.target.style.color = 'var(--black)'; }}
                        onBlur={(e) => { e.target.style.borderBottom = '1px solid transparent'; e.target.style.color = 'var(--gray-4)'; }}
                      />
                    </div>

                  </div>{/* ── închide card principal ── */}
                </td>
              </tr>,
              
              // Next trips rows
              ...(truck.next_trip ? (() => {
                let nextTrips = [];
                try {
                  nextTrips = typeof truck.next_trip === 'string' 
                    ? JSON.parse(truck.next_trip) 
                    : truck.next_trip;
                } catch (e) {
                  nextTrips = [];
                }
                
                if (!nextTrips || nextTrips.length === 0) return [];
                
                return nextTrips.map((trip, idx) => (
    <tr key={`${truck.id}-next-${idx}`} style={{ background: 'var(--gray-1)' }}>
      <td style={{ padding: '4px 4px 4px 12px', fontSize: '12px', color: 'var(--gray-4)', verticalAlign: 'middle', whiteSpace: 'nowrap', borderTop: '1px dashed var(--gray-3)' }}>
        ↳ Cursă #{idx + 1}
      </td>
      <td style={{ padding: '4px 12px 4px 4px', verticalAlign: 'middle', borderTop: '1px dashed var(--gray-3)' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: '8px', border: '1px solid var(--gray-2)', background: 'var(--surface)', overflow: 'hidden', minHeight: '38px' }}>
          <div style={{ padding: '5px 14px', flex: 1, borderRight: '1px solid var(--gray-2)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--gray-4)', fontWeight: 500 }}>{trip.client || '—'}</div>
            <div style={{ fontSize: '11px', color: 'var(--gray-4)', marginTop: '2px' }}>{trip.order_number || '—'}</div>
          </div>
          <div style={{ padding: '5px 14px', flex: 1, borderRight: '1px solid var(--gray-2)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--gray-4)' }}>{trip.load_location || '—'}</div>
            <div style={{ fontSize: '11px', color: 'var(--gray-4)', marginTop: '2px' }}>{trip.load_date} {trip.load_time}</div>
          </div>
          <div style={{ padding: '5px 14px', flex: 1, borderRight: '1px solid var(--gray-2)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--gray-4)' }}>{trip.unload_location || '—'}</div>
            <div style={{ fontSize: '11px', color: 'var(--gray-4)', marginTop: '2px' }}>{trip.unload_date} {trip.unload_time}</div>
          </div>
          <div style={{ padding: '5px 14px', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => { setEditNextTrip({ truck: truck, tripIndex: idx, tripData: trip }); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--gray-4)', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = '#ff7a3d'; e.currentTarget.style.color = '#ff7a3d'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editare
            </button>
            <button onClick={() => { setDeleteConfirm({ ...truck, deleteType: 'nextTrip', tripIndex: idx }); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'transparent', border: '1px solid var(--red)', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--red)', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--red-light)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Șterge
            </button>
          </div>
        </div>
      </td>
    </tr>
                ));
              })() : [])
            ])}

          </tbody>
        </table>

        {filteredTrucks.length === 0 && (
          <div style={{
            padding: '60px',
            textAlign: 'center',
            color: 'var(--gray-4)',
            fontSize: '14px'
          }}>
            Nu există camioane {filter !== 'all' && `cu statusul "${filter}"`}.
          </div>
        )}
      </div>
      )} {/* ← închide ternarul viewMode */}
      {/* Modale */}
{modalType === 'info' && selectedTruck && (
  <InfoVehicleModal
    truck={selectedTruck}
    user={user}
    onClose={() => {
      setModalType(null);
      setSelectedTruck(null);
    }}

    onSave={async (data) => {
  try {
    const truckData = {
      ...selectedTruck,
      ...data,
      amazon_account: data.amazon_account === 1 || data.amazon_account === true ? 1 : 0,
      vignettes: typeof selectedTruck.vignettes === 'string' 
        ? selectedTruck.vignettes 
        : JSON.stringify(selectedTruck.vignettes || []),
      next_trip: typeof selectedTruck.next_trip === 'string'
        ? selectedTruck.next_trip
        : JSON.stringify(selectedTruck.next_trip || null)
    };
    
    const response = await api.updateTruck(selectedTruck.id, truckData);
    // Update local - asigură-te că amazon_account e număr
    setTrucks(trucks.map(t => 
      t.id === selectedTruck.id 
        ? { 
            ...t, 
            driver_1: data.driver_1,
            driver_2: data.driver_2,
            drivers: data.drivers,
            phone: data.phone,
            trailer: data.trailer,
            fuel_card: data.fuel_card,
            fuel_card_expiry: data.fuel_card_expiry,
            amazon_account: data.amazon_account === 1 || data.amazon_account === true ? 1 : 0
          } 
        : t
    ));
    
  } catch (error) {
  }
}}
  />
)}

{/* Weekend Modal */}
{modalType === 'weekend' && selectedTruck && (
  <WeekendModal
    truck={selectedTruck}
    onClose={() => {
      setModalType(null);
      setSelectedTruck(null);
    }}
onSave={async (data) => {
  try {
    const currentWeek = `W${getWeekNumber()}`;
    
    // Parse istoric existent
    let history = [];
    try {
      history = typeof selectedTruck.weekend_history === 'string' 
        ? JSON.parse(selectedTruck.weekend_history) 
        : (selectedTruck.weekend_history || []);
    } catch (e) {
      history = [];
    }
    
    // Verifică dacă săptămâna curentă există deja
    const existingIndex = history.findIndex(h => h.week === currentWeek);
    
    if (existingIndex >= 0) {
      // Actualizează săptămâna curentă
      history[existingIndex] = { week: currentWeek, duration: data.duration };
    } else {
      // Adaugă săptămână nouă
      history.push({ week: currentWeek, duration: data.duration });
    }
    
    // Păstrează doar ultimele 3
    history = history.slice(-3);

    const truckData = {
      ...selectedTruck,
      weekend_duration: data.duration,
      weekend_day: data.day,
      weekend_time: data.time,
      weekend_week: currentWeek,
      weekend_history: JSON.stringify(history),
      vignettes: typeof selectedTruck.vignettes === 'string' 
        ? selectedTruck.vignettes 
        : JSON.stringify(selectedTruck.vignettes || []),
      next_trip: typeof selectedTruck.next_trip === 'string'
        ? selectedTruck.next_trip
        : JSON.stringify(selectedTruck.next_trip || null),
      amazon_account: selectedTruck.amazon_account === true || selectedTruck.amazon_account === 1 ? 1 : 0
    };

    await api.updateTruck(selectedTruck.id, truckData);
    
    // Update local
    setTrucks(trucks.map(t => 
      t.id === selectedTruck.id 
        ? {
            ...t,
            weekend_duration: data.duration,
            weekend_day: data.day,
            weekend_time: data.time,
            weekend_week: currentWeek,
            weekend_history: history
          }
        : t
    ));
  } catch (error) {
    console.error('Error updating:', error);
  }
}}
  />
)}

{/* Edit Trip Modal */}
{modalType === 'edit' && selectedTruck && (
  <EditTripModal
    truck={selectedTruck}
    onClose={() => {
      setModalType(null);
      setSelectedTruck(null);
    }}
    onSave={async (data) => {
      try {
        const truckData = {
          ...selectedTruck,
          ...data,
          vignettes: typeof selectedTruck.vignettes === 'string' 
            ? selectedTruck.vignettes 
            : JSON.stringify(selectedTruck.vignettes || []),
          next_trip: typeof selectedTruck.next_trip === 'string'
            ? selectedTruck.next_trip
            : JSON.stringify(selectedTruck.next_trip || null),
          amazon_account: selectedTruck.amazon_account === true || selectedTruck.amazon_account === 1 ? 1 : 0
        };
        
        await api.updateTruck(selectedTruck.id, truckData);
        
        // Update local
        setTrucks(trucks.map(t => 
          t.id === selectedTruck.id ? { ...t, ...data } : t
        ));
      } catch (error) {
        console.error('Error updating:', error);
      }
    }}
  />
)}

{/* Add Trip Modal */}
{modalType === 'addNext' && selectedTruck && (
  <AddTripModal
    truck={selectedTruck}
    onClose={() => {
      setModalType(null);
      setSelectedTruck(null);
    }}
    onSave={async (newTrips) => {
      try {
        // Parse existing next trips
        let existingTrips = [];
        try {
          existingTrips = typeof selectedTruck.next_trip === 'string' 
            ? JSON.parse(selectedTruck.next_trip) 
            : (selectedTruck.next_trip || []);
        } catch (e) {
          existingTrips = [];
        }

        // Combine existing + new trips
        const allTrips = [...existingTrips, newTrips];

        const truckData = {
          ...selectedTruck,
          next_trip: JSON.stringify(allTrips),
          vignettes: typeof selectedTruck.vignettes === 'string' 
            ? selectedTruck.vignettes 
            : JSON.stringify(selectedTruck.vignettes || []),
          amazon_account: selectedTruck.amazon_account === true || selectedTruck.amazon_account === 1 ? 1 : 0
        };
        
        await api.updateTruck(selectedTruck.id, truckData);
        
        // Update local
        setTrucks(trucks.map(t => 
          t.id === selectedTruck.id 
            ? { ...t, next_trip: allTrips } 
            : t
        ));
      } catch (error) {
        console.error('Error adding trips:', error);
      }
    }}
  />
)}

{editNextTrip && (
  <EditTripModal
    truck={{
      ...editNextTrip.truck,
      client: editNextTrip.tripData.client,
      order_number: editNextTrip.tripData.order_number,
      load_location: editNextTrip.tripData.load_location,
      load_date: editNextTrip.tripData.load_date,
      load_time: editNextTrip.tripData.load_time,
      load_lat: editNextTrip.tripData.load_lat,
      load_lng: editNextTrip.tripData.load_lng,
      unload_location: editNextTrip.tripData.unload_location,
      unload_date: editNextTrip.tripData.unload_date,
      unload_time: editNextTrip.tripData.unload_time,
      unload_lat: editNextTrip.tripData.unload_lat,
      unload_lng: editNextTrip.tripData.unload_lng,
      observations: editNextTrip.tripData.observations
    }}
    onClose={() => setEditNextTrip(null)}
    onSave={async (data) => {
      try {
        let nextTrips = [];
        try {
          nextTrips = typeof editNextTrip.truck.next_trip === 'string' 
            ? JSON.parse(editNextTrip.truck.next_trip) 
            : editNextTrip.truck.next_trip;
        } catch (e) {
          nextTrips = [];
        }

        // Update specific trip
        nextTrips[editNextTrip.tripIndex] = data;

        const truckData = {
          ...editNextTrip.truck,
          next_trip: JSON.stringify(nextTrips),
          vignettes: typeof editNextTrip.truck.vignettes === 'string' 
            ? editNextTrip.truck.vignettes 
            : JSON.stringify(editNextTrip.truck.vignettes || []),
          amazon_account: editNextTrip.truck.amazon_account === true || editNextTrip.truck.amazon_account === 1 ? 1 : 0
        };
        
        await api.updateTruck(editNextTrip.truck.id, truckData);
        
        setTrucks(trucks.map(t => 
          t.id === editNextTrip.truck.id 
            ? { ...t, next_trip: nextTrips } 
            : t
        ));
        
        setEditNextTrip(null);
      } catch (error) {
        console.error('Error updating next trip:', error);
      }
    }}
  />
)}

{deleteConfirm && (
  <div 
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px',
      backdropFilter: 'blur(4px)'
    }}
    onClick={() => setDeleteConfirm(null)}
  >
    <div 
      style={{
        background: 'var(--bg-page)',
        border: '1px solid var(--gray-2)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </div>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--black)',
          marginBottom: '8px',
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>
          Șterge Cursă?
        </h3>
        <p style={{
          fontSize: '14px',
          color: 'var(--gray-4)',
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>
          Ești sigur că vrei să ștergi cursa pentru <strong>{deleteConfirm.number}</strong>?
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setDeleteConfirm(null)}
          style={{
            flex: 1,
            padding: '12px',
            background: 'var(--gray-1)',
            border: '1px solid var(--gray-3)',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--black)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}
          onMouseEnter={(e) => e.target.style.background = 'var(--gray-2)'}
          onMouseLeave={(e) => e.target.style.background = 'var(--gray-1)'}
        >
          Anulează
        </button>
        <button
          onClick={async () => {
            if (!deleteConfirm) return;
            
            if (deleteConfirm.deleteType === 'nextTrip') {
              // Șterge cursă viitoare
              try {
                let nextTrips = typeof deleteConfirm.next_trip === 'string' 
                  ? JSON.parse(deleteConfirm.next_trip) 
                  : deleteConfirm.next_trip;
                
                const updatedTrips = nextTrips.filter((_, i) => i !== deleteConfirm.tripIndex);
                
                const truckData = {
                  ...deleteConfirm,
                  next_trip: JSON.stringify(updatedTrips),
                  deleteType: undefined,
                  tripIndex: undefined,
                  vignettes: typeof deleteConfirm.vignettes === 'string' 
                    ? deleteConfirm.vignettes 
                    : JSON.stringify(deleteConfirm.vignettes || []),
                  amazon_account: deleteConfirm.amazon_account === true || deleteConfirm.amazon_account === 1 ? 1 : 0
                };
                
                await api.updateTruck(deleteConfirm.id, truckData);
                setTrucks(trucks.map(t => 
                  t.id === deleteConfirm.id ? { ...t, next_trip: updatedTrips } : t
                ));
                
                setShowToast('delete');
                setTimeout(() => setShowToast(false), 2000);
              } catch (error) {
                console.error('Error:', error);
              }
            } else {
              // Șterge cursă principală
              handleDeleteTrip(deleteConfirm);
            }
            setDeleteConfirm(null);
          }}
          style={{
            flex: 1,
            padding: '12px',
            background: '#ef4444',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}
          onMouseEnter={(e) => e.target.style.background = '#dc2626'}
          onMouseLeave={(e) => e.target.style.background = '#ef4444'}
        >
          Șterge
        </button>
      </div>
    </div>
  </div>
)}

{/* Overlay status dropdown */}
{statusDropdownId !== null && (
  <div
    onClick={() => setStatusDropdownId(null)}
    style={{ position: 'fixed', inset: 0, zIndex: 999 }}
  />
)}

{/* Overlay pauza dropdown */}
{pauseEditId !== null && (
  <div
    onClick={() => setPauseEditId(null)}
    style={{ position: 'fixed', inset: 0, zIndex: 999 }}
  />
)}

{/* Toast */}
{showToast && (
  <div style={{
    position: 'fixed',
    bottom: '32px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: showToast === 'delete' ? '#ef4444' : '#22c55e',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    zIndex: 3000,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
  }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    {showToast === 'delete' ? 'Cursă ștearsă cu succes' : 'Salvat cu succes'}
  </div>
)}

    </div>
  );
}

export default Tracking;