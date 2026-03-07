import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DRIVER_DOC_TYPES } from '../constants/docTypes';

function DriverDocsOverlay({ driverName, onClose }) {
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch on mount
  useState(() => {
    (async () => {
      try {
        const driversRes = await api.getDrivers();
        const driver = driversRes.data.find(d => d.name === driverName);
        if (!driver) { setDocs([]); setLoading(false); return; }
        const docsRes = await api.getDriverDocuments(driver.id);
        setDocs(docsRes.data || []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDownload = (doc) => {
    const link = document.createElement('a');
    link.href = doc.file_data;
    link.download = doc.file_name || `${doc.doc_type}.pdf`;
    link.click();
  };

  const getDocLabel = (key) => DRIVER_DOC_TYPES.find(d => d.key === key)?.label || key;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3000,
        backdropFilter: 'blur(4px)',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-page)',
          border: '1px solid var(--gray-2)',
          borderRadius: '14px',
          padding: '28px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--gray-2)' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
              Documente șofer
            </div>
            <div style={{ fontSize: '13px', color: 'var(--gray-4)', marginTop: '2px', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
              {driverName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-4)', fontSize: '14px', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
            Se încarcă...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--red)', fontSize: '14px', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
            Eroare la încărcarea documentelor.
          </div>
        ) : docs && docs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-4)', fontSize: '14px', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
            Niciun document adăugat pentru acest șofer.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {docs && docs.map(doc => (
              <div
                key={doc.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
                      {getDocLabel(doc.doc_type)}
                    </div>
                    {doc.expiry_date && (
                      <div style={{ fontSize: '11px', color: 'var(--gray-4)', marginTop: '2px', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
                        Expiră: {doc.expiry_date}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(doc)}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--black)', cursor: 'pointer', fontFamily: "'SF Pro Display', -apple-system, sans-serif", transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '5px' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Descarcă
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoVehicleModal({ truck, onClose, onSave, user }) {
  const [formData, setFormData] = useState({
    phone: truck.phone || '',
    trailer: truck.trailer || '',
    fuel_card: truck.fuel_card || '',
    fuel_card_expiry: truck.fuel_card_expiry || '',
  });

  const [showToast, setShowToast] = useState(false);
  const [driverDocsFor, setDriverDocsFor] = useState(null); // driver name

  // Per-driver Amazon state
  const [driverMap, setDriverMap] = useState({}); // name → { id, amazon_account }
  const [driverAmazon, setDriverAmazon] = useState({}); // name → 0|1

  useEffect(() => {
    if (!truck.driver_1 && !truck.driver_2) return;
    api.getDrivers().then(res => {
      const map = {};
      res.data.forEach(d => {
        map[d.name] = { id: d.id, amazon_account: d.amazon_account || 0 };
      });
      setDriverMap(map);
      const init = {};
      [truck.driver_1, truck.driver_2].filter(Boolean).forEach(name => {
        if (map[name]) init[name] = map[name].amazon_account || 0;
      });
      setDriverAmazon(init);
    }).catch(() => {});
  }, []);

  const handleToggleAmazon = async (driverName) => {
    const d = driverMap[driverName];
    if (!d) return;
    const newVal = driverAmazon[driverName] === 1 ? 0 : 1;
    setDriverAmazon(prev => ({ ...prev, [driverName]: newVal }));
    try {
      await api.updateDriverAmazon(d.id, newVal);
    } catch {
      // revert on error
      setDriverAmazon(prev => ({ ...prev, [driverName]: driverAmazon[driverName] }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, driver_1: truck.driver_1, driver_2: truck.driver_2, drivers: truck.drivers });
    setShowToast('save');
    setTimeout(() => {
      setShowToast(false);
      onClose();
    }, 1500);
  };

  const handleCopy = () => {
    const driver1 = truck.driver_1;
    const driver2 = truck.driver_2;
    let driverLines = '';
    if (driver1) driverLines += `Driver 1: ${driver1}`;
    if (driver2) driverLines += `\nDriver 2: ${driver2}`;
    if (!driver1 && !driver2) driverLines = 'N/A';

    const text = `Truck plate: ${truck.number}
Trailer plate: ${formData.trailer || 'N/A'}
${driverLines}
Phone number: ${formData.phone || 'N/A'}`;

    navigator.clipboard.writeText(text).then(() => {
      setShowToast('copy');
      setTimeout(() => setShowToast(false), 2000);
    });
  };

  const isAdmin = user.role === 'admin';

  const selectStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid var(--gray-3)',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'var(--bg-page)',
    color: 'var(--black)',
    outline: 'none',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    transition: 'border-color 0.2s',
    cursor: 'pointer',
    appearance: 'auto',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '8px',
    color: 'var(--black)',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
  };

  const DocIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'var(--bg-page)',
            border: '1px solid var(--gray-2)',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 24px 48px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '32px',
            paddingBottom: '20px',
            borderBottom: '1px solid var(--gray-2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2">
                <rect x="1" y="5" width="15" height="10" rx="2"/>
                <path d="M16 8h3l3 3v4h-3"/>
                <circle cx="5.5" cy="17.5" r="2.5"/>
                <circle cx="18.5" cy="17.5" r="2.5"/>
              </svg>
              <div>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--black)',
                  marginBottom: '4px',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}>
                  {truck.number}
                </h2>
                <p style={{
                  fontSize: '13px',
                  color: 'var(--gray-4)',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}>
                  Informații vehicul
                </p>
              </div>
            </div>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              title="Copiază detalii"
              style={{
                padding: '10px',
                background: 'var(--gray-1)',
                border: '1px solid var(--gray-3)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--gray-2)';
                e.currentTarget.style.borderColor = '#ff7a3d';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--gray-1)';
                e.currentTarget.style.borderColor = 'var(--gray-3)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Șoferi atribuiți — read-only */}
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Șoferi</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {truck.driver_1 || truck.driver_2 ? (
                  <>
                    {truck.driver_1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ff7a3d22', color: '#ff7a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                          {truck.driver_1.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '14px', color: 'var(--black)', fontWeight: 500, flex: 1 }}>{truck.driver_1}</span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleAmazon(truck.driver_1)}
                            title={driverAmazon[truck.driver_1] ? 'Amazon activ — click pentru dezactivare' : 'Amazon inactiv — click pentru activare'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '3px 9px',
                              background: driverAmazon[truck.driver_1] ? '#22c55e1a' : 'transparent',
                              border: `1px solid ${driverAmazon[truck.driver_1] ? '#22c55e55' : 'var(--gray-3)'}`,
                              borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                              color: driverAmazon[truck.driver_1] ? '#16a34a' : 'var(--gray-4)',
                              transition: 'all 0.2s', flexShrink: 0,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: driverAmazon[truck.driver_1] ? '#22c55e' : 'var(--gray-3)', flexShrink: 0 }} />
                            Amazon
                          </button>
                        )}
                        <button
                          type="button"
                          title="Documente șofer"
                          onClick={() => setDriverDocsFor(truck.driver_1)}
                          style={{ padding: '5px 7px', background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: '6px', cursor: 'pointer', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}
                        >
                          <DocIcon />
                        </button>
                      </div>
                    )}
                    {truck.driver_2 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ff7a3d22', color: '#ff7a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                          {truck.driver_2.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '14px', color: 'var(--black)', fontWeight: 500, flex: 1 }}>{truck.driver_2}</span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleAmazon(truck.driver_2)}
                            title={driverAmazon[truck.driver_2] ? 'Amazon activ — click pentru dezactivare' : 'Amazon inactiv — click pentru activare'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '3px 9px',
                              background: driverAmazon[truck.driver_2] ? '#22c55e1a' : 'transparent',
                              border: `1px solid ${driverAmazon[truck.driver_2] ? '#22c55e55' : 'var(--gray-3)'}`,
                              borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                              color: driverAmazon[truck.driver_2] ? '#16a34a' : 'var(--gray-4)',
                              transition: 'all 0.2s', flexShrink: 0,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: driverAmazon[truck.driver_2] ? '#22c55e' : 'var(--gray-3)', flexShrink: 0 }} />
                            Amazon
                          </button>
                        )}
                        <button
                          type="button"
                          title="Documente șofer"
                          onClick={() => setDriverDocsFor(truck.driver_2)}
                          style={{ padding: '5px 7px', background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: '6px', cursor: 'pointer', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}
                        >
                          <DocIcon />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '10px 14px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px', fontSize: '14px', color: 'var(--gray-4)', fontStyle: 'italic' }}>
                    Niciun șofer alocat
                  </div>
                )}
              </div>
            </div>

            {/* Telefon */}
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Telefon</label>
              <input
                type="text"
                value={formData.phone}
                onChange={isAdmin ? (e) => setFormData({ ...formData, phone: e.target.value }) : undefined}
                readOnly={!isAdmin}
                placeholder="Ex: +40 123 456 789"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: isAdmin ? 'var(--bg-page)' : 'var(--gray-1)',
                  color: 'var(--black)',
                  outline: 'none',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  transition: 'border-color 0.2s',
                  cursor: isAdmin ? 'text' : 'default',
                }}
                onFocus={isAdmin ? (e) => e.target.style.borderColor = '#ff7a3d' : undefined}
                onBlur={isAdmin ? (e) => e.target.style.borderColor = 'var(--gray-3)' : undefined}
              />
            </div>

            {/* Remorcă */}
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Remorcă</label>
              <input
                type="text"
                value={formData.trailer}
                onChange={isAdmin ? (e) => setFormData({ ...formData, trailer: e.target.value }) : undefined}
                readOnly={!isAdmin}
                placeholder="Ex: SV-123-ABC"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: isAdmin ? 'var(--bg-page)' : 'var(--gray-1)',
                  color: 'var(--black)',
                  outline: 'none',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  transition: 'border-color 0.2s',
                  cursor: isAdmin ? 'text' : 'default',
                }}
                onFocus={isAdmin ? (e) => e.target.style.borderColor = '#ff7a3d' : undefined}
                onBlur={isAdmin ? (e) => e.target.style.borderColor = 'var(--gray-3)' : undefined}
              />
            </div>

            {/* Card Combustibil & Expirare */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>Card Combustibil</label>
                <input
                  type="text"
                  value={formData.fuel_card}
                  onChange={isAdmin ? (e) => setFormData({ ...formData, fuel_card: e.target.value }) : undefined}
                  readOnly={!isAdmin}
                  placeholder="1234-5678-9012"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: isAdmin ? 'var(--bg-page)' : 'var(--gray-1)',
                    color: 'var(--black)',
                    outline: 'none',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                    transition: 'border-color 0.2s',
                    cursor: isAdmin ? 'text' : 'default',
                  }}
                  onFocus={isAdmin ? (e) => e.target.style.borderColor = '#ff7a3d' : undefined}
                  onBlur={isAdmin ? (e) => e.target.style.borderColor = 'var(--gray-3)' : undefined}
                />
              </div>
              <div>
                <label style={labelStyle}>Expirare</label>
                <input
                  type="text"
                  value={formData.fuel_card_expiry}
                  onChange={isAdmin ? (e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length >= 2) {
                      value = value.slice(0, 2) + '/' + value.slice(2, 6);
                    }
                    setFormData({ ...formData, fuel_card_expiry: value });
                  } : undefined}
                  readOnly={!isAdmin}
                  placeholder="MM/YYYY"
                  maxLength="7"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: isAdmin ? 'var(--bg-page)' : 'var(--gray-1)',
                    color: 'var(--black)',
                    outline: 'none',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                    transition: 'border-color 0.2s',
                    cursor: isAdmin ? 'text' : 'default',
                  }}
                  onFocus={isAdmin ? (e) => e.target.style.borderColor = '#ff7a3d' : undefined}
                  onBlur={isAdmin ? (e) => e.target.style.borderColor = 'var(--gray-3)' : undefined}
                />
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '14px',
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
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--gray-1)'}
              >
                {isAdmin ? 'Anulează' : 'Închide'}
              </button>
              {isAdmin && <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '14px',
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
                onMouseEnter={(e) => e.currentTarget.style.background = '#ff8c52'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ff7a3d'}
              >
                Salvează
              </button>}
            </div>
          </form>

          {/* Toast */}
          {showToast && (
            <div style={{
              position: 'fixed',
              bottom: '32px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#22c55e',
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
              {showToast === 'copy' ? 'Detalii copiate în clipboard' : 'Modificări salvate cu succes'}
            </div>
          )}
        </div>
      </div>

      {/* Driver docs overlay */}
      {driverDocsFor && (
        <DriverDocsOverlay
          driverName={driverDocsFor}
          onClose={() => setDriverDocsFor(null)}
        />
      )}
    </>
  );
}

export default InfoVehicleModal;
