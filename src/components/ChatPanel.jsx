import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { playReceived, playSent } from '../services/sounds';
import axios from 'axios';

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

// Aceeași formă de bifă — culoare diferită transmite starea
const CHECK_POINTS = "1 4.2 4.2 7.5 11 1";

// Văzut — bifă portocalie
function SeenIcon() {
  return (
    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
      <polyline
        points={CHECK_POINTS}
        stroke="#ff7a3d" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// Trimis — bifă albă semi-transparentă
function SentIcon() {
  return (
    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
      <polyline
        points={CHECK_POINTS}
        stroke="rgba(255,255,255,0.35)" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ChatPanel({ user }) {
  const [open, setOpen]           = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [slideDir, setSlideDir]   = useState('right'); // 'right' | 'left'
  const [view, setView]           = useState('contacts'); // 'contacts' | 'chat'
  const [peer, setPeer]           = useState(null);

  const [orgUsers, setOrgUsers]           = useState([]);
  const [onlineUsers, setOnlineUsers]     = useState([]);
  const [conversations, setConversations] = useState({});
  const [unreadCounts, setUnreadCounts]   = useState({});
  const [lastMessages, setLastMessages]   = useState({});
  const [totalUnread, setTotalUnread]     = useState(0);
  const [peerReadAt, setPeerReadAt]       = useState(null); // când peer-ul a citit ultima oară conv cu mine

  const [inputVal, setInputVal] = useState('');
  const [search, setSearch]     = useState('');

  const openRef        = useRef(false);
  const peerRef        = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const searchRef      = useRef(null);

  const token  = localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}` };

  // ── Load initial + socket listeners ───────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, onlineRes, unreadRes, lastRes] = await Promise.all([
          axios.get('/api/chat/users', { headers }),
          axios.get('/api/chat/online', { headers }),
          axios.get('/api/chat/unread', { headers }),
          axios.get('/api/chat/last-messages', { headers }),
        ]);
        setOrgUsers(usersRes.data);
        setOnlineUsers(onlineRes.data);
        setUnreadCounts(unreadRes.data);
        setLastMessages(lastRes.data);
        setTotalUnread(Object.values(unreadRes.data).reduce((a, b) => a + b, 0));
      } catch {}
    };
    load();

    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const isMine    = msg.username === user.username;
      const peerOfMsg = isMine ? msg.receiver_username : msg.username;

      setConversations(prev =>
        prev[peerOfMsg]
          ? { ...prev, [peerOfMsg]: [...prev[peerOfMsg], msg] }
          : prev
      );
      setLastMessages(prev => ({
        ...prev,
        [peerOfMsg]: { sender: msg.username, message: msg.message, created_at: msg.created_at },
      }));

      if (!isMine) {
        const chatOpen = openRef.current && peerRef.current?.username === peerOfMsg;
        if (chatOpen) {
          axios.put(`/api/chat/read/${peerOfMsg}`, {}, { headers }).catch(() => {});
        } else {
          playReceived(); // 🔔 notificare sonoră — mesaj nou în conversație inactivă
          setUnreadCounts(prev => {
            const updated = { ...prev, [peerOfMsg]: (prev[peerOfMsg] || 0) + 1 };
            setTotalUnread(Object.values(updated).reduce((a, b) => a + b, 0));
            return updated;
          });
        }
      }
    };

    const handleUsersOnline = (list) => setOnlineUsers(list);

    // Peer-ul a citit conversația noastră → actualizează read receipt
    const handlePeerRead = ({ reader, last_read_at }) => {
      if (reader === peerRef.current?.username) {
        setPeerReadAt(last_read_at);
      }
    };

    socket.on('new_private_message', handleNewMessage);
    socket.on('users_online', handleUsersOnline);
    socket.on('peer_read', handlePeerRead);

    return () => {
      socket.off('new_private_message', handleNewMessage);
      socket.off('users_online', handleUsersOnline);
      socket.off('peer_read', handlePeerRead);
    };
  }, []);

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { peerRef.current = peer; }, [peer]);

  // Auto-scroll la mesaje noi
  useEffect(() => {
    if (view === 'chat' && peer) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations]);

  // Focus input când intri în chat
  useEffect(() => {
    if (view === 'chat') {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        messagesEndRef.current?.scrollIntoView();
      });
    }
    if (view === 'contacts') {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [view, peer?.username]);

  // ── Acțiuni ───────────────────────────────────────────────
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => { setOpen(false); setIsClosing(false); setSlideDir('right'); }, 210);
  };

  const openConversation = async (u) => {
    setSlideDir('right');
    setPeer(u);
    setView('chat');
    setPeerReadAt(null);

    // Încarcă mesajele + read receipt în paralel
    const fetchMessages = !conversations[u.username]
      ? axios.get(`/api/chat/messages/${u.username}`, { headers })
      : Promise.resolve(null);
    const fetchPeerRead = axios.get(`/api/chat/peer-read/${u.username}`, { headers });

    const [msgsRes, prRes] = await Promise.allSettled([fetchMessages, fetchPeerRead]);

    if (msgsRes.status === 'fulfilled' && msgsRes.value) {
      setConversations(prev => ({ ...prev, [u.username]: msgsRes.value.data }));
    }
    if (prRes.status === 'fulfilled') {
      setPeerReadAt(prRes.value.data?.last_read_at || null);
    }

    // Marchează ca citit
    if (unreadCounts[u.username] > 0) {
      axios.put(`/api/chat/read/${u.username}`, {}, { headers }).catch(() => {});
      setUnreadCounts(prev => {
        const updated = { ...prev, [u.username]: 0 };
        setTotalUnread(Object.values(updated).reduce((a, b) => a + b, 0));
        return updated;
      });
    }
  };

  const goBack = () => {
    setSlideDir('left');
    setView('contacts');
    setPeer(null);
    setInputVal('');
    setPeerReadAt(null);
  };

  const sendMessage = async () => {
    const msg = inputVal.trim();
    if (!msg || !peer) return;
    setInputVal('');
    try {
      await axios.post('/api/chat/messages', { to: peer.username, message: msg }, { headers });
      playSent(); // 🔔 confirmare sonoră discretă la trimitere
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Helpers ───────────────────────────────────────────────
  const isOnline = (uname) => onlineUsers.includes(uname);

  const isRead = (msg) =>
    peerReadAt && new Date(peerReadAt) >= new Date(msg.created_at);

  const sortedUsers = [...orgUsers].sort((a, b) => {
    const ao = isOnline(a.username), bo = isOnline(b.username);
    if (ao && !bo) return -1;
    if (!ao && bo) return 1;
    const al = lastMessages[a.username]?.created_at || '';
    const bl = lastMessages[b.username]?.created_at || '';
    if (al > bl) return -1;
    if (bl > al) return 1;
    return a.username.localeCompare(b.username);
  });

  const filteredUsers = search.trim()
    ? sortedUsers.filter(u => u.username.toLowerCase().includes(search.trim().toLowerCase()))
    : sortedUsers;

  const messages = (peer && conversations[peer.username]) || [];

  // ── SVG helpers ───────────────────────────────────────────
  const CloseBtn = ({ onClick }) => (
    <button
      onClick={onClick}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6 }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>

      {/* ── Buton floating ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Mesaje"
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#ff7a3d', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(255,122,61,0.45)',
            transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative',
            animation: 'chatPanelIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(255,122,61,0.65)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,122,61,0.45)'; }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {totalUnread > 0 && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              background: '#ef4444', color: 'white', borderRadius: '50%',
              minWidth: 20, height: 20, fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--bg-body)', padding: '0 4px', boxSizing: 'border-box',
            }}>
              {totalUnread > 9 ? '9+' : totalUnread}
            </div>
          )}
        </button>
      )}

      {/* ── Panel ── */}
      {open && (
        <div style={{
          width: 340, height: 520, background: 'var(--bg-page)',
          border: '1px solid var(--gray-2)', borderRadius: 16,
          boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          animation: isClosing
            ? 'chatPanelOut 0.2s ease forwards'
            : 'chatPanelIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* ════ HEADER ════ */}
          {view === 'contacts' ? (
            <div style={{ flexShrink: 0 }}>
              {/* Titlu + close */}
              <div style={{
                padding: '13px 14px 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--gray-1)', borderBottom: '1px solid var(--gray-2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)' }}>Mesaje</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-4)' }}>
                    · {onlineUsers.filter(u => u !== user.username).length} online
                  </span>
                </div>
                <CloseBtn onClick={handleClose} />
              </div>

              {/* Căutare user */}
              <div style={{ padding: '8px 12px', background: 'var(--bg-page)', borderBottom: '1px solid var(--gray-2)' }}>
                <div style={{ position: 'relative' }}>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="var(--gray-4)" strokeWidth="2"
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  >
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Caută după nume..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '7px 10px 7px 30px',
                      border: '1px solid var(--gray-3)', borderRadius: 8,
                      fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)',
                      outline: 'none', fontFamily: 'inherit',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                    onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--gray-4)', padding: 2, display: 'flex', alignItems: 'center',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Header conversație */
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--gray-2)',
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--gray-1)', flexShrink: 0,
            }}>
              <button
                onClick={goBack}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px 4px 2px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: peer ? avatarColor(peer.username) : '#ff7a3d',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 600, fontSize: 15,
                }}>
                  {peer?.username.charAt(0).toUpperCase()}
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 10, height: 10, borderRadius: '50%',
                  background: isOnline(peer?.username) ? '#22c55e' : 'var(--gray-3)',
                  border: '2px solid var(--gray-1)',
                }}/>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)', lineHeight: 1.2 }}>
                  {peer?.username}
                </div>
                <div style={{ fontSize: 11, color: isOnline(peer?.username) ? '#22c55e' : 'var(--gray-4)' }}>
                  {isOnline(peer?.username) ? 'online' : 'offline'}
                </div>
              </div>

              <CloseBtn onClick={handleClose} />
            </div>
          )}

          {/* ════ CONTACTS LIST ════ */}
          {view === 'contacts' && (
            <div className="chat-scroll" style={{
              flex: 1, overflowY: 'auto',
              animation: slideDir === 'left' ? 'chatSlideFromLeft 0.2s ease' : 'none',
            }}>
              {filteredUsers.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, marginTop: 60, lineHeight: 1.7 }}>
                  {search ? `Niciun user „${search}"` : 'Niciun coleg în organizație.'}
                </div>
              )}

              {filteredUsers.map((u, i) => {
                const last   = lastMessages[u.username];
                const unread = unreadCounts[u.username] || 0;
                const online = isOnline(u.username);

                return (
                  <div
                    key={u.username}
                    onClick={() => openConversation(u)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '10px 14px',
                      borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--gray-2)' : 'none',
                      cursor: 'pointer', background: 'transparent', transition: 'background 0.12s',
                      animation: 'chatItemIn 0.22s ease both',
                      animationDelay: `${Math.min(i * 40, 220)}ms`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Avatar + dot online */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: '50%',
                        background: avatarColor(u.username),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 600, fontSize: 17,
                      }}>
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div style={{
                        position: 'absolute', bottom: 1, right: 1,
                        width: 11, height: 11, borderRadius: '50%',
                        background: online ? '#22c55e' : 'var(--gray-3)',
                        border: '2px solid var(--bg-page)', transition: 'background 0.3s',
                      }}/>
                    </div>

                    {/* Texte */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: unread > 0 ? 700 : 500, color: 'var(--black)' }}>
                          {u.username}
                        </span>
                        {last && (
                          <span style={{ fontSize: 11, color: 'var(--gray-4)', flexShrink: 0 }}>
                            {formatTime(last.created_at)}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{
                          fontSize: 12,
                          color: unread > 0 ? 'var(--black)' : 'var(--gray-4)',
                          fontWeight: unread > 0 ? 500 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                        }}>
                          {last
                            ? (last.sender === user.username ? `Tu: ${last.message}` : last.message)
                            : <em style={{ fontStyle: 'italic', opacity: 0.7 }}>{roleLabel(u.role)}</em>
                          }
                        </span>
                        {unread > 0 && (
                          <div style={{
                            background: '#ff7a3d', color: 'white', borderRadius: 10,
                            minWidth: 18, height: 18, fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '0 5px', flexShrink: 0,
                          }}>
                            {unread > 9 ? '9+' : unread}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ════ CONVERSAȚIE ════ */}
          {view === 'chat' && (
            <div style={{
              display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
              animation: 'chatSlideFromRight 0.2s ease',
            }}>
              {/* Mesaje */}
              <div className="chat-scroll" style={{
                flex: 1, overflowY: 'auto', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, marginTop: 70, lineHeight: 1.8 }}>
                    Niciun mesaj cu {peer?.username}.<br/><span style={{ fontSize: 20 }}>👋</span>
                  </div>
                )}

                {messages.map((msg, i) => {
                  const isMe    = msg.username === user.username;
                  const nextSame = i < messages.length - 1 && messages[i + 1].username === msg.username;
                  const showMeta = !nextSame; // arată timestamp + read receipt doar sub ultimul dintr-un grup

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        marginBottom: nextSame ? 1 : 4,
                      }}
                    >
                      <div style={{
                        maxWidth: '80%', padding: '8px 12px',
                        borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                        background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)',
                        color: isMe ? 'var(--chat-sent-text)' : 'var(--chat-recv-text)',
                        fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word',
                      }}>
                        {msg.message}
                      </div>

                      {showMeta && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          marginTop: 2,
                          paddingLeft: isMe ? 0 : 4,
                          paddingRight: isMe ? 4 : 0,
                          flexDirection: isMe ? 'row-reverse' : 'row',
                        }}>
                          <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>
                            {formatTime(msg.created_at)}
                          </span>
                          {/* Read receipt — doar la mesajele mele */}
                          {isMe && (
                            <span title={isRead(msg) ? 'Văzut' : 'Trimis'}>
                              {isRead(msg)
                                ? <SeenIcon />
                                : <SentIcon />
                              }
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef}/>
              </div>

              {/* Input */}
              <div style={{
                padding: '10px 12px', borderTop: '1px solid var(--gray-2)',
                display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
              }}>
                <textarea
                  ref={inputRef}
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Mesaj pentru ${peer?.username}...`}
                  rows={1}
                  className="chat-scroll"
                  style={{
                    flex: 1, resize: 'none', border: '1px solid var(--gray-3)',
                    borderRadius: 10, padding: '9px 12px', fontSize: 14,
                    background: 'var(--gray-1)', color: 'var(--black)', outline: 'none',
                    fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 80, overflowY: 'auto',
                    transition: 'border-color 0.2s', boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputVal.trim()}
                  style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: inputVal.trim() ? '#ff7a3d' : 'var(--gray-2)',
                    border: 'none', cursor: inputVal.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="white" stroke="none">
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
