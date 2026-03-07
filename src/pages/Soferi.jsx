import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { DRIVER_DOC_TYPES as DOC_TYPES } from '../constants/docTypes';

const IconFile     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IconEdit     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconTrash    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const IconFileX    = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;


const iconBtnBase = {
  padding: '6px 10px',
  background: 'transparent',
  border: '1px solid var(--gray-3)',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '5px',
  transition: 'all 0.15s',
  fontSize: '12px', fontWeight: 500,
};

function formatDate(str) {
  if (!str) return '—';
  // YYYY-MM-DD → DD.MM.YYYY
  const [y, m, d] = str.split('-');
  if (!y || !m || !d) return str;
  return `${d}.${m}.${y}`;
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const diff = (expiry - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ── Modal Documente Șofer ─────────────────────────────────────
function DocsModal({ driver, onClose, isAdmin }) {
  const [docs, setDocs] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const [pending, setPending] = useState({}); // key → { file_name, file_data, file_type, expiry_date }
  const fileRefs = useRef({});

  useEffect(() => {
    api.getDriverDocuments(driver.id)
      .then(r => {
        setDocs(r.data);
        // auto-select first available
        const first = DOC_TYPES.find(t => r.data.find(d => d.doc_type === t.key));
        if (first) setSelectedKey(first.key);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [driver.id]);

  const getDoc = (key) => docs.find(d => d.doc_type === key) || null;
  const getPending = (key) => pending[key] || null;

  const handleFileChange = (key, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPending(p => ({
        ...p,
        [key]: {
          ...(p[key] || {}),
          file_name: file.name,
          file_data: ev.target.result,
          file_type: file.type,
        }
      }));
      setChanged(true);
      setSelectedKey(key);
    };
    reader.readAsDataURL(file);
  };

  const handleExpiryChange = (key, value) => {
    setPending(p => ({ ...p, [key]: { ...(p[key] || {}), expiry_date: value } }));
    setChanged(true);
  };

  const handleDeleteDoc = async (key) => {
    const doc = getDoc(key);
    if (!doc) {
      setPending(p => { const n = { ...p }; delete n[key]; return n; });
      setChanged(Object.keys(pending).length > 1);
      return;
    }
    if (!window.confirm(`Ștergi documentul "${DOC_TYPES.find(t => t.key === key)?.label}"?`)) return;
    try {
      await api.deleteDriverDocument(doc.id);
      setDocs(prev => prev.filter(d => d.doc_type !== key));
      if (selectedKey === key) setSelectedKey(null);
    } catch {
      alert('Eroare la ștergere.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, p] of Object.entries(pending)) {
        const existing = getDoc(key);
        const expiry = p.expiry_date ?? existing?.expiry_date ?? null;
        if (existing) {
          await api.updateDriverDocument(existing.id, {
            doc_type: key,
            file_name: p.file_name ?? existing.file_name,
            file_data: p.file_data ?? existing.file_data,
            file_type: p.file_type ?? existing.file_type,
            expiry_date: expiry,
          });
        } else if (p.file_data) {
          await api.createDriverDocument({
            driver_id: driver.id,
            doc_type: key,
            file_name: p.file_name,
            file_data: p.file_data,
            file_type: p.file_type,
            expiry_date: expiry,
          });
        } else if (expiry) {
          // only expiry changed, no file yet — skip or create empty (skip)
        }
      }
      // reload
      const r = await api.getDriverDocuments(driver.id);
      setDocs(r.data);
      setPending({});
      setChanged(false);
    } catch {
      alert('Eroare la salvare.');
    }
    setSaving(false);
  };

  const getPreviewData = (key) => {
    const p = getPending(key);
    if (p?.file_data) return { data: p.file_data, type: p.file_type, name: p.file_name };
    const doc = getDoc(key);
    if (doc?.file_data) return { data: doc.file_data, type: doc.file_type, name: doc.file_name };
    return null;
  };

  const preview = selectedKey ? getPreviewData(selectedKey) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '14px', width: '820px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gray-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--black)' }}>Documente — {[driver.first_name, driver.last_name].filter(Boolean).join(' ') || driver.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--gray-4)', marginTop: '2px' }}>Pașaport, Permis, CI, Card Tahograf</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--gray-4)', lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left panel */}
          <div style={{ width: '270px', flexShrink: 0, borderRight: '1px solid var(--gray-2)', padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ color: 'var(--gray-4)', fontSize: '13px' }}>Se încarcă...</div>
            ) : DOC_TYPES.map(t => {
              const doc = getDoc(t.key);
              const p = getPending(t.key);
              const hasFile = p?.file_data || doc?.file_data;
              const expiry = p?.expiry_date !== undefined ? p.expiry_date : doc?.expiry_date;
              const isSelected = selectedKey === t.key;
              const expired = isExpired(expiry);
              const expiringSoon = isExpiringSoon(expiry);

              return (
                <div key={t.key}
                  onClick={() => hasFile && setSelectedKey(t.key)}
                  style={{
                    border: `1px solid ${isSelected ? '#ff7a3d' : expired ? 'var(--red)' : expiringSoon ? '#f59e0b' : 'var(--gray-2)'}`,
                    borderRadius: '10px',
                    padding: '12px',
                    background: isSelected ? '#ff7a3d0d' : 'var(--gray-1)',
                    cursor: hasFile ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--black)', marginBottom: '8px' }}>{t.label}</div>

                  {/* Expiry date */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--gray-4)', marginBottom: '3px' }}>Expiră</div>
                    {isAdmin ? (
                      <input type="date" value={expiry || ''}
                        onClick={e => e.stopPropagation()}
                        onChange={e => handleExpiryChange(t.key, e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--gray-3)', borderRadius: '5px', background: 'var(--bg-page)', color: expired ? 'var(--red)' : expiringSoon ? '#f59e0b' : 'var(--black)', fontSize: '12px', boxSizing: 'border-box' }} />
                    ) : (
                      <span style={{ fontSize: '12px', color: expired ? 'var(--red)' : expiringSoon ? '#f59e0b' : 'var(--black)', fontWeight: expired || expiringSoon ? 600 : 400 }}>
                        {expiry ? formatDate(expiry) : '—'}
                        {expired && ' ⚠ Expirat'}
                        {expiringSoon && !expired && ' ⚠ Expiră curând'}
                      </span>
                    )}
                  </div>

                  {/* File buttons */}
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input ref={el => fileRefs.current[t.key] = el} type="file" accept=".pdf" style={{ display: 'none' }}
                        onChange={e => handleFileChange(t.key, e)} />
                      {hasFile ? (
                        <>
                          <button onClick={e => { e.stopPropagation(); fileRefs.current[t.key]?.click(); }}
                            style={{ ...iconBtnBase, flex: 1, fontSize: '11px', justifyContent: 'center', color: 'var(--black)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                            Înlocuiește
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDeleteDoc(t.key); }}
                            style={{ ...iconBtnBase, color: 'var(--red)', padding: '6px 8px' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.borderColor = 'var(--red)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                            <IconTrash />
                          </button>
                        </>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); fileRefs.current[t.key]?.click(); }}
                          style={{ ...iconBtnBase, flex: 1, fontSize: '11px', justifyContent: 'center', color: '#ff7a3d', borderColor: '#ff7a3d', background: '#ff7a3d0d' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#ff7a3d22'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#ff7a3d0d'; }}>
                          + Adaugă fișier
                        </button>
                      )}
                    </div>
                  )}

                  {!isAdmin && !hasFile && (
                    <div style={{ fontSize: '11px', color: 'var(--gray-4)', fontStyle: 'italic' }}>Niciun document</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right preview */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {preview ? (
              preview.type?.startsWith('image/') ? (
                <img src={preview.data} alt={preview.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '16px', boxSizing: 'border-box' }} />
              ) : (
                <iframe key={selectedKey} src={preview.data} title={preview.name}
                  style={{ width: '100%', height: '100%', border: 'none' }} />
              )
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-4)', fontSize: '13px', flexDirection: 'column', gap: '8px' }}>
                <IconFileX />
                <span>Selectează un document pentru previzualizare</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {isAdmin && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gray-2)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={onClose}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--black)' }}>
              Închide
            </button>
            <button onClick={handleSave} disabled={!changed || saving}
              style={{ padding: '8px 16px', background: changed ? '#ff7a3d' : 'var(--gray-2)', color: changed ? '#fff' : 'var(--gray-4)', border: 'none', borderRadius: '8px', cursor: changed ? 'pointer' : 'default', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s' }}>
              {saving ? 'Se salvează...' : changed ? 'Salvează modificările' : 'Nicio modificare'}
            </button>
          </div>
        )}
        {!isAdmin && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gray-2)', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--black)' }}>
              Închide
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '8px',
  background: 'var(--bg-page)', color: 'var(--black)', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
};

// ── Modal Adaugă / Editează Șofer ─────────────────────────────
function DriverModal({ driver, onClose, onSave, trucks = [] }) {
  const [firstName, setFirstName] = useState(driver?.first_name || '');
  const [lastName, setLastName] = useState(driver?.last_name || '');
  const [hireDate, setHireDate] = useState(driver?.hire_date || '');
  const [isActive, setIsActive] = useState(driver?.is_active !== 0);
  const [assignedTruck, setAssignedTruck] = useState(driver?.assigned_truck || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim()) return;
    setSaving(true);
    try {
      await onSave({ first_name: firstName.trim(), last_name: lastName.trim(), hire_date: hireDate || null, is_active: isActive ? 1 : 0, assigned_truck: assignedTruck });
    } catch {
      alert('Eroare la salvare.');
    }
    setSaving(false);
  };

  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--gray-4)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '14px', padding: '28px', width: '400px', maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--black)', marginBottom: '20px' }}>
          {driver ? 'Editează șofer' : 'Adaugă șofer'}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '14px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Prenume *</label>
                <input autoFocus value={firstName} onChange={e => setFirstName(e.target.value)}
                  style={inputStyle} placeholder="Ex: Ion"
                  onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
              <div>
                <label style={labelStyle}>Nume *</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  style={inputStyle} placeholder="Ex: Popescu"
                  onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Data angajării</label>
              <input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                onBlur={e => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'flex', background: 'var(--gray-1)', borderRadius: '8px', padding: '3px', border: '1px solid var(--gray-2)' }}>
                {[{ val: true, label: 'Activ' }, { val: false, label: 'Inactiv' }].map(opt => (
                  <button key={String(opt.val)} type="button" onClick={() => setIsActive(opt.val)}
                    style={{ flex: 1, padding: '7px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                      fontWeight: isActive === opt.val ? 600 : 400,
                      background: isActive === opt.val ? 'var(--bg-page)' : 'transparent',
                      color: isActive === opt.val ? 'var(--black)' : 'var(--gray-4)',
                      boxShadow: isActive === opt.val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Camion atribuit</label>
              <select value={assignedTruck} onChange={e => setAssignedTruck(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}>
                <option value="">— Neatribuit —</option>
                {trucks.map(t => (
                  <option key={t.number} value={t.number}>{t.number}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--black)' }}>
              Anulează
            </button>
            <button type="submit" disabled={saving || (!firstName.trim() && !lastName.trim())}
              style={{ padding: '9px 18px', background: '#ff7a3d', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Se salvează...' : driver ? 'Salvează' : 'Adaugă'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const DOC_SHORT = { pasaport: 'Pașaport', permis: 'Permis', ci: 'CI', tahograf: 'Tahograf', a1macron: 'A1' };

// ── Pagina principală ─────────────────────────────────────────
function Soferi({ user }) {
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [docsModal, setDocsModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    Promise.all([api.getDrivers(), api.getTrucks()])
      .then(([dr, tr]) => { setDrivers(dr.data); setTrucks(tr.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getAssociatedTruck = (driver) => {
    const fullName = getFullName(driver);
    return trucks.find(t => t.drivers && t.drivers.toLowerCase().includes(fullName.toLowerCase()));
  };

  const getFullName = (d) => {
    if (d.first_name || d.last_name) return [d.first_name, d.last_name].filter(Boolean).join(' ');
    return d.name || '';
  };

  const handleAdd = async (payload) => {
    const r = await api.createDriver(payload);
    await api.assignDriverTruck(r.data.id, payload.assigned_truck || null);
    const [dr, tr] = await Promise.all([api.getDrivers(), api.getTrucks()]);
    setDrivers(dr.data);
    setTrucks(tr.data);
    setAddModal(false);
  };

  const handleEdit = async (payload) => {
    await api.updateDriver(editModal.id, payload);
    await api.assignDriverTruck(editModal.id, payload.assigned_truck || null);
    const [dr, tr] = await Promise.all([api.getDrivers(), api.getTrucks()]);
    setDrivers(dr.data);
    setTrucks(tr.data);
    setEditModal(null);
  };

  const handleDelete = async (id) => {
    await api.deleteDriver(id);
    setDrivers(prev => prev.filter(d => d.id !== id));
    setDeleteConfirm(null);
  };

  const handleToggleAmazon = async (driver) => {
    if (!isAdmin) return;
    const newVal = driver.amazon_account ? 0 : 1;
    // Optimistic update
    setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, amazon_account: newVal } : d));
    try {
      await api.updateDriverAmazon(driver.id, newVal);
    } catch {
      // Revert on error
      setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, amazon_account: driver.amazon_account } : d));
    }
  };

  // Refresh documents for a driver after modal save
  const refreshDriverDocs = async (driverId) => {
    try {
      const r = await api.getDriverDocuments(driverId);
      setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, documents: r.data } : d));
    } catch {}
  };

  const filtered = drivers.filter(d =>
    getFullName(d).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '320px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-4)', pointerEvents: 'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Caută șofer..."
            style={{ width: '100%', padding: '10px 12px 10px 32px', border: '1px solid var(--gray-3)', borderRadius: '8px', background: 'var(--gray-1)', color: 'var(--black)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#ff7a3d'}
            onBlur={e => e.target.style.borderColor = 'var(--gray-3)'} />
        </div>

        <div style={{ fontSize: '12px', color: 'var(--gray-4)', marginLeft: 'auto' }}>
          {filtered.length} / {drivers.length} șoferi
        </div>

        {isAdmin && (
          <button onClick={() => setAddModal(true)}
            style={{ padding: '10px 16px', background: '#ff7a3d', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            + Adaugă șofer
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-4)' }}>Se încarcă...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-4)', fontSize: '14px' }}>
          {search ? `Niciun șofer găsit pentru "${search}".` : 'Niciun șofer adăugat.'}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--gray-2)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--gray-1)', borderBottom: '1px solid var(--gray-2)' }}>
                {['#', 'Nume', 'Angajat din', 'Status', 'Camion', ...DOC_TYPES.map(t => DOC_SHORT[t.key] || t.label), 'Amazon', 'Acțiuni'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 12px', textAlign: i === 1 ? 'left' : 'center', fontWeight: 600, color: 'var(--gray-4)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((driver, i) => {
                const fullName = getFullName(driver);
                const truck = getAssociatedTruck(driver);
                const hireDate = driver.hire_date ? driver.hire_date.split('-').reverse().join('.') : '—';
                return (
                  <tr key={driver.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--gray-2)' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px', color: 'var(--gray-4)', width: 36, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#ff7a3d22', color: '#ff7a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                          {fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--black)', display: 'block' }}>{driver.first_name || driver.name}</span>
                          {driver.last_name && <span style={{ fontSize: '12px', color: 'var(--gray-4)' }}>{driver.last_name}</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--gray-4)', textAlign: 'center', whiteSpace: 'nowrap' }}>{hireDate}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500,
                        color: driver.is_active !== 0 ? '#16a34a' : 'var(--gray-4)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          background: driver.is_active !== 0 ? '#16a34a' : 'var(--gray-3)' }} />
                        {driver.is_active !== 0 ? 'Activ' : 'Inactiv'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: '13px',
                      color: truck ? 'var(--black)' : 'var(--gray-4)' }}>
                      {truck ? truck.number : '—'}
                    </td>
                    {DOC_TYPES.map(t => {
                      const doc = (driver.documents || []).find(d => d.doc_type === t.key);
                      const exp = doc?.expiry_date;
                      const expired = exp && new Date(exp) < new Date();
                      const soon = exp && !expired && (new Date(exp) - new Date()) / (1000 * 60 * 60 * 24) <= 30;
                      const dotColor = !doc ? 'var(--gray-3)' : expired ? 'var(--red)' : soon ? '#f59e0b' : '#16a34a';
                      const title = !doc ? `${t.label}: lipsă` : exp ? `${t.label}: expiră ${exp.split('-').reverse().join('.')}` : `${t.label}: fără dată`;
                      return (
                        <td key={t.key} style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span title={title} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: dotColor, cursor: 'default' }} />
                        </td>
                      );
                    })}
                    {/* Amazon badge */}
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span
                        onClick={isAdmin ? () => handleToggleAmazon(driver) : undefined}
                        title={driver.amazon_account ? 'Amazon: Activ' : 'Amazon: Inactiv'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 9px',
                          background: driver.amazon_account ? '#22c55e1a' : 'var(--gray-1)',
                          border: `1px solid ${driver.amazon_account ? '#22c55e55' : 'var(--gray-2)'}`,
                          borderRadius: '12px',
                          cursor: isAdmin ? 'pointer' : 'default',
                          fontSize: '11px', fontWeight: 600,
                          color: driver.amazon_account ? '#16a34a' : 'var(--gray-4)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: driver.amazon_account ? '#22c55e' : 'var(--gray-3)', flexShrink: 0 }} />
                        {driver.amazon_account ? 'Activ' : 'Nu'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => setDocsModal(driver)}
                          style={{ ...iconBtnBase, color: 'var(--black)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                          <IconFile /> Documente
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => setEditModal(driver)}
                              style={{ ...iconBtnBase, color: 'var(--black)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                              <IconEdit /> Editează
                            </button>
                            <button onClick={() => setDeleteConfirm(driver)}
                              style={{ ...iconBtnBase, color: 'var(--red)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.borderColor = 'var(--red)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                              <IconTrash /> Șterge
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {addModal && <DriverModal onClose={() => setAddModal(false)} onSave={handleAdd} trucks={trucks} />}
      {editModal && <DriverModal driver={editModal} onClose={() => setEditModal(null)} onSave={handleEdit} trucks={trucks} />}
      {docsModal && <DocsModal driver={docsModal} onClose={() => { setDocsModal(null); refreshDriverDocs(docsModal.id); }} isAdmin={isAdmin} />}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '14px', padding: '28px 32px', width: '340px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--red)' }}><IconTrash /></div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--black)', marginBottom: '8px' }}>Ștergi șoferul?</div>
            <div style={{ fontSize: '13px', color: 'var(--gray-4)', marginBottom: '24px' }}>
              <strong style={{ color: 'var(--black)' }}>{[deleteConfirm.first_name, deleteConfirm.last_name].filter(Boolean).join(' ') || deleteConfirm.name}</strong> va fi șters permanent împreună cu toate documentele sale.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '9px 20px', background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--black)', fontWeight: 500 }}>
                Anulează
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)}
                style={{ padding: '9px 20px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Șterge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Soferi;
