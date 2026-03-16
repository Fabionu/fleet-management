import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import axios from 'axios';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60000) return 'acum';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
}

export default function ChatPanel({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [readStatus, setReadStatus] = useState({});
  const [inputVal, setInputVal] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const openRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const token = localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}` };

  // Load initial data + setup socket listeners
  useEffect(() => {
    const loadData = async () => {
      try {
        const [msgsRes, readRes, onlineRes] = await Promise.all([
          axios.get('/api/chat/messages', { headers }),
          axios.get('/api/chat/read', { headers }),
          axios.get('/api/chat/online', { headers }),
        ]);

        setMessages(msgsRes.data);
        setOnlineUsers(onlineRes.data);

        const readMap = {};
        readRes.data.forEach(r => { readMap[r.username] = r.last_read_at; });
        setReadStatus(readMap);

        const myLastRead = readMap[user.username];
        const unread = msgsRes.data.filter(m =>
          m.username !== user.username &&
          (!myLastRead || new Date(m.created_at) > new Date(myLastRead))
        ).length;
        setUnreadCount(unread);
      } catch {}
    };

    loadData();

    const socket = getSocket();
    if (socket) {
      const handleNewMessage = (msg) => {
        setMessages(prev => [...prev, msg]);
        if (msg.username !== user.username && !openRef.current) {
          setUnreadCount(prev => prev + 1);
        }
      };
      const handleUsersOnline = (list) => setOnlineUsers(list);
      const handleUserRead = ({ username, last_read_at }) => {
        setReadStatus(prev => ({ ...prev, [username]: last_read_at }));
      };

      socket.on('new_message', handleNewMessage);
      socket.on('users_online', handleUsersOnline);
      socket.on('user_read', handleUserRead);

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('users_online', handleUsersOnline);
        socket.off('user_read', handleUserRead);
      };
    }
  }, []);

  // Keep openRef in sync with open state (avoid stale closure)
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // When panel opens: reset badge, mark as read, scroll & focus
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      markRead();
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView();
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Auto-scroll when new messages arrive while panel is open
  useEffect(() => {
    if (open && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const markRead = async () => {
    try {
      await axios.put('/api/chat/read', {}, { headers });
      const now = new Date().toISOString();
      setReadStatus(prev => ({ ...prev, [user.username]: now }));
    } catch {}
  };

  const sendMessage = async () => {
    const msg = inputVal.trim();
    if (!msg) return;
    setInputVal('');
    try {
      await axios.post('/api/chat/messages', { message: msg }, { headers });
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* ── Floating button ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Chat intern"
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
          {unreadCount > 0 && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              background: '#ef4444', color: 'white',
              borderRadius: '50%', minWidth: 20, height: 20,
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--bg-body)',
              padding: '0 4px', boxSizing: 'border-box',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div style={{
          width: 360, height: 500,
          background: 'var(--bg-page)',
          border: '1px solid var(--gray-2)',
          borderRadius: 16,
          boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '13px 16px',
            borderBottom: '1px solid var(--gray-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--gray-1)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)' }}>
                Chat intern
              </span>
              {onlineUsers.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--gray-4)' }}>
                  · {onlineUsers.length} online
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 4, color: 'var(--gray-4)',
                display: 'flex', alignItems: 'center', borderRadius: 6,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Online users strip */}
          {onlineUsers.length > 0 && (
            <div style={{
              padding: '7px 14px',
              borderBottom: '1px solid var(--gray-2)',
              display: 'flex', gap: 14, flexWrap: 'wrap',
              flexShrink: 0, background: 'var(--bg-page)',
            }}>
              {onlineUsers.map(u => (
                <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#22c55e', flexShrink: 0,
                  }}/>
                  <span style={{ fontSize: 12, color: 'var(--black)', fontWeight: 500 }}>
                    {u}
                  </span>
                  {readStatus[u] && (
                    <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>
                      · {formatRelative(readStatus[u])}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Messages list */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center', color: 'var(--gray-4)',
                fontSize: 13, marginTop: 60, lineHeight: 1.7,
              }}>
                Niciun mesaj încă.<br/>Fii primul! 👋
              </div>
            )}

            {messages.map((msg, i) => {
              const isMe = msg.username === user.username;
              const showName = !isMe && (i === 0 || messages[i - 1].username !== msg.username);
              const isLast = i === messages.length - 1;
              const nextIsSame = !isLast && messages[i + 1].username === msg.username;

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    marginBottom: nextIsSame ? 1 : 6,
                  }}
                >
                  {showName && (
                    <span style={{
                      fontSize: 11, color: 'var(--gray-4)',
                      marginBottom: 2, paddingLeft: 4, fontWeight: 500,
                    }}>
                      {msg.username}
                    </span>
                  )}
                  <div style={{
                    maxWidth: '78%',
                    padding: '8px 12px',
                    borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                    background: isMe ? '#ff7a3d' : 'var(--gray-1)',
                    color: isMe ? 'white' : 'var(--black)',
                    fontSize: 14, lineHeight: 1.45,
                    wordBreak: 'break-word',
                  }}>
                    {msg.message}
                  </div>
                  <span style={{
                    fontSize: 10, color: 'var(--gray-3)',
                    marginTop: 2,
                    paddingLeft: isMe ? 0 : 4,
                    paddingRight: isMe ? 4 : 0,
                  }}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
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
              placeholder="Scrie un mesaj... (Enter = trimite)"
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
        </div>
      )}
    </div>
  );
}
