import { useState } from 'react';

function InfoVehicleModal({ truck, onClose, onSave, user }) {
  const [formData, setFormData] = useState({
    phone: truck.phone || '',
    trailer: truck.trailer || '',
    fuel_card: truck.fuel_card || '',
    fuel_card_expiry: truck.fuel_card_expiry || '',
    amazon_account: truck.amazon_account === true || truck.amazon_account === 1 ? 1 : 0
  });

  const [showToast, setShowToast] = useState(false);

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
    const driverStr = [truck.driver_1, truck.driver_2].filter(Boolean).join(', ') || 'N/A';
    const text = `Truck plate: ${truck.number}
Trailer plate: ${formData.trailer || 'N/A'}
Driver/s name: ${driverStr}
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

  return (
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
                      <span style={{ fontSize: '14px', color: 'var(--black)', fontWeight: 500 }}>{truck.driver_1}</span>
                    </div>
                  )}
                  {truck.driver_2 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ff7a3d22', color: '#ff7a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                        {truck.driver_2.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '14px', color: 'var(--black)', fontWeight: 500 }}>{truck.driver_2}</span>
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
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Ex: +40 123 456 789"
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid var(--gray-3)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--bg-page)',
                color: 'var(--black)',
                outline: 'none',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
              onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
            />
          </div>

          {/* Remorcă */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Remorcă</label>
            <input
              type="text"
              value={formData.trailer}
              onChange={(e) => setFormData({ ...formData, trailer: e.target.value })}
              placeholder="Ex: SV-123-ABC"
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid var(--gray-3)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--bg-page)',
                color: 'var(--black)',
                outline: 'none',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
              onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
            />
          </div>

          {/* Card Combustibil & Expirare */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={labelStyle}>Card Combustibil</label>
              <input
                type="text"
                value={formData.fuel_card}
                onChange={(e) => setFormData({ ...formData, fuel_card: e.target.value })}
                placeholder="1234-5678-9012"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'var(--bg-page)',
                  color: 'var(--black)',
                  outline: 'none',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
            <div>
              <label style={labelStyle}>Expirare</label>
              <input
                type="text"
                value={formData.fuel_card_expiry}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  if (value.length >= 2) {
                    value = value.slice(0, 2) + '/' + value.slice(2, 6);
                  }
                  setFormData({ ...formData, fuel_card_expiry: value });
                }}
                placeholder="MM/YYYY"
                maxLength="7"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'var(--bg-page)',
                  color: 'var(--black)',
                  outline: 'none',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
          </div>

          {/* Amazon Account Toggle (doar admin) */}
          {isAdmin && (
            <div style={{ marginBottom: '32px' }}>
              <label style={labelStyle}>Amazon Account</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, amazon_account: formData.amazon_account === 1 ? 0 : 1 })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  background: formData.amazon_account === 1 ? '#22c55e' : 'var(--gray-2)',
                  border: '1px solid',
                  borderColor: formData.amazon_account === 1 ? '#22c55e' : 'var(--gray-3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: formData.amazon_account === 1 ? 'white' : 'var(--black)',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              >
                <div style={{
                  width: '44px',
                  height: '24px',
                  background: formData.amazon_account === 1 ? 'white' : 'var(--gray-3)',
                  borderRadius: '12px',
                  position: 'relative',
                  transition: 'all 0.2s'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: formData.amazon_account === 1 ? '#22c55e' : 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: formData.amazon_account === 1 ? '22px' : '2px',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
                {formData.amazon_account === 1 ? 'Activ' : 'Inactiv'}
              </button>
            </div>
          )}

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
              Anulează
            </button>
            <button
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
            </button>
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
  );
}

export default InfoVehicleModal;
