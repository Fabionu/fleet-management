import { useState } from 'react';

function TruckModal({ truck, onClose, onSave, user }) {
  const [formData, setFormData] = useState({
    drivers: truck?.drivers || '',
    phone: truck?.phone || '',
    trailer: truck?.trailer || '',
    fuel_card: truck?.fuel_card || '',
    fuel_card_expiry: truck?.fuel_card_expiry || '',
    amazon_account: truck?.amazon_account || false,
    load_lat: truck?.load_lat || '',
    load_lng: truck?.load_lng || '',
    unload_lat: truck?.unload_lat || '',
    unload_lng: truck?.unload_lng || '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave({ ...truck, ...formData });
    onClose();
  };

  const canEditAmazon = user.role === 'admin';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Info Vehicul — {truck.number}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-field">
              <label>Șoferi</label>
              <input
                type="text"
                value={formData.drivers}
                onChange={(e) => handleChange('drivers', e.target.value)}
                placeholder="Ion Popescu, Vasile Marin"
              />
            </div>

            <div className="form-field">
              <label>Telefon</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+40 123 456 789"
              />
            </div>

            <div className="form-field">
              <label>Remorcă</label>
              <input
                type="text"
                value={formData.trailer}
                onChange={(e) => handleChange('trailer', e.target.value)}
                placeholder="TR-1234"
              />
            </div>

            <div className="form-field">
              <label>Card Combustibil</label>
              <input
                type="text"
                value={formData.fuel_card}
                onChange={(e) => handleChange('fuel_card', e.target.value)}
                placeholder="DKV 123456"
              />
            </div>

            <div className="form-field">
              <label>Expirare Card</label>
              <input
                type="date"
                value={formData.fuel_card_expiry}
                onChange={(e) => handleChange('fuel_card_expiry', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Amazon Account</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.amazon_account}
                  onChange={(e) => handleChange('amazon_account', e.target.checked)}
                  disabled={!canEditAmazon}
                />
                <span style={{ color: 'var(--gray-4)', fontSize: '12px' }}>
                  {canEditAmazon ? 'Activ' : 'Doar admin poate modifica'}
                </span>
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
            Coordonate Încărcare
          </h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Latitudine</label>
              <input
                type="text"
                value={formData.load_lat}
                onChange={(e) => handleChange('load_lat', e.target.value)}
                placeholder="45.123456"
              />
            </div>
            <div className="form-field">
              <label>Longitudine</label>
              <input
                type="text"
                value={formData.load_lng}
                onChange={(e) => handleChange('load_lng', e.target.value)}
                placeholder="23.123456"
              />
            </div>
          </div>

          <h3 style={{ marginTop: '16px', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
            Coordonate Descărcare
          </h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Latitudine</label>
              <input
                type="text"
                value={formData.unload_lat}
                onChange={(e) => handleChange('unload_lat', e.target.value)}
                placeholder="41.123456"
              />
            </div>
            <div className="form-field">
              <label>Longitudine</label>
              <input
                type="text"
                value={formData.unload_lng}
                onChange={(e) => handleChange('unload_lng', e.target.value)}
                placeholder="14.123456"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Anulează</button>
          <button className="btn-primary" onClick={handleSubmit}>Salvează</button>
        </div>
      </div>
    </div>
  );
}

export default TruckModal;