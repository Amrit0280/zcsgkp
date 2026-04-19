/**
 * Zenith Convent School — Custom AI Chatbot Widget
 * Replaces Botpress. Powered by Gemini API + local Knowledge Base.
 */

(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // CONFIG
  // ──────────────────────────────────────────────
  const API_URL = '/api/chatbot';
  const ACCENT  = '#F4C430';   // ZCS gold
  const BLUE    = '#0A3D62';   // ZCS blue
  const BLUE2   = '#0d4e7a';

  const QUICK_QUESTIONS = [
    '📋 Admission process',
    '💰 Fee structure',
    '👩‍🏫 Our faculty',
    '📅 School calendar',
    '📞 Contact details'
  ];

  const GREET = `Hello! 👋 I'm the **Zenith - Help Desk**.\n\nAsk me anything about **admissions, fees, faculty, rules, or school activities**. I'm here to help!`;

  // ──────────────────────────────────────────────
  // INJECT CSS
  // ──────────────────────────────────────────────
  const CSS = `
    #zcs-chat-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, ${BLUE}, ${BLUE2});
      box-shadow: 0 6px 24px rgba(10,61,98,0.45);
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s;
      outline: none;
    }
    #zcs-chat-fab:hover {
      transform: scale(1.12);
      box-shadow: 0 10px 32px rgba(10,61,98,0.55);
    }
    #zcs-chat-fab svg { transition: transform 0.4s; }
    #zcs-chat-fab.open svg.icon-chat { display: none; }
    #zcs-chat-fab.open svg.icon-close { display: block !important; }
    #zcs-chat-fab .notif-dot {
      position: absolute; top: 10px; right: 10px;
      width: 10px; height: 10px; border-radius: 50%;
      background: ${ACCENT}; border: 2px solid white;
      animation: zcs-pulse 1.8s infinite;
    }
    @keyframes zcs-pulse {
      0%,100%{transform:scale(1);opacity:1}
      50%{transform:scale(1.4);opacity:0.7}
    }

    #zcs-chat-panel {
      position: fixed; bottom: 100px; right: 28px; z-index: 9998;
      width: 370px; max-width: calc(100vw - 40px);
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(10,61,98,0.22), 0 4px 16px rgba(0,0,0,0.1);
      display: flex; flex-direction: column;
      overflow: hidden;
      transform: scale(0.85) translateY(20px);
      opacity: 0; pointer-events: none;
      transform-origin: bottom right;
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
      height: 520px;
      max-height: calc(100vh - 140px);
      font-family: 'Poppins', sans-serif;
    }
    #zcs-chat-panel.visible {
      transform: scale(1) translateY(0);
      opacity: 1; pointer-events: all;
    }

    /* Header */
    #zcs-chat-header {
      background: linear-gradient(135deg, ${BLUE} 0%, ${BLUE2} 100%);
      padding: 16px 18px;
      display: flex; align-items: center; gap: 12px;
      flex-shrink: 0;
    }
    #zcs-chat-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(244,196,48,0.2);
      border: 2px solid rgba(244,196,48,0.5);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    #zcs-chat-header-info { flex: 1; }
    #zcs-chat-header-info .name {
      font-size: 14px; font-weight: 700; color: white; line-height: 1.2;
    }
    #zcs-chat-header-info .status {
      font-size: 11px; color: rgba(255,255,255,0.65);
      display: flex; align-items: center; gap: 5px;
    }
    #zcs-chat-header-info .status::before {
      content: ''; width: 6px; height: 6px; border-radius: 50%;
      background: #4ade80; display: inline-block;
    }
    #zcs-chat-close {
      background: rgba(255,255,255,0.1); border: none; color: white;
      width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; transition: background 0.2s;
    }
    #zcs-chat-close:hover { background: rgba(255,255,255,0.2); }

    /* Messages */
    #zcs-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
      background: #f8fafc;
    }
    #zcs-chat-messages::-webkit-scrollbar { width: 4px; }
    #zcs-chat-messages::-webkit-scrollbar-track { background: transparent; }
    #zcs-chat-messages::-webkit-scrollbar-thumb { background: #dde3ea; border-radius: 4px; }

    .zcs-msg {
      display: flex; gap: 8px; align-items: flex-end;
      animation: zcs-msg-in 0.3s ease both;
    }
    @keyframes zcs-msg-in {
      from { opacity:0; transform:translateY(8px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .zcs-msg.user { flex-direction: row-reverse; }
    .zcs-msg-avatar {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, ${BLUE}, ${BLUE2});
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; color: white; font-weight: 700;
    }
    .zcs-msg.user .zcs-msg-avatar {
      background: linear-gradient(135deg, ${ACCENT}, #d4a017);
      color: ${BLUE};
    }
    .zcs-msg-bubble {
      max-width: 80%; padding: 10px 14px;
      border-radius: 18px 18px 18px 4px;
      font-size: 13px; line-height: 1.6; color: #1e293b;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }
    .zcs-msg.user .zcs-msg-bubble {
      background: linear-gradient(135deg, ${BLUE}, ${BLUE2});
      color: white; border-radius: 18px 18px 4px 18px;
      box-shadow: 0 2px 10px rgba(10,61,98,0.25);
    }
    .zcs-msg-bubble strong { font-weight: 700; }
    .zcs-msg-bubble em { font-style: italic; }

    /* Source citation */
    .zcs-sources {
      margin-top: 8px; padding-top: 8px;
      border-top: 1px solid rgba(10,61,98,0.1);
      display: flex; flex-wrap: wrap; gap: 4px;
    }
    .zcs-source-chip {
      font-size: 10px; padding: 2px 8px; border-radius: 50px;
      background: rgba(244,196,48,0.15); color: #7a5a00;
      border: 1px solid rgba(244,196,48,0.4);
      font-weight: 600;
    }

    /* Typing indicator */
    #zcs-typing {
      display: none; align-items: flex-end; gap: 8px;
      animation: zcs-msg-in 0.3s ease both;
    }
    #zcs-typing.show { display: flex; }
    .zcs-typing-bubble {
      background: white; padding: 12px 16px; border-radius: 18px 18px 18px 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
      display: flex; gap: 4px; align-items: center;
    }
    .zcs-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #94a3b8;
      animation: zcs-bounce 1.2s infinite;
    }
    .zcs-dot:nth-child(2) { animation-delay: 0.2s; }
    .zcs-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes zcs-bounce {
      0%,60%,100%{transform:translateY(0)}
      30%{transform:translateY(-6px)}
    }

    /* Quick replies */
    #zcs-quick-replies {
      padding: 8px 12px;
      display: flex; flex-wrap: wrap; gap: 6px;
      border-top: 1px solid #e8edf2;
      background: #fff;
      flex-shrink: 0;
    }
    .zcs-quick-btn {
      font-size: 11.5px; padding: 5px 12px; border-radius: 50px;
      border: 1.5px solid rgba(10,61,98,0.2);
      background: transparent; color: ${BLUE}; cursor: pointer;
      font-family: inherit; font-weight: 600;
      transition: all 0.2s; white-space: nowrap;
    }
    .zcs-quick-btn:hover {
      background: ${BLUE}; color: white;
      border-color: ${BLUE};
    }

    /* Input area */
    #zcs-chat-input-area {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; border-top: 1px solid #e8edf2;
      background: #fff; flex-shrink: 0;
    }
    #zcs-chat-input {
      flex: 1; border: 1.5px solid #e2e8f0; border-radius: 50px;
      padding: 9px 16px; font-size: 13px;
      font-family: 'Poppins', sans-serif;
      outline: none; resize: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #f8fafc;
      color: #1e293b;
    }
    #zcs-chat-input:focus {
      border-color: ${BLUE}; background: #fff;
      box-shadow: 0 0 0 3px rgba(10,61,98,0.08);
    }
    #zcs-chat-send {
      width: 38px; height: 38px; border-radius: 50%; border: none;
      background: linear-gradient(135deg, ${BLUE}, ${BLUE2});
      color: white; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      flex-shrink: 0; transition: transform 0.2s, opacity 0.2s;
    }
    #zcs-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
    #zcs-chat-send:not(:disabled):hover { transform: scale(1.1); }

    /* Watermark */
    #zcs-watermark {
      text-align: center; font-size: 10px; color: #94a3b8;
      padding: 5px; background: #fff;
      flex-shrink: 0;
    }

    @media(max-width: 480px) {
      #zcs-chat-panel { right: 12px; bottom: 90px; width: calc(100vw - 24px); }
      #zcs-chat-fab   { bottom: 18px; right: 16px; }
    }
  `;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ──────────────────────────────────────────────
  // HTML STRUCTURE
  // ──────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <!-- FAB Button -->
    <button id="zcs-chat-fab" aria-label="Open Zenith - Help Desk">
      <div class="notif-dot" id="zcsNotifDot"></div>
      <svg class="icon-chat" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="icon-close" style="display:none" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- Chat Panel -->
    <div id="zcs-chat-panel" role="dialog" aria-label="Zenith - Help Desk">
      <!-- Header -->
      <div id="zcs-chat-header">
        <div id="zcs-chat-avatar">
          <img src="/Images/zenithlogo.png" alt="ZCS Logo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: contain; background: white; padding: 2px;" />
        </div>
        <div id="zcs-chat-header-info">
          <div class="name">Zenith - Help Desk</div>
          <div class="status">Online · Powered by Gemini AI</div>
        </div>
        <button id="zcs-chat-close" aria-label="Close chat">✕</button>
      </div>

      <!-- Messages -->
      <div id="zcs-chat-messages">
        <!-- Greeting injected by JS -->
        <div id="zcs-typing">
          <div class="zcs-msg-avatar">Z</div>
          <div class="zcs-typing-bubble">
            <div class="zcs-dot"></div>
            <div class="zcs-dot"></div>
            <div class="zcs-dot"></div>
          </div>
        </div>
      </div>

      <!-- Quick reply chips -->
      <div id="zcs-quick-replies">
        ${QUICK_QUESTIONS.map(q => `<button class="zcs-quick-btn">${q}</button>`).join('')}
      </div>

      <!-- Input -->
      <div id="zcs-chat-input-area">
        <input type="text" id="zcs-chat-input" placeholder="Ask about admissions, fees…" autocomplete="off" maxlength="300"/>
        <button id="zcs-chat-send" aria-label="Send" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <div id="zcs-watermark">Zenith Convent School · AI-powered answers</div>
    </div>
  `;
  document.body.appendChild(wrap);

  // ──────────────────────────────────────────────
  // STATE & ELEMENTS
  // ──────────────────────────────────────────────
  const fab      = document.getElementById('zcs-chat-fab');
  const panel    = document.getElementById('zcs-chat-panel');
  const msgs     = document.getElementById('zcs-chat-messages');
  const input    = document.getElementById('zcs-chat-input');
  const sendBtn  = document.getElementById('zcs-chat-send');
  const closeBtn = document.getElementById('zcs-chat-close');
  const typing   = document.getElementById('zcs-typing');
  const notifDot = document.getElementById('zcsNotifDot');

  let isOpen    = false;
  let isBusy    = false;

  // ──────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────
  function mdToHtml(text) {
    return text
      // Images: ![alt](url)
      .replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; border-radius:8px; margin-top:8px; display:block; border: 1px solid rgba(10,61,98,0.1);" referrerpolicy="no-referrer">')
      // Links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#0A3D62; text-decoration:underline; font-weight:600;">$1</a>')
      // Bold: **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic: *text*
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Newlines
      .replace(/\n/g, '<br>');
  }

  function addMsg(role, text, sources) {
    const isBot = role === 'bot';
    const div = document.createElement('div');
    div.className = 'zcs-msg' + (isBot ? '' : ' user');

    let sourcesHtml = '';
    if (isBot && sources && sources.length > 0) {
      sourcesHtml = `<div class="zcs-sources">${sources.map(s =>
        `<span class="zcs-source-chip">📎 ${s.label}</span>`
      ).join('')}</div>`;
    }

    div.innerHTML = `
      <div class="zcs-msg-avatar">${isBot ? 'Z' : 'U'}</div>
      <div class="zcs-msg-bubble">${mdToHtml(text)}${sourcesHtml}</div>
    `;
    msgs.insertBefore(div, typing);
    scrollToBottom();
  }

  function scrollToBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping(show) {
    typing.classList.toggle('show', show);
    if (show) scrollToBottom();
  }

  function setBusy(busy) {
    isBusy = busy;
    input.disabled = busy;
    sendBtn.disabled = busy || !input.value.trim();
  }

  // ──────────────────────────────────────────────
  // OPEN / CLOSE PANEL
  // ──────────────────────────────────────────────
  function openPanel() {
    isOpen = true;
    panel.classList.add('visible');
    fab.classList.add('open');
    notifDot.style.display = 'none';
    input.focus();
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('visible');
    fab.classList.remove('open');
  }

  fab.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closePanel(); });

  // ──────────────────────────────────────────────
  // SEND MESSAGE
  // ──────────────────────────────────────────────
  async function sendMessage(text) {
    if (!text || isBusy) return;
    text = text.trim();
    if (!text) return;

    addMsg('user', text);
    input.value = '';
    sendBtn.disabled = true;
    showTyping(true);
    setBusy(true);

    // Hide quick replies after first message
    document.getElementById('zcs-quick-replies').style.display = 'none';

    try {
      const res = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: text })
      });
      const data = await res.json();
      showTyping(false);

      if (data.success) {
        addMsg('bot', data.answer, data.sources);
      } else {
        addMsg('bot', '⚠️ ' + (data.message || 'Something went wrong. Please try again.'), []);
      }
    } catch (err) {
      showTyping(false);
      addMsg('bot', '⚠️ Unable to connect to the server. Please check your internet connection or call us at **+91 6391002700**.', []);
    } finally {
      setBusy(false);
    }
  }

  sendBtn.addEventListener('click', () => sendMessage(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });
  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim() || isBusy;
  });

  // Quick replies
  document.querySelectorAll('.zcs-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.textContent.replace(/^[^\w]*/, '').trim();
      sendMessage(q);
    });
  });

  // ──────────────────────────────────────────────
  // GREETING MESSAGE
  // ──────────────────────────────────────────────
  addMsg('bot', GREET, []);

  // Show notification dot after 3 seconds if chat hasn't been opened
  setTimeout(() => {
    if (!isOpen) notifDot.style.display = 'block';
  }, 3000);

  // Proactive bubble after 5 seconds
  setTimeout(() => {
    if (!isOpen) {
      const bubble = document.createElement('div');
      bubble.id = 'zcs-proactive';
      bubble.style.cssText = `
        position:fixed;bottom:100px;right:28px;z-index:9997;
        background:white;border-radius:14px;padding:12px 16px;
        box-shadow:0 8px 32px rgba(10,61,98,0.2);
        font-family:'Poppins',sans-serif;font-size:13px;color:#1e293b;
        max-width:230px;line-height:1.5;
        animation:zcs-msg-in 0.4s ease both;
        cursor:pointer;
        border-left:4px solid ${ACCENT};
      `;
      bubble.innerHTML = '👋 Hi! Ask me about <strong>admissions, fees</strong>, or anything about Zenith School!';
      bubble.addEventListener('click', () => {
        bubble.remove();
        openPanel();
      });
      document.body.appendChild(bubble);
      setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 8000);
    }
  }, 5000);

})();
