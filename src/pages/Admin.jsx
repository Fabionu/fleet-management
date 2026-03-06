import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { DRIVER_DOC_TYPES } from '../constants/docTypes';

// ── Constante ──────────────────────────────────────────────
const PERM_LABELS = {
  editVehicleInfo:  'Editare info vehicul',
  toggleAmazon:     'Toggle Amazon',
  addTrip:          'Adăugare cursă',
  editTrip:         'Editare cursă',
  deleteTrip:       'Ștergere cursă',
  clearTruckData:   'Golire date camion',
  deleteTruckRow:   'Ștergere rând camion',
  addNextTrip:      'Adăugare cursă următoare',
  markInvoiced:     'Marcare facturată',
};

const DEFAULT_PERMISSIONS = {
  admin:      { editVehicleInfo:true,  toggleAmazon:true,  addTrip:true,  editTrip:true,  deleteTrip:true,  clearTruckData:true,  deleteTruckRow:true,  addNextTrip:true,  markInvoiced:true  },
  dispatcher: { editVehicleInfo:false, toggleAmazon:false, addTrip:true,  editTrip:true,  deleteTrip:false, clearTruckData:true,  deleteTruckRow:true,  addNextTrip:true,  markInvoiced:false },
  contabil:   { editVehicleInfo:false, toggleAmazon:false, addTrip:false, editTrip:true,  deleteTrip:false, clearTruckData:false, deleteTruckRow:false, addNextTrip:false, markInvoiced:true  },
};

const DOC_TYPES = DRIVER_DOC_TYPES;

// ── Tipuri vehicule ─────────────────────────────────────────
const VEHICLE_TYPES = [
  { value: '40t',  label: '40t',  color: '#ef4444', desc: 'Semi-remorcher' },
  { value: '12t',  label: '12t',  color: '#f59e0b', desc: 'Rigid 12t' },
  { value: '10t',  label: '10t',  color: '#3b82f6', desc: 'Rigid 10t' },
  { value: '7.5t', label: '7.5t', color: '#8b5cf6', desc: 'Rigid 7.5t' },
  { value: '3.5t', label: '3.5t', color: '#22c55e', desc: 'Dubă / Van' },
];

const VehicleIcon = ({ type, size = 32 }) => {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const icons = {
    '40t': (
      <svg viewBox="0 0 44 20" width={size} height={Math.round(size * 20 / 44)} {...s}>
        {/* Cab */}
        <path d="M1 14 L1 6 Q1 4.5 2.5 4.5 L10 4.5 L12.5 7 L12.5 14 Z" />
        {/* Coupling */}
        <line x1="12.5" y1="9" x2="15" y2="9" />
        {/* Trailer */}
        <rect x="15" y="5" width="27" height="9" rx="1" />
        {/* Wheels */}
        <circle cx="3.5" cy="16.5" r="2" />
        <circle cx="9.5" cy="16.5" r="2" />
        <circle cx="32"  cy="16.5" r="2" />
        <circle cx="38"  cy="16.5" r="2" />
      </svg>
    ),
    '12t': (
      <svg viewBox="0 0 40 20" width={size} height={Math.round(size * 20 / 40)} {...s}>
        {/* Cab */}
        <rect x="1" y="6" width="9" height="8" rx="1.5" />
        <path d="M5 6 L10 6 L10 9" />
        {/* Box */}
        <rect x="11" y="3" width="26" height="11" rx="1" />
        {/* Wheels */}
        <circle cx="3.5" cy="16.5" r="2" />
        <circle cx="8.5" cy="16.5" r="2" />
        <circle cx="28"  cy="16.5" r="2" />
        <circle cx="34"  cy="16.5" r="2" />
      </svg>
    ),
    '10t': (
      <svg viewBox="0 0 36 20" width={size} height={Math.round(size * 20 / 36)} {...s}>
        {/* Cab */}
        <rect x="1" y="6" width="8" height="8" rx="1.5" />
        <path d="M4.5 6 L9 6 L9 9" />
        {/* Box */}
        <rect x="10" y="3" width="22" height="11" rx="1" />
        {/* Wheels */}
        <circle cx="3.5" cy="16.5" r="2" />
        <circle cx="8"   cy="16.5" r="2" />
        <circle cx="24"  cy="16.5" r="2" />
        <circle cx="29"  cy="16.5" r="2" />
      </svg>
    ),
    '7.5t': (
      <svg viewBox="0 0 30 20" width={size} height={Math.round(size * 20 / 30)} {...s}>
        {/* Cab */}
        <rect x="1" y="6" width="7" height="8" rx="1.5" />
        <path d="M4 6 L8 6 L8 9" />
        {/* Box */}
        <rect x="9" y="3" width="18" height="11" rx="1" />
        {/* Wheels */}
        <circle cx="3.5" cy="16.5" r="2" />
        <circle cx="7.5" cy="16.5" r="2" />
        <circle cx="20"  cy="16.5" r="2" />
        <circle cx="24"  cy="16.5" r="2" />
      </svg>
    ),
    '3.5t': (
      <svg viewBox="0 0 26 20" width={size} height={Math.round(size * 20 / 26)} {...s}>
        {/* Van body */}
        <path d="M1 14 L1 7 L6 3 L23 3 L25 5 L25 14 Z" />
        {/* Windshield */}
        <path d="M2 7 L6 4 L11 4 L11 7 Z" />
        {/* Side window */}
        <rect x="13" y="4" width="8" height="5" rx="0.5" />
        {/* Wheels */}
        <circle cx="5.5" cy="16.5" r="2" />
        <circle cx="19.5" cy="16.5" r="2" />
      </svg>
    ),
  };
  return icons[type] || null;
};

const VehicleBadge = ({ type }) => {
  const vt = VEHICLE_TYPES.find(v => v.value === type);
  if (!vt) return <span style={{ color: 'var(--gray-4)', fontSize: '12px' }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: vt.color }}>
      <VehicleIcon type={type} size={28} />
      <span style={{ fontSize: '12px', fontWeight: 700 }}>{vt.label}</span>
    </div>
  );
};

// ── SVG Icons ──────────────────────────────────────────────
const IconUsers = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="4"/>
    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    <path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
  </svg>
);

const IconTruck = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="15" height="11" rx="2"/>
    <path d="M16 8h4l3 4v3h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

const IconDriver = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Inel exterior */}
    <circle cx="12" cy="12" r="10"/>
    {/* Butuc central */}
    <circle cx="12" cy="12" r="2.5"/>
    {/* Spite: sus, dreapta-jos, stânga-jos — 120° între ele */}
    <line x1="12" y1="9.5"  x2="12"   y2="2"/>
    <line x1="14.2" y1="13.2" x2="20.7" y2="17"/>
    <line x1="9.8"  y1="13.2" x2="3.3"  y2="17"/>
  </svg>
);

const IconLog = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="13" y2="17"/>
  </svg>
);

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconChevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// ── Componente utilitare ───────────────────────────────────
function Toast({ msg, onClose }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div style={{
      position:'fixed', bottom:'32px', left:'50%', transform:'translateX(-50%)', zIndex:9999,
      background:'#22c55e', color:'#fff', padding:'12px 20px',
      borderRadius:'8px', fontSize:'14px', fontWeight:500,
      boxShadow:'0 4px 16px rgba(0,0,0,0.2)',
      display:'flex', alignItems:'center', gap:'8px',
      animation:'slideIn 0.2s ease'
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      {msg}
    </div>
  );
}

function ConfirmDialog({ msg, onConfirm, onCancel }) {
  if (!msg) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
      <div style={{ background:'var(--bg-page)', border:'1px solid var(--gray-2)', borderRadius:'14px', padding:'28px 32px', minWidth:'320px', textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </div>
        <p style={{ color:'var(--black)', fontSize:'15px', marginBottom:'20px', lineHeight:1.5 }}>{msg}</p>
        <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
          <button onClick={onCancel} style={{ padding:'9px 22px', borderRadius:'7px', border:'1px solid var(--gray-3)', background:'var(--gray-1)', color:'var(--black)', cursor:'pointer', fontSize:'14px', fontWeight:500 }}>Anulează</button>
          <button onClick={onConfirm} style={{ padding:'9px 22px', borderRadius:'7px', border:'none', background:'#ef4444', color:'#fff', cursor:'pointer', fontSize:'14px', fontWeight:600 }}>Șterge</button>
        </div>
      </div>
    </div>
  );
}

// ── Header secțiune cu buton înapoi ────────────────────────
function SectionHeader({ title, icon, count, onBack, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <button onClick={onBack} style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          width:34, height:34, borderRadius:'8px',
          border:'1px solid var(--gray-3)', background:'var(--gray-1)',
          cursor:'pointer', color:'var(--gray-4)', transition:'all 0.15s'
        }}
          onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.color='var(--black)'; }}
          onMouseLeave={e => { e.currentTarget.style.background='var(--gray-1)'; e.currentTarget.style.color='var(--gray-4)'; }}
        >
          <IconBack />
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ color:'#ff7a3d' }}>{icon}</span>
          <h3 style={{ color:'var(--black)', fontSize:'17px', fontWeight:700, margin:0 }}>{title}</h3>
          {count !== undefined && (
            <span style={{ fontSize:'12px', color:'var(--gray-4)', background:'var(--gray-2)', borderRadius:'20px', padding:'2px 10px', fontWeight:500 }}>{count}</span>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Dashboard carduri ──────────────────────────────────────
function Dashboard({ onSelect, counts }) {
  const cards = [
    {
      key: 'utilizatori',
      icon: <IconUsers />,
      title: 'Utilizatori',
      desc: 'Gestionare conturi, roluri și permisiuni',
      color: '#3b82f6',
      count: counts.users,
      countLabel: 'utilizatori',
    },
    {
      key: 'camioane',
      icon: <IconTruck />,
      title: 'Camioane',
      desc: 'Flotă vehicule, remorcă, carduri carburant',
      color: '#ff7a3d',
      count: counts.trucks,
      countLabel: 'vehicule',
    },
    {
      key: 'soferi',
      icon: <IconDriver />,
      title: 'Șoferi',
      desc: 'Lista șoferi și documente (pașaport, permis)',
      color: '#22c55e',
      count: counts.drivers,
      countLabel: 'șoferi',
    },
    {
      key: 'jurnal',
      icon: <IconLog />,
      title: 'Jurnal activitate',
      desc: 'Istoricul acțiunilor în aplicație',
      color: '#8b5cf6',
      count: counts.logs,
      countLabel: 'înregistrări',
    },
  ];

  return (
    <div>
      <p style={{ color:'var(--gray-4)', fontSize:'14px', marginBottom:'24px', marginTop:0 }}>
        Selectează o secțiune pentru administrare.
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px' }}>
        {cards.map(card => (
          <AdminCard key={card.key} card={card} onClick={() => onSelect(card.key)} />
        ))}
      </div>
    </div>
  );
}

function AdminCard({ card, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--gray-1)' : 'var(--bg-page)',
        border: `1.5px solid ${hovered ? card.color + '66' : 'var(--gray-2)'}`,
        borderRadius: '14px',
        padding: '24px',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        boxShadow: hovered ? `0 4px 20px ${card.color}18` : '0 1px 4px rgba(0,0,0,0.06)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: card.color,
        borderRadius: '14px 14px 0 0',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.18s'
      }} />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '12px',
          background: card.color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: card.color,
          transition: 'background 0.18s',
        }}>
          {card.icon}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'24px', fontWeight:700, color:'var(--black)', lineHeight:1 }}>
            {card.count ?? '—'}
          </div>
          <div style={{ fontSize:'11px', color:'var(--gray-4)', marginTop:'2px' }}>{card.countLabel}</div>
        </div>
      </div>

      <div>
        <div style={{ fontSize:'15px', fontWeight:700, color:'var(--black)', marginBottom:'4px' }}>{card.title}</div>
        <div style={{ fontSize:'12px', color:'var(--gray-4)', lineHeight:1.5 }}>{card.desc}</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'4px', color: card.color, fontSize:'12px', fontWeight:600, opacity: hovered ? 1 : 0.5, transition:'opacity 0.18s' }}>
        Deschide <IconChevron />
      </div>
    </div>
  );
}

// ── Secțiunea Utilizatori ──────────────────────────────────
function SectionUtilizatori({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ username:'', password:'', role:'dispatcher', permissions:{} });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.getUsers(); setUsers(res.data); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ username:'', password:'', role:'dispatcher', permissions:{ ...DEFAULT_PERMISSIONS.dispatcher } });
    setModal({ mode:'add' });
  };
  const openEdit = (u) => {
    setForm({ username:u.username, password:'', role:u.role, permissions:{ ...u.permissions } });
    setModal({ mode:'edit', user:u });
  };
  const handleRoleChange = (role) => setForm(f => ({ ...f, role, permissions:{ ...DEFAULT_PERMISSIONS[role] } }));

  const handleSave = async () => {
    if (!form.username.trim()) return;
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        if (!form.password.trim()) { setSaving(false); return; }
        await api.createUser({ username:form.username, password:form.password, role:form.role, permissions:form.permissions });
        setToast('Utilizator adăugat');
      } else {
        await api.updateUser(modal.user.id, { password:form.password||undefined, role:form.role, permissions:form.permissions });
        setToast('Utilizator actualizat');
      }
      setModal(null); load();
    } catch (err) { setToast(err.response?.data?.error || 'Eroare'); }
    setSaving(false);
  };

  const doDelete = async () => {
    try { await api.deleteUser(confirm.id); setToast('Utilizator șters'); load(); }
    catch { setToast('Eroare la ștergere'); }
    setConfirm(null);
  };

  const roleColor = { admin:'#ff7a3d', dispatcher:'#3b82f6', contabil:'#8b5cf6' };
  const roleLabel = { admin:'Administrator', dispatcher:'Dispecer', contabil:'Contabil' };

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast('')} />
      <ConfirmDialog msg={confirm?.msg} onConfirm={doDelete} onCancel={() => setConfirm(null)} />
      <SectionHeader
        title="Utilizatori" icon={<IconUsers />} count={users.length} onBack={onBack}
        action={<button onClick={openAdd} style={btnPrimary}>+ Adaugă utilizator</button>}
      />

      {loading ? <Loader /> : (
        <Table headers={['Utilizator','Rol','Permisiuni','Acțiuni']}>
          {[...users].sort((a, b) => {
            const order = { admin: 0, contabil: 1, dispatcher: 2 };
            return (order[a.role] ?? 3) - (order[b.role] ?? 3);
          }).map((u, i) => (
            <tr key={u.id} style={{ borderBottom: i < users.length-1 ? '1px solid var(--gray-2)' : 'none' }}>
              <td style={tdStyle}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <Avatar name={u.username} color={roleColor[u.role]} />
                  <span style={{ fontWeight:600, color:'var(--black)' }}>{u.username}</span>
                </div>
              </td>
              <td style={tdStyle}>
                <Badge label={roleLabel[u.role]||u.role} color={roleColor[u.role]||'#6b7280'} />
              </td>
              <td style={{ ...tdStyle, color:'var(--gray-4)', fontSize:'12px', maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {Object.entries(u.permissions).filter(([,v])=>v).map(([k])=>PERM_LABELS[k]||k).join(', ')||'—'}
              </td>
              <td style={tdStyle}>
                <Actions onEdit={() => openEdit(u)} onDelete={() => setConfirm({ msg:`Ștergi utilizatorul "${u.username}"?`, id:u.id })} />
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={modal.mode==='add' ? 'Adaugă utilizator' : `Editează: ${modal.user.username}`} onClose={() => setModal(null)} width={480}>
          <div style={{ display:'grid', gap:'14px' }}>
            {modal.mode === 'add' && (
              <Field label="Username *">
                <input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} style={inputStyle} />
              </Field>
            )}
            <Field label={modal.mode==='edit' ? 'Parolă nouă (opțional)' : 'Parolă *'}>
              <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={inputStyle} />
            </Field>
            <Field label="Rol">
              <select value={form.role} onChange={e=>handleRoleChange(e.target.value)} style={inputStyle}>
                <option value="admin">Administrator</option>
                <option value="dispatcher">Dispecer</option>
                <option value="contabil">Contabil</option>
              </select>
            </Field>
            <div>
              <div style={{ fontSize:'12px', color:'var(--gray-4)', fontWeight:500, marginBottom:'10px' }}>Permisiuni</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                {Object.entries(PERM_LABELS).map(([key, label]) => (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:'7px', cursor:'pointer', fontSize:'13px', color:'var(--black)' }}>
                    <input type="checkbox" checked={!!form.permissions[key]}
                      onChange={e=>setForm(f=>({...f, permissions:{...f.permissions,[key]:e.target.checked}}))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setModal(null)} onSave={handleSave} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Secțiunea Camioane ─────────────────────────────────────
function SectionCamioane({ onBack }) {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ number:'', trailer:'', fuel_card:'', fuel_card_expiry:'', phone:'', drivers:'', vehicle_type:'' });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.getTrucks(); setTrucks(res.data); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ number:'', trailer:'', fuel_card:'', fuel_card_expiry:'', phone:'', drivers:'', vehicle_type:'' });
    setModal({ mode:'add' });
  };
  const openEdit = (t) => {
    setForm({ number:t.number||'', trailer:t.trailer||'', fuel_card:t.fuel_card||'', fuel_card_expiry:t.fuel_card_expiry||'', phone:t.phone||'', drivers:t.drivers||'', vehicle_type:t.vehicle_type||'' });
    setModal({ mode:'edit', truck:t });
  };

  const handleSave = async () => {
    if (!form.number.trim()) return;
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.createTruck({
          number:form.number, trailer:form.trailer, fuel_card:form.fuel_card,
          fuel_card_expiry:form.fuel_card_expiry, phone:form.phone, drivers:form.drivers,
          vehicle_type:form.vehicle_type||null,
          status:'liber', amazon_account:0, vignettes:'[]', next_trip:null,
          client:'', order_number:'', load_location:'', load_date:'', load_lat:'', load_lng:'',
          unload_location:'', unload_date:'', unload_lat:'', unload_lng:'', eta:'',
          observations:'', pause_date:'', pause_time:'',
          weekend_duration:'', weekend_day:'', weekend_time:'', weekend_week:'', weekend_history:'[]',
          file_name:null, file_data:null, file_type:null,
        });
        setToast('Camion adăugat');
      } else {
        const t = modal.truck;
        await api.updateTruck(t.id, {
          ...t,
          number:form.number, trailer:form.trailer, fuel_card:form.fuel_card,
          fuel_card_expiry:form.fuel_card_expiry, phone:form.phone, drivers:form.drivers,
          vehicle_type:form.vehicle_type||null,
          amazon_account: t.amazon_account===true||t.amazon_account===1 ? 1 : 0,
          vignettes: typeof t.vignettes==='string' ? t.vignettes : JSON.stringify(t.vignettes||[]),
          next_trip: typeof t.next_trip==='string' ? t.next_trip : JSON.stringify(t.next_trip||null),
          weekend_history: typeof t.weekend_history==='string' ? t.weekend_history : JSON.stringify(t.weekend_history||[]),
        });
        setToast('Camion actualizat');
      }
      setModal(null); load();
    } catch (err) { setToast(err.response?.data?.error || 'Eroare'); }
    setSaving(false);
  };

  const doDelete = async () => {
    try { await api.deleteTruck(confirm.id); setToast('Camion șters'); load(); }
    catch { setToast('Eroare la ștergere'); }
    setConfirm(null);
  };

  const statusColor = { liber:'#22c55e', incarcare:'#f59e0b', descarcare:'#3b82f6', tranzit:'#8b5cf6', booked:'#ff7a3d', weekend:'#ec4899' };

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast('')} />
      <ConfirmDialog msg={confirm?.msg} onConfirm={doDelete} onCancel={() => setConfirm(null)} />
      <SectionHeader
        title="Camioane" icon={<IconTruck />} count={trucks.length} onBack={onBack}
        action={<button onClick={openAdd} style={btnPrimary}>+ Adaugă camion</button>}
      />

      {loading ? <Loader /> : (
        <Table headers={['Nr. camion','Tip','Status','Șoferi','Remorcă','Card carburant','Expirare','Telefon','Acțiuni']}>
          {trucks.map((t, i) => (
            <tr key={t.id} style={{ borderBottom: i<trucks.length-1 ? '1px solid var(--gray-2)' : 'none' }}>
              <td style={tdStyle}><span style={{ fontWeight:700, color:'var(--black)' }}>{t.number}</span></td>
              <td style={tdStyle}><VehicleBadge type={t.vehicle_type} /></td>
              <td style={tdStyle}><Badge label={t.status} color={statusColor[t.status]||'#6b7280'} /></td>
              <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.drivers||'—'}</td>
              <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.trailer||'—'}</td>
              <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.fuel_card||'—'}</td>
              <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.fuel_card_expiry||'—'}</td>
              <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.phone||'—'}</td>
              <td style={tdStyle}><Actions onEdit={() => openEdit(t)} onDelete={() => setConfirm({ msg:`Ștergi camionul "${t.number}"? Se vor pierde toate datele!`, id:t.id })} /></td>
            </tr>
          ))}
        </Table>
      )}

      {modal && (
        <Modal title={modal.mode==='add' ? 'Adaugă camion' : `Editează: ${modal.truck.number}`} onClose={() => setModal(null)} width={460}>
          <div style={{ display:'grid', gap:'12px' }}>
            {[
              { key:'number', label:'Număr camion *', disabled:modal.mode==='edit' },
              { key:'trailer', label:'Remorcă' },
              { key:'fuel_card', label:'Card carburant' },
              { key:'fuel_card_expiry', label:'Expirare card' },
              { key:'phone', label:'Telefon firmă' },
              { key:'drivers', label:'Șoferi (text liber)' },
            ].map(({ key, label, disabled }) => (
              <Field key={key} label={label}>
                <input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} disabled={disabled}
                  style={{ ...inputStyle, background: disabled ? 'var(--gray-2)' : 'var(--gray-1)', color: disabled ? 'var(--gray-4)' : 'var(--black)' }} />
              </Field>
            ))}
            {/* Vehicle type selector */}
            <Field label="Tip vehicul">
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'2px' }}>
                {VEHICLE_TYPES.map(vt => {
                  const sel = form.vehicle_type === vt.value;
                  return (
                    <button key={vt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, vehicle_type: sel ? '' : vt.value }))}
                      title={vt.desc}
                      style={{
                        padding:'5px 10px', borderRadius:'7px', cursor:'pointer', transition:'all 0.15s',
                        border: `2px solid ${sel ? vt.color : 'var(--gray-3)'}`,
                        background: sel ? vt.color + '1a' : 'transparent',
                        color: sel ? vt.color : 'var(--gray-4)',
                        display:'flex', alignItems:'center', gap:'5px',
                        fontSize:'12px', fontWeight:700,
                      }}
                    >
                      <VehicleIcon type={vt.value} size={22} />
                      {vt.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <ModalFooter onCancel={() => setModal(null)} onSave={handleSave} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Secțiunea Șoferi ───────────────────────────────────────
function SectionSoferi({ onBack }) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [docsModal, setDocsModal] = useState(null);
  const [form, setForm] = useState({ first_name:'', last_name:'', hire_date:'', is_active:1, assigned_truck:'' });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docForm, setDocForm] = useState({ doc_type:'pasaport', file_name:'', file_data:'', file_type:'', expiry_date:'' });
  const docFileRef = useRef(null);
  const [search, setSearch] = useState('');
  const [trucks, setTrucks] = useState([]);

  const getFullName = (d) => {
    if (d.first_name || d.last_name) return [d.first_name, d.last_name].filter(Boolean).join(' ');
    return d.name || '';
  };

  const getAssociatedTruck = (driver) => {
    const fullName = getFullName(driver);
    return trucks.find(t => t.drivers && t.drivers.toLowerCase().includes(fullName.toLowerCase()));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [driversRes, trucksRes] = await Promise.all([api.getDrivers(), api.getTrucks()]);
      setDrivers(driversRes.data);
      setTrucks(trucksRes.data);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadDocs = async (id) => {
    setDocsLoading(true);
    try { const res = await api.getDriverDocuments(id); setDocs(res.data); } catch {}
    setDocsLoading(false);
  };

  const openDocs = (driver) => {
    setDocsModal(driver); setDocs([]); setAddingDoc(false); setEditingDoc(null);
    setDocForm({ doc_type:'pasaport', file_name:'', file_data:'', file_type:'', expiry_date:'' });
    loadDocs(driver.id);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) return;
    setSaving(true);
    try {
      const payload = { first_name:form.first_name, last_name:form.last_name, hire_date:form.hire_date||null, is_active:form.is_active };
      let driverId;
      if (modal.mode === 'add') { const r = await api.createDriver(payload); driverId = r.data.id; setToast('Șofer adăugat'); }
      else { await api.updateDriver(modal.driver.id, payload); driverId = modal.driver.id; setToast('Șofer actualizat'); }
      await api.assignDriverTruck(driverId, form.assigned_truck || null);
      setModal(null); load();
    } catch { setToast('Eroare'); }
    setSaving(false);
  };

  const doDelete = async () => {
    try { await api.deleteDriver(confirm.id); setToast('Șofer șters'); load(); }
    catch { setToast('Eroare'); }
    setConfirm(null);
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDocForm(f => ({ ...f, file_name:file.name, file_data:ev.target.result, file_type:file.type }));
    reader.readAsDataURL(file);
  };

  const handleSaveDoc = async () => {
    setSaving(true);
    try {
      if (editingDoc) { await api.updateDriverDocument(editingDoc.id, docForm); setToast('Document actualizat'); }
      else { await api.createDriverDocument({ ...docForm, driver_id:docsModal.id }); setToast('Document adăugat'); }
      setAddingDoc(false); setEditingDoc(null);
      setDocForm({ doc_type:'pasaport', file_name:'', file_data:'', file_type:'', expiry_date:'' });
      loadDocs(docsModal.id);
    } catch { setToast('Eroare'); }
    setSaving(false);
  };

  const handleDeleteDoc = async (id) => {
    try { await api.deleteDriverDocument(id); setToast('Document șters'); loadDocs(docsModal.id); }
    catch { setToast('Eroare'); }
  };

  const isExpired = (d) => d && new Date(d) < new Date();
  const isExpiringSoon = (d) => {
    if (!d) return false;
    const diff = (new Date(d) - new Date()) / (1000*60*60*24);
    return diff >= 0 && diff <= 30;
  };
  const docStatusColor = (d) => isExpired(d) ? '#ef4444' : isExpiringSoon(d) ? '#f59e0b' : '#22c55e';
  const docStatusLabel = (d) => isExpired(d) ? 'Expirat' : isExpiringSoon(d) ? 'Expiră curând' : d ? 'Valid' : '';

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast('')} />
      <ConfirmDialog msg={confirm?.msg} onConfirm={doDelete} onCancel={() => setConfirm(null)} />
      <SectionHeader
        title="Șoferi" icon={<IconDriver />} count={drivers.length} onBack={onBack}
        action={
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ position:'relative' }}>
              <svg style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'var(--gray-4)', pointerEvents:'none' }}
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Caută șofer..."
                style={{ width:'200px', padding:'9px 12px 9px 32px', border:'1px solid var(--gray-3)', borderRadius:'8px', background:'var(--gray-1)', color:'var(--black)', fontSize:'13px', outline:'none', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor='#ff7a3d'}
                onBlur={e => e.target.style.borderColor='var(--gray-3)'} />
            </div>
            <button onClick={() => { setForm({ first_name:'', last_name:'', hire_date:'', is_active:1, assigned_truck:'' }); setModal({ mode:'add' }); }} style={btnPrimary}>+ Adaugă șofer</button>
          </div>
        }
      />

      {loading ? <Loader /> : drivers.length === 0 ? (
        <EmptyState msg="Niciun șofer adăugat încă" />
      ) : (() => {
        const DOC_SHORT = { pasaport:'Pașaport', permis:'Permis', ci:'CI', tahograf:'Tahograf', a1macron:'A1' };
        const filtered = drivers.filter(d => getFullName(d).toLowerCase().includes(search.toLowerCase()));
        if (filtered.length === 0) return <EmptyState msg={`Niciun rezultat pentru "${search}"`} />;
        return (
          <div style={{ border:'1px solid var(--gray-2)', borderRadius:'12px', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ background:'var(--gray-1)', borderBottom:'1px solid var(--gray-2)' }}>
                  {['#','Nume','Angajat din','Status','Camion',...DOC_TYPES.map(t=>DOC_SHORT[t.key]||t.label),'Acțiuni'].map((h,i) => (
                    <th key={i} style={{ padding:'9px 12px', textAlign: i===1?'left':'center', fontWeight:600, color:'var(--gray-4)', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => {
                  const fullName = getFullName(d);
                  const truck = getAssociatedTruck(d);
                  const hireDate = d.hire_date ? d.hire_date.split('-').reverse().join('.') : '—';
                  return (
                    <tr key={d.id} style={{ borderBottom: i < filtered.length-1 ? '1px solid var(--gray-2)' : 'none', transition:'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--gray-1)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'10px 12px', color:'var(--gray-4)', textAlign:'center', width:36 }}>{i+1}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <Avatar name={fullName} color="#22c55e" size={32} />
                          <div>
                            <span style={{ fontWeight:600, color:'var(--black)', display:'block' }}>{d.first_name || d.name}</span>
                            {d.last_name && <span style={{ fontSize:'12px', color:'var(--gray-4)' }}>{d.last_name}</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'10px 12px', color:'var(--gray-4)', textAlign:'center', whiteSpace:'nowrap' }}>{hireDate}</td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'12px', fontWeight:500,
                          color: d.is_active!==0 ? '#16a34a' : 'var(--gray-4)' }}>
                          <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0,
                            background: d.is_active!==0 ? '#16a34a' : 'var(--gray-3)' }} />
                          {d.is_active!==0 ? 'Activ' : 'Inactiv'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:600, fontSize:'13px',
                        color: truck ? 'var(--black)' : 'var(--gray-4)' }}>
                        {truck ? truck.number : '—'}
                      </td>
                      {DOC_TYPES.map(t => {
                        const doc = (d.documents||[]).find(x => x.doc_type === t.key);
                        const exp = doc?.expiry_date;
                        const expired = exp && new Date(exp) < new Date();
                        const soon = exp && !expired && (new Date(exp)-new Date())/(1000*60*60*24)<=30;
                        const bg = !doc?'var(--gray-2)':expired?'var(--red-light)':soon?'#fef3c7':'#dcfce7';
                        const color = !doc?'var(--gray-4)':expired?'var(--red)':soon?'#d97706':'#16a34a';
                        const border = !doc?'var(--gray-3)':expired?'var(--red)':soon?'#f59e0b':'#16a34a';
                        const title = !doc?'Lipsă':exp?`Expiră: ${exp.split('-').reverse().join('.')}`:doc?'Fără dată':'';
                        return (
                          <td key={t.key} style={{ padding:'10px 8px', textAlign:'center' }}>
                            <span title={title} style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:color, border:`1px solid ${border}`, cursor:'default' }} />
                          </td>
                        );
                      })}
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        <div style={{ display:'flex', gap:'5px', justifyContent:'center' }}>
                          <button onClick={() => openDocs(d)}
                            style={{ ...iconBtnBase, color:'var(--black)' }}
                            onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                            <SvgEdit /> Documente
                          </button>
                          <button onClick={() => { setForm({ first_name:d.first_name||'', last_name:d.last_name||'', hire_date:d.hire_date||'', is_active:d.is_active??1, assigned_truck:d.assigned_truck||'' }); setModal({ mode:'edit', driver:d }); }}
                            style={{ ...iconBtnBase, color:'var(--black)' }}
                            onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                            <SvgEdit /> Editează
                          </button>
                          <button onClick={() => setConfirm({ msg:`Ștergi șoferul "${getFullName(d)}"?`, id:d.id })}
                            style={{ ...iconBtnBase, color:'var(--red)' }}
                            onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                            <SvgTrash /> Șterge
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Modal add/edit */}
      {modal && (
        <Modal title={modal.mode==='add' ? 'Adaugă șofer' : `Editează: ${[modal.driver.first_name, modal.driver.last_name].filter(Boolean).join(' ') || modal.driver.name}`} onClose={() => setModal(null)} width={420}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <Field label="Prenume *">
              <input value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} style={inputStyle} autoFocus placeholder="Ion" />
            </Field>
            <Field label="Nume *">
              <input value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} style={inputStyle} placeholder="Popescu" />
            </Field>
          </div>
          <Field label="Data angajării">
            <input type="date" value={form.hire_date} onChange={e=>setForm(f=>({...f,hire_date:e.target.value}))} style={inputStyle} />
          </Field>
          <Field label="Status">
            <div style={{ display:'flex', background:'var(--gray-1)', borderRadius:'8px', padding:'3px', border:'1px solid var(--gray-2)' }}>
              {[{val:1,label:'Activ'},{val:0,label:'Inactiv'}].map(opt => (
                <button key={opt.val} type="button" onClick={() => setForm(f=>({...f,is_active:opt.val}))}
                  style={{ flex:1, padding:'7px 12px', borderRadius:'6px', fontSize:'13px', cursor:'pointer', transition:'all 0.15s', border:'none',
                    fontWeight: form.is_active===opt.val ? 600 : 400,
                    background: form.is_active===opt.val ? 'var(--bg-page)' : 'transparent',
                    color: form.is_active===opt.val ? 'var(--black)' : 'var(--gray-4)',
                    boxShadow: form.is_active===opt.val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Camion atribuit">
            <select value={form.assigned_truck} onChange={e=>setForm(f=>({...f,assigned_truck:e.target.value}))} style={inputStyle}
              onFocus={e=>e.target.style.borderColor='#ff7a3d'}
              onBlur={e=>e.target.style.borderColor='var(--gray-3)'}>
              <option value="">— Neatribuit —</option>
              {trucks.map(t => (
                <option key={t.number} value={t.number}>{t.number}</option>
              ))}
            </select>
          </Field>
          <ModalFooter onCancel={() => setModal(null)} onSave={handleSave} saving={saving} />
        </Modal>
      )}

      {/* Modal documente */}
      {docsModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:8000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ background:'var(--bg-page)', border:'1px solid var(--gray-2)', borderRadius:'14px', padding:'28px', width:600, maxWidth:'95vw', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <Avatar name={getFullName(docsModal)} color="#22c55e" size={36} />
                <div>
                  <div style={{ fontWeight:700, color:'var(--black)', fontSize:'15px' }}>{getFullName(docsModal)}</div>
                  <div style={{ fontSize:'12px', color:'var(--gray-4)' }}>Documente identitate</div>
                </div>
              </div>
              <button onClick={() => { setDocsModal(null); setAddingDoc(false); }}
                style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--gray-4)', fontSize:'22px', lineHeight:1 }}>×</button>
            </div>

            {docsLoading ? <Loader /> : (
              <>
                {docs.length === 0 && !addingDoc && <EmptyState msg="Niciun document adăugat" />}
                <div style={{ display:'grid', gap:'8px', marginBottom:'12px' }}>
                  {docs.map(doc => (
                    <div key={doc.id} style={{ padding:'12px 14px', background:'var(--gray-1)', borderRadius:'9px', border:'1px solid var(--gray-2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                        <div style={{ width:36, height:36, borderRadius:'8px', background: doc.expiry_date ? docStatusColor(doc.expiry_date)+'18' : 'var(--gray-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>
                          📄
                        </div>
                        <div>
                          <div style={{ fontWeight:600, color:'var(--black)', fontSize:'13px' }}>{DOC_TYPES.find(t => t.key === doc.doc_type)?.label || doc.doc_type}</div>
                          <div style={{ fontSize:'11px', color:'var(--gray-4)', marginTop:'2px' }}>
                            {doc.file_name || 'Fără fișier'}
                            {doc.expiry_date && (
                              <span style={{ marginLeft:8, color: docStatusColor(doc.expiry_date), fontWeight:600 }}>
                                · {doc.expiry_date} · {docStatusLabel(doc.expiry_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'5px' }}>
                        {doc.file_data && (
                          <a href={doc.file_data} download={doc.file_name}
                            style={{ padding:'5px 9px', background:'var(--gray-2)', border:'1px solid var(--gray-3)', borderRadius:'5px', cursor:'pointer', fontSize:'12px', color:'var(--black)', textDecoration:'none' }}>↓</a>
                        )}
                        <button
                          onClick={() => {
                            setDocForm({ doc_type:doc.doc_type, file_name:doc.file_name||'', file_data:doc.file_data||'', file_type:doc.file_type||'', expiry_date:doc.expiry_date||'' });
                            setEditingDoc(doc); setAddingDoc(true);
                          }}
                          style={{ ...iconBtnBase, color:'var(--black)' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
                        >
                          <SvgEdit /> Editează
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          style={{ ...iconBtnBase, color:'var(--red)' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
                        >
                          <SvgTrash /> Șterge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {addingDoc ? (
                  <div style={{ padding:'16px', background:'var(--gray-1)', borderRadius:'10px', border:'1px solid var(--gray-2)' }}>
                    <div style={{ fontWeight:600, color:'var(--black)', fontSize:'14px', marginBottom:'12px' }}>
                      {editingDoc ? 'Editează document' : 'Document nou'}
                    </div>
                    <div style={{ display:'grid', gap:'10px' }}>
                      <Field label="Tip document">
                        <select value={docForm.doc_type} onChange={e=>setDocForm(f=>({...f,doc_type:e.target.value}))} style={inputStyle}>
                          {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Data expirare">
                        <input type="date" value={docForm.expiry_date} onChange={e=>setDocForm(f=>({...f,expiry_date:e.target.value}))} style={inputStyle} />
                      </Field>
                      <Field label="Fișier (PDF)">
                        <input ref={docFileRef} type="file" accept=".pdf" onChange={handleFile} style={{ display:'none' }} />
                        <button type="button" onClick={() => docFileRef.current?.click()}
                          style={{ display:'flex', alignItems:'center', gap:'7px', padding:'8px 12px', border:'1px solid var(--gray-3)', borderRadius:'7px', background:'transparent', color:'var(--black)', cursor:'pointer', fontSize:'12px', fontWeight:500, transition:'all 0.15s', width:'100%' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          {docForm.file_name ? docForm.file_name : 'Selectează fișier PDF'}
                        </button>
                      </Field>
                    </div>
                    <div style={{ display:'flex', gap:'8px', marginTop:'14px' }}>
                      <button onClick={() => { setAddingDoc(false); setEditingDoc(null); }}
                        style={{ padding:'7px 16px', border:'1px solid var(--gray-3)', background:'var(--gray-2)', borderRadius:'6px', cursor:'pointer', fontSize:'12px', color:'var(--black)' }}>Anulează</button>
                      <button onClick={handleSaveDoc} disabled={saving}
                        style={{ padding:'7px 16px', border:'none', background:'#ff7a3d', color:'#fff', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:600, opacity:saving?0.7:1 }}>
                        {saving ? 'Se salvează...' : 'Salvează document'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setDocForm({ doc_type:'pasaport', file_name:'', file_data:'', file_type:'', expiry_date:'' }); setEditingDoc(null); setAddingDoc(true); }}
                    style={{ width:'100%', padding:'10px', background:'transparent', border:'2px dashed var(--gray-3)', borderRadius:'8px', cursor:'pointer', fontSize:'13px', color:'var(--gray-4)', transition:'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#ff7a3d'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--gray-3)'}
                  >
                    + Adaugă document
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Secțiunea Jurnal ───────────────────────────────────────
function SectionJurnal({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ user:'', entity:'', search:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.getLogs(); setLogs(res.data); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const users = [...new Set(logs.map(l => l.username))];
  const entities = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  const filtered = logs.filter(l => {
    if (filter.user && l.username !== filter.user) return false;
    if (filter.entity && l.entity_type !== filter.entity) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!`${l.action} ${l.details||''} ${l.username}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const fmtDate = (str) => {
    const d = new Date(str);
    return d.toLocaleDateString('ro-RO', { day:'2-digit', month:'2-digit', year:'numeric' }) + ' ' +
           d.toLocaleTimeString('ro-RO', { hour:'2-digit', minute:'2-digit' });
  };

  const actionColor = (a) => a?.startsWith('Adăug') ? '#22c55e' : a?.startsWith('Editat') ? '#3b82f6' : a?.startsWith('Șters') ? '#ef4444' : '#6b7280';
  const entityIcon = { truck:'🚛', trip:'📦', user:'👤', driver:'🧑‍✈️' };
  const entityLabel = { truck:'Camion', trip:'Cursă', user:'Utilizator', driver:'Șofer' };

  return (
    <div>
      <SectionHeader
        title="Jurnal activitate" icon={<IconLog />} count={filtered.length} onBack={onBack}
        action={
          <button onClick={load} style={{ padding:'7px 14px', background:'var(--gray-1)', border:'1px solid var(--gray-3)', borderRadius:'6px', cursor:'pointer', fontSize:'13px', color:'var(--black)', display:'flex', alignItems:'center', gap:'5px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Reîncarcă
          </button>
        }
      />

      {/* Filtre */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:150 }}>
          <svg style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--gray-4)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Caută..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))}
            style={{ ...inputStyle, paddingLeft:30, width:'100%', boxSizing:'border-box' }} />
        </div>
        <select value={filter.user} onChange={e=>setFilter(f=>({...f,user:e.target.value}))} style={{ ...inputStyle, minWidth:140 }}>
          <option value="">Toți utilizatorii</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filter.entity} onChange={e=>setFilter(f=>({...f,entity:e.target.value}))} style={{ ...inputStyle, minWidth:130 }}>
          <option value="">Toate tipurile</option>
          {entities.map(e => <option key={e} value={e}>{entityIcon[e]||''} {entityLabel[e]||e}</option>)}
        </select>
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState msg="Nicio înregistrare găsită" />
      ) : (
        <Table headers={['Data / Ora','Utilizator','Acțiune','Entitate','Detalii']}>
          {filtered.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: i<filtered.length-1 ? '1px solid var(--gray-2)' : 'none' }}>
              <td style={{ ...tdStyle, color:'var(--gray-4)', fontSize:'12px', whiteSpace:'nowrap' }}>{fmtDate(l.created_at)}</td>
              <td style={tdStyle}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <Avatar name={l.username} size={24} color="#6b7280" />
                  <span style={{ color:'var(--black)', fontWeight:500, fontSize:'13px' }}>{l.username}</span>
                </div>
              </td>
              <td style={tdStyle}><Badge label={l.action} color={actionColor(l.action)} /></td>
              <td style={{ ...tdStyle, fontSize:'12px', color:'var(--gray-4)' }}>
                {l.entity_type ? `${entityIcon[l.entity_type]||''} ${entityLabel[l.entity_type]||l.entity_type}` : '—'}
              </td>
              <td style={{ ...tdStyle, color:'var(--gray-4)', fontSize:'12px', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {l.details||'—'}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ── Componente mici reutilizabile ──────────────────────────
const tdStyle = { padding:'11px 14px', verticalAlign:'middle' };
const inputStyle = { padding:'8px 10px', borderRadius:'7px', border:'1px solid var(--gray-3)', background:'var(--gray-1)', color:'var(--black)', fontSize:'13px', width:'100%', boxSizing:'border-box' };
const btnPrimary = { padding:'8px 16px', background:'#ff7a3d', color:'#fff', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:600 };

function Loader() { return <p style={{ color:'var(--gray-4)', padding:'24px 0', textAlign:'center' }}>Se încarcă...</p>; }
function EmptyState({ msg }) { return <p style={{ color:'var(--gray-4)', textAlign:'center', padding:'40px 0', fontSize:'14px' }}>{msg}</p>; }
function Avatar({ name, color='#ff7a3d', size=28 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:color+'22', border:`1.5px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', color, fontWeight:700, fontSize:size*0.44, flexShrink:0 }}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );
}
function Badge({ label, color }) {
  return (
    <span style={{ padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:600, background:color+'20', color }}>
      {label}
    </span>
  );
}
const SvgEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const SvgTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);
const iconBtnBase = {
  padding: '6px 10px', background: 'transparent', border: '1px solid var(--gray-3)',
  borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: '5px', transition: 'all 0.15s',
  fontSize: '12px', fontWeight: 500,
};
function Actions({ onEdit, onDelete }) {
  return (
    <div style={{ display:'flex', gap:'5px' }}>
      <button
        onClick={onEdit}
        style={{ ...iconBtnBase, color: 'var(--black)' }}
        onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
      >
        <SvgEdit /> Editează
      </button>
      <button
        onClick={onDelete}
        style={{ ...iconBtnBase, color: 'var(--red)' }}
        onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
      >
        <SvgTrash /> Șterge
      </button>
    </div>
  );
}
function Table({ headers, children }) {
  return (
    <div style={{ background:'var(--bg-page)', border:'1px solid var(--gray-2)', borderRadius:'10px', overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--gray-2)', background:'var(--gray-1)' }}>
              {headers.map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'var(--gray-4)', fontWeight:600, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <span style={{ fontSize:'12px', color:'var(--gray-4)', fontWeight:500 }}>{label}</span>
      {children}
    </label>
  );
}
function Modal({ title, onClose, children, width=480 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:8000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
      <div style={{ background:'var(--bg-page)', border:'1px solid var(--gray-2)', borderRadius:'14px', padding:'28px', width, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h3 style={{ color:'var(--black)', margin:0, fontSize:'16px', fontWeight:700 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--gray-4)', fontSize:'22px', lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ModalFooter({ onCancel, onSave, saving }) {
  return (
    <div style={{ display:'flex', gap:'10px', marginTop:'22px', justifyContent:'flex-end' }}>
      <button onClick={onCancel} style={{ padding:'9px 20px', border:'1px solid var(--gray-3)', background:'var(--gray-1)', borderRadius:'7px', cursor:'pointer', color:'var(--black)', fontSize:'13px', fontWeight:500 }}>Anulează</button>
      <button onClick={onSave} disabled={saving} style={{ padding:'9px 20px', border:'none', background:'#ff7a3d', color:'#fff', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:600, opacity:saving?0.7:1 }}>
        {saving ? 'Se salvează...' : 'Salvează'}
      </button>
    </div>
  );
}

// ── Admin principal ────────────────────────────────────────
function Admin({ user }) {
  const [active, setActive] = useState(() => localStorage.getItem('adminSection') || null);
  const [counts, setCounts] = useState({ users:null, trucks:null, drivers:null, logs:null });

  useEffect(() => {
    Promise.all([
      api.getUsers().then(r => r.data.length).catch(() => null),
      api.getTrucks().then(r => r.data.length).catch(() => null),
      api.getDrivers().then(r => r.data.length).catch(() => null),
      api.getLogs().then(r => r.data.length).catch(() => null),
    ]).then(([users, trucks, drivers, logs]) => {
      setCounts({ users, trucks, drivers, logs });
    });
  }, [active]); // reîncarcă contoarele la revenire

  const goTo = (section) => {
    setActive(section);
    if (section) localStorage.setItem('adminSection', section);
    else localStorage.removeItem('adminSection');
  };

  return (
    <div style={{ paddingTop:'16px' }}>
      {!active && <Dashboard onSelect={goTo} counts={counts} />}
      {active === 'utilizatori' && <SectionUtilizatori onBack={() => goTo(null)} />}
      {active === 'camioane'    && <SectionCamioane    onBack={() => goTo(null)} />}
      {active === 'soferi'      && <SectionSoferi      onBack={() => goTo(null)} />}
      {active === 'jurnal'      && <SectionJurnal      onBack={() => goTo(null)} />}
    </div>
  );
}

export default Admin;
