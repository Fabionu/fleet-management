import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import AddCurseModal from '../components/AddCurseModal';
import EditCurseModal from '../components/EditCurseModal';
import TripDocsModal from '../components/TripDocsModal';

function Curse({ user }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [trucks, setTrucks] = useState([]);
  const [deleteConfirmTrip, setDeleteConfirmTrip] = useState(null);
  const [editTrip, setEditTrip] = useState(null);
  const [docsTrip, setDocsTrip] = useState(null);
  const [toast, setToast] = useState(null);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterInvoiced, setFilterInvoiced] = useState('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const menuRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadTrips();
    loadTrucks();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadTrips = async () => {
    try {
      const response = await api.getTrips();
      setTrips(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading trips:', error);
      setLoading(false);
    }
  };

  const loadTrucks = async () => {
    try {
      const response = await api.getTrucks();
      setTrucks(response.data);
    } catch (error) {
      console.error('Error loading trucks:', error);
      setTrucks([]);
    }
  };

  const handleInvoiceToggle = async (trip) => {
    const newInvoiced = !trip.invoiced;
    setTrips(trips.map(t => t.id === trip.id ? { ...t, invoiced: newInvoiced } : t));
    try {
      await api.updateTrip(trip.id, { ...trip, invoiced: newInvoiced });
    } catch (error) {
      setTrips(trips.map(t => t.id === trip.id ? { ...t, invoiced: trip.invoiced } : t));
      console.error('Eroare la actualizarea statusului factură:', error);
    }
  };

  const handleSendToTracking = async (trip) => {
    setOpenMenuId(null);

    // Găsește camionul în trucks (deja încărcate)
    const truck = trucks.find(t => t.number === trip.truck_number);
    if (!truck) {
      showToast(`Camionul ${trip.truck_number} nu a fost găsit în tracking`, 'error');
      return;
    }

    // Parsează next_trip (poate fi string JSON sau array)
    let nextTrips = [];
    try {
      const raw = truck.next_trip;
      if (typeof raw === 'string' && raw) nextTrips = JSON.parse(raw);
      else if (Array.isArray(raw)) nextTrips = raw;
    } catch(e) { nextTrips = []; }

    // Verifică dacă order_number există deja în tracking (la orice camion)
    const alreadyInTracking = trucks.some(t => {
      if (t.order_number === trip.order_number) return true;
      let nt = [];
      try {
        const raw = t.next_trip;
        nt = typeof raw === 'string' && raw ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
      } catch(e) {}
      return nt.some(n => n.order_number === trip.order_number);
    });

    if (alreadyInTracking) {
      showToast(`Comanda ${trip.order_number} este deja în tracking`, 'error');
      return;
    }

    // Parsează data/ora din formatul "DD.MM.YYYY HH:MM"
    const parseDateTime = (str) => {
      if (!str) return { date: '', time: '' };
      const [datePart, timePart] = str.split(' ');
      return { date: datePart || '', time: timePart || '' };
    };
    const loadParsed = parseDateTime(trip.load_date);
    const unloadParsed = parseDateTime(trip.unload_date);

    const parseCoords = (str) => {
      if (!str) return { lat: '', lng: '' };
      const parts = str.split(',').map(c => c.trim());
      return { lat: parts[0] || '', lng: parts[1] || '' };
    };
    const loadCoords = parseCoords(trip.load_coords);
    const unloadCoords = parseCoords(trip.unload_coords);

    const mainLineEmpty = !truck.client && !truck.order_number;

    // Serializare câmpuri speciale (același pattern ca Tracking.jsx)
    const baseTruck = {
      ...truck,
      amazon_account: truck.amazon_account === true || truck.amazon_account === 1 ? 1 : 0,
      vignettes: typeof truck.vignettes === 'string'
        ? truck.vignettes
        : JSON.stringify(truck.vignettes || [])
    };

    let updatedTruck;

    if (mainLineEmpty) {
      // Linia principală liberă → setează cursa principală + status booked
      updatedTruck = {
        ...baseTruck,
        status: 'booked',
        client: trip.client,
        order_number: trip.order_number,
        load_firm: trip.load_firm || '',
        load_street: trip.load_street || '',
        load_location: trip.load_location || '',
        load_date: trip.load_date || '',
        load_lat: loadCoords.lat,
        load_lng: loadCoords.lng,
        unload_firm: trip.unload_firm || '',
        unload_street: trip.unload_street || '',
        unload_location: trip.unload_location || '',
        unload_date: trip.unload_date || '',
        unload_lat: unloadCoords.lat,
        unload_lng: unloadCoords.lng,
        next_trip: JSON.stringify(nextTrips)
      };
    } else {
      // Linia principală ocupată → adaugă ca urmatoarea cursă
      const newNextTrip = {
        client: trip.client,
        order_number: trip.order_number,
        load_firm: trip.load_firm || '',
        load_street: trip.load_street || '',
        load_location: trip.load_location || '',
        load_date: loadParsed.date,
        load_time: loadParsed.time,
        load_lat: loadCoords.lat, load_lng: loadCoords.lng,
        unload_firm: trip.unload_firm || '',
        unload_street: trip.unload_street || '',
        unload_location: trip.unload_location || '',
        unload_date: unloadParsed.date,
        unload_time: unloadParsed.time,
        unload_lat: unloadCoords.lat, unload_lng: unloadCoords.lng,
        observations: ''
      };
      nextTrips.push(newNextTrip);
      updatedTruck = {
        ...baseTruck,
        next_trip: JSON.stringify(nextTrips)
      };
    }

    try {
      await api.updateTruck(truck.id, updatedTruck);
      await loadTrucks();
      if (mainLineEmpty) {
        showToast(`Cursa ${trip.order_number} trimisă în tracking — status setat la Booked`);
      } else {
        showToast(`Cursa ${trip.order_number} adăugată ca urmatoarea cursă pentru ${trip.truck_number}`);
      }
    } catch(error) {
      console.error('Error sending to tracking:', error);
      showToast('Eroare la trimiterea în tracking', 'error');
    }
  };

  const handleSyncData = async (trip) => {
    setOpenMenuId(null);

    // Găsește camionul în trucks
    const truck = trucks.find(t => t.number === trip.truck_number);
    if (!truck) {
      showToast(`Camionul ${trip.truck_number} nu a fost găsit în tracking`, 'error');
      return;
    }

    // Parsează data/ora din formatul "DD.MM.YYYY HH:MM"
    const parseDateTime = (str) => {
      if (!str) return { date: '', time: '' };
      const [datePart, timePart] = str.split(' ');
      return { date: datePart || '', time: timePart || '' };
    };
    const loadParsed = parseDateTime(trip.load_date);
    const unloadParsed = parseDateTime(trip.unload_date);

    // Parsează next_trip
    let nextTrips = [];
    try {
      const raw = truck.next_trip;
      if (typeof raw === 'string' && raw) nextTrips = JSON.parse(raw);
      else if (Array.isArray(raw)) nextTrips = raw;
    } catch(e) { nextTrips = []; }

    // Câmpuri de bază (serializare corectă pentru SQLite)
    const baseTruck = {
      ...truck,
      amazon_account: truck.amazon_account === true || truck.amazon_account === 1 ? 1 : 0,
      vignettes: typeof truck.vignettes === 'string'
        ? truck.vignettes
        : JSON.stringify(truck.vignettes || [])
    };

    const onMainLine = truck.order_number === trip.order_number;
    const nextTripIndex = nextTrips.findIndex(n => n.order_number === trip.order_number);

    if (!onMainLine && nextTripIndex === -1) {
      showToast(`Comanda ${trip.order_number} nu este în tracking — folosește "Trimite în Tracking"`, 'error');
      return;
    }

    let updatedTruck;

    if (onMainLine) {
      // Actualizează linia principală
      updatedTruck = {
        ...baseTruck,
        client: trip.client,
        order_number: trip.order_number,
        load_firm: trip.load_firm || '',
        load_street: trip.load_street || '',
        load_location: trip.load_location || '',
        load_date: trip.load_date || '',
        unload_firm: trip.unload_firm || '',
        unload_street: trip.unload_street || '',
        unload_location: trip.unload_location || '',
        unload_date: trip.unload_date || '',
        next_trip: JSON.stringify(nextTrips)
      };
    } else {
      // Actualizează intrarea din next_trip
      nextTrips[nextTripIndex] = {
        ...nextTrips[nextTripIndex],
        client: trip.client,
        order_number: trip.order_number,
        load_firm: trip.load_firm || '',
        load_street: trip.load_street || '',
        load_location: trip.load_location || '',
        load_date: loadParsed.date,
        load_time: loadParsed.time,
        unload_firm: trip.unload_firm || '',
        unload_street: trip.unload_street || '',
        unload_location: trip.unload_location || '',
        unload_date: unloadParsed.date,
        unload_time: unloadParsed.time
      };
      updatedTruck = {
        ...baseTruck,
        next_trip: JSON.stringify(nextTrips)
      };
    }

    try {
      await api.updateTruck(truck.id, updatedTruck);
      await loadTrucks();
      showToast(`Datele pentru comanda ${trip.order_number} au fost sincronizate în tracking`);
    } catch(error) {
      console.error('Error syncing data:', error);
      showToast('Eroare la sincronizarea datelor', 'error');
    }
  };

  const handleDeleteTrip = (trip) => {
    setDeleteConfirmTrip(trip);
    setOpenMenuId(null);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.deleteTrip(deleteConfirmTrip.id);
      setTrips(trips.filter(t => t.id !== deleteConfirmTrip.id));
      showToast(`Cursa pentru ${deleteConfirmTrip.client} a fost ștearsă`);
    } catch (error) {
      console.error('Error deleting trip:', error);
      showToast('Eroare la ștergerea cursei', 'error');
    } finally {
      setDeleteConfirmTrip(null);
    }
  };

  // Filter helpers
  const MONTHS_RO = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
  const formatMonthLabel = (key) => {
    const [year, month] = key.split('-');
    return `${MONTHS_RO[parseInt(month, 10) - 1]} ${year}`;
  };
  const parseDateToMonthKey = (d) => {
    if (!d) return '';
    const parts = d.split('.');
    if (parts.length >= 3) return `${parts[2].substring(0,4)}-${parts[1]}`;
    if (d.includes('-')) return d.substring(0, 7);
    return '';
  };

  const uniqueCreatedBy = [...new Set(trips.map(t => t.created_by).filter(Boolean))].sort();
  const uniqueMonths = [...new Set(trips.map(t => parseDateToMonthKey(t.load_date)).filter(Boolean))].sort().reverse();

  const filteredTrips = trips.filter(trip => {
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const haystack = [trip.client, trip.order_number, trip.truck_number, trip.driver, trip.load_location, trip.unload_location]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filterInvoiced === 'invoiced' && !trip.invoiced) return false;
    if (filterInvoiced === 'not_invoiced' && trip.invoiced) return false;
    if (filterMonth && parseDateToMonthKey(trip.load_date) !== filterMonth) return false;
    if (filterCreatedBy && trip.created_by !== filterCreatedBy) return false;
    return true;
  });

  // Calculate totals (on filtered trips)
  const totals = filteredTrips.reduce((acc, trip) => {
    const kmTotal = trip.km_empty + trip.km_loaded;
    return {
      trips: acc.trips + 1,
      km: acc.km + kmTotal,
      price: acc.price + trip.price
    };
  }, { trips: 0, km: 0, price: 0 });

  const avgEuroPerKm = totals.km > 0 ? totals.price / totals.km : 0;

  if (loading) {
    return (
      <div style={{ 
        padding: '60px', 
        textAlign: 'center',
        color: 'var(--gray-4)',
        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        Se încarcă...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 0' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--black)',
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>
          Registru Curse
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '10px 20px',
            background: '#ff7a3d',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}
          onMouseEnter={(e) => e.target.style.background = '#ff8c52'}
          onMouseLeave={(e) => e.target.style.background = '#ff7a3d'}
        >
          + Adaugă Cursă
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-4)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Caută client, comandă, camion, șofer..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-2)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif", boxSizing: 'border-box' }}
          />
        </div>

        {/* Month filter */}
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid var(--gray-2)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', cursor: 'pointer', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}
        >
          <option value="">Toate lunile</option>
          {uniqueMonths.map(m => (
            <option key={m} value={m}>{formatMonthLabel(m)}</option>
          ))}
        </select>

        {/* Invoiced filter */}
        <select
          value={filterInvoiced}
          onChange={e => setFilterInvoiced(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid var(--gray-2)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', cursor: 'pointer', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}
        >
          <option value="all">Toate</option>
          <option value="not_invoiced">Nefacturate</option>
          <option value="invoiced">Facturate</option>
        </select>

        {/* Created by filter */}
        <select
          value={filterCreatedBy}
          onChange={e => setFilterCreatedBy(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid var(--gray-2)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', cursor: 'pointer', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}
        >
          <option value="">Toți utilizatorii</option>
          {uniqueCreatedBy.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Counter */}
        <span style={{ fontSize: '13px', color: 'var(--gray-4)', whiteSpace: 'nowrap', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}>
          {filteredTrips.length} / {trips.length} curse
        </span>
      </div>

      {/* Table Container */}
      <div style={{
        background: 'var(--bg-page)',
        border: '1px solid var(--gray-2)',
        borderRadius: '12px',
        overflow: 'visible'
      }}>
        <div style={{ 
          overflowX: 'auto',
          overflowY: 'visible'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            <thead>
              <tr style={{ 
                borderBottom: '2px solid var(--gray-2)',
                background: 'var(--gray-1)'
              }}>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '60px' }}>
                  ✓
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '140px' }}>
                  CLIENT
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '130px' }}>
                  NR. COMANDĂ
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)' }}>
                  CAMION
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '185px' }}>
                  ÎNCĂRCARE
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '185px' }}>
                  DESCĂRCARE
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '120px' }}>
                  INTRODUS DE
                </th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '80px' }}>
                  KM GOL
                </th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '80px' }}>
                  KM PLIN
                </th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '90px' }}>
                  KM TOTAL
                </th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '100px' }}>
                  PREȚ (€)
                </th>
                <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '80px' }}>
                  €/KM
                </th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--gray-4)', width: '50px' }}>
                  
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map((trip) => {
                const kmTotal = trip.km_empty + trip.km_loaded;
                const euroPerKm = kmTotal > 0 ? trip.price / kmTotal : 0;
                const isInvoiced = !!trip.invoiced;
                const isLockedForUser = isInvoiced && user.role === 'dispatcher';
                const cellColor = isInvoiced ? 'var(--gray-4)' : 'var(--black)';

                return (
                  <tr
                    key={trip.id}
                    onMouseEnter={() => setHoveredRowId(trip.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    style={{
                      borderBottom: '1px solid var(--gray-2)',
                      borderLeft: `4px solid ${trip.invoiced ? '#22c55e' : '#ef4444'}`,
                      transition: 'background 0.15s',
                      background: hoveredRowId === trip.id
                        ? (isInvoiced ? 'rgba(34, 197, 94, 0.09)' : 'var(--gray-1)')
                        : (isInvoiced ? 'rgba(34, 197, 94, 0.04)' : 'transparent'),
                    }}
                  >
                    <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
    <button
      onClick={() => handleInvoiceToggle(trip)}
      disabled={!user.permissions?.markInvoiced}
      style={{
        width: '24px',
        height: '24px',
        border: `2px solid ${trip.invoiced ? '#22c55e' : 'var(--gray-3)'}`,
        borderRadius: '6px',
        background: trip.invoiced ? '#22c55e' : 'transparent',
        cursor: user.permissions?.markInvoiced ? 'pointer' : 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        opacity: user.permissions?.markInvoiced ? 1 : 0.5,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (user.permissions?.markInvoiced) {
          e.currentTarget.style.transform = 'scale(1.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {trip.invoiced && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
    </button>
    {isInvoiced && (
      <span style={{
        fontSize: '9px', fontWeight: 700, color: '#16a34a',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>Facturat</span>
    )}
  </div>
</td>
                    <td style={{ padding: '16px', fontSize: '14px', color: cellColor, width: '140px', fontWeight: 500, verticalAlign: 'middle' }}>
                      {trip.client}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', color: cellColor, width: '130px', verticalAlign: 'middle' }}>
                      {trip.order_number}
                    </td>
                    <td style={{ padding: '16px', width: '125px', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: '14px', color: cellColor, fontWeight: 600 }}>
                        {trip.truck_number}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-4)', marginTop: '3px' }}>
                        {trip.driver}
                      </div>
                    </td>
                    <td style={{ padding: '16px', width: '185px', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: '14px', color: cellColor, marginBottom: '4px' }}>
                        {trip.load_location}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-4)' }}>
                        {trip.load_date}
                      </div>
                    </td>
                    <td style={{ padding: '16px', width: '185px', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: '14px', color: cellColor, marginBottom: '4px' }}>
                        {trip.unload_location}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-4)' }}>
                        {trip.unload_date}
                      </div>
                    </td>
                    <td style={{ padding: '16px', fontSize: '13px', color: 'var(--gray-4)', width: '120px', verticalAlign: 'middle' }}>
                      {trip.created_by || '—'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontSize: '14px', color: 'var(--gray-4)', verticalAlign: 'middle' }}>
                      {trip.km_empty.toLocaleString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontSize: '14px', color: cellColor, fontWeight: 500, verticalAlign: 'middle' }}>
                      {trip.km_loaded.toLocaleString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontSize: '14px', color: cellColor, fontWeight: 600, verticalAlign: 'middle' }}>
                      {kmTotal.toLocaleString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontSize: '14px', color: '#22c55e', fontWeight: 600, verticalAlign: 'middle' }}>
                      {trip.price.toLocaleString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontSize: '13px', color: 'var(--gray-4)', verticalAlign: 'middle' }}>
                      {euroPerKm.toFixed(2)}
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => {
                            if (openMenuId === trip.id) {
                              setOpenMenuId(null);
                            } else {
                              const btnRect = e.currentTarget.getBoundingClientRect();
                              setMenuPosition({
                                top: btnRect.bottom + 4,
                                right: window.innerWidth - btnRect.right
                              });
                              setOpenMenuId(trip.id);
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--gray-2)',
                            color: 'var(--gray-4)',
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'var(--gray-1)';
                            e.target.style.borderColor = 'var(--gray-3)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'transparent';
                            e.target.style.borderColor = 'var(--gray-2)';
                          }}
                        >
                          ⋮
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuId === trip.id && createPortal(
                          <div
                            ref={menuRef}
                            style={{
                              position: 'fixed',
                              top: menuPosition.top,
                              right: menuPosition.right,
                              background: 'var(--bg-page)',
                              border: '1px solid var(--gray-2)',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px var(--shadow)',
                              minWidth: '200px',
                              zIndex: 9999
                            }}
                          >
                            {/* Editare Cursă */}
                            {isLockedForUser ? (
                              <div style={{
                                width: '100%',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '13px',
                                color: 'var(--gray-3)',
                                cursor: 'not-allowed',
                                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                                boxSizing: 'border-box',
                              }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="5" y="11" width="14" height="10" rx="2"/>
                                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                                </svg>
                                Editare restricționată
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditTrip(trip);
                                  setOpenMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '12px 16px',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: '13px',
                                  color: 'var(--black)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  transition: 'background 0.2s',
                                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                Editare Cursă
                              </button>
                            )}

                            {/* Documente */}
                            <button
                              onClick={() => {
                                setDocsTrip(trip);
                                setOpenMenuId(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'transparent',
                                border: 'none',
                                textAlign: 'left',
                                fontSize: '13px',
                                color: 'var(--black)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'background 0.2s',
                                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-1)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10 9 9 9 8 9"/>
                              </svg>
                              Documente
                            </button>

                            {/* Trimite în Tracking */}
                            <button
                              onClick={() => handleSendToTracking(trip)}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'transparent',
                                border: 'none',
                                textAlign: 'left',
                                fontSize: '13px',
                                color: 'var(--black)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'background 0.2s',
                                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                              }}
                              onMouseEnter={(e) => e.target.style.background = 'var(--gray-1)'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                              </svg>
                              Trimite în Tracking
                            </button>

                            {/* Sincronizare Date */}
                            <button
                              onClick={() => handleSyncData(trip)}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'transparent',
                                border: 'none',
                                textAlign: 'left',
                                fontSize: '13px',
                                color: 'var(--black)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'background 0.2s',
                                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                              }}
                              onMouseEnter={(e) => e.target.style.background = 'var(--gray-1)'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="23 4 23 10 17 10"/>
                                <polyline points="1 20 1 14 7 14"/>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                              </svg>
                              Sincronizare Date
                            </button>

                            <div style={{ height: '1px', background: 'var(--gray-2)', margin: '4px 0' }}></div>

                            {/* Șterge Cursă */}
                            <button
                              onClick={() => handleDeleteTrip(trip)}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'transparent',
                                border: 'none',
                                textAlign: 'left',
                                fontSize: '13px',
                                color: '#ef4444',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'background 0.2s',
                                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                              }}
                              onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                              Șterge Cursă
                            </button>
                          </div>,
                          document.body
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with Totals */}
        <div style={{
          padding: '20px 24px',
          borderTop: '2px solid var(--gray-2)',
          background: 'var(--gray-1)',
          display: 'flex',
          gap: '32px',
          justifyContent: 'flex-end',
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--gray-4)', marginRight: '8px' }}>
              TOTAL CURSE:
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--black)' }}>
              {totals.trips}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--gray-4)', marginRight: '8px' }}>
              TOTAL KM:
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--black)' }}>
              {totals.km.toLocaleString()}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--gray-4)', marginRight: '8px' }}>
              TOTAL PREȚ:
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#22c55e' }}>
              {totals.price.toLocaleString()} €
            </span>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--gray-4)', marginRight: '8px' }}>
              MEDIE €/KM:
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#ff7a3d' }}>
              {avgEuroPerKm.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {trips.length === 0 && (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--gray-4)', fontSize: '14px', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}>
          Nicio cursă înregistrată
        </div>
      )}
      {trips.length > 0 && filteredTrips.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-4)', fontSize: '14px', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif" }}>
          Niciun rezultat pentru filtrele selectate
        </div>
      )}

      {/* Add Curse Modal */}
      {showAddModal && (
        <AddCurseModal
          trucks={trucks}
          onClose={() => setShowAddModal(false)}
          onSave={async (data) => {
            try {
              const formatDate = (date, time) => {
                if (!date) return '';
                const [y, m, d] = date.split('-');
                return `${d}.${m}.${y}${time ? ' ' + time : ''}`;
              };

              let file_data = null, file_name = null, file_type = null;
              if (data.pdf_file) {
                file_data = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve(e.target.result);
                  reader.readAsDataURL(data.pdf_file);
                });
                file_name = data.pdf_file.name;
                file_type = data.pdf_file.type;
              }

              await api.createTrip({
                client: data.client,
                order_number: data.order_number,
                load_firm: data.load_firm,
                load_street: data.load_street,
                load_location: data.load_location,
                load_date: formatDate(data.load_date, data.load_time),
                unload_firm: data.unload_firm,
                unload_street: data.unload_street,
                unload_location: data.unload_location,
                unload_date: formatDate(data.unload_date, data.unload_time),
                price: parseFloat(data.price),
                km_empty: parseFloat(data.km_empty),
                km_loaded: parseFloat(data.km_loaded),
                tolls: 0,
                truck_number: data.truck,
                driver: data.drivers,
                invoiced: false,
                file_name,
                file_data,
                file_type,
                load_coords: data.load_coords,
                unload_coords: data.unload_coords
              });

              await loadTrips();
              setShowAddModal(false);
              showToast('Cursa a fost adăugată cu succes');
            } catch (error) {
              console.error('Error saving curse:', error);
              showToast('Eroare la salvarea cursei', 'error');
            }
          }}
        />
      )}
      {/* Edit Curse Modal */}
      {editTrip && (
        <EditCurseModal
          trip={editTrip}
          trucks={trucks}
          onClose={() => setEditTrip(null)}
          onSave={async (data, tripId) => {
            try {
              const formatDate = (date, time) => {
                if (!date) return '';
                const [y, m, d] = date.split('-');
                return `${d}.${m}.${y}${time ? ' ' + time : ''}`;
              };

              let file_data = editTrip.file_data;
              let file_name = editTrip.file_name;
              let file_type = editTrip.file_type;

              if (data.pdf_file) {
                file_data = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve(e.target.result);
                  reader.readAsDataURL(data.pdf_file);
                });
                file_name = data.pdf_file.name;
                file_type = data.pdf_file.type;
              }

              await api.updateTrip(tripId, {
                client: data.client,
                order_number: data.order_number,
                load_firm: data.load_firm,
                load_street: data.load_street,
                load_location: data.load_location,
                load_date: formatDate(data.load_date, data.load_time),
                unload_firm: data.unload_firm,
                unload_street: data.unload_street,
                unload_location: data.unload_location,
                unload_date: formatDate(data.unload_date, data.unload_time),
                price: parseFloat(data.price),
                km_empty: parseFloat(data.km_empty),
                km_loaded: parseFloat(data.km_loaded),
                tolls: editTrip.tolls || 0,
                truck_number: data.truck,
                driver: data.drivers,
                invoiced: editTrip.invoiced,
                file_name,
                file_data,
                file_type,
                load_coords: data.load_coords,
                unload_coords: data.unload_coords,
                cmr_file_name: editTrip.cmr_file_name,
                cmr_file_data: editTrip.cmr_file_data,
                cmr_file_type: editTrip.cmr_file_type,
                invoice_file_name: editTrip.invoice_file_name,
                invoice_file_data: editTrip.invoice_file_data,
                invoice_file_type: editTrip.invoice_file_type
              });

              await loadTrips();
              setEditTrip(null);
              showToast('Cursa a fost actualizată cu succes');
            } catch (error) {
              console.error('Error updating trip:', error);
              const msg = error.response?.data?.error || error.message || 'Eroare necunoscută';
              showToast(`Eroare: ${msg}`, 'error');
            }
          }}
        />
      )}

      {/* Docs Modal */}
      {docsTrip && (
        <TripDocsModal
          trip={docsTrip}
          onClose={() => setDocsTrip(null)}
          onSave={async (docs, tripId) => {
            try {
              await api.updateTrip(tripId, {
                client: docsTrip.client,
                order_number: docsTrip.order_number,
                load_date: docsTrip.load_date,
                unload_date: docsTrip.unload_date,
                load_location: docsTrip.load_location,
                unload_location: docsTrip.unload_location,
                price: docsTrip.price,
                km_empty: docsTrip.km_empty,
                km_loaded: docsTrip.km_loaded,
                tolls: docsTrip.tolls || 0,
                truck_number: docsTrip.truck_number,
                driver: docsTrip.driver,
                invoiced: docsTrip.invoiced,
                load_coords: docsTrip.load_coords,
                unload_coords: docsTrip.unload_coords,
                file_name: docs.file_name,
                file_data: docs.file_data,
                file_type: docs.file_type,
                cmr_file_name: docs.cmr_file_name,
                cmr_file_data: docs.cmr_file_data,
                cmr_file_type: docs.cmr_file_type,
                invoice_file_name: docs.invoice_file_name,
                invoice_file_data: docs.invoice_file_data,
                invoice_file_type: docs.invoice_file_type,
              });
              await loadTrips();
              setDocsTrip(null);
              showToast('Documentele au fost salvate cu succes');
            } catch (error) {
              console.error('Error saving docs:', error);
              const msg = error.response?.data?.error || error.message || 'Eroare necunoscută';
              showToast(`Eroare: ${msg}`, 'error');
            }
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      {deleteConfirmTrip && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 3000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-page)', border: '1px solid var(--gray-2)',
            borderRadius: '12px', padding: '32px', maxWidth: '400px', width: '100%',
            boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            <div style={{ marginBottom: '8px', fontSize: '18px', fontWeight: 600, color: 'var(--black)' }}>
              Șterge cursă
            </div>
            <div style={{ marginBottom: '24px', fontSize: '14px', color: 'var(--gray-4)' }}>
              Ești sigur că vrei să ștergi cursa pentru <strong style={{ color: 'var(--black)' }}>{deleteConfirmTrip.client}</strong>? Această acțiune nu poate fi anulată.
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirmTrip(null)}
                style={{
                  flex: 1, padding: '12px', background: 'var(--gray-1)',
                  border: '1px solid var(--gray-3)', borderRadius: '8px',
                  fontSize: '14px', fontWeight: 500, color: 'var(--black)',
                  cursor: 'pointer',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              >
                Anulează
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  flex: 1, padding: '12px', background: '#ef4444',
                  border: 'none', borderRadius: '8px',
                  fontSize: '14px', fontWeight: 600, color: 'white',
                  cursor: 'pointer',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              >
                Șterge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: 'white', padding: '12px 20px', borderRadius: '8px',
          fontSize: '14px', fontWeight: 500, zIndex: 4000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          animation: 'fadeIn 0.2s ease'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default Curse;
