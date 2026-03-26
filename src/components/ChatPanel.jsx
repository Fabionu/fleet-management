import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getSocket } from '../services/socket';
import { playReceived, playSent, playTripOrderReceived, playTripOrderAccepted, playTripOrderRejected } from '../services/sounds';
import axios from 'axios';

function isTripOrderMsg(msg) {
  if (msg.message_type === 'trip_order') return true;
  if (msg.message && msg.message.startsWith('{')) {
    try {
      const d = JSON.parse(msg.message);
      return !!(d.order_number !== undefined || d.truck !== undefined || d.payment_terms !== undefined || d.doc_type !== undefined);
    } catch {}
  }
  return false;
}

function isImageMsg(msg) {
  return msg.message_type === 'image' && msg.image_data;
}

function sanitizeReplyText(text) {
  if (!text) return '';
  if (text.startsWith('{')) {
    try {
      const d = JSON.parse(text);
      if (d.order_number || d.truck || d.payment_terms) {
        return `📦 Comandă de transport${d.order_number ? ` #${d.order_number}` : ''}${d.truck ? ` • ${d.truck}` : ''}`;
      }
    } catch {}
  }
  return text;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
}

function roleLabel(role) {
  if (role === 'admin') return 'Administrator';
  if (role === 'dispatcher') return 'Dispecer';
  return 'Contabil';
}

const AVATAR_COLORS = ['#ff7a3d', '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899'];
function avatarColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const GROUP_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f43f5e', '#a855f7', '#84cc16'];
function groupColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

const CHECK_POINTS = '1 4.2 4.2 7.5 11 1';
function SeenIcon() {
  return (
    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
      <polyline points={CHECK_POINTS} stroke="#ff7a3d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function SentIcon() {
  return (
    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
      <polyline points={CHECK_POINTS} stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GroupIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function formatText(text) {
  const parts = [];
  const regex = /(\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    const inner = match[0].slice(1, -1);
    if (match[0].startsWith('*')) parts.push({ type: 'bold', content: inner });
    else parts.push({ type: 'italic', content: inner });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) });
  return parts;
}

function renderTextSegment(text, currentUser, keyPrefix) {
  if (!text) return null;
  if (!text.includes('@')) {
    const fmtParts = formatText(text);
    return fmtParts.map((p, i) => {
      if (p.type === 'bold') return <strong key={`${keyPrefix}-b${i}`}>{p.content}</strong>;
      if (p.type === 'italic') return <em key={`${keyPrefix}-em${i}`}>{p.content}</em>;
      return p.content;
    });
  }
  const mentionParts = text.split(/(@\w+)/g);
  return mentionParts.map((part, i) => {
    if (/^@\w+$/.test(part)) {
      const isMentionedMe = part.slice(1) === currentUser;
      return (
        <span key={`${keyPrefix}-m${i}`} style={{
          color: '#ff7a3d', fontWeight: 600,
          background: isMentionedMe ? 'rgba(255,122,61,0.18)' : 'transparent',
          borderRadius: 3, padding: isMentionedMe ? '0 3px' : 0,
        }}>
          {part}
        </span>
      );
    }
    const fmtParts = formatText(part);
    return fmtParts.map((p, j) => {
      if (p.type === 'bold') return <strong key={`${keyPrefix}-b${i}-${j}`}>{p.content}</strong>;
      if (p.type === 'italic') return <em key={`${keyPrefix}-em${i}-${j}`}>{p.content}</em>;
      return p.content;
    });
  });
}

function renderMessageText(text, currentUser) {
  if (!text) return text;
  return renderTextSegment(text, currentUser, 'msg');
}

function getSeenBy(msgIdx, allMsgs, readsForGroup, currentUser) {
  if (!readsForGroup || !allMsgs[msgIdx]) return [];
  const msgTime = new Date(allMsgs[msgIdx].created_at).getTime();
  const nextMsgTime = msgIdx < allMsgs.length - 1
    ? new Date(allMsgs[msgIdx + 1].created_at).getTime()
    : Infinity;
  return Object.entries(readsForGroup)
    .filter(([uname, readAt]) => {
      if (uname === currentUser) return false;
      const rt = new Date(readAt).getTime();
      return rt >= msgTime && rt < nextMsgTime;
    })
    .map(([uname]) => uname);
}

function CloseBtn({ onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6 }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );
}

function BackBtn({ onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px 4px 2px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6 }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  );
}

// ── Trip Order Modal ────────────────────────────────────────
function TripOrderModal({ peer, groupName, members, dn, onClose, onSend }) {
  const [form, setForm] = useState({ order_number: '', truck: '', payment_terms: '', doc_type: 'Digital', to_user: '' });
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFile({ name: f.name, data: ev.target.result.split(',')[1], type: f.type });
    reader.readAsDataURL(f);
  };

  const canSubmit = form.order_number.trim() && form.truck.trim() && !sending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      await onSend({ ...form, file_name: file?.name || null, file_data: file?.data || null, file_type: file?.type || null });
      onClose();
    } catch {}
    setSending(false);
  };

  const inp = { padding: '8px 10px', borderRadius: 7, border: '1px solid var(--gray-3)', background: 'var(--gray-1)', color: 'var(--black)', fontSize: 13, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
  const lbl = { fontSize: 12, color: 'var(--gray-4)', fontWeight: 500, marginBottom: 5 };

  const dest = form.to_user ? (dn ? dn(form.to_user) : form.to_user) : (peer || groupName);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: 16, width: 400, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ff7a3d18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff7a3d' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--black)' }}>Trimite cursă</div>
              <div style={{ fontSize: 11, color: 'var(--gray-4)' }}>către {dest}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Destinatar — only for group */}
            {members && members.length > 0 && (
              <div>
                <div style={lbl}>Destinatar</div>
                <select value={form.to_user} onChange={e => setForm(f => ({ ...f, to_user: e.target.value }))} style={inp}>
                  <option value="">Întreg grupul</option>
                  {members.map(m => <option key={m} value={m}>{dn ? dn(m) : m}</option>)}
                </select>
              </div>
            )}
            {/* PDF Upload */}
            <div>
              <div style={lbl}>Comandă de transport (PDF)</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1.5px dashed ${file ? '#ff7a3d' : 'var(--gray-3)'}`, borderRadius: 8, cursor: 'pointer', background: file ? '#ff7a3d08' : 'var(--gray-1)', transition: 'all 0.15s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={file ? '#ff7a3d' : 'var(--gray-4)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span style={{ fontSize: 12, color: file ? '#ff7a3d' : 'var(--gray-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file ? file.name : 'Selectează PDF...'}</span>
                {file && <button onMouseDown={e => { e.preventDefault(); setFile(null); }} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 0, display: 'flex' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>}
                <input type="file" accept=".pdf,application/pdf" onChange={handleFile} style={{ display: 'none' }} />
              </label>
            </div>
            <div>
              <div style={lbl}>Număr comandă *</div>
              <input value={form.order_number} onChange={e => setForm(f => ({ ...f, order_number: e.target.value }))} style={inp} placeholder="ex: CMD-2026-001" />
            </div>
            <div>
              <div style={lbl}>Camion *</div>
              <input value={form.truck} onChange={e => setForm(f => ({ ...f, truck: e.target.value }))} style={inp} placeholder="ex: B 123 ABC" />
            </div>
            <div>
              <div style={lbl}>Termen de plată</div>
              <input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} style={inp} placeholder="ex: 30 zile, imediat..." />
            </div>
            <div>
              <div style={lbl}>Documente</div>
              <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))} style={inp}>
                <option value="Digital">Digital</option>
                <option value="Originale">Originale</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 22px 18px', borderTop: '1px solid var(--gray-2)', marginTop: 14, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid var(--gray-3)', background: 'var(--gray-1)', borderRadius: 7, cursor: 'pointer', color: 'var(--black)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }}>Anulează</button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ padding: '8px 18px', border: 'none', background: (!form.order_number.trim() || !form.truck.trim()) ? 'var(--gray-3)' : '#ff7a3d', color: 'white', borderRadius: 7, cursor: canSubmit ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: canSubmit ? 1 : 0.7, display: 'flex', alignItems: 'center', gap: 7 }}>
            {sending && (
              <svg style={{ animation: 'spin-loader 0.7s linear infinite', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            )}
            {sending ? 'Se trimite...' : 'Trimite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Trip Order Card (rendered inside message bubble) ────────
function TripOrderCard({ msg, currentUser, onRespond }) {
  const [hoverAccept, setHoverAccept] = useState(false);
  const [hoverReject, setHoverReject] = useState(false);
  let data = {};
  try { data = JSON.parse(msg.message); } catch {}
  const isMe = msg.username === currentUser;
  const status = msg.trip_order_status || 'pending';
  const STATUS = {
    pending:  { label: 'În așteptare', color: 'var(--orange)' },
    accepted: { label: 'Acceptată',    color: 'var(--green)' },
    rejected: { label: 'Refuzată',     color: 'var(--red)' },
  };
  const s = STATUS[status] || STATUS.pending;

  const downloadPdf = () => {
    if (!data.file_data) return;
    const link = document.createElement('a');
    link.href = `data:${data.file_type || 'application/pdf'};base64,${data.file_data}`;
    link.download = data.file_name || 'comanda.pdf';
    link.click();
  };

  return (
    <div style={{ width: 245, borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px', overflow: 'hidden', border: '1px solid var(--gray-2)', background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ padding: '9px 11px 7px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--gray-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--black)' }}>Comandă de transport</div>
          {data.order_number && <div style={{ fontSize: 11, color: '#ff7a3d', fontWeight: 600 }}>#{data.order_number}</div>}
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, border: `1px solid ${s.color}`, color: s.color, flexShrink: 0 }}>{s.label}</span>
      </div>
      {/* Body */}
      <div style={{ padding: '8px 11px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {data.truck && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: 'var(--gray-4)', width: 72, flexShrink: 0 }}>Camion</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--black)' }}>{data.truck}</span>
            </div>
          )}
          {data.payment_terms && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: 'var(--gray-4)', width: 72, flexShrink: 0 }}>Termen plată</span>
              <span style={{ fontSize: 12, color: 'var(--black)' }}>{data.payment_terms}</span>
            </div>
          )}
          {data.doc_type && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 10, color: 'var(--gray-4)', width: 72, flexShrink: 0 }}>Documente</span>
              <span style={{ fontSize: 12, color: 'var(--black)' }}>{data.doc_type}</span>
            </div>
          )}
        </div>
        {data.file_name && (
          <button onClick={downloadPdf}
            style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', width: '100%', color: 'var(--gray-4)', fontSize: 11, fontWeight: 500, fontFamily: 'inherit', boxSizing: 'border-box' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.file_name}</span>
          </button>
        )}
        {!isMe && status === 'pending' && onRespond && (
          <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
            <button onClick={() => onRespond('accepted')}
              onMouseEnter={() => setHoverAccept(true)}
              onMouseLeave={() => setHoverAccept(false)}
              style={{ flex: 1, padding: '5px 0', border: '1px solid var(--green)', background: hoverAccept ? 'var(--green)' : 'transparent', color: hoverAccept ? 'white' : 'var(--green)', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s' }}>
              ✓ Acceptă
            </button>
            <button onClick={() => onRespond('rejected')}
              onMouseEnter={() => setHoverReject(true)}
              onMouseLeave={() => setHoverReject(false)}
              style={{ flex: 1, padding: '5px 0', border: '1px solid var(--red)', background: hoverReject ? 'var(--red)' : 'transparent', color: hoverReject ? 'white' : 'var(--red)', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s' }}>
              ✗ Refuză
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1400;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
          else        { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name?.replace(/\.[^.]+$/, '.jpg') || 'imagine.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function ChatInput({ inputRef, value, onChange, onKeyDown, onSend, placeholder, mentionQuery, mentionUsers, mentionHighlight, onMentionSelect, replyTo, onCancelReply, onOpenTripOrder, onSendImage }) {
  const [plusOpen, setPlusOpen]         = useState(false);
  const [imgPreview, setImgPreview]     = useState(null); // { dataUrl, file, sizeKb }
  const [imgCompressing, setImgCompressing] = useState(false);
  const fileRef = useRef(null);

  const prepareImage = async (rawFile) => {
    if (!rawFile || !rawFile.type.startsWith('image/')) return;
    setImgCompressing(true);
    try {
      const compressed = await compressImage(rawFile);
      const dataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onload = (e) => res(e.target.result);
        r.readAsDataURL(compressed);
      });
      setImgPreview({ dataUrl, file: compressed, sizeKb: Math.round(compressed.size / 1024) });
    } finally {
      setImgCompressing(false);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        prepareImage(item.getAsFile());
        return;
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) prepareImage(file);
    e.target.value = '';
  };

  const confirmSend = () => {
    if (!imgPreview) return;
    onSendImage && onSendImage(imgPreview.file);
    setImgPreview(null);
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Image preview strip */}
      {(imgPreview || imgCompressing) && (
        <div style={{ margin: '0 12px 6px', padding: '8px 10px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, animation: 'chatItemIn 0.15s ease' }}>
          {imgCompressing ? (
            <>
              <div style={{ width: 44, height: 44, borderRadius: 7, background: 'var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ animation: 'spin-loader 0.8s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.15)" strokeWidth="3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--gray-4)" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{ fontSize: 12, color: 'var(--gray-4)', fontFamily: 'inherit' }}>Se comprimă imaginea...</span>
            </>
          ) : (
            <>
              <img src={imgPreview.dataUrl} alt="preview"
                style={{ width: 44, height: 44, borderRadius: 7, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--gray-2)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  {imgPreview.file.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-4)', fontFamily: 'inherit' }}>
                  {imgPreview.sizeKb < 1024 ? `${imgPreview.sizeKb} KB` : `${(imgPreview.sizeKb / 1024).toFixed(1)} MB`} · JPEG comprimat
                </div>
              </div>
              <button onClick={confirmSend}
                style={{ padding: '5px 12px', background: '#ff7a3d', border: 'none', borderRadius: 7, cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#ff8c52'}
                onMouseLeave={e => e.currentTarget.style.background = '#ff7a3d'}>
                Trimite
              </button>
              <button onClick={() => setImgPreview(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </>
          )}
        </div>
      )}
      {replyTo && (
        <div style={{ margin: '0 12px 6px', padding: '6px 10px', background: 'var(--gray-1)', borderLeft: '3px solid #ff7a3d', borderRadius: '0 6px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#ff7a3d' }}>Răspuns la {replyTo.username}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.text}</div>
          </div>
          <button onClick={onCancelReply} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex', alignItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
      {mentionQuery !== null && mentionUsers.length > 0 && (
        <div className="chat-scroll" style={{ position: 'absolute', bottom: '100%', left: 12, right: 58, background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 -4px 20px rgba(0,0,0,0.18)', maxHeight: 160, overflowY: 'auto', zIndex: 10 }}>
          {mentionUsers.map((u, i) => (
            <div key={u} onMouseDown={e => { e.preventDefault(); onMentionSelect(u); }}
              style={{ padding: '8px 12px', cursor: 'pointer', background: i === mentionHighlight ? 'var(--gray-1)' : 'transparent', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: avatarColor(u), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {u.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: 'var(--black)' }}>
                <span style={{ color: '#ff7a3d', fontWeight: 600 }}>@</span>{u}
              </span>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea ref={inputRef} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} onPaste={handlePaste}
          placeholder={placeholder} rows={1} className="chat-scroll"
          style={{ flex: 1, resize: 'none', border: '1px solid var(--gray-3)', borderRadius: 10, padding: '9px 12px', fontSize: 14, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 80, overflowY: 'auto', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
          onMouseEnter={e => { if (document.activeElement !== e.target) e.target.style.borderColor = 'var(--gray-4)'; }}
          onMouseLeave={e => { if (document.activeElement !== e.target) e.target.style.borderColor = 'var(--gray-3)'; }}
          onFocus={e => e.target.style.borderColor = '#ff7a3d'}
          onBlur={e => { e.target.style.borderColor = 'var(--gray-3)'; }}
        />
        {/* Plus menu */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setPlusOpen(p => !p)}
            style={{ width: 38, height: 38, borderRadius: '50%', background: plusOpen ? 'var(--gray-2)' : 'var(--gray-1)', border: '1px solid var(--gray-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-4)', transition: 'all 0.15s', transform: plusOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; e.currentTarget.style.color = 'var(--black)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = plusOpen ? 'var(--gray-2)' : 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          {plusOpen && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 180, overflow: 'hidden', animation: 'chatItemIn 0.15s ease', zIndex: 20 }}
              onMouseLeave={() => setPlusOpen(false)}>
              {onOpenTripOrder && (
                <button onMouseDown={(e) => { e.preventDefault(); setPlusOpen(false); onOpenTripOrder(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--black)', fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: '#ff7a3d18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  </div>
                  <span style={{ fontWeight: 500 }}>Trimite cursă</span>
                </button>
              )}
              <button onMouseDown={(e) => { e.preventDefault(); setPlusOpen(false); fileRef.current?.click(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--black)', fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <span style={{ fontWeight: 500 }}>Adaugă imagine</span>
              </button>
            </div>
          )}
        </div>
        <button onClick={onSend} disabled={!value.trim()}
          style={{ width: 38, height: 38, borderRadius: '50%', background: value.trim() ? '#ff7a3d' : 'var(--gray-2)', border: 'none', cursor: value.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <div onClick={onChange}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', transition: 'background 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: checked ? '1.5px solid #ff7a3d' : '1.5px solid var(--gray-3)', background: checked ? '#ff7a3d' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><polyline points="1 3.5 3.5 6 8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(label), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 12 }}>
          {label.charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 14, color: 'var(--black)' }}>{label}</span>
      </div>
    </div>
  );
}

export default function ChatPanel({ user, currentPage }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('chat_sidebar_collapsed') === 'true');
  const [openCards, setOpenCards] = useState([]); // [{ key, type:'dm'|'group', peer?, group?, minimized }]
  const [slideDir, setSlideDir]   = useState('right');
  const [view, setView]           = useState('contacts');
  const [peer, setPeer]           = useState(null);

  const [orgUsers, setOrgUsers]           = useState([]);
  const [onlineUsers, setOnlineUsers]     = useState([]);
  const [conversations, setConversations] = useState({});
  const [unreadCounts, setUnreadCounts]   = useState({});
  const [lastMessages, setLastMessages]   = useState({});
  const [totalUnread, setTotalUnread]     = useState(0);
  const [peerReadAt, setPeerReadAt]       = useState(null);

  const [groups, setGroups]               = useState([]);
  const [groupUnread, setGroupUnread]     = useState({});
  const [groupMessages, setGroupMessages] = useState({});
  const [activeGroup, setActiveGroup]     = useState(null);
  const [memberReads, setMemberReads]     = useState({});

  const [newGroupName, setNewGroupName]         = useState('');
  const [newGroupMembers, setNewGroupMembers]   = useState([]);
  const [editGroupMembers, setEditGroupMembers] = useState([]);
  const [editGroupName, setEditGroupName]       = useState('');
  const [groupSaving, setGroupSaving]           = useState(false);
  const [memberMenuOpen, setMemberMenuOpen]     = useState(null); // username cu meniu ⋮ deschis
  const [addMemberSel, setAddMemberSel]         = useState([]);   // useri selectați la adăugare
  const [groupRenaming, setGroupRenaming]       = useState(false);

  const [inputVal, setInputVal]           = useState('');
  const [search, setSearch]               = useState('');
  const [dmCollapsed, setDmCollapsed]     = useState(() => localStorage.getItem('chat_dm_collapsed') === 'true');
  const [grpsCollapsed, setGrpsCollapsed] = useState(() => localStorage.getItem('chat_grps_collapsed') === 'true');

  const [mentionQuery, setMentionQuery]         = useState(null);
  const [mentionUsers, setMentionUsers]         = useState([]);
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const [mentionAtIdx, setMentionAtIdx]         = useState(0);

  const [typingUsers, setTypingUsers]       = useState({});
  const typingTimers                        = useRef({});
  const stopTypingTimer                     = useRef(null);
  const [replyTo, setReplyTo]               = useState(null);
  const [pinnedMsg, setPinnedMsg]           = useState(null);
  const [hoveredMsgId, setHoveredMsgId]     = useState(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const highlightTimer                      = useRef(null);
  const [showScrollBtn, setShowScrollBtn]   = useState(false);
  const [editingMsgId, setEditingMsgId]     = useState(null);
  const [editingText, setEditingText]       = useState('');
  const [showSearch, setShowSearch]         = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchIdx, setSearchIdx]           = useState(0);
  const [firstUnreadId, setFirstUnreadId]   = useState(null);
  const [pinNotification, setPinNotification] = useState(null);
  const pinNotifTimer                       = useRef(null);
  const [tripOrderModal, setTripOrderModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState(null); // mesajul pending ștergere
  const [chatToast, setChatToast]           = useState(null); // { message, type }
  const [lightboxSrc, setLightboxSrc]       = useState(null); // src imagine full-screen
  const [avatarTooltip, setAvatarTooltip]   = useState(null); // { name, top } — tooltip collapsed sidebar
  const [chatFontSize, setChatFontSize]     = useState(() => parseInt(localStorage.getItem('chat_font_size') || '14', 10));
  const [showChatSettings, setShowChatSettings] = useState(false);
  const chatSettingsRef                     = useRef(null);
  const fileInputRef                        = useRef(null);
  const searchInputRef                      = useRef(null);
  const EDIT_LIMIT_MS = 5 * 60 * 1000;

  const [globalSearch, setGlobalSearch]       = useState(false);
  const [globalQuery, setGlobalQuery]         = useState('');
  const [globalResults, setGlobalResults]     = useState({ dm: [], groups: [] });
  const [globalSearching, setGlobalSearching] = useState(false);
  const globalSearchRef  = useRef(null);
  const globalSearchTimer = useRef(null);

  const mutedKey = `chat_muted_${user.username}`;
  const [muted, setMuted] = useState(() => {
    try { return JSON.parse(localStorage.getItem(mutedKey)) || { dm: [], group: [] }; } catch { return { dm: [], group: [] }; }
  });
  const mutedRef = useRef(muted);
  const [hoveredDm, setHoveredDm]       = useState(null);
  const [hoveredGroup, setHoveredGroup] = useState(null);

  const openRef         = useRef(false);
  const peerRef         = useRef(null);
  const activeGroupRef  = useRef(null);
  const messagesEndRef  = useRef(null);

  // ── Resize ─────────────────────────────────────────────────
  const inputRef        = useRef(null);
  const searchRef       = useRef(null);
  const newGroupNameRef = useRef(null);
  const currentPageRef  = useRef(currentPage);

  const token   = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}` };
  const isAdmin = user.role === 'admin';
  const canChat = (key) => user.role === 'admin' || user.permissions?.[key] !== false;

  const displayNames = useMemo(() => {
    const map = {};
    orgUsers.forEach(u => {
      const full = [u.first_name, u.last_name].filter(Boolean).join(' ');
      map[u.username] = full || u.username;
    });
    return map;
  }, [orgUsers]);

  const dn = (username) => displayNames[username] || username;

  // ── Global search debounce ─────────────────────────────────
  useEffect(() => {
    clearTimeout(globalSearchTimer.current);
    if (globalQuery.trim().length < 2) {
      setGlobalResults({ dm: [], groups: [] });
      setGlobalSearching(false);
      return;
    }
    setGlobalSearching(true);
    globalSearchTimer.current = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/chat/search?q=${encodeURIComponent(globalQuery.trim())}`, { headers });
        setGlobalResults(res.data);
      } catch {}
      setGlobalSearching(false);
    }, 300);
    return () => clearTimeout(globalSearchTimer.current);
  }, [globalQuery]);

  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>{text.slice(0, idx)}<span style={{ background: 'rgba(255,122,61,0.28)', color: '#ff7a3d', fontWeight: 600, borderRadius: 2, padding: '0 2px' }}>{text.slice(idx, idx + query.length)}</span>{text.slice(idx + query.length)}</>
    );
  };

  const openGlobalResult = (result) => {
    if (result.type === 'dm') {
      const peerObj = orgUsers.find(u => u.username === result.peer);
      if (peerObj) openConversation(peerObj);
    } else {
      const grp = groups.find(g => g.id === result.group_id);
      if (grp) openGroupConversation(grp);
    }
    setGlobalSearch(false);
    setGlobalQuery('');
    setTimeout(() => {
      setShowSearch(true);
      setSearchQuery(result.message.slice(0, 30));
    }, 400);
  };

  // ── Cerere permisiune notificări browser ──────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Titlu tab cu număr mesaje necitite ────────────────────
  const originalTitle = useRef(document.title);
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ${originalTitle.current}`;
    } else {
      document.title = originalTitle.current;
    }
    return () => { document.title = originalTitle.current; };
  }, [totalUnread]);

  // ── Restaurare titlu la focus tab ─────────────────────────
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && totalUnread === 0) {
        document.title = originalTitle.current;
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [totalUnread]);

  // ── Trimitere notificare browser ──────────────────────────
  const sendBrowserNotif = (title, body, icon) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    // Fără restricție document.hidden — caller decide când trimite
    const n = new Notification(title, { body, icon: icon || '/favicon.ico', silent: false });
    n.onclick = () => { window.focus(); n.close(); };
  };

  // ── Load initial data + socket listeners ──────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, onlineRes, unreadRes, lastRes, groupsRes, groupUnreadRes] = await Promise.all([
          axios.get('/api/chat/users', { headers }),
          axios.get('/api/chat/online', { headers }),
          axios.get('/api/chat/unread', { headers }),
          axios.get('/api/chat/last-messages', { headers }),
          axios.get('/api/chat/groups', { headers }),
          axios.get('/api/chat/groups/unread', { headers }),
        ]);
        setOrgUsers(usersRes.data);
        setOnlineUsers(onlineRes.data);
        setUnreadCounts(unreadRes.data);
        setLastMessages(lastRes.data);
        setGroups(groupsRes.data);
        setGroupUnread(groupUnreadRes.data);
        const readsMap = {};
        groupsRes.data.forEach(g => {
          if (g.memberReads) {
            readsMap[g.id] = {};
            g.memberReads.forEach(r => { readsMap[g.id][r.username] = r.last_read_at; });
          }
        });
        setMemberReads(readsMap);
        const privTotal  = Object.values(unreadRes.data).reduce((a, b) => a + b, 0);
        const groupTotal = Object.values(groupUnreadRes.data).reduce((a, b) => a + b, 0);
        setTotalUnread(privTotal + groupTotal);
      } catch {}
    };
    load();

    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const isMine    = msg.username === user.username;
      const peerOfMsg = isMine ? msg.receiver_username : msg.username;
      setConversations(prev =>
        prev[peerOfMsg] ? { ...prev, [peerOfMsg]: [...prev[peerOfMsg], msg] } : prev
      );
      setLastMessages(prev => ({
        ...prev,
        [peerOfMsg]: { sender: msg.username, message: msg.message, created_at: msg.created_at },
      }));
      if (!isMine) {
        const chatOpen = (openRef.current || currentPageRef.current === 'chat') && peerRef.current?.username === peerOfMsg;
        // "Activ în pagină" = chat-ul e deschis + tabul e vizibil + utilizatorul e pe pagina /chat
        const activelyViewing = chatOpen && document.visibilityState === 'visible' && currentPageRef.current === 'chat';
        const isMuted  = mutedRef.current.dm.includes(peerOfMsg);
        if (activelyViewing) {
          // Utilizatorul vede conversația în timp real — marchează citit, fără sunet
          axios.put(`/api/chat/read/${peerOfMsg}`, {}, { headers }).catch(() => {});
        } else {
          // Alt tab activ, altă pagină sau fundal → sună
          if (!isMuted) {
            isTripOrderMsg(msg) ? playTripOrderReceived() : playReceived();
          }
          if (!chatOpen && !isMuted) {
            // Chat-ul nu e deschis deloc → crește și contorul necitite
            setUnreadCounts(prev => ({ ...prev, [peerOfMsg]: (prev[peerOfMsg] || 0) + 1 }));
          }
        }
        if (!isMuted && !activelyViewing) {
          const preview = isTripOrderMsg(msg) ? '📦 Comandă de transport' : (msg.message?.slice(0, 80) || '');
          sendBrowserNotif(`Mesaj de la ${peerOfMsg}`, preview);
        }
      }
    };

    const handleNewGroupMessage = (msg) => {
      const gId = msg.group_id;
      setGroupMessages(prev => prev[gId] ? { ...prev, [gId]: [...prev[gId], msg] } : prev);
      setGroups(prev => prev.map(g =>
        g.id === gId
          ? { ...g, _lastMsg: { sender: msg.username, message: msg.message, created_at: msg.created_at } }
          : g
      ));
      const chatOpenGrp = (openRef.current || currentPageRef.current === 'chat') && activeGroupRef.current?.id === gId;
      const activelyViewingGrp = chatOpenGrp && document.visibilityState === 'visible' && currentPageRef.current === 'chat';
      const isMuted = mutedRef.current.group.includes(gId);
      if (msg.username !== user.username && msg.message_type !== 'system') {
        if (activelyViewingGrp) {
          // Utilizatorul vede grupul în timp real — marchează citit, fără sunet
          axios.put(`/api/chat/groups/${gId}/read`, {}, { headers }).catch(() => {});
        } else {
          // Alt tab activ, altă pagină sau fundal → sună
          if (!isMuted) {
            isTripOrderMsg(msg) ? playTripOrderReceived() : playReceived();
          }
          if (!chatOpenGrp && !isMuted) {
            setGroupUnread(prev => ({ ...prev, [gId]: (prev[gId] || 0) + 1 }));
          }
          if (!isMuted) {
            const grpName = groups.find(g => g.id === gId)?.name || 'Grup';
            const preview = isTripOrderMsg(msg) ? '📦 Comandă de transport' : (msg.message?.slice(0, 80) || '');
            sendBrowserNotif(`${msg.username} în ${grpName}`, preview);
          }
        }
      }
    };

    const handleUsersOnline     = (list) => setOnlineUsers(list);
    const handlePeerRead        = ({ reader, last_read_at }) => {
      if (reader === peerRef.current?.username) setPeerReadAt(last_read_at);
    };
    const handleGroupReadUpdate = ({ groupId, username, lastReadAt }) => {
      setMemberReads(prev => ({
        ...prev,
        [groupId]: { ...(prev[groupId] || {}), [username]: lastReadAt }
      }));
    };
    const handleGroupRenamed    = ({ id, name }) => {
      setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
      setActiveGroup(prev => prev?.id === id ? { ...prev, name } : prev);
    };
    const handleGroupCreated    = (g) => {
      setGroups(prev => prev.some(x => x.id === g.id) ? prev : [g, ...prev]);
      const s = getSocket(); if (s) s.emit('join_group', g.id);
    };
    const handleGroupDeleted    = ({ id }) => {
      setGroups(prev => prev.filter(g => g.id !== id));
      setGroupMessages(prev => { const n = { ...prev }; delete n[id]; return n; });
      setGroupUnread(prev => { const n = { ...prev }; delete n[id]; return n; });
      setMemberReads(prev => { const n = { ...prev }; delete n[id]; return n; });
      if (activeGroupRef.current?.id === id) { setView('contacts'); setActiveGroup(null); }
    };
    const handleGroupUpdated    = ({ id, members }) => {
      setGroups(prev => prev.map(g => g.id === id ? { ...g, members } : g));
      if (activeGroupRef.current?.id === id) setActiveGroup(prev => prev ? { ...prev, members } : prev);
    };
    const handleGroupMemberAdded = ({ groupId }) => {
      axios.get('/api/chat/groups', { headers }).then(r => {
        setGroups(r.data);
        const rm = {};
        r.data.forEach(g => {
          if (g.memberReads) { rm[g.id] = {}; g.memberReads.forEach(rr => { rm[g.id][rr.username] = rr.last_read_at; }); }
        });
        setMemberReads(rm);
      }).catch(() => {});
      const s = getSocket(); if (s) s.emit('join_group', groupId);
    };
    const handleGroupMemberRemoved = ({ groupId }) => {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      setGroupMessages(prev => { const n = { ...prev }; delete n[groupId]; return n; });
      setGroupUnread(prev => { const n = { ...prev }; delete n[groupId]; return n; });
      setMemberReads(prev => { const n = { ...prev }; delete n[groupId]; return n; });
      if (activeGroupRef.current?.id === groupId) { setView('contacts'); setActiveGroup(null); }
    };

    const handleUserTyping = ({ username: typingUsername, to, groupId }) => {
      if (typingUsername === user.username) return;
      const key = groupId ? `group_${groupId}` : `dm_${typingUsername}`;
      setTypingUsers(prev => ({ ...prev, [key]: typingUsername }));
      clearTimeout(typingTimers.current[key]);
      typingTimers.current[key] = setTimeout(() => {
        setTypingUsers(prev => { const n = { ...prev }; delete n[key]; return n; });
      }, 3000);
    };

    const handleMsgEdited = (msg) => {
      const peerUn = msg.username === user.username ? msg.receiver_username : msg.username;
      setConversations(prev => prev[peerUn]
        ? { ...prev, [peerUn]: prev[peerUn].map(m => m.id === msg.id ? msg : m) }
        : prev);
    };
    const handleMsgDeleted = ({ id, username: msgUser, receiver_username }) => {
      const peerUn = msgUser === user.username ? receiver_username : msgUser;
      setConversations(prev => prev[peerUn]
        ? { ...prev, [peerUn]: prev[peerUn].map(m => m.id === id ? { ...m, is_deleted: true } : m) }
        : prev);
    };
    const handleGroupMsgEdited = (msg) => {
      setGroupMessages(prev => prev[msg.group_id]
        ? { ...prev, [msg.group_id]: prev[msg.group_id].map(m => m.id === msg.id ? msg : m) }
        : prev);
    };
    const handleGroupMsgDeleted = ({ id, group_id }) => {
      setGroupMessages(prev => prev[group_id]
        ? { ...prev, [group_id]: prev[group_id].map(m => m.id === id ? { ...m, is_deleted: true } : m) }
        : prev);
    };

    socket.on('new_private_message',  handleNewMessage);
    socket.on('new_group_message',    handleNewGroupMessage);
    socket.on('users_online',         handleUsersOnline);
    socket.on('peer_read',            handlePeerRead);
    socket.on('group_read_update',    handleGroupReadUpdate);
    socket.on('group_renamed',        handleGroupRenamed);
    socket.on('group_created',        handleGroupCreated);
    socket.on('group_deleted',        handleGroupDeleted);
    socket.on('group_updated',        handleGroupUpdated);
    socket.on('group_member_added',   handleGroupMemberAdded);
    socket.on('group_member_removed', handleGroupMemberRemoved);
    socket.on('user_typing',          handleUserTyping);
    const handlePinNotification = ({ text, context, peer1, peer2, groupId }) => {
      const me = user.username;
      const isRelevant =
        (context === 'dm' && (peer1 === me || peer2 === me)) ||
        (context === 'group');
      if (!isRelevant) return;
      if (context === 'group' && activeGroupRef.current?.id !== groupId) return;
      if (context === 'dm' && peerRef.current?.username !== (peer1 === me ? peer2 : peer1)) return;
      clearTimeout(pinNotifTimer.current);
      setPinNotification(text);
      pinNotifTimer.current = setTimeout(() => setPinNotification(null), 3500);
    };

    const handleTripOrderUpdated = (msg) => {
      const peerUn = msg.username === user.username ? msg.receiver_username : msg.username;
      setConversations(prev => prev[peerUn]
        ? { ...prev, [peerUn]: prev[peerUn].map(m => m.id === msg.id ? { ...m, trip_order_status: msg.trip_order_status } : m) }
        : prev);
      if (msg.trip_order_status === 'accepted') playTripOrderAccepted();
      else if (msg.trip_order_status === 'rejected') playTripOrderRejected();
    };
    const handleGroupTripOrderUpdated = (msg) => {
      setGroupMessages(prev => prev[msg.group_id]
        ? { ...prev, [msg.group_id]: prev[msg.group_id].map(m => m.id === msg.id ? { ...m, trip_order_status: msg.trip_order_status } : m) }
        : prev);
      if (msg.trip_order_status === 'accepted') playTripOrderAccepted();
      else if (msg.trip_order_status === 'rejected') playTripOrderRejected();
    };

    socket.on('message_edited',            handleMsgEdited);
    socket.on('message_deleted',           handleMsgDeleted);
    socket.on('group_message_edited',      handleGroupMsgEdited);
    socket.on('group_message_deleted',     handleGroupMsgDeleted);
    socket.on('pin_notification',          handlePinNotification);
    socket.on('trip_order_updated',        handleTripOrderUpdated);
    socket.on('group_trip_order_updated',  handleGroupTripOrderUpdated);

    return () => {
      socket.off('new_private_message',  handleNewMessage);
      socket.off('new_group_message',    handleNewGroupMessage);
      socket.off('users_online',         handleUsersOnline);
      socket.off('peer_read',            handlePeerRead);
      socket.off('group_read_update',    handleGroupReadUpdate);
      socket.off('group_renamed',        handleGroupRenamed);
      socket.off('group_created',        handleGroupCreated);
      socket.off('group_deleted',        handleGroupDeleted);
      socket.off('group_updated',        handleGroupUpdated);
      socket.off('group_member_added',   handleGroupMemberAdded);
      socket.off('group_member_removed', handleGroupMemberRemoved);
      socket.off('user_typing',          handleUserTyping);
      socket.off('message_edited',            handleMsgEdited);
      socket.off('message_deleted',           handleMsgDeleted);
      socket.off('group_message_edited',      handleGroupMsgEdited);
      socket.off('group_message_deleted',     handleGroupMsgDeleted);
      socket.off('pin_notification',          handlePinNotification);
      socket.off('trip_order_updated',        handleTripOrderUpdated);
      socket.off('group_trip_order_updated',  handleGroupTripOrderUpdated);
    };
  }, []);

  // Request fresh online list after listeners are registered
  useEffect(() => {
    const socket = getSocket();
    if (socket?.connected) socket.emit('get_online_users');
    else if (socket) socket.once('connect', () => socket.emit('get_online_users'));
  }, []);

  // Ghost unread fix — refresh counts each time panel opens
  useEffect(() => {
    if (!open) return;
    Promise.all([
      axios.get('/api/chat/unread', { headers }),
      axios.get('/api/chat/groups/unread', { headers }),
    ]).then(([u, g]) => { setUnreadCounts(u.data); setGroupUnread(g.data); }).catch(() => {});
  }, [open]);

  useEffect(() => { openRef.current = !!peer || !!activeGroup; }, [peer, activeGroup]);
  useEffect(() => { peerRef.current = peer; }, [peer]);
  useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Update pinned message whenever the active message list changes
  useEffect(() => {
    if (peer) {
      const msgs = conversations[peer.username] || [];
      setPinnedMsg(msgs.find(m => m.is_pinned) || null);
    } else if (activeGroup) {
      const msgs = groupMessages[activeGroup.id] || [];
      setPinnedMsg(msgs.find(m => m.is_pinned) || null);
    } else {
      setPinnedMsg(null);
    }
  }, [conversations, groupMessages, peer?.username, activeGroup?.id]);

  useEffect(() => {
    const pt = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    const gt = Object.values(groupUnread).reduce((a, b) => a + b, 0);
    setTotalUnread(pt + gt);
  }, [unreadCounts, groupUnread]);

  useEffect(() => {
    if (peer) messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [conversations]);

  useEffect(() => {
    if (activeGroup) messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [groupMessages]);

  // Auto-scroll when typing indicator appears (if already near bottom)
  useEffect(() => {
    const dmKey  = `dm_${peerRef.current?.username}`;
    const grpKey = `group_${activeGroupRef.current?.id}`;
    if (typingUsers[dmKey] || typingUsers[grpKey]) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [typingUsers]);

  useEffect(() => {
    if (peer || activeGroup) {
      requestAnimationFrame(() => { inputRef.current?.focus(); messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }); });
    }
    if (!peer && !activeGroup && view === 'contacts') requestAnimationFrame(() => searchRef.current?.focus());
    if (view === 'create-group') requestAnimationFrame(() => newGroupNameRef.current?.focus());
  }, [view, peer?.username, activeGroup?.id]);

  // ── Închide dropdown setări la click în afară ─────────────
  useEffect(() => {
    const handleOutside = (e) => {
      if (chatSettingsRef.current && !chatSettingsRef.current.contains(e.target)) {
        setShowChatSettings(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ── Mute helpers ──────────────────────────────────────────
  const toggleMuteDm = (username) => {
    setMuted(prev => {
      const already = prev.dm.includes(username);
      const next = { ...prev, dm: already ? prev.dm.filter(u => u !== username) : [...prev.dm, username] };
      mutedRef.current = next;
      localStorage.setItem(mutedKey, JSON.stringify(next));
      return next;
    });
  };
  const toggleMuteGroup = (gId) => {
    setMuted(prev => {
      const already = prev.group.includes(gId);
      const next = { ...prev, group: already ? prev.group.filter(id => id !== gId) : [...prev.group, gId] };
      mutedRef.current = next;
      localStorage.setItem(mutedKey, JSON.stringify(next));
      return next;
    });
  };

  // ── Actions ────────────────────────────────────────────────
  const handleClose = () => { setView('contacts'); setPeer(null); setActiveGroup(null); };

  const closeCard = (key) => {
    const card = openCards.find(c => c.key === key);
    setOpenCards(prev => prev.filter(c => c.key !== key));
    if (!card) return;
    if ((card.type === 'dm' && peer?.username === card.peer?.username) ||
        (card.type === 'group' && activeGroup?.id === card.group?.id)) {
      setPeer(null); setActiveGroup(null); setView('contacts');
      setInputVal(''); setReplyTo(null); setPinnedMsg(null);
    }
  };

  const minimizeCard = (key) => setOpenCards(prev => prev.map(c => c.key === key ? { ...c, minimized: !c.minimized } : c));

  const openConversation = async (u) => {
    const key = `dm_${u.username}`;
    if (currentPage !== 'chat') {
      setOpenCards(prev => prev.find(c => c.key === key)
        ? prev.map(c => c.key === key ? { ...c, minimized: false } : c)
        : [...prev, { key, type: 'dm', peer: u, minimized: false }]);
    }
    setSlideDir('right'); setPeer(u); setActiveGroup(null);
    setView(currentPage === 'chat' ? 'chat' : 'contacts');
    setPeerReadAt(null);
    setShowScrollBtn(false); setShowSearch(false); setSearchQuery(''); setEditingMsgId(null);
    const hasUnread = (unreadCounts[u.username] || 0) > 0;
    const fetchMsgs = !conversations[u.username]
      ? axios.get(`/api/chat/messages/${u.username}`, { headers })
      : Promise.resolve(null);
    const fetchPR = axios.get(`/api/chat/peer-read/${u.username}`, { headers });
    const [msgsRes, prRes] = await Promise.allSettled([fetchMsgs, fetchPR]);
    let msgs = null;
    if (msgsRes.status === 'fulfilled' && msgsRes.value) {
      msgs = msgsRes.value.data;
      setConversations(prev => ({ ...prev, [u.username]: msgs }));
    }
    if (prRes.status === 'fulfilled') setPeerReadAt(prRes.value.data?.last_read_at || null);
    if (hasUnread) {
      // găsim primul mesaj necitit (de la peer, după last_read_at)
      const readAt = prRes.status === 'fulfilled' ? prRes.value.data?.last_read_at : null;
      const allMsgs = msgs || conversations[u.username] || [];
      if (readAt) {
        const firstNew = allMsgs.find(m => m.username !== user.username && new Date(m.created_at) > new Date(readAt));
        setFirstUnreadId(firstNew?.id || null);
      } else {
        const firstOther = allMsgs.find(m => m.username !== user.username);
        setFirstUnreadId(firstOther?.id || null);
      }
      axios.put(`/api/chat/read/${u.username}`, {}, { headers }).catch(() => {});
      setUnreadCounts(prev => ({ ...prev, [u.username]: 0 }));
    } else {
      setFirstUnreadId(null);
    }
  };

  const openGroupConversation = async (g) => {
    const key = `group_${g.id}`;
    if (currentPage !== 'chat') {
      setOpenCards(prev => prev.find(c => c.key === key)
        ? prev.map(c => c.key === key ? { ...c, minimized: false } : c)
        : [...prev, { key, type: 'group', group: g, minimized: false }]);
    }
    setSlideDir('right'); setPeer(null); setActiveGroup(g);
    setView(currentPage === 'chat' ? 'group-chat' : 'contacts');
    setShowScrollBtn(false); setShowSearch(false); setSearchQuery(''); setEditingMsgId(null);
    const hasUnread = (groupUnread[g.id] || 0) > 0;
    let msgs = groupMessages[g.id] || null;
    if (!msgs) {
      try {
        const res = await axios.get(`/api/chat/groups/${g.id}/messages`, { headers });
        msgs = res.data;
        setGroupMessages(prev => ({ ...prev, [g.id]: msgs }));
      } catch {}
    }
    if (hasUnread) {
      const myRead = memberReads[g.id]?.[user.username];
      if (myRead && msgs) {
        const firstNew = msgs.find(m => m.username !== user.username && m.message_type !== 'system' && new Date(m.created_at) > new Date(myRead));
        setFirstUnreadId(firstNew?.id || null);
      } else {
        setFirstUnreadId(null);
      }
      axios.put(`/api/chat/groups/${g.id}/read`, {}, { headers }).catch(() => {});
      setGroupUnread(prev => ({ ...prev, [g.id]: 0 }));
      const now = new Date().toISOString();
      setMemberReads(prev => ({ ...prev, [g.id]: { ...(prev[g.id] || {}), [user.username]: now } }));
    } else {
      setFirstUnreadId(null);
    }
  };

  const goBack = () => {
    setSlideDir('left');
    if (view === 'group-add-members') {
      setView('group-members');
    } else {
      setView('contacts');
    }
  };

  const handleInputChange = (val) => {
    setInputVal(val);
    const cursorPos = inputRef.current?.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const query = atMatch[1].toLowerCase();
      let available = [];
      if (activeGroup)
        available = (activeGroup.members || []).filter(u => u !== user.username);
      else if (peer)
        available = [peer.username];
      const filtered = available.filter(u => u.toLowerCase().startsWith(query));
      if (filtered.length > 0) {
        setMentionQuery(query); setMentionUsers(filtered);
        setMentionHighlight(0); setMentionAtIdx(cursorPos - atMatch[0].length);
      } else { setMentionQuery(null); }
    } else { setMentionQuery(null); }
    // Emit typing indicator
    const socket = getSocket();
    if (socket) {
      if (val.trim()) {
        if (activeGroup) {
          socket.emit('typing', { groupId: activeGroup.id });
        } else if (peer) {
          socket.emit('typing', { to: peer.username });
        }
      }
      // Emit stop_typing după 2s de pauză (sau imediat dacă input e gol)
      if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
      const delay = val.trim() ? 2000 : 0;
      stopTypingTimer.current = setTimeout(() => {
        if (activeGroup) {
          socket.emit('stop_typing', { groupId: activeGroup.id });
        } else if (peer) {
          socket.emit('stop_typing', { to: peer.username });
        }
      }, delay);
    }
  };

  const insertMention = (username) => {
    const before = inputVal.slice(0, mentionAtIdx);
    const after  = inputVal.slice(mentionAtIdx + 1 + (mentionQuery?.length || 0));
    const newVal = before + '@' + username + ' ' + after;
    setInputVal(newVal); setMentionQuery(null);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const pos = before.length + username.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const sendMessage = async () => {
    const msg = inputVal.trim();
    if (!msg) return;
    setInputVal(''); setMentionQuery(null);
    // Stop typing imediat la trimitere
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    const socket = getSocket();
    if (socket) {
      if (activeGroup) socket.emit('stop_typing', { groupId: activeGroup.id });
      else if (peer) socket.emit('stop_typing', { to: peer.username });
    }
    if (activeGroup) {
      try {
        await axios.post(`/api/chat/groups/${activeGroup.id}/messages`, {
          message: msg,
          reply_to_id: replyTo?.id || null,
          reply_to_text: replyTo?.text || null,
          reply_to_username: replyTo?.username || null,
        }, { headers });
        playSent();
      } catch {}
    } else if (peer) {
      try {
        await axios.post('/api/chat/messages', {
          to: peer.username,
          message: msg,
          reply_to_id: replyTo?.id || null,
          reply_to_text: replyTo?.text || null,
          reply_to_username: replyTo?.username || null,
        }, { headers });
        playSent();
      } catch {}
    }
    setReplyTo(null);
  };

  const sendImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(',')[1];
      const imgType = file.type;
      const payload = {
        message: file.name || 'imagine.png',
        image_data: base64,
        image_type: imgType,
        reply_to_id: replyTo?.id || null,
        reply_to_text: replyTo?.text || null,
        reply_to_username: replyTo?.username || null,
      };
      try {
        if (activeGroup) {
          await axios.post(`/api/chat/groups/${activeGroup.id}/messages`, payload, { headers });
        } else if (peer) {
          await axios.post('/api/chat/messages', { to: peer.username, ...payload }, { headers });
        }
        playSent();
        setReplyTo(null);
      } catch { showChatToast('Eroare la trimiterea imaginii', 'error'); }
    };
    reader.readAsDataURL(file);
  };

  const sendTripOrder = async ({ order_number, truck, payment_terms, doc_type, file_name, file_data, file_type, to_user }) => {
    if (peer) {
      await axios.post('/api/chat/trip-order', { to: peer.username, order_number, truck, payment_terms, doc_type, file_name, file_data, file_type }, { headers });
      playSent();
    } else if (activeGroup) {
      if (to_user) {
        // Send as DM to specific group member
        await axios.post('/api/chat/trip-order', { to: to_user, order_number, truck, payment_terms, doc_type, file_name, file_data, file_type }, { headers });
      } else {
        await axios.post('/api/chat/trip-order', { group_id: activeGroup.id, order_number, truck, payment_terms, doc_type, file_name, file_data, file_type }, { headers });
      }
      playSent();
    }
  };

  const handleTripOrderRespond = async (msg, status) => {
    try {
      if (msg.group_id) {
        await axios.put(`/api/chat/groups/${msg.group_id}/messages/${msg.id}/trip-order-respond`, { status }, { headers });
      } else {
        await axios.put(`/api/chat/messages/${msg.id}/trip-order-respond`, { status }, { headers });
      }
    } catch {}
  };

  const handlePin = async (msg) => {
    const isPinned = !msg.is_pinned;
    try {
      if (activeGroup) {
        await axios.put(`/api/chat/groups/${activeGroup.id}/messages/${msg.id}/pin`, { is_pinned: isPinned }, { headers });
        setGroupMessages(prev => {
          const gId = activeGroup.id;
          const updated = (prev[gId] || []).map(m => m.id === msg.id ? { ...m, is_pinned: isPinned, pinned_by: isPinned ? user.username : null } : (isPinned ? { ...m, is_pinned: false, pinned_by: null } : m));
          return { ...prev, [gId]: updated };
        });
      } else if (peer) {
        await axios.put(`/api/chat/messages/${msg.id}/pin`, { is_pinned: isPinned }, { headers });
        setConversations(prev => {
          const peerUn = peer.username;
          const updated = (prev[peerUn] || []).map(m => m.id === msg.id ? { ...m, is_pinned: isPinned, pinned_by: isPinned ? user.username : null } : (isPinned ? { ...m, is_pinned: false, pinned_by: null } : m));
          return { ...prev, [peerUn]: updated };
        });
      }
    } catch {}
  };

  const handleUnpin = (msg) => handlePin({ ...msg, is_pinned: true });

  const scrollToPinned = () => {
    if (!pinnedMsg) return;
    const el = document.getElementById(`msg-${pinnedMsg.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    clearTimeout(highlightTimer.current);
    setHighlightedMsgId(pinnedMsg.id);
    highlightTimer.current = setTimeout(() => setHighlightedMsgId(null), 1600);
  };

  const handleMsgsScroll = (e) => {
    const el = e.currentTarget;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 80);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startEdit = (msg) => { setEditingMsgId(msg.id); setEditingText(msg.message); };
  const cancelEdit = () => { setEditingMsgId(null); setEditingText(''); };

  const submitEdit = async (msg) => {
    if (!editingText.trim() || editingText.trim() === msg.message) { cancelEdit(); return; }
    try {
      if (activeGroup) {
        await axios.put(`/api/chat/groups/${activeGroup.id}/messages/${msg.id}`, { message: editingText.trim() }, { headers });
      } else if (peer) {
        await axios.put(`/api/chat/messages/${msg.id}`, { message: editingText.trim() }, { headers });
      }
    } catch {}
    cancelEdit();
  };

  const showChatToast = (message, type = 'success') => {
    setChatToast({ message, type });
    setTimeout(() => setChatToast(null), 3000);
  };

  const changeFontSize = (delta) => {
    setChatFontSize(prev => {
      const next = Math.max(11, Math.min(20, prev + delta));
      localStorage.setItem('chat_font_size', String(next));
      return next;
    });
  };

  const deleteMsg = (msg) => {
    setDeleteConfirm(msg);
  };

  const confirmDeleteMsg = async () => {
    const msg = deleteConfirm;
    setDeleteConfirm(null);
    try {
      if (activeGroup) {
        await axios.delete(`/api/chat/groups/${activeGroup.id}/messages/${msg.id}`, { headers });
      } else if (peer) {
        await axios.delete(`/api/chat/messages/${msg.id}`, { headers });
      }
      showChatToast('Mesaj șters');
    } catch {
      showChatToast('Eroare la ștergerea mesajului', 'error');
    }
  };

  const toggleSearch = () => {
    setShowSearch(s => { if (s) { setSearchQuery(''); setSearchIdx(0); } return !s; });
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const searchMatches = (() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const list = peer ? messages : groupMsgs;
    return list.reduce((acc, msg, i) => {
      if (!msg.is_deleted && msg.message?.toLowerCase().includes(q)) acc.push(i);
      return acc;
    }, []);
  })();

  const navigateSearch = (dir) => {
    if (!searchMatches.length) return;
    const next = (searchIdx + dir + searchMatches.length) % searchMatches.length;
    setSearchIdx(next);
    const list = peer ? messages : groupMsgs;
    const msgId = list[searchMatches[next]]?.id;
    if (msgId) {
      const el = document.getElementById(`msg-${msgId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const applyFormat = (marker) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const val   = inputVal;
    const selected = val.slice(start, end);
    const newVal = val.slice(0, start) + marker + selected + marker + val.slice(end);
    setInputVal(newVal);
    requestAnimationFrame(() => {
      el.focus();
      if (selected.length > 0) {
        el.setSelectionRange(start + marker.length, end + marker.length);
      } else {
        el.setSelectionRange(start + marker.length, start + marker.length);
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'b') { e.preventDefault(); applyFormat('*'); return; }
    if (e.ctrlKey && e.key === 'i') { e.preventDefault(); applyFormat('_'); return; }
    if (mentionQuery !== null && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionHighlight(h => Math.min(h + 1, mentionUsers.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionHighlight(h => Math.max(h - 1, 0)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); insertMention(mentionUsers[mentionHighlight]); return; }
      if (e.key === 'Escape')    { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Group actions ──────────────────────────────────────────
  const openCreateGroup = () => { setNewGroupName(''); setNewGroupMembers([]); setSlideDir('right'); setView('create-group'); };
  const toggleCreateMember = (uname) => setNewGroupMembers(prev => prev.includes(uname) ? prev.filter(m => m !== uname) : [...prev, uname]);

  const submitCreateGroup = async () => {
    if (!newGroupName.trim() || newGroupMembers.length === 0) return;
    setGroupSaving(true);
    try {
      const res = await axios.post('/api/chat/groups', { name: newGroupName.trim(), members: newGroupMembers }, { headers });
      setGroups(prev => prev.some(g => g.id === res.data.id) ? prev : [res.data, ...prev]);
      setView('contacts');
    } catch (e) { alert(e.response?.data?.error || 'Eroare la creare grup'); }
    finally { setGroupSaving(false); }
  };

  const openGroupMembers = () => {
    setEditGroupMembers(activeGroup?.members || []);
    setEditGroupName(activeGroup?.name || '');
    setSlideDir('right'); setView('group-members');
  };
  const toggleEditMember = (uname) => setEditGroupMembers(prev => prev.includes(uname) ? prev.filter(m => m !== uname) : [...prev, uname]);

  const submitEditMembers = async () => {
    if (!activeGroup) return;
    setGroupSaving(true);
    try {
      const nameChanged = editGroupName.trim() && editGroupName.trim() !== activeGroup.name;
      const tasks = [axios.put(`/api/chat/groups/${activeGroup.id}/members`, { members: editGroupMembers }, { headers })];
      if (nameChanged) tasks.push(axios.put(`/api/chat/groups/${activeGroup.id}/name`, { name: editGroupName.trim() }, { headers }));
      const [membersRes] = await Promise.all(tasks);
      setActiveGroup(prev => prev ? { ...prev, members: membersRes.data.members } : prev);
      setView('group-chat');
    } catch (e) { alert(e.response?.data?.error || 'Eroare la actualizare'); }
    finally { setGroupSaving(false); }
  };

  const deleteGroup = async () => {
    if (!activeGroup) return;
    if (!window.confirm(`Ștergi grupul „${activeGroup.name}"? Toate mesajele vor fi pierdute.`)) return;
    try {
      await axios.delete(`/api/chat/groups/${activeGroup.id}`, { headers });
      setView('contacts'); setActiveGroup(null);
    } catch (e) { alert(e.response?.data?.error || 'Eroare la ștergere'); }
  };

  const removeMember = async (uname) => {
    if (!activeGroup) return;
    const newMembers = (activeGroup.members || []).filter(m => m !== uname);
    try {
      const res = await axios.put(`/api/chat/groups/${activeGroup.id}/members`, { members: newMembers }, { headers });
      setActiveGroup(prev => prev ? { ...prev, members: res.data.members } : prev);
    } catch (e) { alert(e.response?.data?.error || 'Eroare'); }
    setMemberMenuOpen(null);
  };

  const openAddMembers = () => {
    setAddMemberSel([]);
    setSlideDir('right');
    setView('group-add-members');
  };

  const submitAddMembers = async () => {
    if (!activeGroup || addMemberSel.length === 0) return;
    const newMembers = [...new Set([...(activeGroup.members || []), ...addMemberSel])];
    setGroupSaving(true);
    try {
      const res = await axios.put(`/api/chat/groups/${activeGroup.id}/members`, { members: newMembers }, { headers });
      setActiveGroup(prev => prev ? { ...prev, members: res.data.members } : prev);
      setSlideDir('left');
      setView('group-members');
    } catch (e) { alert(e.response?.data?.error || 'Eroare'); }
    finally { setGroupSaving(false); }
  };

  const submitRenameGroup = async () => {
    const trimmed = editGroupName.trim();
    setGroupRenaming(false);
    if (!activeGroup || !trimmed || trimmed === activeGroup.name) return;
    try {
      await axios.put(`/api/chat/groups/${activeGroup.id}/name`, { name: trimmed }, { headers });
      setActiveGroup(prev => prev ? { ...prev, name: trimmed } : prev);
    } catch (e) { alert(e.response?.data?.error || 'Eroare redenumire'); }
  };

  const toggleDm   = () => { const n = !dmCollapsed;   setDmCollapsed(n);   localStorage.setItem('chat_dm_collapsed', n); };
  const toggleGrps = () => { const n = !grpsCollapsed; setGrpsCollapsed(n); localStorage.setItem('chat_grps_collapsed', n); };

  // ── Helpers ────────────────────────────────────────────────
  const isOnline = (uname) => onlineUsers.includes(uname);
  const isRead   = (msg)   => peerReadAt && new Date(peerReadAt) >= new Date(msg.created_at);

  const sortedUsers = [...orgUsers].sort((a, b) => {
    const ao = isOnline(a.username), bo = isOnline(b.username);
    if (ao && !bo) return -1; if (!ao && bo) return 1;
    const al = lastMessages[a.username]?.created_at || '';
    const bl = lastMessages[b.username]?.created_at || '';
    if (al > bl) return -1; if (bl > al) return 1;
    return a.username.localeCompare(b.username);
  });
  const filteredUsers  = search.trim()
    ? sortedUsers.filter(u => {
        const q = search.trim().toLowerCase();
        return u.username.toLowerCase().includes(q) ||
          (u.first_name || '').toLowerCase().includes(q) ||
          (u.last_name || '').toLowerCase().includes(q);
      })
    : sortedUsers;
  const filteredGroups = search.trim() ? groups.filter(g => g.name.toLowerCase().includes(search.trim().toLowerCase())) : groups;
  const messages  = (peer && conversations[peer.username]) || [];
  const groupMsgs = (activeGroup && groupMessages[activeGroup.id]) || [];

  // ── Shared helpers ──────────────────────────────────────────
  const msgActionBtns = (msg, isDm) => (
    <div style={{ display: 'flex', gap: 2, opacity: hoveredMsgId === msg.id && editingMsgId !== msg.id ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: hoveredMsgId === msg.id && editingMsgId !== msg.id ? 'auto' : 'none' }}>
      <button onClick={() => setReplyTo({ id: msg.id, text: isTripOrderMsg(msg) ? (() => { try { const d = JSON.parse(msg.message); return `📦 Comandă de transport${d.order_number ? ` #${d.order_number}` : ''}${d.truck ? ` • ${d.truck}` : ''}`; } catch { return '📦 Comandă de transport'; } })() : msg.message, username: msg.username })} title="Răspunde"
        style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', transition: 'all 0.12s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
      </button>
      <button onClick={() => handlePin(msg)} title={msg.is_pinned ? 'Desprinde' : 'Prinde'}
        style={{ background: 'var(--surface)', border: `1px solid ${msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'}`, borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)', display: 'flex', alignItems: 'center', transition: 'all 0.12s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)'; e.currentTarget.style.borderColor = msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'; }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
      </button>
      {msg.username === user.username && <>
        {Date.now() - new Date(msg.created_at).getTime() <= EDIT_LIMIT_MS && (
          <button onClick={() => startEdit(msg)} title="Editează"
            style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
        {canChat('chatDeleteMessage') && (
          <button onClick={() => deleteMsg(msg)} title="Șterge"
            style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        )}
      </>}
    </div>
  );

  const renderMsgBubble = (msg) => {
    const isMe = msg.username === user.username;
    const isEditing = editingMsgId === msg.id;
    if (msg.is_deleted) return <div style={{ fontSize: 13, color: 'var(--gray-4)', fontStyle: 'italic', padding: '6px 10px', border: '1px solid var(--gray-2)', borderRadius: 10 }}>Mesaj șters</div>;
    if (isTripOrderMsg(msg)) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexDirection: isMe ? 'row' : 'row-reverse' }}>
        {msgActionBtns(msg)}
        <TripOrderCard msg={msg} currentUser={user.username} onRespond={(status) => handleTripOrderRespond(msg, status)} />
      </div>
    );
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexDirection: isMe ? 'row' : 'row-reverse', maxWidth: '75%', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
        {msgActionBtns(msg)}
        {isEditing ? (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <textarea value={editingText} onChange={e => setEditingText(e.target.value)} autoFocus rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg); } if (e.key === 'Escape') cancelEdit(); }}
              style={{ resize: 'none', border: '1.5px solid #ff7a3d', borderRadius: 10, padding: '7px 10px', fontSize: 14, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, minWidth: 160 }}
            />
            <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
              <button onClick={cancelEdit} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--gray-3)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--gray-4)' }}>Anulează</button>
              <button onClick={() => submitEdit(msg)} style={{ fontSize: 11, padding: '3px 8px', border: 'none', borderRadius: 6, background: '#ff7a3d', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Salvează</button>
            </div>
          </div>
        ) : isImageMsg(msg) ? (
          <div style={{ padding: 4, borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', overflow: 'hidden', cursor: 'pointer' }}
            onClick={() => setLightboxSrc(`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`)}>
            {msg.reply_to_id && (
              <div style={{ fontSize: 11, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', padding: '3px 6px', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'rgba(255,122,61,0.08)', borderRadius: '0 4px 4px 0' }}>
                <span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}
              </div>
            )}
            <img src={`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`}
              alt={msg.message || 'imagine'}
              style={{ display: 'block', maxWidth: 220, maxHeight: 200, borderRadius: 10, objectFit: 'cover' }}
            />
          </div>
        ) : (
          <div style={{ padding: '8px 12px', borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', color: isMe ? 'var(--chat-sent-text)' : 'var(--chat-recv-text)', fontSize: chatFontSize, lineHeight: 1.45, wordBreak: 'break-word' }}>
            {msg.reply_to_id && (
              <div onClick={() => {
                const el = document.getElementById(`msg-${msg.reply_to_id}`);
                if (!el) return;
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                clearTimeout(highlightTimer.current);
                setHighlightedMsgId(msg.reply_to_id);
                highlightTimer.current = setTimeout(() => setHighlightedMsgId(null), 1600);
              }} style={{ fontSize: 11, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', paddingLeft: 6, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', borderRadius: '0 4px 4px 0', padding: '3px 6px', background: 'rgba(255,122,61,0.08)' }}>
                <span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}
              </div>
            )}
            {renderMessageText(msg.message, user.username)}
            {msg.edited_at && <span style={{ fontSize: 10, opacity: 0.55, marginLeft: 6 }}>(editat)</span>}
          </div>
        )}
      </div>
    );
  };

  const renderConversation = (msgs, isDm) => (
    <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 4 }} onScroll={handleMsgsScroll}>
      {msgs.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, marginTop: 70, lineHeight: 1.8 }}>
          {isDm ? <>Niciun mesaj cu {dn(peer?.username)}.<br/><span style={{ fontSize: 20 }}>👋</span></> : <>Niciun mesaj în „{activeGroup?.name}".<br/><span style={{ fontSize: 20 }}>💬</span></>}
        </div>
      )}
      {msgs.map((msg, i) => {
        if (!isDm && msg.message_type === 'system') return (
          <div key={msg.id || `sys-${i}`} style={{ textAlign: 'center', padding: '6px 14px' }}>
            <span style={{ fontSize: 11, color: 'var(--gray-4)', fontStyle: 'italic', background: 'var(--gray-1)', borderRadius: 10, padding: '3px 10px' }}>{msg.message}</span>
          </div>
        );
        const isMe = msg.username === user.username;
        const nextMsg = msgs[i + 1];
        const prevMsg = msgs[i - 1];
        const nextSame = nextMsg && nextMsg.message_type !== 'system' && nextMsg.username === msg.username;
        const prevSame = !isDm && prevMsg && prevMsg.message_type !== 'system' && prevMsg.username === msg.username;
        const seenBy = !isDm ? getSeenBy(i, msgs, memberReads[activeGroup?.id], user.username) : [];
        const isSearchMatch = searchQuery.trim() && !msg.is_deleted && msg.message?.toLowerCase().includes(searchQuery.toLowerCase());
        const isCurrentSearchMatch = isSearchMatch && searchMatches[searchIdx] === i;
        return (
          <div key={msg.id}>
            {msg.id === firstUnreadId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#ff7a3d', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>MESAJE NOI</span>
                <div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/>
              </div>
            )}
            <div id={`msg-${msg.id}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4, borderRadius: 10, animation: highlightedMsgId === msg.id ? 'msgHighlight 1.6s ease forwards' : 'none', padding: '2px 4px', outline: isCurrentSearchMatch ? '2px solid #ff7a3d' : isSearchMatch ? '1px solid rgba(255,122,61,0.4)' : 'none', outlineOffset: 2 }}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => setHoveredMsgId(null)}>
              {!isDm && !isMe && !prevSame && !msg.is_deleted && (
                <div style={{ fontSize: 11, color: '#ff7a3d', marginBottom: 3, paddingLeft: 4, fontWeight: 600 }}>{dn(msg.username)}</div>
              )}
              {renderMsgBubble(msg)}
              {!nextSame && !msg.is_deleted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span>
                  {isDm && isMe && <span title={isRead(msg) ? 'Văzut' : 'Trimis'}>{isRead(msg) ? <SeenIcon /> : <SentIcon />}</span>}
                  {!isDm && seenBy.length > 0 && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      {seenBy.map(u => (
                        <div key={u} title={`Văzut de ${u}`} style={{ width: 14, height: 14, borderRadius: '50%', background: avatarColor(u), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 8, fontWeight: 700 }}>
                          {u.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {isDm && typingUsers[`dm_${peer?.username}`] && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', color: 'var(--gray-4)', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 3 }}>{[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gray-4)', animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite` }}/>)}</div>
          <span>{typingUsers[`dm_${peer?.username}`]} scrie...</span>
        </div>
      )}
      {!isDm && typingUsers[`group_${activeGroup?.id}`] && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', color: 'var(--gray-4)', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 3 }}>{[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gray-4)', animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite` }}/>)}</div>
          <span>{typingUsers[`group_${activeGroup?.id}`]} scrie...</span>
        </div>
      )}
      <div ref={messagesEndRef}/>
    </div>
  );

  // ── Full-page chat layout (pagina Mesaje) ─────────────────────────────
  if (currentPage === 'chat') {
    const isConvView = view === 'chat' || view === 'group-chat';
    return (
      <>
      <div style={{ display: 'flex', height: 'calc(100vh - 80px)', minHeight: 420, border: '1px solid var(--gray-2)', borderRadius: '12px 12px 14px 14px', overflow: 'hidden', marginTop: 8 }}>

        {/* ── LEFT SIDEBAR ─────────────────────────────── */}
        <div style={{ width: 300, borderRight: '1px solid var(--gray-2)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', flexShrink: 0 }}>
          {/* Header */}
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--gray-2)', flexShrink: 0 }}>
            {globalSearch ? (
              /* ── Global search mode ── */
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => { setGlobalSearch(false); setGlobalQuery(''); setGlobalResults({ dm: [], groups: [] }); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 2px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input ref={globalSearchRef} type="text" value={globalQuery} onChange={e => setGlobalQuery(e.target.value)}
                    placeholder="Caută în toate mesajele..."
                    autoFocus
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 28px 7px 28px', border: '1px solid #ff7a3d', borderRadius: 8, fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit' }}
                  />
                  {globalQuery && (
                    <button onClick={() => setGlobalQuery('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ── Normal mode ── */
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--black)' }}>Chat</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button onClick={() => { setGlobalSearch(true); setGlobalQuery(''); setGlobalResults({ dm: [], groups: [] }); setTimeout(() => globalSearchRef.current?.focus(), 50); }}
                      title="Caută în toate mesajele"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px 7px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                    </button>
                    {canChat('chatCreateGroup') && (
                      <button onClick={() => { setNewGroupName(''); setNewGroupMembers([]); setView('create-group'); }}
                        title="Grup nou"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px 7px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <line x1="19" y1="8" x2="19" y2="14"/>
                          <line x1="22" y1="11" x2="16" y2="11"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {/* Contact filter search */}
                <div style={{ position: 'relative' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Caută contact..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 30px 7px 28px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                    onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Contacts scroll / Global search results */}
          <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>

            {/* ── Global search results ── */}
            {globalSearch && (
              <div>
                {globalQuery.trim().length < 2 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-4)' }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <div style={{ fontSize: 13 }}>Scrie minim 2 caractere</div>
                  </div>
                ) : globalSearching ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-4)', fontSize: 13 }}>Se caută...</div>
                ) : globalResults.dm.length === 0 && globalResults.groups.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-4)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Niciun rezultat</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>pentru „{globalQuery}"</div>
                  </div>
                ) : (
                  <>
                    {globalResults.dm.length > 0 && (
                      <>
                        <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
                          Mesaje directe · {globalResults.dm.length}
                        </div>
                        {globalResults.dm.map(r => {
                          const peerU = orgUsers.find(u => u.username === r.peer);
                          return (
                            <div key={r.id} onClick={() => openGlobalResult(r)}
                              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 14px', cursor: 'pointer', transition: 'background 0.12s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                              <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(r.peer), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                                {(peerU?.first_name || r.peer).charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--black)' }}>{dn(r.peer)}</span>
                                  <span style={{ fontSize: 10, color: 'var(--gray-4)', flexShrink: 0, marginLeft: 6 }}>{formatTime(r.created_at)}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--gray-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.username === user.username && <span style={{ color: 'var(--gray-3)', marginRight: 3 }}>Tu:</span>}
                                  {highlightMatch(r.message, globalQuery)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                    {globalResults.groups.length > 0 && (
                      <>
                        <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)', marginTop: globalResults.dm.length > 0 ? 4 : 0 }}>
                          Grupuri · {globalResults.groups.length}
                        </div>
                        {globalResults.groups.map(r => (
                          <div key={r.id} onClick={() => openGlobalResult(r)}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 14px', cursor: 'pointer', transition: 'background 0.12s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: groupColor(r.group_name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                              <GroupIcon size={15} color="white" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--black)' }}>{r.group_name}</span>
                                <span style={{ fontSize: 10, color: 'var(--gray-4)', flexShrink: 0, marginLeft: 6 }}>{formatTime(r.created_at)}</span>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--gray-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ color: 'var(--gray-3)', marginRight: 3 }}>{r.username === user.username ? 'Tu' : r.username}:</span>
                                {highlightMatch(r.message, globalQuery)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Normal contacts list ── */}
            {!globalSearch && <>
            {/* DM section */}
            <div onClick={toggleDm}
              style={{ padding: '8px 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
                Directe {dmCollapsed && filteredUsers.length > 0 ? `(${filteredUsers.length})` : ''}
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2.5"
                style={{ transform: dmCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            <div style={{ overflow: 'hidden', maxHeight: dmCollapsed ? '0px' : '2000px', opacity: dmCollapsed ? 0 : 1, transition: 'max-height 0.32s ease, opacity 0.22s ease' }}>
            {filteredUsers.map(u => {
              const last = lastMessages[u.username], unread = unreadCounts[u.username] || 0, online = isOnline(u.username);
              const isActiveDm = peer?.username === u.username && view === 'chat';
              const isMutedDm  = muted.dm.includes(u.username);
              const showMuteBtn = hoveredDm === u.username || isMutedDm;
              return (
                <div key={u.username} onClick={() => openConversation(u)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', background: isActiveDm ? 'var(--gray-1)' : hoveredDm === u.username ? 'var(--gray-2)' : 'transparent', transition: 'background 0.12s', borderLeft: isActiveDm ? '3px solid #ff7a3d' : '3px solid transparent', boxSizing: 'border-box' }}
                  onMouseEnter={() => setHoveredDm(u.username)}
                  onMouseLeave={() => setHoveredDm(null)}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 16 }}>
                      {(u.first_name || u.username).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: online ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)' }}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{dn(u.username)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); toggleMuteDm(u.username); }}
                          title={isMutedDm ? 'Activează notificări' : 'Silențios'}
                          style={{ visibility: showMuteBtn ? 'visible' : 'hidden', background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 4px', color: isMutedDm ? 'var(--gray-4)' : 'var(--gray-3)', display: 'flex', alignItems: 'center', borderRadius: 5, transition: 'all 0.12s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = isMutedDm ? 'var(--black)' : 'var(--gray-4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isMutedDm ? 'var(--gray-4)' : 'var(--gray-3)'; }}>
                          {isMutedDm
                            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                          }
                        </button>
                        {last && <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(last.created_at)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 12, color: unread > 0 ? 'var(--black)' : 'var(--gray-4)', fontWeight: unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {last ? (last.sender === user.username ? `Tu: ${last.message}` : last.message) : <em style={{ opacity: 0.6 }}>—</em>}
                      </span>
                      {unread > 0 && <span style={{ background: '#ff7a3d', color: 'white', borderRadius: '50%', minWidth: 17, height: 17, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', boxSizing: 'border-box', flexShrink: 0 }}>{unread > 9 ? '9+' : unread}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            {/* Groups section */}
            <div onClick={toggleGrps}
              style={{ padding: '8px 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', marginTop: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
                Grupuri {grpsCollapsed && filteredGroups.length > 0 ? `(${filteredGroups.length})` : ''}
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2.5"
                style={{ transform: grpsCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            <div style={{ overflow: 'hidden', maxHeight: grpsCollapsed ? '0px' : '2000px', opacity: grpsCollapsed ? 0 : 1, transition: 'max-height 0.32s ease, opacity 0.22s ease' }}>
            {filteredGroups.map(g => {
              const unread = groupUnread[g.id] || 0;
              const lastMsg = (groupMessages[g.id] || []).at(-1) || g._lastMsg;
              const isActiveGrp = activeGroup?.id === g.id && ['group-chat','group-members','group-add-members'].includes(view);
              const isMutedGrp  = muted.group.includes(g.id);
              const showMuteGrp = hoveredGroup === g.id || isMutedGrp;
              return (
                <div key={g.id} onClick={() => openGroupConversation(g)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', background: isActiveGrp ? 'var(--gray-1)' : hoveredGroup === g.id ? 'var(--gray-2)' : 'transparent', transition: 'background 0.12s', borderLeft: isActiveGrp ? '3px solid #ff7a3d' : '3px solid transparent', boxSizing: 'border-box' }}
                  onMouseEnter={() => setHoveredGroup(g.id)}
                  onMouseLeave={() => setHoveredGroup(null)}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: groupColor(g.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                    <GroupIcon size={17} color="white" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{g.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); toggleMuteGroup(g.id); }}
                          title={isMutedGrp ? 'Activează notificări' : 'Silențios'}
                          style={{ visibility: showMuteGrp ? 'visible' : 'hidden', background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 4px', color: isMutedGrp ? 'var(--gray-4)' : 'var(--gray-3)', display: 'flex', alignItems: 'center', borderRadius: 5, transition: 'all 0.12s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = isMutedGrp ? 'var(--black)' : 'var(--gray-4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isMutedGrp ? 'var(--gray-4)' : 'var(--gray-3)'; }}>
                          {isMutedGrp
                            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                          }
                        </button>
                        {lastMsg && <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(lastMsg.created_at)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 12, color: unread > 0 ? 'var(--black)' : 'var(--gray-4)', fontWeight: unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {lastMsg ? `${lastMsg.username === user.username ? 'Tu' : dn(lastMsg.username)}: ${lastMsg.message}` : <em style={{ opacity: 0.6 }}>{g.members?.length || 0} membri</em>}
                      </span>
                      {unread > 0 && <span style={{ background: '#ff7a3d', color: 'white', borderRadius: '50%', minWidth: 17, height: 17, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', boxSizing: 'border-box', flexShrink: 0 }}>{unread > 9 ? '9+' : unread}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
            </>}

          </div>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-page)' }}>

          {/* Empty state */}
          {view === 'contacts' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--gray-4)' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)', marginBottom: 5 }}>Nicio conversație selectată</div>
                <div style={{ fontSize: 13 }}>Alege un contact sau grup din stânga</div>
              </div>
            </div>
          )}

          {/* DM or Group conversation */}
          {isConvView && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
              {/* Header */}
              <div style={{ padding: '12px 18px', borderBottom: showSearch || pinnedMsg ? 'none' : '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', flexShrink: 0 }}>
                {view === 'chat' ? (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: peer ? avatarColor(peer.username) : '#ff7a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 17 }}>
                      {(peer?.first_name || peer?.username || '').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: '50%', background: isOnline(peer?.username) ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)' }}/>
                  </div>
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: activeGroup ? groupColor(activeGroup.name) : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GroupIcon size={19} color="white" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {view === 'chat' ? dn(peer?.username) : activeGroup?.name}
                  </div>
                  {view === 'chat' ? (
                    <div style={{ fontSize: 12, color: isOnline(peer?.username) ? '#22c55e' : 'var(--gray-4)' }}>
                      {isOnline(peer?.username) ? 'online' : 'offline'}
                    </div>
                  ) : (
                    <div onClick={openGroupMembers}
                      style={{ fontSize: 12, color: 'var(--gray-4)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ff7a3d'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}>
                      {activeGroup?.members?.length || 0} membri
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  )}
                </div>
                <button onClick={toggleSearch} title="Caută în conversație"
                  style={{ background: showSearch ? 'var(--gray-2)' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', color: showSearch ? 'var(--black)' : 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = showSearch ? 'var(--gray-2)' : 'transparent'; e.currentTarget.style.color = showSearch ? 'var(--black)' : 'var(--gray-4)'; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
                {/* Setări chat */}
                <div ref={chatSettingsRef} style={{ position: 'relative' }}>
                  <button onClick={() => setShowChatSettings(s => !s)} title="Opțiuni chat"
                    style={{ background: showChatSettings ? 'var(--gray-2)' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', color: showChatSettings ? 'var(--black)' : 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = showChatSettings ? 'var(--gray-2)' : 'transparent'; e.currentTarget.style.color = showChatSettings ? 'var(--black)' : 'var(--gray-4)'; }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="6" x2="20" y2="6"/><circle cx="8" cy="6" r="2.2" fill="currentColor" stroke="none"/>
                      <line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2.2" fill="currentColor" stroke="none"/>
                      <line x1="4" y1="18" x2="20" y2="18"/><circle cx="10" cy="18" r="2.2" fill="currentColor" stroke="none"/>
                    </svg>
                  </button>
                  {showChatSettings && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100, padding: '14px 16px', minWidth: 180 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Opțiuni chat</div>
                      <div style={{ fontSize: 12, color: 'var(--black)', marginBottom: 8, fontWeight: 500 }}>Mărime text</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => changeFontSize(-1)} disabled={chatFontSize <= 11}
                          style={{ width: 30, height: 30, border: '1px solid var(--gray-3)', borderRadius: 7, background: 'var(--gray-1)', cursor: chatFontSize <= 11 ? 'default' : 'pointer', color: chatFontSize <= 11 ? 'var(--gray-3)' : 'var(--black)', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
                          onMouseEnter={e => { if (chatFontSize > 11) { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; } }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                          <span style={{ fontSize: 18, lineHeight: 1, marginTop: -1 }}>−</span>
                        </button>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--black)' }}>{chatFontSize}px</div>
                        <button onClick={() => changeFontSize(1)} disabled={chatFontSize >= 20}
                          style={{ width: 30, height: 30, border: '1px solid var(--gray-3)', borderRadius: 7, background: 'var(--gray-1)', cursor: chatFontSize >= 20 ? 'default' : 'pointer', color: chatFontSize >= 20 ? 'var(--gray-3)' : 'var(--black)', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
                          onMouseEnter={e => { if (chatFontSize < 20) { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; } }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                        </button>
                      </div>
                      {chatFontSize !== 14 && (
                        <button onClick={() => { setChatFontSize(14); localStorage.setItem('chat_font_size', '14'); }}
                          style={{ marginTop: 10, width: '100%', padding: '5px 0', border: '1px solid var(--gray-3)', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: 'var(--gray-4)', fontSize: 11, fontWeight: 500, transition: 'all 0.12s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                          Resetează (14px)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Search bar */}
              {showSearch && (
                <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-page)' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input ref={searchInputRef} type="text" value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setSearchIdx(0); }}
                      onKeyDown={e => { if (e.key === 'Enter') navigateSearch(e.shiftKey ? -1 : 1); if (e.key === 'Escape') toggleSearch(); }}
                      placeholder="Caută în conversație..."
                      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px 6px 28px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit' }}
                      onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                      onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                    />
                  </div>
                  {searchQuery.trim() && <span style={{ fontSize: 11, color: 'var(--gray-4)', whiteSpace: 'nowrap' }}>{searchMatches.length > 0 ? `${searchIdx + 1} / ${searchMatches.length}` : '0'}</span>}
                  <button onClick={() => navigateSearch(-1)} disabled={!searchMatches.length} style={{ background: 'transparent', border: 'none', cursor: searchMatches.length ? 'pointer' : 'default', color: 'var(--gray-4)', padding: '3px 4px', display: 'flex', alignItems: 'center', opacity: searchMatches.length ? 1 : 0.4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button onClick={() => navigateSearch(1)} disabled={!searchMatches.length} style={{ background: 'transparent', border: 'none', cursor: searchMatches.length ? 'pointer' : 'default', color: 'var(--gray-4)', padding: '3px 4px', display: 'flex', alignItems: 'center', opacity: searchMatches.length ? 1 : 0.4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              )}
              {/* Pinned message */}
              {pinnedMsg && (
                <div onClick={scrollToPinned}
                  style={{ padding: '6px 14px', borderBottom: '1px solid var(--gray-2)', background: 'var(--gray-1)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--gray-1)'}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                  <div style={{ flex: 1, fontSize: 11, color: 'var(--gray-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--black)' }}>{pinnedMsg.username}</span>: {pinnedMsg.message}
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleUnpin(pinnedMsg); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}
              {/* Messages */}
              {renderConversation(view === 'chat' ? messages : groupMsgs, view === 'chat')}
              {/* Pin notification */}
              {pinNotification && (
                <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.14)', fontSize: 12, color: 'var(--black)', zIndex: 2 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                  <span>{pinNotification}</span>
                </div>
              )}
              {showScrollBtn && (
                <button onClick={scrollToBottom}
                  style={{ position: 'absolute', bottom: 70, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 20, padding: '5px 14px 5px 10px', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.14)', color: 'var(--gray-4)', fontSize: 12, fontWeight: 500 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  Ultimul mesaj
                </button>
              )}
              <ChatInput inputRef={inputRef} value={inputVal} onChange={handleInputChange}
                onKeyDown={handleKeyDown} onSend={sendMessage}
                placeholder={view === 'chat' ? `Mesaj pentru ${dn(peer?.username)}...` : `Mesaj în ${activeGroup?.name}...`}
                mentionQuery={mentionQuery} mentionUsers={mentionUsers}
                mentionHighlight={mentionHighlight} onMentionSelect={insertMention}
                replyTo={replyTo} onCancelReply={() => setReplyTo(null)}
                onOpenTripOrder={canChat('chatSendTripOrder') ? () => setTripOrderModal(true) : null}
                onSendImage={sendImage}
              />
            </div>
          )}

          {/* Group members */}
          {(view === 'group-members' || view === 'group-add-members') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Header */}
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', flexShrink: 0 }}>
                <BackBtn onClick={goBack} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {view === 'group-members' ? (
                    groupRenaming ? (
                      <input autoFocus type="text" value={editGroupName}
                        onChange={e => setEditGroupName(e.target.value)}
                        onBlur={submitRenameGroup}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitRenameGroup(); } if (e.key === 'Escape') { setGroupRenaming(false); setEditGroupName(activeGroup?.name || ''); } }}
                        maxLength={60}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '3px 8px', border: '1px solid #ff7a3d', borderRadius: 6, fontSize: 15, fontWeight: 600, background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)' }}>{activeGroup?.name}</span>
                        {isAdmin && (
                          <button onClick={() => { setEditGroupName(activeGroup?.name || ''); setGroupRenaming(true); }} title="Redenumește"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 4 }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)' }}>Adaugă membri</span>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--gray-4)', marginTop: 1 }}>
                    {view === 'group-members' ? `${activeGroup?.members?.length || 0} membri` : (addMemberSel.length === 0 ? 'Selectează utilizatori' : `${addMemberSel.length} selectați`)}
                  </div>
                </div>
              </div>
              {/* Body */}
              {view === 'group-members' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {memberMenuOpen && <div onClick={() => setMemberMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />}
                  <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                    {(activeGroup?.members || []).map(uname => (
                      <div key={uname}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', transition: 'background 0.12s', position: 'relative' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(uname), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 17 }}>{uname.charAt(0).toUpperCase()}</div>
                          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: '50%', background: isOnline(uname) ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--bg-page)' }}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {dn(uname)}{dn(uname) !== uname ? <span style={{ fontSize: 11, color: 'var(--gray-4)', marginLeft: 5 }}>@{uname}</span> : null}
                          </div>
                          <div style={{ fontSize: 12, color: isOnline(uname) ? '#22c55e' : 'var(--gray-4)' }}>{isOnline(uname) ? 'online' : 'offline'}</div>
                        </div>
                        {canChat('chatManageMembers') && uname !== user.username && (
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <button onClick={e => { e.stopPropagation(); setMemberMenuOpen(prev => prev === uname ? null : uname); }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 5 }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
                            </button>
                            {memberMenuOpen === uname && (
                              <div style={{ position: 'absolute', right: 0, top: 32, background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 9999, minWidth: 170, overflow: 'hidden' }}>
                                <button onClick={() => removeMember(uname)}
                                  style={{ width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--red-light)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                                  Elimină din grup
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {(isAdmin || canChat('chatManageMembers')) && (
                    <div style={{ padding: '12px 18px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
                      {isAdmin && (
                        <button onClick={deleteGroup}
                          style={{ padding: '9px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--red)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.borderColor = 'var(--red)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                          Șterge grup
                        </button>
                      )}
                      {canChat('chatManageMembers') && (
                        <button onClick={openAddMembers}
                          style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 8, background: '#ff7a3d', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                          Adaugă membri
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {view === 'group-add-members' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                    {(() => {
                      const nonMembers = orgUsers.filter(u => !(activeGroup?.members || []).includes(u.username));
                      if (!nonMembers.length) return <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, padding: '28px 16px' }}>Toți utilizatorii sunt deja în grup.</div>;
                      return nonMembers.map(u => (
                        <Checkbox key={u.username}
                          checked={addMemberSel.includes(u.username)}
                          onChange={() => setAddMemberSel(prev => prev.includes(u.username) ? prev.filter(x => x !== u.username) : [...prev, u.username])}
                          label={dn(u.username) !== u.username ? `${dn(u.username)} (@${u.username})` : u.username}
                        />
                      ));
                    })()}
                  </div>
                  <div style={{ padding: '12px 18px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => { setSlideDir('left'); setView('group-members'); }}
                      style={{ flex: 1, padding: '9px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--black)', fontFamily: 'inherit' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      Anulează
                    </button>
                    <button onClick={submitAddMembers} disabled={addMemberSel.length === 0 || groupSaving}
                      style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: (addMemberSel.length === 0 || groupSaving) ? 'var(--gray-2)' : '#ff7a3d', cursor: (addMemberSel.length === 0 || groupSaving) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                      {groupSaving ? 'Se adaugă...' : `Adaugă${addMemberSel.length > 0 ? ` (${addMemberSel.length})` : ''}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Create group */}
          {view === 'create-group' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', flexShrink: 0 }}>
                <BackBtn onClick={() => setView('contacts')} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)' }}>Grup nou</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>Adaugă un nume și selectează membri</div>
                </div>
              </div>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-2)', flexShrink: 0 }}>
                <input ref={newGroupNameRef} type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Numele grupului..." maxLength={60}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 14, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                  onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                />
                <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 5 }}>
                  {newGroupMembers.length === 0 ? 'Selectează cel puțin un membru' : `${newGroupMembers.length} membri selectați`}
                </div>
              </div>
              <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                {orgUsers.map(u => (
                  <Checkbox key={u.username} checked={newGroupMembers.includes(u.username)} onChange={() => toggleCreateMember(u.username)} label={dn(u.username) !== u.username ? `${dn(u.username)} (@${u.username})` : u.username} />
                ))}
              </div>
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setView('contacts')}
                  style={{ flex: 1, padding: '9px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--black)', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  Anulează
                </button>
                <button onClick={submitCreateGroup} disabled={!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving}
                  style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: (!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving) ? 'var(--gray-2)' : '#ff7a3d', cursor: (!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                  {groupSaving ? 'Se creează...' : 'Creează grup'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      {tripOrderModal && (
        <TripOrderModal
          peer={view === 'chat' ? dn(peer?.username) : null}
          groupName={view === 'group-chat' ? activeGroup?.name : null}
          members={view === 'group-chat' ? (activeGroup?.members || []).filter(m => m !== user.username) : []}
          dn={dn}
          onClose={() => setTripOrderModal(false)}
          onSend={sendTripOrder}
        />
      )}

      {/* Lightbox imagine — full page */}
      {lightboxSrc && (
        <div onClick={() => setLightboxSrc(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9800, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', cursor: 'zoom-out', animation: 'chatItemIn 0.18s ease' }}>
          <img src={lightboxSrc} alt="imagine" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '88vh', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', objectFit: 'contain', cursor: 'default' }} />
          <button onClick={() => setLightboxSrc(null)}
            style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.24)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <a href={lightboxSrc} download="imagine.png" onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', top: 18, right: 62, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'background 0.15s', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.24)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        </div>
      )}

      {/* Delete confirm modal — full page */}
      {deleteConfirm && (
        <div
          onClick={() => setDeleteConfirm(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9600,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--gray-2)',
              borderRadius: 16,
              padding: '28px 28px 24px',
              width: 320,
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>Șterge mesaj</div>
                <div style={{ fontSize: 12, color: 'var(--gray-4)', marginTop: 2, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>Această acțiune nu poate fi anulată</div>
              </div>
            </div>
            <div style={{ background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--gray-4)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isTripOrderMsg(deleteConfirm) ? '📦 Comandă de transport' : (deleteConfirm.is_deleted ? 'Mesaj șters' : deleteConfirm.message)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, padding: '10px 0', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--black)', cursor: 'pointer', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--gray-1)'}>
                Anulează
              </button>
              <button onClick={confirmDeleteMsg}
                style={{ flex: 1, padding: '10px 0', background: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}>
                Șterge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat toast — full page */}
      {chatToast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9700, background: chatToast.type === 'error' ? '#ef4444' : '#111110',
          color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none',
          whiteSpace: 'nowrap', animation: 'fadeInUp 0.2s ease',
        }}>
          {chatToast.message}
        </div>
      )}
      </>
    );
  }

  // ── Render ─────────────────────────────────────────────────
  const SW = sidebarCollapsed ? 52 : 260;
  return (
    <>


      {/* ── Right Sidebar ─────────────────────────────────── */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 9900,
        width: SW, background: 'var(--surface)', borderLeft: '1px solid var(--gray-2)',
        display: 'flex', flexDirection: 'column', transition: 'width 0.22s ease',
        fontFamily: "'SF Pro Display', -apple-system, sans-serif", overflow: 'hidden',
      }}>
        {/* Sidebar Header */}
        <div style={{ height: 52, borderBottom: '1px solid var(--gray-2)', background: 'var(--gray-1)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8, flexShrink: 0, position: 'relative' }}>
          <button onClick={() => { const v = !sidebarCollapsed; setSidebarCollapsed(v); localStorage.setItem('chat_sidebar_collapsed', v); }}
            title={sidebarCollapsed ? 'Extinde chat' : 'Restrânge chat'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--gray-4)', display: 'flex', alignItems: 'center', transition: 'background 0.15s, color 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
            {sidebarCollapsed
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
            }
          </button>
          {!sidebarCollapsed && (
            <>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)', flex: 1 }}>Mesaje</span>
              <span style={{ fontSize: 11, color: 'var(--gray-4)', whiteSpace: 'nowrap' }}>{onlineUsers.filter(u => u !== user.username).length} online</span>
              {totalUnread > 0 && (
                <button title="Marchează tot citit" onClick={() => { axios.put('/api/chat/read-all', {}, { headers }).catch(() => {}); setUnreadCounts({}); setGroupUnread({}); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 6, display: 'flex', alignItems: 'center', color: 'var(--gray-4)', transition: 'background 0.15s, color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--green)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                </button>
              )}
            </>
          )}
          {sidebarCollapsed && totalUnread > 0 && (
            <div style={{ position: 'absolute', top: 8, right: 8, background: '#ef4444', color: 'white', borderRadius: '50%', minWidth: 16, height: 16, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', boxSizing: 'border-box' }}>
              {totalUnread > 9 ? '9+' : totalUnread}
            </div>
          )}
        </div>

        {/* Sidebar Body */}
        {sidebarCollapsed ? (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4 }}>
            {orgUsers.map(u => {
              const unread = unreadCounts[u.username] || 0;
              const online = isOnline(u.username);
              return (
                <div key={u.username} onClick={() => openConversation(u)}
                  className="chat-avatar-item"
                  onMouseEnter={e => setAvatarTooltip({ name: dn(u.username), y: e.clientY })}
                  onMouseMove={e => setAvatarTooltip(p => p ? { ...p, y: e.clientY } : null)}
                  onMouseLeave={() => setAvatarTooltip(null)}
                  style={{ position: 'relative', cursor: 'pointer', padding: '4px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div className="chat-avatar-circle" style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 14 }}>
                    {(u.first_name || u.username).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ position: 'absolute', bottom: 4, right: 6, width: 9, height: 9, borderRadius: '50%', background: online ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)' }}/>
                  {unread > 0 && <div style={{ position: 'absolute', top: 2, right: 4, background: '#ff7a3d', color: 'white', borderRadius: '50%', minWidth: 14, height: 14, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', boxSizing: 'border-box' }}>{unread > 9 ? '9+' : unread}</div>}
                </div>
              );
            })}
            {groups.map(g => {
              const unread = groupUnread[g.id] || 0;
              return (
                <div key={g.id} onClick={() => openGroupConversation(g)}
                  className="chat-avatar-item"
                  onMouseEnter={e => setAvatarTooltip({ name: g.name, y: e.clientY })}
                  onMouseMove={e => setAvatarTooltip(p => p ? { ...p, y: e.clientY } : null)}
                  onMouseLeave={() => setAvatarTooltip(null)}
                  style={{ position: 'relative', cursor: 'pointer', padding: '4px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div className="chat-avatar-circle" style={{ width: 34, height: 34, borderRadius: '50%', background: groupColor(g.name), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GroupIcon size={16} color="white"/>
                  </div>
                  {unread > 0 && <div style={{ position: 'absolute', top: 2, right: 4, background: '#ff7a3d', color: 'white', borderRadius: '50%', minWidth: 14, height: 14, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', boxSizing: 'border-box' }}>{unread > 9 ? '9+' : unread}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {(view === 'contacts' || view === 'chat' || view === 'group-chat') && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--gray-2)', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută după nume..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ff7a3d'} onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}/>
                  {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex', alignItems: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
                </div>
              </div>
            )}

            {(view === 'create-group' || view === 'group-members' || view === 'group-add-members') && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gray-1)', flexShrink: 0 }}>
                <BackBtn onClick={goBack}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)' }}>
                    {view === 'create-group' ? 'Grup nou' : view === 'group-add-members' ? 'Adaugă membri' : (
                      groupRenaming
                        ? <input autoFocus type="text" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} onBlur={submitRenameGroup} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitRenameGroup(); } if (e.key === 'Escape') { setGroupRenaming(false); setEditGroupName(activeGroup?.name || ''); } }} maxLength={60} style={{ width: '100%', boxSizing: 'border-box', padding: '2px 6px', border: '1px solid #ff7a3d', borderRadius: 5, fontSize: 14, fontWeight: 600, background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit' }}/>
                        : <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeGroup?.name}</span>{isAdmin && <button onClick={() => { setEditGroupName(activeGroup?.name || ''); setGroupRenaming(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 4 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 1 }}>
                    {view === 'create-group' ? (newGroupMembers.length === 0 ? 'Selectează cel puțin un membru' : `${newGroupMembers.length} membri selectați`) : view === 'group-add-members' ? (addMemberSel.length === 0 ? 'Selectează utilizatori' : `${addMemberSel.length} selectați`) : `${activeGroup?.members?.length || 0} membri`}
                  </div>
                </div>
              </div>
            )}

            {(view === 'contacts' || view === 'chat' || view === 'group-chat') && (
              <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                <div onClick={toggleDm} style={{ padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>Mesaje directe {dmCollapsed && filteredUsers.length > 0 ? `(${filteredUsers.length})` : ''}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2.5" style={{ transform: dmCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div style={{ overflow: 'hidden', maxHeight: dmCollapsed ? '0px' : '5000px', opacity: dmCollapsed ? 0 : 1, transition: 'max-height 0.32s ease, opacity 0.22s ease' }}>
                  {filteredUsers.length === 0 && !search && <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, padding: '12px 14px' }}>Niciun coleg în organizație.</div>}
                  {filteredUsers.map((u, i) => {
                    const last = lastMessages[u.username], unread = unreadCounts[u.username] || 0, online = isOnline(u.username);
                    const isMutedDm = muted.dm.includes(u.username);
                    const showMuteBtn = hoveredDm === u.username || isMutedDm;
                    return (
                      <div key={u.username} onClick={() => openConversation(u)}
                        className="chat-contact-item"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--gray-2)' : 'none', cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredDm(u.username)}
                        onMouseLeave={() => setHoveredDm(null)}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 14 }}>{(u.first_name || u.username).charAt(0).toUpperCase()}</div>
                          <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: online ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)', transition: 'background 0.3s' }}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dn(u.username)}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                              <button onClick={e => { e.stopPropagation(); toggleMuteDm(u.username); }} title={isMutedDm ? 'Activează notificări' : 'Silențios'}
                                style={{ visibility: showMuteBtn ? 'visible' : 'hidden', background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 4px', color: isMutedDm ? 'var(--gray-4)' : 'var(--gray-3)', display: 'flex', alignItems: 'center', borderRadius: 5 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                {isMutedDm ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
                              </button>
                              {last && <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(last.created_at)}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 11, color: unread > 0 ? 'var(--black)' : 'var(--gray-4)', fontWeight: unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {last ? (last.sender === user.username ? `Tu: ${last.message}` : last.message) : <em style={{ opacity: 0.7 }}>{roleLabel(u.role)}</em>}
                            </span>
                            {unread > 0 && <div style={{ background: '#ff7a3d', color: 'white', borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{unread > 9 ? '9+' : unread}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(!search || filteredGroups.length > 0) && (
                  <div style={{ borderTop: filteredUsers.length > 0 ? '1px solid var(--gray-2)' : 'none' }}>
                    <div onClick={toggleGrps} style={{ padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>Grupuri {grpsCollapsed && filteredGroups.length > 0 ? `(${filteredGroups.length})` : ''}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {canChat('chatCreateGroup') && <button onClick={e => { e.stopPropagation(); openCreateGroup(); }} title="Grup nou" style={{ background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: 6, cursor: 'pointer', padding: '2px 7px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nou</button>}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2.5" style={{ transform: grpsCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ overflow: 'hidden', maxHeight: grpsCollapsed ? '0px' : '5000px', opacity: grpsCollapsed ? 0 : 1, transition: 'max-height 0.32s ease, opacity 0.22s ease' }}>
                  {filteredGroups.length === 0 && !search && <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 12, padding: '10px 14px 16px', fontStyle: 'italic' }}>{isAdmin ? 'Niciun grup creat.' : 'Nu ești în niciun grup.'}</div>}
                  {filteredGroups.map((g, i) => {
                    const unread = groupUnread[g.id] || 0, lastMsg = g._lastMsg;
                    const isMutedGrp = muted.group.includes(g.id);
                    const showMuteGrp = hoveredGroup === g.id || isMutedGrp;
                    return (
                      <div key={g.id} onClick={() => openGroupConversation(g)}
                        className="chat-contact-item"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < filteredGroups.length - 1 ? '1px solid var(--gray-2)' : 'none', cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredGroup(g.id)}
                        onMouseLeave={() => setHoveredGroup(null)}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: groupColor(g.name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GroupIcon size={17} color="white"/></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                              <button onClick={e => { e.stopPropagation(); toggleMuteGroup(g.id); }} title={isMutedGrp ? 'Activează notificări' : 'Silențios'}
                                style={{ visibility: showMuteGrp ? 'visible' : 'hidden', background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 4px', color: isMutedGrp ? 'var(--gray-4)' : 'var(--gray-3)', display: 'flex', alignItems: 'center', borderRadius: 5 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                {isMutedGrp ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
                              </button>
                              {lastMsg && <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(lastMsg.created_at)}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 11, color: unread > 0 ? 'var(--black)' : 'var(--gray-4)', fontWeight: unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {lastMsg ? (lastMsg.sender === 'SYSTEM' ? lastMsg.message : lastMsg.sender === user.username ? `Tu: ${lastMsg.message}` : `${dn(lastMsg.sender)}: ${lastMsg.message}`) : <em style={{ opacity: 0.55 }}>Niciun mesaj încă</em>}
                            </span>
                            {unread > 0 && <div style={{ background: '#ff7a3d', color: 'white', borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{unread > 9 ? '9+' : unread}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === 'create-group' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-2)', flexShrink: 0 }}>
                  <input ref={newGroupNameRef} type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Numele grupului..." maxLength={60}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 14, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ff7a3d'} onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}/>
                </div>
                <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                  {orgUsers.map(u => <Checkbox key={u.username} checked={newGroupMembers.includes(u.username)} onChange={() => toggleCreateMember(u.username)} label={dn(u.username) !== u.username ? `${dn(u.username)} (@${u.username})` : u.username}/>)}
                </div>
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setView('contacts')} style={{ flex: 1, padding: '9px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--black)', fontFamily: 'inherit', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Anulează</button>
                  <button onClick={submitCreateGroup} disabled={!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving}
                    style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: (!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving) ? 'var(--gray-2)' : '#ff7a3d', cursor: (!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                    {groupSaving ? 'Se creează...' : 'Creează grup'}
                  </button>
                </div>
              </div>
            )}

            {view === 'group-members' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
                {memberMenuOpen && <div onClick={() => setMemberMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }}/>}
                <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                  {(activeGroup?.members || []).map(uname => (
                    <div key={uname} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', transition: 'background 0.12s', position: 'relative' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(uname), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 13 }}>{uname.charAt(0).toUpperCase()}</div>
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: isOnline(uname) ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)' }}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dn(uname)}{dn(uname) !== uname ? <span style={{ fontSize: 11, color: 'var(--gray-4)', marginLeft: 4 }}>@{uname}</span> : null}</div>
                        <div style={{ fontSize: 11, color: isOnline(uname) ? '#22c55e' : 'var(--gray-4)' }}>{isOnline(uname) ? 'online' : 'offline'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {canChat('chatManageMembers') && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gray-2)', flexShrink: 0 }}>
                    <button onClick={() => setView('group-add-members')} style={{ width: '100%', padding: '9px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--black)', fontFamily: 'inherit', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>+ Adaugă membri</button>
                  </div>
                )}
              </div>
            )}

            {view === 'group-add-members' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                  {(() => {
                    const nonMembers = orgUsers.filter(u => !(activeGroup?.members || []).includes(u.username));
                    if (nonMembers.length === 0) return <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, padding: '28px 16px' }}>Toți utilizatorii sunt deja în grup.</div>;
                    return nonMembers.map(u => <Checkbox key={u.username} checked={addMemberSel.includes(u.username)} onChange={() => setAddMemberSel(prev => prev.includes(u.username) ? prev.filter(x => x !== u.username) : [...prev, u.username])} label={dn(u.username) !== u.username ? `${dn(u.username)} (@${u.username})` : u.username}/>);
                  })()}
                </div>
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setView('group-members')} style={{ flex: 1, padding: '9px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--black)', fontFamily: 'inherit', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Anulează</button>
                  <button onClick={submitAddMembers} disabled={addMemberSel.length === 0 || groupSaving}
                    style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: (addMemberSel.length === 0 || groupSaving) ? 'var(--gray-2)' : '#ff7a3d', cursor: (addMemberSel.length === 0 || groupSaving) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                    {groupSaving ? 'Se adaugă...' : `Adaugă${addMemberSel.length > 0 ? ` (${addMemberSel.length})` : ''}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Chat Cards ────────────────────────────────────── */}
      {openCards.map((card, idx) => {
        const cardW = 400;
        const rightOffset = SW + 8 + idx * (cardW + 8);
        const isActiveDm  = card.type === 'dm'    && peer?.username  === card.peer?.username;
        const isActiveGrp = card.type === 'group' && activeGroup?.id === card.group?.id;
        const isActive = isActiveDm || isActiveGrp;
        const cardUnread = card.type === 'dm' ? (unreadCounts[card.peer?.username] || 0) : (groupUnread[card.group?.id] || 0);
        return (
          <div key={card.key} style={{
            position: 'fixed', bottom: 0, right: rightOffset, zIndex: 9800, width: cardW,
            height: card.minimized ? 48 : 560,
            background: 'var(--surface)', border: '1px solid var(--gray-2)',
            borderRadius: '12px 12px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            transition: 'height 0.2s ease',
            fontFamily: "'SF Pro Display', -apple-system, sans-serif",
          }}>
            {/* Card Header */}
            <div
              onClick={() => {
                if (card.minimized) {
                  setOpenCards(prev => prev.map(c => c.key === card.key ? { ...c, minimized: false } : c));
                  if (!isActive) { if (card.type === 'dm') openConversation(card.peer); else openGroupConversation(card.group); }
                } else {
                  minimizeCard(card.key);
                }
              }}
              style={{ height: 52, padding: '0 8px 0 12px', display: 'flex', alignItems: 'center', gap: 10, background: isActive ? 'var(--gray-1)' : 'var(--surface)', borderBottom: card.minimized ? 'none' : '1px solid var(--gray-2)', cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
              {card.type === 'dm' ? (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(card.peer?.username || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                    {(card.peer?.first_name || card.peer?.username || '').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: isOnline(card.peer?.username) ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)' }}/>
                </div>
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: groupColor(card.group?.name || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <GroupIcon size={16} color="white"/>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {card.type === 'dm' ? dn(card.peer?.username) : card.group?.name}
                </div>
                {card.type === 'dm' && !card.minimized && (
                  <div style={{ fontSize: 12, fontWeight: 500, color: isOnline(card.peer?.username) ? '#22c55e' : 'var(--gray-4)', marginTop: 1 }}>
                    {isOnline(card.peer?.username) ? 'online' : 'offline'}
                  </div>
                )}
                {card.type === 'group' && !card.minimized && (
                  <div style={{ fontSize: 12, color: 'var(--gray-4)', marginTop: 1 }}>
                    {card.group?.members?.length || 0} membri
                  </div>
                )}
              </div>
              {card.minimized && cardUnread > 0 && (
                <div style={{ background: '#ff7a3d', color: 'white', borderRadius: 10, minWidth: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>{cardUnread > 9 ? '9+' : cardUnread}</div>
              )}
              <button onClick={e => { e.stopPropagation(); minimizeCard(card.key); }} title={card.minimized ? 'Extinde' : 'Minimizează'}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 10px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'background 0.12s', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button onClick={e => { e.stopPropagation(); closeCard(card.key); }} title="Închide"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 10px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'background 0.12s, color 0.12s', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--red)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Card Body — mesajele se afișează mereu; inputul doar la cardul activ */}
            {!card.minimized && (() => {
              const cardDmMsgs  = card.type === 'dm'    ? (conversations[card.peer?.username] || []) : [];
              const cardGrpMsgs = card.type === 'group' ? (groupMessages[card.group?.id]    || []) : [];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                  {/* Search bar — doar la cardul activ */}
                  {isActive && showSearch && (
                    <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-page)', flexShrink: 0 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2" style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSearchIdx(0); }}
                          onKeyDown={e => { if (e.key === 'Enter') navigateSearch(e.shiftKey ? -1 : 1); if (e.key === 'Escape') toggleSearch(); }}
                          placeholder="Caută în conversație..."
                          style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px 5px 25px', border: '1px solid var(--gray-3)', borderRadius: 7, fontSize: 12, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit' }}
                          onFocus={e => e.target.style.borderColor = '#ff7a3d'} onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}/>
                      </div>
                      {searchQuery.trim() && <span style={{ fontSize: 11, color: 'var(--gray-4)', whiteSpace: 'nowrap' }}>{searchMatches.length > 0 ? `${searchIdx + 1}/${searchMatches.length}` : '0'}</span>}
                      <button onClick={toggleSearch} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 3, display: 'flex', alignItems: 'center', borderRadius: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                  )}
                  {/* Pinned — doar la cardul activ */}
                  {isActive && pinnedMsg && (
                    <div onClick={scrollToPinned} style={{ padding: '5px 10px', borderBottom: '1px solid var(--gray-2)', background: 'var(--gray-1)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--gray-1)'}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                      <div style={{ flex: 1, fontSize: 11, color: 'var(--gray-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ fontWeight: 600, color: 'var(--black)' }}>{pinnedMsg.username}</span>: {pinnedMsg.message}</div>
                      <button onClick={e => { e.stopPropagation(); handleUnpin(pinnedMsg); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                  )}
                  {/* Mesaje — mereu vizibile, din datele proprii ale cardului */}
                  <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }} onScroll={isActive ? handleMsgsScroll : undefined}>
                    {card.type === 'dm' ? (
                      cardDmMsgs.length === 0
                        ? <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, marginTop: 50, lineHeight: 1.8 }}>Niciun mesaj cu {dn(card.peer?.username)}.<br/><span style={{ fontSize: 20 }}>👋</span></div>
                        : cardDmMsgs.map((msg, i) => {
                          if (msg.message_type === 'system') return <div key={msg.id || `s${i}`} style={{ textAlign: 'center', padding: '4px 10px' }}><span style={{ fontSize: 11, color: 'var(--gray-4)', fontStyle: 'italic', background: 'var(--gray-1)', borderRadius: 10, padding: '2px 8px' }}>{msg.message}</span></div>;
                          const isMe = msg.username === user.username;
                          const nextSame = i < cardDmMsgs.length - 1 && cardDmMsgs[i+1].username === msg.username && cardDmMsgs[i+1].message_type !== 'system';
                          const isHovered = isActive && hoveredMsgId === msg.id;
                          const isEditing = isActive && editingMsgId === msg.id;
                          const isSearchMatch = isActive && searchQuery.trim() && !msg.is_deleted && !isTripOrderMsg(msg) && msg.message?.toLowerCase().includes(searchQuery.toLowerCase());
                          const isCurrentSearchMatch = isSearchMatch && searchMatches[searchIdx] === i;
                          if (isTripOrderMsg(msg)) return (
                            <div key={msg.id} id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4, padding: '1px 2px' }}>
                              <TripOrderCard msg={msg} currentUser={user.username} onRespond={isActive ? (status) => handleTripOrderRespond(msg, status) : undefined}/>
                              {!nextSame && <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, flexDirection: isMe ? 'row-reverse' : 'row' }}><span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span>{isMe && <span title={isRead(msg) ? 'Văzut' : 'Trimis'}>{isRead(msg) ? <SeenIcon/> : <SentIcon/>}</span>}</div>}
                            </div>
                          );
                          return (
                            <div key={msg.id}>
                              {isActive && msg.id === firstUnreadId && <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0' }}><div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/><span style={{ fontSize: 10, fontWeight: 600, color: '#ff7a3d', whiteSpace: 'nowrap' }}>MESAJE NOI</span><div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/></div>}
                              <div id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4, borderRadius: 8, animation: isActive && highlightedMsgId === msg.id ? 'msgHighlight 1.6s ease forwards' : 'none', padding: '1px 2px', outline: isCurrentSearchMatch ? '2px solid #ff7a3d' : isSearchMatch ? '1px solid rgba(255,122,61,0.4)' : 'none', outlineOffset: 2 }}
                                onMouseEnter={() => isActive && setHoveredMsgId(msg.id)} onMouseLeave={() => isActive && setHoveredMsgId(null)}>
                                {msg.is_deleted ? (
                                  <div style={{ fontSize: 13, color: 'var(--gray-4)', fontStyle: 'italic', padding: '5px 9px', border: '1px solid var(--gray-2)', borderRadius: 10 }}>Mesaj șters</div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexDirection: isMe ? 'row' : 'row-reverse', maxWidth: '82%' }}>
                                    {isActive && <div style={{ display: 'flex', gap: 2, opacity: isHovered && !isEditing ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: isHovered && !isEditing ? 'auto' : 'none' }}>
                                      <button onClick={() => setReplyTo({ id: msg.id, text: msg.message, username: msg.username })} title="Răspunde" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></button>
                                      <button onClick={() => handlePin(msg)} title={msg.is_pinned ? 'Desprinde' : 'Prinde'} style={{ background: 'var(--surface)', border: `1px solid ${msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'}`, borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)'; e.currentTarget.style.borderColor = msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg></button>
                                      {isMe && <>
                                        {Date.now() - new Date(msg.created_at).getTime() <= EDIT_LIMIT_MS && <button onClick={() => startEdit(msg)} title="Editează" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>}
                                        {canChat('chatDeleteMessage') && <button onClick={() => deleteMsg(msg)} title="Șterge" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>}
                                      </>}
                                    </div>}
                                    {isEditing ? (
                                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <textarea value={editingText} onChange={e => setEditingText(e.target.value)} autoFocus rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg); } if (e.key === 'Escape') cancelEdit(); }} style={{ resize: 'none', border: '1.5px solid #ff7a3d', borderRadius: 8, padding: '5px 8px', fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, minWidth: 120 }}/>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                          <button onClick={cancelEdit} style={{ fontSize: 11, padding: '2px 7px', border: '1px solid var(--gray-3)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--gray-4)' }}>Anulează</button>
                                          <button onClick={() => submitEdit(msg)} style={{ fontSize: 11, padding: '2px 7px', border: 'none', borderRadius: 5, background: '#ff7a3d', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Salvează</button>
                                        </div>
                                      </div>
                                    ) : isImageMsg(msg) ? (
                                      <div style={{ padding: 3, borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setLightboxSrc(`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`)}>
                                        {msg.reply_to_id && <div style={{ fontSize: 10, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', padding: '2px 5px', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'rgba(255,122,61,0.08)', borderRadius: '0 4px 4px 0' }}><span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}</div>}
                                        <img src={`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`} alt={msg.message || 'imagine'} style={{ display: 'block', maxWidth: 300, maxHeight: 200, borderRadius: 8, objectFit: 'cover' }}/>
                                      </div>
                                    ) : (
                                      <div style={{ padding: '7px 11px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', color: isMe ? 'var(--chat-sent-text)' : 'var(--chat-recv-text)', fontSize: chatFontSize, lineHeight: 1.45, wordBreak: 'break-word' }}>
                                        {msg.reply_to_id && <div style={{ fontSize: 10, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', paddingLeft: 5, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}><span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}</div>}
                                        {renderMessageText(msg.message, user.username)}
                                        {msg.edited_at && <span style={{ fontSize: 10, opacity: 0.55, marginLeft: 5 }}>(editat)</span>}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!nextSame && !msg.is_deleted && <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: isMe ? 'flex-end' : 'flex-start' }}><span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span>{isMe && <span title={isRead(msg) ? 'Văzut' : 'Trimis'}>{isRead(msg) ? <SeenIcon/> : <SentIcon/>}</span>}</div>}
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      cardGrpMsgs.length === 0
                        ? <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, marginTop: 50, lineHeight: 1.8 }}>Niciun mesaj în „{card.group?.name}".<br/><span style={{ fontSize: 20 }}>💬</span></div>
                        : cardGrpMsgs.map((msg, i) => {
                          if (msg.message_type === 'system') return <div key={msg.id || `sg${i}`} style={{ textAlign: 'center', padding: '4px 10px' }}><span style={{ fontSize: 11, color: 'var(--gray-4)', fontStyle: 'italic', background: 'var(--gray-1)', borderRadius: 10, padding: '2px 8px' }}>{msg.message}</span></div>;
                          const isMe = msg.username === user.username;
                          const nextMsg = cardGrpMsgs[i+1], prevMsg = cardGrpMsgs[i-1];
                          const nextSame = nextMsg && nextMsg.username === msg.username && nextMsg.message_type !== 'system';
                          const prevSame = prevMsg && prevMsg.username === msg.username && prevMsg.message_type !== 'system';
                          const seenBy = getSeenBy(i, cardGrpMsgs, memberReads[card.group?.id], user.username);
                          const isHovered = isActive && hoveredMsgId === msg.id;
                          const isEditing = isActive && editingMsgId === msg.id;
                          const isSearchMatch = isActive && searchQuery.trim() && !msg.is_deleted && !isTripOrderMsg(msg) && msg.message?.toLowerCase().includes(searchQuery.toLowerCase());
                          const isCurrentSearchMatch = isSearchMatch && searchMatches[searchIdx] === i;
                          if (isTripOrderMsg(msg)) return (
                            <div key={msg.id} id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4, padding: '1px 2px' }}>
                              {!isMe && !prevSame && <div style={{ fontSize: 11, color: '#ff7a3d', marginBottom: 2, paddingLeft: 2, fontWeight: 600 }}>{dn(msg.username)}</div>}
                              <TripOrderCard msg={msg} currentUser={user.username} onRespond={isActive ? (status) => handleTripOrderRespond(msg, status) : undefined}/>
                              {!nextSame && <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, flexDirection: isMe ? 'row-reverse' : 'row' }}><span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span></div>}
                            </div>
                          );
                          return (
                            <div key={msg.id}>
                              {isActive && msg.id === firstUnreadId && <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0' }}><div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/><span style={{ fontSize: 10, fontWeight: 600, color: '#ff7a3d', whiteSpace: 'nowrap' }}>MESAJE NOI</span><div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/></div>}
                              <div id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4, borderRadius: 8, animation: isActive && highlightedMsgId === msg.id ? 'msgHighlight 1.6s ease forwards' : 'none', padding: '1px 2px', outline: isCurrentSearchMatch ? '2px solid #ff7a3d' : isSearchMatch ? '1px solid rgba(255,122,61,0.4)' : 'none', outlineOffset: 2 }}
                                onMouseEnter={() => isActive && setHoveredMsgId(msg.id)} onMouseLeave={() => isActive && setHoveredMsgId(null)}>
                                {!isMe && !prevSame && !msg.is_deleted && <div style={{ fontSize: 11, color: '#ff7a3d', marginBottom: 2, paddingLeft: 2, fontWeight: 600 }}>{dn(msg.username)}</div>}
                                {msg.is_deleted ? (
                                  <div style={{ fontSize: 13, color: 'var(--gray-4)', fontStyle: 'italic', padding: '5px 9px', border: '1px solid var(--gray-2)', borderRadius: 10 }}>Mesaj șters</div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexDirection: isMe ? 'row' : 'row-reverse', maxWidth: '82%' }}>
                                    {isActive && <div style={{ display: 'flex', gap: 2, opacity: isHovered && !isEditing ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: isHovered && !isEditing ? 'auto' : 'none' }}>
                                      <button onClick={() => setReplyTo({ id: msg.id, text: msg.message, username: msg.username })} title="Răspunde" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></button>
                                      <button onClick={() => handlePin(msg)} title={msg.is_pinned ? 'Desprinde' : 'Prinde'} style={{ background: 'var(--surface)', border: `1px solid ${msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'}`, borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)'; e.currentTarget.style.borderColor = msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg></button>
                                      {isMe && <>
                                        {Date.now() - new Date(msg.created_at).getTime() <= EDIT_LIMIT_MS && <button onClick={() => startEdit(msg)} title="Editează" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>}
                                        {canChat('chatDeleteMessage') && <button onClick={() => deleteMsg(msg)} title="Șterge" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>}
                                      </>}
                                    </div>}
                                    {isEditing ? (
                                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <textarea value={editingText} onChange={e => setEditingText(e.target.value)} autoFocus rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg); } if (e.key === 'Escape') cancelEdit(); }} style={{ resize: 'none', border: '1.5px solid #ff7a3d', borderRadius: 8, padding: '5px 8px', fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, minWidth: 120 }}/>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                          <button onClick={cancelEdit} style={{ fontSize: 11, padding: '2px 7px', border: '1px solid var(--gray-3)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--gray-4)' }}>Anulează</button>
                                          <button onClick={() => submitEdit(msg)} style={{ fontSize: 11, padding: '2px 7px', border: 'none', borderRadius: 5, background: '#ff7a3d', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Salvează</button>
                                        </div>
                                      </div>
                                    ) : isImageMsg(msg) ? (
                                      <div style={{ padding: 3, borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setLightboxSrc(`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`)}>
                                        {msg.reply_to_id && <div style={{ fontSize: 10, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', padding: '2px 5px', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'rgba(255,122,61,0.08)', borderRadius: '0 4px 4px 0' }}><span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}</div>}
                                        <img src={`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`} alt={msg.message || 'imagine'} style={{ display: 'block', maxWidth: 300, maxHeight: 200, borderRadius: 8, objectFit: 'cover' }}/>
                                      </div>
                                    ) : (
                                      <div style={{ padding: '7px 11px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', color: isMe ? 'var(--chat-sent-text)' : 'var(--chat-recv-text)', fontSize: chatFontSize, lineHeight: 1.45, wordBreak: 'break-word' }}>
                                        {msg.reply_to_id && <div style={{ fontSize: 10, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', paddingLeft: 5, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}><span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}</div>}
                                        {renderMessageText(msg.message, user.username)}
                                        {msg.edited_at && <span style={{ fontSize: 10, opacity: 0.55, marginLeft: 5 }}>(editat)</span>}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!nextSame && !msg.is_deleted && <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: isMe ? 'flex-end' : 'flex-start' }}><span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span></div>}
                                {seenBy.length > 0 && !msg.is_deleted && <div style={{ display: 'flex', gap: 2, marginTop: 2, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>{seenBy.map(uname => <div key={uname} title={`Văzut de ${uname}`} style={{ width: 12, height: 12, borderRadius: '50%', background: avatarColor(uname), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 7, fontWeight: 700 }}>{uname.charAt(0).toUpperCase()}</div>)}</div>}
                              </div>
                            </div>
                          );
                        })
                    )}
                    {card.type === 'dm' && typingUsers[`dm_${card.peer?.username}`] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0', color: 'var(--gray-4)', fontSize: 12 }}>
                        <div style={{ display: 'flex', gap: 2 }}>{[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gray-4)', animation: `typingDot 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}</div>
                        <span>{typingUsers[`dm_${card.peer?.username}`]} scrie...</span>
                      </div>
                    )}
                    {card.type === 'group' && typingUsers[`group_${card.group?.id}`] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0', color: 'var(--gray-4)', fontSize: 12 }}>
                        <div style={{ display: 'flex', gap: 2 }}>{[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gray-4)', animation: `typingDot 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}</div>
                        <span>{typingUsers[`group_${card.group?.id}`]} scrie...</span>
                      </div>
                    )}
                    {isActive && <div ref={messagesEndRef}/>}
                  </div>
                  {/* Pin notification + scroll btn — doar activ */}
                  {isActive && pinNotification && (
                    <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 10, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 12px rgba(0,0,0,0.14)', fontSize: 11, color: 'var(--black)', whiteSpace: 'nowrap', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', animation: 'chatItemIn 0.2s ease', zIndex: 2, pointerEvents: 'none' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{pinNotification}</span>
                    </div>
                  )}
                  {isActive && showScrollBtn && (
                    <button onClick={scrollToBottom} style={{ position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 16, padding: '4px 12px 4px 8px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.14)', color: 'var(--gray-4)', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', animation: 'chatItemIn 0.18s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      Ultimul mesaj
                    </button>
                  )}
                  {/* Input: mereu vizibil; cardul inactiv are un overlay transparent care activează la click */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <ChatInput inputRef={isActive ? inputRef : undefined}
                      value={isActive ? inputVal : ''}
                      onChange={isActive ? handleInputChange : undefined}
                      onKeyDown={isActive ? handleKeyDown : undefined}
                      onSend={isActive ? sendMessage : undefined}
                      placeholder={card.type === 'dm' ? `Mesaj pentru ${dn(card.peer?.username)}...` : `Mesaj în ${card.group?.name}...`}
                      mentionQuery={isActive ? mentionQuery : ''}
                      mentionUsers={isActive ? mentionUsers : []}
                      onOpenTripOrder={isActive && canChat('chatSendTripOrder') ? () => setTripOrderModal(true) : null}
                      onSendImage={isActive ? sendImage : undefined}
                      mentionHighlight={isActive ? mentionHighlight : -1}
                      onMentionSelect={isActive ? insertMention : undefined}
                      replyTo={isActive ? replyTo : null}
                      onCancelReply={isActive ? () => setReplyTo(null) : undefined}
                    />
                    {!isActive && (
                      <div
                        onClick={() => { if (card.type === 'dm') openConversation(card.peer); else openGroupConversation(card.group); }}
                        style={{ position: 'absolute', inset: 0, cursor: 'text', zIndex: 1 }}
                      />
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* ── Tooltip avatar collapsed sidebar — portal pe body ── */}
      {avatarTooltip && createPortal(
        <div style={{
          position: 'fixed',
          right: SW + 10,
          top: avatarTooltip.y,
          transform: 'translateY(-50%)',
          background: 'rgba(18,18,16,0.92)',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 99999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.28)',
        }}>
          {avatarTooltip.name}
        </div>,
        document.body
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {tripOrderModal && (
        <TripOrderModal
          peer={peer ? dn(peer.username) : null}
          groupName={activeGroup?.name || null}
          members={(activeGroup?.members || []).filter(m => m !== user.username)}
          dn={dn}
          onClose={() => setTripOrderModal(false)}
          onSend={sendTripOrder}
        />
      )}

      {lightboxSrc && (
        <div onClick={() => setLightboxSrc(null)} style={{ position: 'fixed', inset: 0, zIndex: 9800, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', cursor: 'zoom-out', animation: 'chatItemIn 0.18s ease' }}>
          <img src={lightboxSrc} alt="imagine" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '88vh', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', objectFit: 'contain', cursor: 'default' }}/>
          <button onClick={() => setLightboxSrc(null)} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.24)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <a href={lightboxSrc} download="imagine.png" onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 18, right: 62, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.24)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>
        </div>
      )}

      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 9600, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: 16, padding: '28px 28px 24px', width: 320, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
              <div><div style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>Șterge mesaj</div><div style={{ fontSize: 12, color: 'var(--gray-4)', marginTop: 2 }}>Această acțiune nu poate fi anulată</div></div>
            </div>
            <div style={{ background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--gray-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isTripOrderMsg(deleteConfirm) ? '📦 Comandă de transport' : (deleteConfirm.is_deleted ? 'Mesaj șters' : deleteConfirm.message)}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px 0', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--black)', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--gray-1)'}>Anulează</button>
              <button onClick={confirmDeleteMsg} style={{ flex: 1, padding: '10px 0', background: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#dc2626'} onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}>Șterge</button>
            </div>
          </div>
        </div>
      )}

      {chatToast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 9700, background: chatToast.type === 'error' ? '#ef4444' : '#111110', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none', whiteSpace: 'nowrap', animation: 'fadeInUp 0.2s ease' }}>
          {chatToast.message}
        </div>
      )}
    </>
  );
}
