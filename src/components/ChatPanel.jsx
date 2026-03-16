import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
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

export default function ChatPanel({ user }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('contacts'); // 'contacts' | 'chat'
  const [peer, setPeer] = useState(null);        // { username, role }

  const [orgUsers, setOrgUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [conversations, setConversations] = useState({}); // peerUsername → [messages]
  const [unreadCounts, setUnreadCounts] = useState({});   // peerUsername → number
  const [lastMessages, setLastMessages] = useState({});   // peerUsername → { sender, message, created_at }
  const [totalUnread, setTotalUnread] = useState(0);

  const [inputVal, setInputVal] = useState('');

  const openRef = useRef(false);
  const peerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const token = localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}` };

  // ── Load initial data + socket listeners ──────────────────
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
        const total = Object.values(unreadRes.data).reduce((a, b) => a + b, 0);
        setTotalUnread(total);
      } catch {}
    };
    load();

    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const isMine = msg.username === user.username;
      const peerOfMsg = isMine ? msg.receiver_username : msg.username;

      // Adaugă în conversația cache-uită (dacă e deja deschisă)
      setConversations(prev =>
        prev[peerOfMsg]
          ? { ...prev, [peerOfMsg]: [...prev[peerOfMsg], msg] }
          : prev
      );

      // Actualizează preview-ul din contacts
      setLastMessages(prev => ({
        ...prev,
        [peerOfMsg]: { sender: msg.username, message: msg.message, created_at: msg.created_at },
      }));

      // Unread doar pentru mesaje primite, și doar dacă nu suntem în acea conv
      if (!isMine) {
        const chatOpen = openRef.current && peerRef.current?.username === peerOfMsg;
        if (chatOpen) {
          // Panel deschis pe acea conversație → marchează automat ca citit
          axios.put(`/api/chat/read/${peerOfMsg}`, {}, { headers }).catch(() => {});
        } else {
          setUnreadCounts(prev => {
            const updated = { ...prev, [peerOfMsg]: (prev[peerOfMsg] || 0) + 1 };
            setTotalUnread(Object.values(updated).reduce((a, b) => a + b, 0));
            return updated;
          });
        }
      }
    };

    const handleUsersOnline = (list) => setOnlineUsers(list);

    socket.on('new_private_message', handleNewMessage);
    socket.on('users_online', handleUsersOnline);

    return () => {
      socket.off('new_private_message', handleNewMessage);
      socket.off('users_online', handleUsersOnline);
    };
  }, []);

  // Ține ref-urile sincronizate (evită stale closure în socket handler)
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { peerRef.current = peer; }, [peer]);

  // Auto-scroll la mesaje noi în conversația activă
  useEffect(() => {
    if (view === 'chat' && peer) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations]);

  // Focus input când intri în conversație
  useEffect(() => {
    if (view === 'chat') {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        messagesEndRef.current?.scrollIntoView();
      });
    }
  }, [view, peer?.username]);

  // ── Acțiuni ───────────────────────────────────────────────
  const openConversation = async (u) => {
    setPeer(u);
    setView('chat');

    // Încarcă mesajele dacă nu sunt în cache
    if (!conversations[u.username]) {
      try {
        const res = await axios.get(`/api/chat/messages/${u.username}`, { headers });
        setConversations(prev => ({ ...prev, [u.username]: res.data }));
      } catch {}
    }

    // Marchează ca citit dacă sunt mesaje necitite
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
    setView('contacts');
    setPeer(null);
    setInputVal('');
  };

  const sendMessage = async () => {
    const msg = inputVal.trim();
    if (!msg || !peer) return;
    setInputVal('');
    try {
      await axios.post('/api/chat/messages', { to: peer.username, message: msg }, { headers });
      // Mesajul vine înapoi prin socket (camera privată a sender-ului)
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Helpers ───────────────────────────────────────────────
  const isOnline = (uname) => onlineUsers.includes(uname);

  const sortedUsers = [...orgUsers].sort((a, b) => {
    const ao = isOnline(a.username), bo = isOnline(b.username);
    if (ao && !bo) return -1;
    if (!ao && bo) return 1;
    // Conversațiile cu mesaje recente vin primele
    const al = lastMessages[a.username]?.created_at || '';
    const bl = lastMessages[b.username]?.created_at || '';
    if (al > bl) return -1;
    if (bl > al) return 1;
    return a.username.localeCompare(b.username);
  });

  const messages = (peer && conversations[peer.username]) || [];

  // ── Stiluri comune ────────────────────────────────────────
  const panelStyle = {
    width: 340, height: 520,
    background: 'var(--bg-page)',
    border: '1px solid var(--gray-2)',
    borderRadius: 16,
    boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  };

  const iconBtn = (hover) => ({
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: 5, color: 'var(--gray-4)',
    display: 'flex', alignItems: 'center', borderRadius: 6,
    transition: 'color 0.15s',
  });

  const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
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
            transition: 'transform 0.2s, box-shadow 0.2s',
            position: 'relative',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 22px rgba(255,122,61,0.65)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,122,61,0.45)';
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {totalUnread > 0 && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              background: '#ef4444', color: 'white',
              borderRadius: '50%', minWidth: 20, height: 20,
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--bg-body)', padding: '0 4px',
              boxSizing: 'border-box',
            }}>
              {totalUnread > 9 ? '9+' : totalUnread}
            </div>
          )}
        </button>
      )}

      {/* ── Panel ── */}
      {open && (
        <div style={panelStyle}>

          {/* ════ HEADER ════ */}
          {view === 'contacts' ? (
            /* Header contacts */
            <div style={{
              padding: '13px 14px',
              borderBottom: '1px solid var(--gray-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--gray-1)', flexShrink: 0,
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
              <button
                style={iconBtn()}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
          ) : (
            /* Header conversație */
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--gray-2)',
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--gray-1)', flexShrink: 0,
            }}>
              {/* Back */}
              <button
                style={iconBtn()}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}
                onClick={goBack}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              {/* Avatar */}
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

              {/* Info peer */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)', lineHeight: 1.2 }}>
                  {peer?.username}
                </div>
                <div style={{ fontSize: 11, color: isOnline(peer?.username) ? '#22c55e' : 'var(--gray-4)' }}>
                  {isOnline(peer?.username) ? 'online' : 'offline'}
                </div>
              </div>

              {/* Close */}
              <button
                style={iconBtn()}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
          )}

          {/* ════ CONTACTS LIST ════ */}
          {view === 'contacts' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sortedUsers.length === 0 && (
                <div style={{
                  textAlign: 'center', color: 'var(--gray-4)',
                  fontSize: 13, marginTop: 70, lineHeight: 1.7,
                }}>
                  Niciun coleg în organizație.
                </div>
              )}

              {sortedUsers.map((u, i) => {
                const last = lastMessages[u.username];
                const unread = unreadCounts[u.username] || 0;
                const online = isOnline(u.username);
                const isLast = i === sortedUsers.length - 1;

                return (
                  <div
                    key={u.username}
                    onClick={() => openConversation(u)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '10px 14px',
                      borderBottom: isLast ? 'none' : '1px solid var(--gray-2)',
                      cursor: 'pointer', background: 'transparent',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Avatar cu dot online */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: '50%',
                        background: avatarColor(u.username),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 600, fontSize: 17,
                      }}>
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      {/* Dot online/offline */}
                      <div style={{
                        position: 'absolute', bottom: 1, right: 1,
                        width: 11, height: 11, borderRadius: '50%',
                        background: online ? '#22c55e' : 'var(--gray-3)',
                        border: '2px solid var(--bg-page)',
                        transition: 'background 0.3s',
                      }}/>
                    </div>

                    {/* Texte */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', marginBottom: 3,
                      }}>
                        <span style={{
                          fontSize: 14, fontWeight: unread > 0 ? 700 : 500,
                          color: 'var(--black)',
                        }}>
                          {u.username}
                        </span>
                        {last && (
                          <span style={{ fontSize: 11, color: 'var(--gray-4)', flexShrink: 0 }}>
                            {formatTime(last.created_at)}
                          </span>
                        )}
                      </div>

                      <div style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 6,
                      }}>
                        <span style={{
                          fontSize: 12,
                          color: unread > 0 ? 'var(--black)' : 'var(--gray-4)',
                          fontWeight: unread > 0 ? 500 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', flex: 1,
                        }}>
                          {last
                            ? (last.sender === user.username
                                ? `Tu: ${last.message}`
                                : last.message)
                            : <em style={{ fontStyle: 'italic', opacity: 0.7 }}>{roleLabel(u.role)}</em>
                          }
                        </span>
                        {unread > 0 && (
                          <div style={{
                            background: '#ff7a3d', color: 'white',
                            borderRadius: 10, minWidth: 18, height: 18,
                            fontSize: 11, fontWeight: 700,
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
            <>
              {/* Mesaje */}
              <div style={{
                flex: 1, overflowY: 'auto', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                {messages.length === 0 && (
                  <div style={{
                    textAlign: 'center', color: 'var(--gray-4)',
                    fontSize: 13, marginTop: 70, lineHeight: 1.8,
                  }}>
                    Niciun mesaj cu {peer?.username}.<br/>
                    <span style={{ fontSize: 20 }}>👋</span>
                  </div>
                )}

                {messages.map((msg, i) => {
                  const isMe = msg.username === user.username;
                  const nextSame = i < messages.length - 1 &&
                    messages[i + 1].username === msg.username;
                  const showTime = !nextSame;

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
                        maxWidth: '80%',
                        padding: '8px 12px',
                        borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                        background: isMe ? '#ff7a3d' : 'var(--gray-1)',
                        color: isMe ? 'white' : 'var(--black)',
                        fontSize: 14, lineHeight: 1.45,
                        wordBreak: 'break-word',
                      }}>
                        {msg.message}
                      </div>
                      {showTime && (
                        <span style={{
                          fontSize: 10, color: 'var(--gray-3)', marginTop: 2,
                          paddingLeft: isMe ? 0 : 4,
                          paddingRight: isMe ? 4 : 0,
                        }}>
                          {formatTime(msg.created_at)}
                        </span>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef}/>
              </div>

              {/* Input */}
              <div style={{
                padding: '10px 12px',
                borderTop: '1px solid var(--gray-2)',
                display: 'flex', gap: 8, alignItems: 'flex-end',
                flexShrink: 0,
              }}>
                <textarea
                  ref={inputRef}
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Mesaj pentru ${peer?.username}...`}
                  rows={1}
                  style={{
                    flex: 1, resize: 'none',
                    border: '1px solid var(--gray-3)',
                    borderRadius: 10, padding: '9px 12px',
                    fontSize: 14, background: 'var(--gray-1)',
                    color: 'var(--black)', outline: 'none',
                    fontFamily: 'inherit', lineHeight: 1.4,
                    maxHeight: 80, overflowY: 'auto',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
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
                    border: 'none',
                    cursor: inputVal.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="white" stroke="none">
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
