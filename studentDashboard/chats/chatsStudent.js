/**
 * StudentSphere – Student Chats Page Logic
 * File: chatsStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('chats');

  /* ─────────────────────────────────────────────
     1. INITIALIZE CHAT DATABASES
  ───────────────────────────────────────────── */
  var branch = (user.branch || '').toLowerCase();
  
  // Custom subject names
  var sub1 = 'networks-class';
  var sub2 = 'software-eng';
  var sub3 = 'dbms-queries';

  if (branch.includes('communication') || branch.includes('electronics')) {
    sub1 = 'signals-systems';
    sub2 = 'vlsi-design';
    sub3 = 'dsp-signals';
  } else if (branch.includes('mechanical')) {
    sub1 = 'thermo-class';
    sub2 = 'fluid-mechanics';
    sub3 = 'cad-cam-group';
  }

  var chatsData = [
    {
      id: 'off-dept',
      name: 'CS Announcements',
      category: 'official',
      meta: 'Managed by Department Office',
      unread: true,
      messages: [
        { sender: 'Dr. Vikram Singh', text: 'Important: Mid-semester lab examination schedule has been uploaded in the portal. Please verify your slots.', time: '10:30 AM', outgoing: false },
        { sender: 'Office of CS', text: 'All students are requested to clear their dues before Nov 30 to download registration cards.', time: '11:15 AM', outgoing: false }
      ]
    },
    {
      id: 'off-placement',
      name: 'Placement Alerts',
      category: 'official',
      meta: 'Placement Cell Official',
      unread: false,
      messages: [
        { sender: 'Placement Coordinator', text: 'TCS on-campus drive registrations close tonight. Apply via the Career tab.', time: 'Yesterday', outgoing: false },
        { sender: 'Placement Coordinator', text: 'Google Summer of Code info session is scheduled for 5 PM in LH-108.', time: '3h ago', outgoing: false }
      ]
    },
    {
      id: 'sub-1',
      name: sub1,
      category: 'subject',
      meta: 'Class Discussion group',
      unread: false,
      messages: [
        { sender: 'Rahul', text: 'Has anyone finished the assignment due this weekend?', time: '2:15 PM', outgoing: false },
        { sender: 'Dr. Sneha Patel', text: 'Please ensure you submit the simulation script as a zip file. PDF report is mandatory.', time: '3:00 PM', outgoing: false }
      ]
    },
    {
      id: 'sub-2',
      name: sub2,
      category: 'subject',
      meta: 'Subject Q&A channel',
      unread: true,
      messages: [
        { sender: 'Priya', text: 'Does anyone have the slides for Module 3?', time: '4:20 PM', outgoing: false },
        { sender: 'Rohan Mehra', text: 'I have uploaded them in the Notes section.', time: '4:45 PM', outgoing: false }
      ]
    },
    {
      id: 'group-peer',
      name: 'Hackathon Hyperion 4.0',
      category: 'peer',
      meta: '4 members',
      unread: false,
      messages: [
        { sender: 'Arjun', text: 'Let\'s meet in the library cafeteria at 4 PM to finalize our project deck.', time: '12:00 PM', outgoing: false },
        { sender: 'Rahul', text: 'Sounds good, I\'ll bring my laptop.', time: '12:10 PM', outgoing: false },
        { sender: 'You', text: 'Perfect, see you guys there!', time: '12:15 PM', outgoing: true }
      ]
    },
    {
      id: 'direct-prof',
      name: 'Dr. Sneha Patel (Prof)',
      category: 'direct',
      meta: 'Online',
      unread: false,
      messages: [
        { sender: 'Dr. Sneha Patel', text: 'Hello ' + user.name + ', regarding your query about the research project, please meet me in my office tomorrow during visiting hours.', time: 'Yesterday', outgoing: false }
      ]
    },
    {
      id: 'direct-rahul',
      name: 'Rahul (Peer)',
      category: 'direct',
      meta: 'Away',
      unread: false,
      messages: [
        { sender: 'Rahul', text: 'Hey, are you free for a quick call to discuss the lab project?', time: 'Yesterday', outgoing: false },
        { sender: 'You', text: 'Yes, call me after 6 PM.', time: 'Yesterday', outgoing: true }
      ]
    }
  ];

  var activeChat = null;

  /* ─────────────────────────────────────────────
     2. DOM ELEMENTS
  ───────────────────────────────────────────── */
  var sidebarContainer = document.getElementById('chatChannelsList');
  var emptyState = document.getElementById('chatEmptyState');
  var chatContent = document.getElementById('chatContent');

  var activeChatTitle = document.getElementById('activeChatTitle');
  var activeChatMeta = document.getElementById('activeChatMeta');
  var messagesLog = document.getElementById('chatMessagesLog');
  var chatInputForm = document.getElementById('chatInputForm');
  var chatMsgInput = document.getElementById('chatMsgInput');

  /* ─────────────────────────────────────────────
     3. RENDER LEFT SIDEBAR CHANNELS
  ───────────────────────────────────────────── */
  function renderSidebar() {
    if (!sidebarContainer) return;

    var html = '';

    var categories = [
      { key: 'official', label: 'Official Channels' },
      { key: 'subject', label: 'Subject Groups' },
      { key: 'peer', label: 'Peer Groups' },
      { key: 'direct', label: 'Direct Messages' }
    ];

    categories.forEach(function (cat) {
      var filtered = chatsData.filter(function (c) { return c.category === cat.key; });
      if (filtered.length === 0) return;

      html += '<span class="group-section-label">' + cat.label + '</span>';
      filtered.forEach(function (c) {
        var unreadHTML = c.unread ? '<span class="unread-dot" aria-hidden="true"></span>' : '';
        var selectClass = (activeChat && activeChat.id === c.id) ? ' selected' : '';
        var avatarLabel = c.name.slice(0, 2).toUpperCase();
        var avatarClass = 'chat-item-avatar';
        if (c.category === 'official') avatarClass += ' official';
        if (c.category === 'subject')  avatarClass += ' subject';

        var lastMessageText = c.messages.length > 0 ? c.messages[c.messages.length - 1].text : 'No messages yet';

        html += (
          '<div class="chat-item' + selectClass + '" data-id="' + c.id + '">' +
            '<div class="' + avatarClass + '">' + avatarLabel + '</div>' +
            '<div class="chat-item-info">' +
              '<span class="chat-item-name">' + esc(c.name) + '</span>' +
              '<span class="chat-item-sub">' + esc(lastMessageText) + '</span>' +
            '</div>' +
            unreadHTML +
          '</div>'
        );
      });
    });

    sidebarContainer.innerHTML = html;

    // Bind clicks
    sidebarContainer.querySelectorAll('.chat-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = item.getAttribute('data-id');
        selectChatById(id);
      });
    });
  }

  function selectChatById(id) {
    for (var i = 0; i < chatsData.length; i++) {
      if (chatsData[i].id === id) {
        activeChat = chatsData[i];
        activeChat.unread = false; // Mark read
        break;
      }
    }
    renderSidebar();
    renderChatWindow();
  }

  /* ─────────────────────────────────────────────
     4. RENDER CHAT WINDOW & MESSAGES
  ───────────────────────────────────────────── */
  function renderChatWindow() {
    if (!activeChat) {
      emptyState.classList.remove('hidden');
      chatContent.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    chatContent.classList.remove('hidden');

    activeChatTitle.textContent = activeChat.name;
    activeChatMeta.textContent = activeChat.meta;

    renderMessages();
  }

  function renderMessages() {
    if (!messagesLog || !activeChat) return;

    messagesLog.innerHTML = activeChat.messages.map(function (msg) {
      var rowClass = msg.outgoing ? 'msg-row outgoing' : 'msg-row incoming';
      var senderLabel = msg.outgoing ? 'You' : msg.sender;
      return (
        '<div class="' + rowClass + '">' +
          '<span class="msg-sender">' + esc(senderLabel) + '</span>' +
          '<div class="msg-bubble">' +
            esc(msg.text) +
            '<span class="msg-time">' + msg.time + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Scroll to bottom
    messagesLog.scrollTop = messagesLog.scrollHeight;
  }

  /* ─────────────────────────────────────────────
     5. SEND MESSAGE & SIMULATE PEER REPLY
  ───────────────────────────────────────────── */
  if (chatInputForm) {
    chatInputForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!activeChat) return;

      var text = chatMsgInput.value.trim();
      if (!text) return;

      // Add student message
      var time = formatTime(new Date());
      activeChat.messages.push({
        sender: 'You',
        text: text,
        time: time,
        outgoing: true
      });

      chatMsgInput.value = '';
      renderMessages();
      renderSidebar(); // Update last message in sidebar

      // Trigger automatic peer reply after 1.5s
      simulatePeerReply(activeChat);
    });
  }

  function simulatePeerReply(chatObj) {
    var replies = [
      'Okay, sounds good!',
      'Thanks for sharing, I will look into it.',
      'Got it. Let\'s discuss this in the next class.',
      'Great! I will update the group doc.',
      'I am working on it too, should be done soon.',
      'Can you upload the script reference?'
    ];

    setTimeout(function () {
      // Make sure we are still viewing the same chat
      if (!activeChat || activeChat.id !== chatObj.id) return;

      var randomText = replies[Math.floor(Math.random() * replies.length)];
      var responder = 'Rahul';
      if (chatObj.id === 'direct-prof') responder = 'Dr. Sneha Patel';
      else if (chatObj.id === 'off-dept') responder = 'Office of CS';

      chatObj.messages.push({
        sender: responder,
        text: randomText,
        time: formatTime(new Date()),
        outgoing: false
      });

      renderMessages();
      renderSidebar();
    }, 1500);
  }

  function formatTime(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 12 instead of 0
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minutes + ' ' + ampm;
  }

  function esc(val) {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  // Initial Load
  renderSidebar();

}());
