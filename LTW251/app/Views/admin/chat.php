<div class="row g-2 align-items-center mb-3">
  <div class="col">
    <h2 class="page-title">Hỗ trợ trực tuyến (Live Takeover)</h2>
  </div>
</div>

<div class="row">
  <div class="col-md-4">
    <div class="card" style="height: 70vh;">
      <div class="card-header"><h3 class="card-title">Phiên đang chờ</h3></div>
      <div class="list-group list-group-flush overflow-auto" id="session-list" style="flex: 1;">
        <div class="p-3 text-muted text-center" id="no-session-msg">Đang tải...</div>
      </div>
    </div>
  </div>
  <div class="col-md-8">
    <div class="card d-flex flex-column" style="height: 70vh;" id="chat-panel">
      <div class="card-header">
        <h3 class="card-title" id="chat-title">Chọn một phiên để hỗ trợ</h3>
        <div class="card-actions">
           <button class="btn btn-sm btn-outline-danger d-none" id="btn-end-session">Trả lại cho Bot</button>
        </div>
      </div>
      <div class="card-body overflow-auto flex-grow-1" id="chat-history" style="background: #f8f9fa;">
        <!-- Chat history appears here -->
      </div>
      <div class="card-footer d-none" id="chat-input-area">
        <form id="chat-form" class="d-flex gap-2">
          <input type="text" id="chat-message" class="form-control" placeholder="Nhập tin nhắn..." autocomplete="off">
          <button type="submit" class="btn btn-primary">Gửi</button>
        </form>
      </div>
    </div>
  </div>
</div>

<script>
let sessions = [];
let currentSession = null;

async function pollSessions() {
    try {
        const res = await fetch('<?= BASE_URL ?>/?r=adminChat/poll');
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
            sessions = json.data;
            renderSessions();
            if (currentSession) {
                const updated = sessions.find(s => s.channel === currentSession.channel && s.userId === currentSession.userId);
                if (updated) {
                    currentSession = updated;
                    renderHistory();
                } else {
                    currentSession = null;
                    renderHistory();
                }
            }
        }
    } catch(e) {
        console.error(e);
    }
    setTimeout(pollSessions, 3000);
}

function renderSessions() {
    const list = document.getElementById('session-list');
    if (sessions.length === 0) {
        list.innerHTML = '<div class="p-3 text-muted text-center">Không có khách hàng nào đang chờ.</div>';
        return;
    }
    
    let html = '';
    for (const s of sessions) {
        const activeClass = (currentSession && currentSession.channel === s.channel && currentSession.userId === s.userId) ? 'active' : '';
        const time = new Date(s.requestedAtMs).toLocaleTimeString();
        html += `
            <a href="#" class="list-group-item list-group-item-action ${activeClass}" onclick="selectSession('${s.channel}', '${s.userId}')">
                <div class="d-flex justify-content-between align-items-center">
                    <strong>${s.channel} - ${s.userId.substring(0, 8)}...</strong>
                    <span class="badge bg-blue text-blue-fg">${time}</span>
                </div>
                <div class="text-truncate text-muted mt-1 small">${s.lastMessage}</div>
            </a>
        `;
    }
    list.innerHTML = html;
}

window.selectSession = function(channel, userId) {
    currentSession = sessions.find(s => s.channel === channel && s.userId === userId);
    renderSessions();
    renderHistory();
};

function renderHistory() {
    const historyEl = document.getElementById('chat-history');
    const titleEl = document.getElementById('chat-title');
    const inputArea = document.getElementById('chat-input-area');
    const btnEnd = document.getElementById('btn-end-session');
    
    if (!currentSession) {
        titleEl.textContent = "Chọn một phiên để hỗ trợ";
        historyEl.innerHTML = "";
        inputArea.classList.add('d-none');
        btnEnd.classList.add('d-none');
        return;
    }
    
    titleEl.textContent = `Đang hỗ trợ: ${currentSession.channel} (${currentSession.userId})`;
    inputArea.classList.remove('d-none');
    btnEnd.classList.remove('d-none');
    btnEnd.onclick = endSession;
    
    if (!currentSession.history || currentSession.history.length === 0) {
         historyEl.innerHTML = '<div class="text-center text-muted mt-5">Chưa có tin nhắn nào.</div>';
         return;
    }
    
    let html = '';
    for (const msg of currentSession.history) {
        const isAgent = msg.role === 'agent';
        const floatClass = isAgent ? 'float-end bg-primary text-white' : 'float-start bg-white border';
        const alignClass = isAgent ? 'text-end' : '';
        const time = new Date(msg.timestampMs).toLocaleTimeString();
        
        html += `
            <div class="mb-3 w-100 d-inline-block ${alignClass}">
                <div class="d-inline-block p-2 rounded shadow-sm ${floatClass}" style="max-width: 75%; text-align: left;">
                    <div style="white-space: pre-wrap; word-wrap: break-word;">${msg.content}</div>
                    <div class="small mt-1 opacity-75 text-end">${time}</div>
                </div>
            </div>
        `;
    }
    historyEl.innerHTML = html;
    historyEl.scrollTop = historyEl.scrollHeight;
}

document.getElementById('chat-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentSession) return;
    
    const input = document.getElementById('chat-message');
    const message = input.value.trim();
    if (!message) return;
    
    input.value = '';
    
    // Optimistic UI append
    if(!currentSession.history) currentSession.history = [];
    currentSession.history.push({ role: 'agent', content: message, timestampMs: Date.now() });
    renderHistory();
    
    try {
        await fetch('<?= BASE_URL ?>/?r=adminChat/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: currentSession.channel,
                userId: currentSession.userId,
                message: message
            })
        });
    } catch(e) { console.error(e); }
});

async function endSession() {
    if (!currentSession || !confirm('Giao lại cuộc trò chuyện này cho Bot tự động?')) return;
    try {
        await fetch('<?= BASE_URL ?>/?r=adminChat/endSession', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: currentSession.channel,
                userId: currentSession.userId
            })
        });
        currentSession = null;
        renderHistory();
    } catch(e) { console.error(e); }
}

// Start polling
pollSessions();
</script>
