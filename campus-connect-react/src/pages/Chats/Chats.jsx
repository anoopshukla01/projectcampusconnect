/**
 * Chats — All Portals (Student, Professor, Admin, TPO)
 *
 * Role-aware conversations:
 *   - Direct 1:1  (student↔student, student↔professor, any↔any)
 *   - Private group (any role can create/join)
 *   - Official/Subject groups (created server-side; read-only membership)
 *
 * All API calls go through chatsApi from services/api.js — no raw fetch.
 * Message history polls every 3 s for lightweight real-time simulation.
 *
 * IDOR: membership checked server-side on every message/action endpoint.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { chatsApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Chats.css';

const CATEGORY_ICONS = { official: '📢', subject: '📚', private: '👥', direct: '💬' };

export default function Chats() {
  const { user } = useAuth();
  const showToast = useToast();
  const msgRef = useRef(null);

  // ── Conversation list ──────────────────────────────────────────────────────
  // Chats are mounted at /api/v1/career/chats in the backend
  const { data: apiData, loading, error, isEmpty, refetch: refetchRooms } = useApiData(
    '/career/chats',
    { rooms: [] },
  );

  const [rooms,          setRooms]          = useState([]);
  const [activeId,       setActiveId]       = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [loadingMsgs,    setLoadingMsgs]    = useState(false);
  const [messageText,    setMessageText]    = useState('');
  const [sending,        setSending]        = useState(false);

  useEffect(() => {
    if (apiData?.rooms) setRooms(apiData.rooms);
  }, [apiData]);

  // ── Message history + 3-second poll ───────────────────────────────────────
  const fetchMessages = useCallback(async (showSpinner = false) => {
    if (!activeId) return;
    if (showSpinner) setLoadingMsgs(true);
    const res = await chatsApi.getMessages(activeId);
    if (showSpinner) setLoadingMsgs(false);
    if (res?.messages) setMessages(res.messages);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    fetchMessages(true);
    const id = setInterval(() => fetchMessages(false), 3000);
    return () => clearInterval(id);
  }, [activeId, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
  }, [messages]);

  // ── Start-chat modal state ─────────────────────────────────────────────────
  const [showModal,          setShowModal]          = useState(false);
  const [startStep,          setStartStep]          = useState('menu');
  const [contacts,           setContacts]           = useState({ students: [], professors: [] });
  const [loadingContacts,    setLoadingContacts]    = useState(false);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [groupName,          setGroupName]          = useState('');
  const [selectedInviteIds,  setSelectedInviteIds]  = useState([]);
  const [joinGroupId,        setJoinGroupId]        = useState('');

  // ── Group admin panel ──────────────────────────────────────────────────────
  const [showAdminPanel,    setShowAdminPanel]    = useState(false);
  const [adminAction,       setAdminAction]       = useState(null);
  const [adminTargetUserId, setAdminTargetUserId] = useState('');

  const openModal = () => {
    setStartStep('menu');
    setSearchQuery('');
    setGroupName('');
    setSelectedInviteIds([]);
    setJoinGroupId('');
    setShowModal(true);
  };

  const loadContacts = async () => {
    setLoadingContacts(true);
    const res = await chatsApi.getContacts();
    setLoadingContacts(false);
    if (res?.error) { showToast('Could not load campus directory.', 'error'); return; }
    setContacts({ students: res.students || [], professors: res.professors || [] });
  };

  const handleMenuOption = (step) => {
    setStartStep(step);
    if (['direct_student', 'direct_professor', 'create_group'].includes(step)) loadContacts();
  };

  // ── Start direct chat ──────────────────────────────────────────────────────
  async function startDirectChat(recipientId) {
    const res = await chatsApi.createConversation({ type: 'direct', recipient_id: recipientId });
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Conversation started.', 'success');
    setActiveId(res.conversation_id);
    setShowModal(false);
    refetchRooms();
  }

  // ── Create private group ───────────────────────────────────────────────────
  async function createPrivateGroup(e) {
    e.preventDefault();
    if (!groupName.trim()) return;
    const res = await chatsApi.createConversation({
      type:             'private',
      name:             groupName.trim(),
      invited_user_ids: selectedInviteIds,
    });
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`Group "${groupName}" created!`, 'success');
    setActiveId(res.conversation_id);
    setShowModal(false);
    refetchRooms();
  }

  // ── Join group by UUID ─────────────────────────────────────────────────────
  async function joinGroupById(e) {
    e.preventDefault();
    if (!joinGroupId.trim()) return;
    const res = await chatsApi.joinGroup(joinGroupId.trim());
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`Joined group "${res.name || 'Private Group'}"`, 'success');
    setActiveId(res.conversation_id);
    setShowModal(false);
    refetchRooms();
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function handleSend(e) {
    e.preventDefault();
    const content = messageText.trim();
    if (!content || !activeId) return;
    setMessageText('');
    setSending(true);
    const res = await chatsApi.sendMessage(activeId, content);
    setSending(false);
    if (res?.error) {
      showToast('Failed to send message.', 'error');
      setMessageText(content);
      return;
    }
    setMessages(prev => [...prev, res]);
    refetchRooms();
  }

  // ── Leave group ────────────────────────────────────────────────────────────
  async function handleLeave() {
    if (!window.confirm('Leave this group?')) return;
    const res = await chatsApi.leaveGroup(activeId);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Left group.', 'success');
    setActiveId(null);
    refetchRooms();
  }

  // ── Add / promote member ───────────────────────────────────────────────────
  async function handleAdminAction(e) {
    e.preventDefault();
    if (!adminTargetUserId) return;
    const res = adminAction === 'add'
      ? await chatsApi.addMember(activeId, adminTargetUserId)
      : await chatsApi.promoteMember(activeId, adminTargetUserId);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(adminAction === 'add' ? 'Member added.' : 'Member promoted to co-admin.', 'success');
    setAdminTargetUserId('');
    setAdminAction(null);
    setShowAdminPanel(false);
  }

  // ── Filtered contacts ──────────────────────────────────────────────────────
  const filteredStudents  = contacts.students.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.roll?.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredProfessors = contacts.professors.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.designation?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeChat = rooms.find(r => r.id === activeId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="chats-layout">
      {/* Sidebar */}
      <aside className="chats-list-panel panel" aria-label="Conversations">
        <div className="chats-list-header">
          <h1 className="page-title" style={{ fontSize: '1.1rem', margin: 0 }}>Messages</h1>
          <button className="action-btn start-conv-btn" onClick={openModal}>➕ Start Chat</button>
        </div>
        <StateContainer loading={loading} error={error} isEmpty={isEmpty}
          emptyMessage="No active chats. Start one below!">
          <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rooms.map(r => (
              <li key={r.id}>
                <button
                  className={`chat-item${activeId === r.id ? ' active' : ''}`}
                  onClick={() => setActiveId(r.id)}>
                  <div className="chat-avatar">{CATEGORY_ICONS[r.type] || '💬'}</div>
                  <div className="chat-item-body">
                    <div className="chat-item-row">
                      <span className="chat-name">{r.name}</span>
                      <span className="chat-time">{r.lastTime || ''}</span>
                    </div>
                    <span className="chat-preview">{r.lastMessage || 'No messages yet'}</span>
                  </div>
                  {r.unread && <span className="chat-dot" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </StateContainer>
      </aside>

      {/* Chat window */}
      <section className="chat-window panel" aria-label="Active chat messages">
        {!activeChat ? (
          <div className="chat-empty">
            <span style={{ fontSize: '2.5rem' }}>💬</span>
            <h3>Stay connected with Campus</h3>
            <p style={{ color: 'var(--clr-muted)', fontSize: '0.85rem' }}>
              Select a conversation or click <strong>Start Chat</strong> to begin.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-window-header">
              <div className="chat-avatar-lg">{CATEGORY_ICONS[activeChat.type] || '💬'}</div>
              <div style={{ flex: 1 }}>
                <div className="chat-window-name">{activeChat.name}</div>
                <div className="chat-window-meta">
                  {activeChat.type.toUpperCase()}
                  {activeChat.class_code && ` · ${activeChat.class_code}`}
                  {activeChat.user_role && ` · ${activeChat.user_role.toUpperCase()}`}
                </div>
              </div>
              {activeChat.type === 'private' && (
                <div className="group-actions-container">
                  <button className="action-btn btn-sm"
                    onClick={() => setShowAdminPanel(p => !p)}>
                    ⚙️ Group Info
                  </button>
                  {showAdminPanel && (
                    <div className="group-admin-dropdown">
                      <div className="dropdown-section">
                        <strong>Group Actions</strong>
                        <button className="dropdown-item text-danger" onClick={handleLeave}>
                          Leave Group
                        </button>
                      </div>
                      {(activeChat.user_role === 'admin' || activeChat.user_role === 'co_admin') && (
                        <div className="dropdown-section mt-2">
                          <strong>Admin Options</strong>
                          <button className="dropdown-item"
                            onClick={() => { setAdminAction('add'); loadContacts(); }}>
                            Add Member
                          </button>
                          <button className="dropdown-item"
                            onClick={() => { setAdminAction('promote'); loadContacts(); }}>
                            Promote to Co-Admin
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Admin action bar */}
            {activeChat.type === 'private' && adminAction && (
              <div className="admin-action-bar">
                <form onSubmit={handleAdminAction}>
                  <label>
                    {adminAction === 'add' ? 'Add Member:' : 'Promote to Co-Admin:'}
                    <select value={adminTargetUserId}
                      onChange={e => setAdminTargetUserId(e.target.value)} required>
                      <option value="">— Choose student —</option>
                      {contacts.students.map(s => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.name} ({s.roll})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="action-btn btn-sm">Confirm</button>
                  <button type="button" className="action-btn btn-sm"
                    style={{ background: 'transparent', color: 'var(--clr-muted)' }}
                    onClick={() => setAdminAction(null)}>
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Messages */}
            <div className="chat-messages" ref={msgRef}>
              {loadingMsgs ? (
                <div className="chat-empty">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="chat-empty">No messages yet. Say hello! 👋</div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`message${m.out ? ' outgoing' : ''}`}>
                    {!m.out && <span className="msg-sender">{m.sender}</span>}
                    <div className="msg-bubble">{m.text}</div>
                    <span className="msg-time">{m.time}</span>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <form className="chat-input-row" onSubmit={handleSend}>
              <input className="chat-input" type="text"
                placeholder="Type a message…"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                aria-label="Type a message"
                required />
              <button type="submit" className="send-btn action-btn"
                disabled={!messageText.trim() || sending}
                aria-label="Send">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </form>
          </>
        )}
      </section>

      {/* Start Conversation Modal */}
      {showModal && (
        <div className="chat-modal-overlay">
          <div className="chat-modal">
            <div className="chat-modal-header">
              <h3>
                {{
                  menu:             'Start Conversation',
                  direct_student:   'Message a Student',
                  direct_professor: 'Message a Professor',
                  create_group:     'Create Private Group',
                  join_group:       'Join Group by ID',
                }[startStep]}
              </h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="chat-modal-content">
              {/* Menu */}
              {startStep === 'menu' && (
                <div className="menu-options-list">
                  <button className="menu-opt" onClick={() => handleMenuOption('direct_student')}>
                    💬 Message a Student
                  </button>
                  <button className="menu-opt" onClick={() => handleMenuOption('direct_professor')}>
                    🎓 Message a Professor
                  </button>
                  <button className="menu-opt" onClick={() => handleMenuOption('create_group')}>
                    👥 Create Group
                  </button>
                  <button className="menu-opt" onClick={() => handleMenuOption('join_group')}>
                    🔗 Join Group by ID
                  </button>
                </div>
              )}

              {/* Students */}
              {startStep === 'direct_student' && (
                <div>
                  <input className="modal-search-input" type="text"
                    placeholder="Search by name or roll number…"
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {loadingContacts ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>Loading…</div>
                  ) : filteredStudents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--clr-muted)' }}>
                      No students found.
                    </div>
                  ) : (
                    <div className="modal-scroll-list">
                      {filteredStudents.map(s => (
                        <button key={s.user_id} className="contact-list-item"
                          onClick={() => startDirectChat(s.user_id)}>
                          <div><strong>{s.name}</strong></div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--clr-muted)' }}>
                            {s.roll} · {s.branch}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="action-btn" style={{ marginTop: '0.75rem', opacity: 0.7 }}
                    onClick={() => setStartStep('menu')}>← Back</button>
                </div>
              )}

              {/* Professors */}
              {startStep === 'direct_professor' && (
                <div>
                  <input className="modal-search-input" type="text"
                    placeholder="Search by name or designation…"
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {loadingContacts ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>Loading…</div>
                  ) : filteredProfessors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--clr-muted)' }}>
                      No professors found.
                    </div>
                  ) : (
                    <div className="modal-scroll-list">
                      {filteredProfessors.map(p => (
                        <button key={p.user_id} className="contact-list-item"
                          onClick={() => startDirectChat(p.user_id)}>
                          <div><strong>{p.name}</strong></div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--clr-muted)' }}>
                            {p.designation}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="action-btn" style={{ marginTop: '0.75rem', opacity: 0.7 }}
                    onClick={() => setStartStep('menu')}>← Back</button>
                </div>
              )}

              {/* Create group */}
              {startStep === 'create_group' && (
                <form onSubmit={createPrivateGroup}>
                  <label className="form-label">
                    Group Name:
                    <input className="form-input" type="text"
                      placeholder="e.g. Hackathon Team"
                      value={groupName} onChange={e => setGroupName(e.target.value)} required />
                  </label>
                  <label className="form-label" style={{ marginTop: '0.75rem' }}>
                    Invite Students (optional):
                    <div className="invite-selection-box">
                      {loadingContacts ? <div>Loading…</div> : contacts.students.map(s => {
                        const checked = selectedInviteIds.includes(s.user_id);
                        return (
                          <label key={s.user_id} className="invite-checkbox-row">
                            <input type="checkbox" checked={checked}
                              onChange={() => setSelectedInviteIds(
                                p => checked ? p.filter(id => id !== s.user_id) : [...p, s.user_id],
                              )} />
                            <span>{s.name} ({s.roll})</span>
                          </label>
                        );
                      })}
                    </div>
                  </label>
                  <div className="modal-footer-row" style={{ marginTop: '1rem' }}>
                    <button type="button" className="action-btn" style={{ opacity: 0.7 }}
                      onClick={() => setStartStep('menu')}>← Back</button>
                    <button type="submit" className="action-btn" disabled={!groupName.trim()}>Create</button>
                  </div>
                </form>
              )}

              {/* Join group */}
              {startStep === 'join_group' && (
                <form onSubmit={joinGroupById}>
                  <label className="form-label">
                    Group ID (UUID):
                    <input className="form-input" type="text"
                      placeholder="Paste UUID here…"
                      value={joinGroupId} onChange={e => setJoinGroupId(e.target.value)} required />
                  </label>
                  <p style={{ fontSize: '0.72rem', color: 'var(--clr-muted)', marginTop: '0.4rem' }}>
                    Paste the conversation UUID shared by the group admin.
                  </p>
                  <div className="modal-footer-row" style={{ marginTop: '1rem' }}>
                    <button type="button" className="action-btn" style={{ opacity: 0.7 }}
                      onClick={() => setStartStep('menu')}>← Back</button>
                    <button type="submit" className="action-btn" disabled={!joinGroupId.trim()}>Join</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
