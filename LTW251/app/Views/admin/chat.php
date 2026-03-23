<div class="row g-2 align-items-center mb-3">
  <div class="col">
    <h2 class="page-title mb-1">Hỗ trợ trực tuyến</h2>
    <div class="text-muted small">Xử lý takeover, auto-reply theo action bot, thu hồi/xóa tin nhắn khi cần.</div>
  </div>
  <div class="col-auto">
    <span class="badge bg-success-lt text-success" id="connection-badge">Đang kết nối</span>
  </div>
</div>

<style>
  .chat-shell {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 12px;
    min-height: 72vh;
  }
  .chat-sidebar,
  .chat-main {
    background: #fff;
    border: 1px solid #e6e8ec;
    border-radius: 14px;
    overflow: hidden;
  }
  .chat-sidebar-header,
  .chat-main-header {
    padding: 14px 16px;
    border-bottom: 1px solid #eef0f4;
    background: #fafbfc;
  }
  .chat-search {
    width: 100%;
    border: 1px solid #d9dce3;
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 14px;
    outline: none;
  }
  .chat-search:focus {
    border-color: #4a7cf3;
    box-shadow: 0 0 0 2px rgba(74, 124, 243, 0.12);
  }
  .chat-session-list {
    max-height: calc(72vh - 120px);
    overflow-y: auto;
  }
  .chat-session-item {
    display: block;
    text-decoration: none;
    color: inherit;
    padding: 12px 14px;
    border-bottom: 1px solid #f0f2f5;
    transition: background-color 0.15s ease;
  }
  .chat-session-item:hover {
    background: #f8f9fc;
  }
  .chat-session-item.active {
    background: #edf2ff;
    border-left: 3px solid #4a7cf3;
    padding-left: 11px;
  }
  .chat-session-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .chat-session-name {
    font-weight: 600;
    font-size: 13px;
    max-width: 220px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chat-session-time {
    font-size: 11px;
    color: #6b7280;
    white-space: nowrap;
  }
  .chat-session-last {
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chat-main-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .chat-main-title {
    font-weight: 700;
    margin: 0;
    font-size: 16px;
  }
  .chat-main-subtitle {
    margin-top: 3px;
    color: #6b7280;
    font-size: 12px;
  }
  .chat-main-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .chat-history {
    padding: 14px;
    background: linear-gradient(180deg, #f6f7fb 0%, #f9fafb 100%);
    height: calc(72vh - 240px);
    overflow-y: auto;
  }
  .chat-empty {
    color: #64748b;
    text-align: center;
    padding: 48px 18px;
    font-size: 14px;
  }
  .chat-bubble-row {
    display: flex;
    margin-bottom: 10px;
  }
  .chat-bubble-row.user { justify-content: flex-start; }
  .chat-bubble-row.agent { justify-content: flex-end; }
  .chat-bubble-row.bot { justify-content: flex-start; }
  .chat-bubble {
    max-width: 80%;
    border-radius: 14px;
    padding: 8px 10px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
  }
  .chat-bubble.user {
    background: #fff;
    border: 1px solid #e2e8f0;
  }
  .chat-bubble.agent {
    background: #2859d1;
    color: #fff;
  }
  .chat-bubble.bot {
    background: #effaf3;
    border: 1px solid #b7ebc9;
    color: #0f5132;
  }
  .chat-bubble-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .chat-role-tag {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2px;
    padding: 1px 6px;
    border-radius: 999px;
    margin-bottom: 4px;
    background: rgba(15, 81, 50, 0.15);
    color: #0f5132;
  }
  .chat-role-tag.agent {
    background: rgba(255, 255, 255, 0.22);
    color: #fff;
  }
  .chat-message-delete {
    border: 0;
    background: transparent;
    font-size: 11px;
    opacity: 0.8;
    cursor: pointer;
    padding: 0 4px;
  }
  .chat-bubble.agent .chat-message-delete { color: #fff; }
  .chat-bubble.bot .chat-message-delete { color: #0f5132; }
  .chat-bubble-text {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.42;
    font-size: 14px;
  }
  .chat-ui {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed rgba(100, 116, 139, 0.35);
  }
  .chat-ui-items {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
  }
  .chat-ui-items li { margin-bottom: 2px; }
  .chat-ui-suggestions {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chat-ui-chip {
    font-size: 11px;
    border-radius: 999px;
    padding: 2px 8px;
    border: 1px solid rgba(71, 85, 105, 0.35);
    background: rgba(255, 255, 255, 0.7);
  }
  .chat-bubble-time {
    margin-top: 4px;
    opacity: 0.75;
    font-size: 11px;
    text-align: right;
  }
  .chat-compose {
    border-top: 1px solid #eef0f4;
    padding: 10px;
    background: #fff;
  }
  .chat-auto-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .chat-auto-btn {
    border: 1px solid #d1d9ea;
    background: #f8fbff;
    color: #1f3f9f;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .chat-compose-form {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }
  .chat-compose-input {
    flex: 1;
    resize: none;
    min-height: 44px;
    max-height: 120px;
    border-radius: 10px;
    border: 1px solid #d8dce6;
    padding: 10px 12px;
    outline: none;
  }
  .chat-compose-input:focus {
    border-color: #4a7cf3;
    box-shadow: 0 0 0 2px rgba(74, 124, 243, 0.12);
  }
  .chat-system-status {
    margin-bottom: 6px;
    font-size: 12px;
    color: #64748b;
    min-height: 16px;
  }
  .chat-system-status.error { color: #c2410c; }
  @media (max-width: 991px) {
    .chat-shell { grid-template-columns: 1fr; }
    .chat-session-list { max-height: 220px; }
    .chat-history { height: 50vh; }
  }
</style>

<div class="chat-shell">
  <aside class="chat-sidebar">
    <div class="chat-sidebar-header">
      <input id="session-search" class="chat-search" type="text" placeholder="Tìm theo userId / channel...">
    </div>
    <div id="session-list" class="chat-session-list">
      <div class="chat-empty">Đang tải danh sách phiên...</div>
    </div>
  </aside>

  <section class="chat-main">
    <div class="chat-main-header">
      <div>
        <h3 class="chat-main-title" id="chat-title">Chọn phiên để bắt đầu hỗ trợ</h3>
        <div class="chat-main-subtitle" id="chat-subtitle">Tin nhắn sẽ cập nhật tự động mỗi 3 giây.</div>
      </div>
      <div class="chat-main-actions">
        <button class="btn btn-outline-danger btn-sm d-none" id="btn-delete-session">Xóa cuộc trò chuyện</button>
        <button class="btn btn-outline-danger btn-sm d-none" id="btn-end-session">Trả lại bot</button>
      </div>
    </div>

    <div class="chat-history" id="chat-history">
      <div class="chat-empty">Chưa có phiên nào được chọn.</div>
    </div>

    <div class="chat-compose d-none" id="chat-compose">
      <div id="chat-system-status" class="chat-system-status"></div>

      <div class="chat-auto-actions" id="chat-auto-actions">
        <button class="chat-auto-btn" data-action="ACTION_VIEW_MENU">Auto: Xem menu</button>
        <button class="chat-auto-btn" data-action="ACTION_CATEGORY:coffee">Auto: Món cà phê</button>
        <button class="chat-auto-btn" data-action="ACTION_ORDER_START">Auto: Bắt đầu đặt đơn</button>
        <button class="chat-auto-btn" data-action="ACTION_ORDER_STATUS">Auto: Kiểm tra đơn</button>
        <button class="chat-auto-btn" data-action="ACTION_HELP">Auto: Trợ giúp</button>
      </div>

      <form id="chat-form" class="chat-compose-form">
        <textarea id="chat-message" class="chat-compose-input" placeholder="Nhập nội dung phản hồi cho khách..." maxlength="2000"></textarea>
        <button id="chat-send-btn" type="submit" class="btn btn-primary">Gửi</button>
      </form>
    </div>
  </section>
</div>

<script>
  (function () {
    var endpoints = {
      poll: '<?= BASE_URL ?>/?r=adminChat/poll',
      reply: '<?= BASE_URL ?>/?r=adminChat/reply',
      autoReply: '<?= BASE_URL ?>/?r=adminChat/autoReply',
      deleteMessage: '<?= BASE_URL ?>/?r=adminChat/deleteMessage',
      deleteSession: '<?= BASE_URL ?>/?r=adminChat/deleteSession',
      endSession: '<?= BASE_URL ?>/?r=adminChat/endSession'
    };

    var sessions = [];
    var currentKey = '';
    var pollTimer = null;
    var isSending = false;
    var searchKeyword = '';
    var knownHistorySize = {};
    var unreadMap = {};

    var sessionListEl = document.getElementById('session-list');
    var sessionSearchEl = document.getElementById('session-search');
    var connectionBadgeEl = document.getElementById('connection-badge');
    var chatTitleEl = document.getElementById('chat-title');
    var chatSubtitleEl = document.getElementById('chat-subtitle');
    var chatHistoryEl = document.getElementById('chat-history');
    var chatComposeEl = document.getElementById('chat-compose');
    var chatStatusEl = document.getElementById('chat-system-status');
    var chatFormEl = document.getElementById('chat-form');
    var chatMessageEl = document.getElementById('chat-message');
    var chatSendBtnEl = document.getElementById('chat-send-btn');
    var chatAutoActionsEl = document.getElementById('chat-auto-actions');
    var btnDeleteSessionEl = document.getElementById('btn-delete-session');
    var btnEndSessionEl = document.getElementById('btn-end-session');

    function keyOf(session) {
      return String(session.channel || '') + ':' + String(session.userId || '');
    }

    function escapeHtml(input) {
      return String(input || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function formatClock(ms) {
      var date = new Date(Number(ms || 0));
      if (isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    function formatChannel(channel) {
      if (channel === 'telegram') return 'Telegram';
      if (channel === 'messenger') return 'Messenger';
      if (channel === 'modernfashion_web') return 'ModernFashion Web';
      return 'Web';
    }

    function truncateUser(userId) {
      var raw = String(userId || '');
      if (raw.length <= 16) return raw;
      return raw.slice(0, 8) + '...' + raw.slice(-4);
    }

    function getCurrentSession() {
      if (!currentKey) return null;
      for (var i = 0; i < sessions.length; i += 1) {
        if (keyOf(sessions[i]) === currentKey) return sessions[i];
      }
      return null;
    }

    function setConnectionState(ok) {
      if (ok) {
        connectionBadgeEl.className = 'badge bg-success-lt text-success';
        connectionBadgeEl.textContent = 'Đang kết nối';
        return;
      }
      connectionBadgeEl.className = 'badge bg-red-lt text-danger';
      connectionBadgeEl.textContent = 'Mất kết nối';
    }

    function setSystemStatus(text, isError) {
      chatStatusEl.textContent = text || '';
      chatStatusEl.className = isError ? 'chat-system-status error' : 'chat-system-status';
    }

    function sortedSessions(list) {
      return list.slice().sort(function (a, b) {
        return Number(b.requestedAtMs || 0) - Number(a.requestedAtMs || 0);
      });
    }

    function filteredHistory(history) {
      return (Array.isArray(history) ? history : []).filter(function (msg) {
        return String(msg && msg.content ? msg.content : '').trim() !== 'ACTION_HANDOFF_STATUS';
      });
    }

    function updateUnreadCounter(newSessions) {
      for (var i = 0; i < newSessions.length; i += 1) {
        var session = newSessions[i];
        var key = keyOf(session);
        var history = filteredHistory(session.history);
        var size = history.length;
        var oldSize = Number(knownHistorySize[key] || 0);
        if (size > oldSize && key !== currentKey) {
          unreadMap[key] = Number(unreadMap[key] || 0) + (size - oldSize);
        }
        knownHistorySize[key] = size;
      }
      if (currentKey) unreadMap[currentKey] = 0;
    }

    function normalizeUiSuggestions(raw) {
      if (!Array.isArray(raw)) return [];
      return raw.map(function (entry) {
        if (typeof entry === 'string') {
          var label = entry.trim();
          return label ? { label: label, payload: label } : null;
        }
        var labelObj = String(entry && entry.label ? entry.label : '').trim();
        var payloadObj = String(entry && entry.payload ? entry.payload : '').trim();
        if (!labelObj || !payloadObj) return null;
        return { label: labelObj, payload: payloadObj };
      }).filter(Boolean);
    }

    function renderUiPreview(ui) {
      if (!ui || ui.type !== 'menu') return '';
      var html = '<div class="chat-ui">';
      var items = Array.isArray(ui.items) ? ui.items.slice(0, 8) : [];
      if (items.length > 0) {
        html += '<ul class="chat-ui-items">';
        for (var i = 0; i < items.length; i += 1) {
          var item = items[i] || {};
          html += '<li>' + escapeHtml(String(item.name || '') + ' (' + String(item.sku || '') + ')</li>');
        }
        html += '</ul>';
      }

      var suggestions = normalizeUiSuggestions(ui.suggestions || []);
      if (suggestions.length > 0) {
        html += '<div class="chat-ui-suggestions">';
        for (var j = 0; j < suggestions.length; j += 1) {
          html += '<span class="chat-ui-chip">' + escapeHtml(suggestions[j].label) + '</span>';
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    function renderSessionList() {
      var list = sortedSessions(sessions);
      if (searchKeyword) {
        var keyword = searchKeyword.toLowerCase();
        list = list.filter(function (item) {
          var hay = (String(item.channel || '') + ' ' + String(item.userId || '') + ' ' + String(item.lastMessage || '')).toLowerCase();
          return hay.indexOf(keyword) >= 0;
        });
      }

      if (list.length === 0) {
        sessionListEl.innerHTML = '<div class="chat-empty">Không có phiên nào đang chờ.</div>';
        return;
      }

      var html = '';
      for (var i = 0; i < list.length; i += 1) {
        var session = list[i];
        var key = keyOf(session);
        var history = filteredHistory(session.history);
        var lastContent = String(session.lastMessage || '');
        for (var j = history.length - 1; j >= 0; j -= 1) {
          var content = String(history[j] && history[j].content ? history[j].content : '').trim();
          if (content) {
            lastContent = content;
            break;
          }
        }
        var activeClass = key === currentKey ? ' active' : '';
        var unread = Number(unreadMap[key] || 0);
        var unreadBadge = unread > 0 ? '<span class="badge bg-danger ms-1">' + unread + '</span>' : '';
        html += ''
          + '<a href="#" class="chat-session-item' + activeClass + '" data-session-key="' + escapeHtml(key) + '">'
          + '  <div class="chat-session-top">'
          + '    <div class="chat-session-name">' + escapeHtml(formatChannel(session.channel) + ' • ' + truncateUser(session.userId)) + unreadBadge + '</div>'
          + '    <div class="chat-session-time">' + escapeHtml(formatClock(session.requestedAtMs)) + '</div>'
          + '  </div>'
          + '  <div class="chat-session-last">' + escapeHtml(lastContent) + '</div>'
          + '</a>';
      }
      sessionListEl.innerHTML = html;
    }

    function renderChatPanel() {
      var session = getCurrentSession();
      if (!session) {
        chatTitleEl.textContent = 'Chọn phiên để bắt đầu hỗ trợ';
        chatSubtitleEl.textContent = 'Tin nhắn sẽ cập nhật tự động mỗi 3 giây.';
        chatHistoryEl.innerHTML = '<div class="chat-empty">Chưa có phiên nào được chọn.</div>';
        chatComposeEl.classList.add('d-none');
        btnEndSessionEl.classList.add('d-none');
        btnDeleteSessionEl.classList.add('d-none');
        return;
      }

      unreadMap[currentKey] = 0;
      chatTitleEl.textContent = formatChannel(session.channel) + ' • ' + session.userId;
      chatSubtitleEl.textContent = 'Yêu cầu lúc ' + formatClock(session.requestedAtMs);
      chatComposeEl.classList.remove('d-none');
      btnEndSessionEl.classList.remove('d-none');
      btnDeleteSessionEl.classList.remove('d-none');

      var history = filteredHistory(session.history);
      if (history.length === 0) {
        chatHistoryEl.innerHTML = '<div class="chat-empty">Chưa có tin nhắn trong phiên này.</div>';
        return;
      }

      var stickBottom = chatHistoryEl.scrollHeight - chatHistoryEl.scrollTop - chatHistoryEl.clientHeight < 90;
      var html = '';
      for (var i = 0; i < history.length; i += 1) {
        var msg = history[i] || {};
        var role = String(msg.role || '');
        var bubbleRole = role === 'agent' ? 'agent' : (role === 'bot' ? 'bot' : 'user');
        var roleTag = role === 'bot'
          ? '<span class="chat-role-tag">BOT</span>'
          : (role === 'agent' ? '<span class="chat-role-tag agent">ADMIN</span>' : '');
        var canDelete = (role === 'bot' || role === 'agent') && String(msg.id || '') !== '';
        var deleteBtn = canDelete
          ? '<button class="chat-message-delete js-delete-message" data-message-id="' + escapeHtml(String(msg.id || '')) + '" title="Xóa khỏi cuộc trò chuyện">Xóa</button>'
          : '';

        html += ''
          + '<div class="chat-bubble-row ' + bubbleRole + '">'
          + '  <div class="chat-bubble ' + bubbleRole + '">'
          + '    <div class="chat-bubble-head">' + roleTag + deleteBtn + '</div>'
          + '    <div class="chat-bubble-text">' + escapeHtml(String(msg.content || '')) + '</div>'
          +       renderUiPreview(msg.ui)
          + '    <div class="chat-bubble-time">' + escapeHtml(formatClock(msg.timestampMs)) + '</div>'
          + '  </div>'
          + '</div>';
      }
      chatHistoryEl.innerHTML = html;

      if (stickBottom) {
        chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
      }
    }

    async function sendReply() {
      if (isSending) return;
      var session = getCurrentSession();
      if (!session) return;
      var message = String(chatMessageEl.value || '').trim();
      if (!message) return;

      isSending = true;
      chatSendBtnEl.disabled = true;
      setSystemStatus('Đang gửi...', false);
      try {
        var response = await fetch(endpoints.reply, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: session.channel,
            userId: session.userId,
            message: message
          })
        });
        var json = await response.json();
        if (!response.ok || !json || json.ok !== true) {
          throw new Error((json && json.error) ? json.error : 'Gửi tin nhắn thất bại');
        }
        chatMessageEl.value = '';
        setSystemStatus('Đã gửi.', false);
        await refreshNow();
      } catch (error) {
        setSystemStatus('Không gửi được: ' + String(error && error.message ? error.message : error), true);
      } finally {
        isSending = false;
        chatSendBtnEl.disabled = false;
      }
    }

    async function sendAutoReply(actionPayload) {
      var session = getCurrentSession();
      if (!session || !actionPayload) return;
      setSystemStatus('Đang tạo phản hồi tự động...', false);
      try {
        var response = await fetch(endpoints.autoReply, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: session.channel,
            userId: session.userId,
            actionPayload: actionPayload
          })
        });
        var json = await response.json();
        if (!response.ok || !json || json.ok !== true) {
          throw new Error((json && json.error) ? json.error : 'Auto-reply thất bại');
        }
        setSystemStatus('Đã gửi auto-reply.', false);
        await refreshNow();
      } catch (error) {
        setSystemStatus('Lỗi auto-reply: ' + String(error && error.message ? error.message : error), true);
      }
    }

    async function deleteMessage(messageId) {
      var session = getCurrentSession();
      if (!session || !messageId) return;
      if (!window.confirm('Xóa tin nhắn này khỏi cuộc trò chuyện?')) return;

      try {
        var response = await fetch(endpoints.deleteMessage, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: session.channel,
            userId: session.userId,
            messageId: messageId
          })
        });
        var json = await response.json();
        if (!response.ok || !json || json.ok !== true) {
          throw new Error((json && json.error) ? json.error : 'Không xóa được tin nhắn');
        }
        setSystemStatus('Đã xóa tin nhắn.', false);
        await refreshNow();
      } catch (error) {
        setSystemStatus('Lỗi xóa tin nhắn: ' + String(error && error.message ? error.message : error), true);
      }
    }

    async function deleteSession() {
      var session = getCurrentSession();
      if (!session) return;
      if (!window.confirm('Xóa toàn bộ cuộc trò chuyện này?')) return;

      btnDeleteSessionEl.disabled = true;
      try {
        var response = await fetch(endpoints.deleteSession, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: session.channel,
            userId: session.userId
          })
        });
        var json = await response.json();
        if (!response.ok || !json || json.ok !== true) {
          throw new Error((json && json.error) ? json.error : 'Không xóa được cuộc trò chuyện');
        }
        currentKey = '';
        setSystemStatus('Đã xóa cuộc trò chuyện.', false);
        await refreshNow();
      } catch (error) {
        setSystemStatus('Lỗi xóa cuộc trò chuyện: ' + String(error && error.message ? error.message : error), true);
      } finally {
        btnDeleteSessionEl.disabled = false;
      }
    }

    async function endSession() {
      var session = getCurrentSession();
      if (!session) return;
      if (!window.confirm('Trả phiên này về bot tự động?')) return;

      btnEndSessionEl.disabled = true;
      try {
        var response = await fetch(endpoints.endSession, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: session.channel,
            userId: session.userId
          })
        });
        var json = await response.json();
        if (!response.ok || !json || json.ok !== true) {
          throw new Error((json && json.error) ? json.error : 'Kết thúc phiên thất bại');
        }
        currentKey = '';
        setSystemStatus('Đã trả phiên về bot.', false);
        await refreshNow();
      } catch (error) {
        setSystemStatus('Không thể kết thúc phiên: ' + String(error && error.message ? error.message : error), true);
      } finally {
        btnEndSessionEl.disabled = false;
      }
    }

    async function pollSessions() {
      try {
        var response = await fetch(endpoints.poll, { cache: 'no-store' });
        var json = await response.json();
        if (!response.ok || !json || json.ok !== true || !Array.isArray(json.data)) {
          throw new Error((json && json.error) ? json.error : 'Dữ liệu không hợp lệ');
        }

        setConnectionState(true);
        sessions = json.data;
        updateUnreadCounter(sessions);

        if (currentKey) {
          var hasCurrent = sessions.some(function (s) { return keyOf(s) === currentKey; });
          if (!hasCurrent) currentKey = '';
        }
        if (!currentKey && sessions.length > 0) {
          currentKey = keyOf(sortedSessions(sessions)[0]);
          unreadMap[currentKey] = 0;
        }

        renderSessionList();
        renderChatPanel();
      } catch (error) {
        setConnectionState(false);
      } finally {
        pollTimer = setTimeout(pollSessions, 3000);
      }
    }

    async function refreshNow() {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      await pollSessions();
    }

    sessionListEl.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== sessionListEl && !target.getAttribute('data-session-key')) {
        target = target.parentElement;
      }
      if (!target || target === sessionListEl) return;

      event.preventDefault();
      var key = String(target.getAttribute('data-session-key') || '');
      if (!key) return;
      currentKey = key;
      unreadMap[key] = 0;
      renderSessionList();
      renderChatPanel();
    });

    chatHistoryEl.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.classList || !target.classList.contains('js-delete-message')) return;
      var messageId = String(target.getAttribute('data-message-id') || '');
      if (!messageId) return;
      deleteMessage(messageId);
    });

    chatFormEl.addEventListener('submit', function (event) {
      event.preventDefault();
      sendReply();
    });

    chatMessageEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendReply();
      }
    });

    chatAutoActionsEl.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.getAttribute) return;
      var actionPayload = String(target.getAttribute('data-action') || '');
      if (!actionPayload) return;
      sendAutoReply(actionPayload);
    });

    sessionSearchEl.addEventListener('input', function () {
      searchKeyword = String(sessionSearchEl.value || '').trim().toLowerCase();
      renderSessionList();
    });

    btnEndSessionEl.addEventListener('click', function () {
      endSession();
    });

    btnDeleteSessionEl.addEventListener('click', function () {
      deleteSession();
    });

    pollSessions();
  })();
</script>
