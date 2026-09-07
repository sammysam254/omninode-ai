import { supabaseService } from './supabaseClient.js';
import { aiDecisionEngine } from './aiDecisionEngine.js';

// State
let allNodes = [];
let allDevices = [];
let allAssets = [];
let currentUser = null;

// Chat Sessions State
let chatSessions = JSON.parse(localStorage.getItem('omni_chat_sessions') || '[]');
let currentSessionId = null;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const btnMobileMenu = document.getElementById('btnMobileMenu');
const btnNewChat = document.getElementById('btnNewChat');
const chatHistoryList = document.getElementById('chatHistoryList');

const meshStatusPill = document.getElementById('meshStatusPill');
const meshStatusText = document.getElementById('meshStatusText');
const currentModelBadge = document.getElementById('currentModelBadge');

const userAccountBar = document.getElementById('userAccountBar');
const userAvatar = document.getElementById('userAvatar');
const userNameDisplay = document.getElementById('userNameDisplay');
const userEmailDisplay = document.getElementById('userEmailDisplay');

const welcomeHero = document.getElementById('welcomeHero');
const chatScrollContainer = document.getElementById('chatScrollContainer');
const chatStream = document.getElementById('chatStream');
const chatInput = document.getElementById('chatInput');
const btnSendMessage = document.getElementById('btnSendMessage');
const btnClearCurrentChat = document.getElementById('btnClearCurrentChat');

// Modals
const accountModal = document.getElementById('accountModal');
const btnAccountSettings = document.getElementById('btnAccountSettings');
const btnCloseAccountModal = document.getElementById('btnCloseAccountModal');
const tabAuth = document.getElementById('tabAuth');
const tabApiKeys = document.getElementById('tabApiKeys');
const paneAuth = document.getElementById('paneAuth');
const paneApiKeys = document.getElementById('paneApiKeys');

const authLoggedOutView = document.getElementById('authLoggedOutView');
const authLoggedInView = document.getElementById('authLoggedInView');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const btnSignIn = document.getElementById('btnSignIn');
const btnSignUp = document.getElementById('btnSignUp');
const btnSignOut = document.getElementById('btnSignOut');
const authErrorMsg = document.getElementById('authErrorMsg');
const profileAvatar = document.getElementById('profileAvatar');
const profileEmail = document.getElementById('profileEmail');

const inputGrokKey = document.getElementById('inputGrokKey');
const inputOpenRouterKey = document.getElementById('inputOpenRouterKey');
const inputGeminiApiKey = document.getElementById('inputGeminiApiKey');
const btnSaveApiKeys = document.getElementById('btnSaveApiKeys');

const downloadModal = document.getElementById('downloadModal');
const btnDownloadAgent = document.getElementById('btnDownloadAgent');
const btnCloseDownloadModal = document.getElementById('btnCloseDownloadModal');
const btnDownloadBatFile = document.getElementById('btnDownloadBatFile');

// Load Background Data from Supabase
async function loadBackgroundData() {
    try {
        allNodes = await supabaseService.getNodes();
        allDevices = await supabaseService.getAttachedDevices();
        allAssets = await supabaseService.getAssets();

        // Update silent status pill
        const pcCount = allNodes.length;
        const devCount = allDevices.length;
        const assetCount = allAssets.length;

        if (pcCount > 0 || devCount > 0) {
            meshStatusText.textContent = `Synced: ${pcCount} PC${pcCount !== 1 ? 's' : ''}, ${devCount} Android, ${assetCount} Assets`;
            meshStatusPill.style.color = 'var(--accent-emerald)';
        } else {
            meshStatusText.textContent = 'Mesh Ready (Run setup.bat to sync)';
            meshStatusPill.style.color = 'var(--text-muted)';
        }
    } catch (e) {
        console.warn('Silent mesh background poll:', e.message);
    }
}

// User Authentication
async function checkAuthSession() {
    if (supabaseService.client) {
        try {
            const { data } = await supabaseService.client.auth.getSession();
            if (data?.session?.user) {
                setLoggedInUser(data.session.user);
                return;
            }
        } catch (e) {}
    }

    // Default Guest state
    const localGuest = localStorage.getItem('omni_guest_user');
    if (localGuest) {
        setLoggedInUser(JSON.parse(localGuest));
    } else {
        setLoggedOutState();
    }
}

function setLoggedInUser(user) {
    currentUser = user;
    const initial = (user.email ? user.email.charAt(0).toUpperCase() : 'U');
    userAvatar.textContent = initial;
    profileAvatar.textContent = initial;
    userNameDisplay.textContent = user.user_metadata?.full_name || user.email.split('@')[0];
    userEmailDisplay.textContent = user.email;
    profileEmail.textContent = user.email;

    authLoggedOutView.style.display = 'none';
    authLoggedInView.style.display = 'block';
}

function setLoggedOutState() {
    currentUser = null;
    userAvatar.textContent = 'G';
    profileAvatar.textContent = 'G';
    userNameDisplay.textContent = 'Guest User';
    userEmailDisplay.textContent = 'Click to sign in / create account';

    authLoggedOutView.style.display = 'block';
    authLoggedInView.style.display = 'none';
}

// Chat Session Management
function initChatSessions() {
    if (chatSessions.length === 0) {
        createNewChatSession(false);
    } else {
        loadChatSession(chatSessions[0].id);
    }
    renderChatHistorySidebar();
}

function createNewChatSession(shouldFocus = true) {
    const newSession = {
        id: 'session_' + Date.now(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
    };

    chatSessions.unshift(newSession);
    saveChatSessions();
    loadChatSession(newSession.id);
    renderChatHistorySidebar();

    if (shouldFocus) {
        chatInput.focus();
    }
}

function loadChatSession(sessionId) {
    currentSessionId = sessionId;
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) return;

    aiDecisionEngine.setHistory(session.messages.map(m => ({
        role: m.role,
        content: m.content
    })));

    renderMessages(session.messages);
    renderChatHistorySidebar();
}

function deleteChatSession(sessionId, e) {
    if (e) e.stopPropagation();
    chatSessions = chatSessions.filter(s => s.id !== sessionId);
    saveChatSessions();

    if (chatSessions.length === 0) {
        createNewChatSession(false);
    } else if (currentSessionId === sessionId) {
        loadChatSession(chatSessions[0].id);
    } else {
        renderChatHistorySidebar();
    }
}

function saveChatSessions() {
    localStorage.setItem('omni_chat_sessions', JSON.stringify(chatSessions));
}

function renderChatHistorySidebar() {
    chatHistoryList.innerHTML = '';

    chatSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `chat-history-item ${session.id === currentSessionId ? 'active' : ''}`;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-history-title';
        titleSpan.textContent = session.title || 'Conversation';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-history-delete';
        deleteBtn.title = 'Delete conversation';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = (e) => deleteChatSession(session.id, e);

        item.onclick = () => loadChatSession(session.id);
        item.appendChild(titleSpan);
        item.appendChild(deleteBtn);
        chatHistoryList.appendChild(item);
    });
}

// Render Messages & Markdown Formatter
function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        welcomeHero.style.display = 'flex';
        chatStream.innerHTML = '';
        return;
    }

    welcomeHero.style.display = 'none';
    chatStream.innerHTML = '';

    messages.forEach(msg => {
        appendMessageElement(msg.role, msg.content, false);
    });

    chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
}

function formatMarkdown(text) {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code Blocks
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Inline Code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold & Italics
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^>\s?(.*)$/gm, '<blockquote style="border-left: 3px solid var(--gemini-blue); padding-left: 10px; margin: 6px 0; color: var(--text-secondary);">$1</blockquote>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 1.05rem; margin: 0.75rem 0 0.35rem 0; color: var(--text-main);">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size: 1.15rem; margin: 0.9rem 0 0.4rem 0; color: var(--text-main);">$1</h2>');

    // Bullet Lists
    html = html.replace(/^\s*-\s+(.*)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul style="margin: 0.5rem 0 0.5rem 1.25rem;">$1</ul>');

    // Newlines to Paragraphs
    html = html.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

    return html;
}

function appendMessageElement(role, text, shouldScroll = true) {
    const row = document.createElement('div');
    row.className = `chat-message-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = `chat-avatar ${role}`;
    avatar.textContent = role === 'user' ? (currentUser ? currentUser.email.charAt(0).toUpperCase() : 'U') : '✦';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    if (role === 'user') {
        bubble.textContent = text;
    } else {
        bubble.innerHTML = formatMarkdown(text);
    }

    if (role === 'user') {
        row.appendChild(bubble);
        row.appendChild(avatar);
    } else {
        row.appendChild(avatar);
        row.appendChild(bubble);
    }

    chatStream.appendChild(row);

    if (shouldScroll) {
        chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
    }

    return row;
}

function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'chat-message-row assistant typing-row';
    row.id = 'typingIndicatorRow';

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar assistant';
    avatar.textContent = '✦';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = `
        <div class="typing-dots">
            <span></span><span></span><span></span>
        </div>
    `;

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatStream.appendChild(row);
    chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingRow = document.getElementById('typingIndicatorRow');
    if (typingRow) typingRow.remove();
}

// Send Message Handler
async function handleSendMessage(promptText) {
    const prompt = (promptText || chatInput.value).trim();
    if (!prompt) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';

    const session = chatSessions.find(s => s.id === currentSessionId);
    if (!session) return;

    // First prompt becomes the title of the chat
    if (session.messages.length === 0) {
        session.title = prompt.length > 28 ? prompt.substring(0, 28) + '...' : prompt;
        renderChatHistorySidebar();
    }

    welcomeHero.style.display = 'none';

    // Append User Message
    session.messages.push({ role: 'user', content: prompt });
    appendMessageElement('user', prompt, true);
    saveChatSessions();

    btnSendMessage.disabled = true;
    showTypingIndicator();

    try {
        const result = await aiDecisionEngine.chat(prompt, allAssets, allNodes, allDevices);
        removeTypingIndicator();

        if (result.source_engine) {
            currentModelBadge.textContent = result.source_engine;
        }

        session.messages.push({ role: 'assistant', content: result.reply });
        appendMessageElement('assistant', result.reply, true);
        saveChatSessions();

        // Save AI decision asynchronously to Supabase
        supabaseService.saveDecision({
            node_id: allNodes[0]?.node_id || 'web-client',
            decision_type: 'conversational_query',
            context: { prompt, user_id: currentUser?.id || 'guest' },
            decision_payload: { response: result.reply, engine: result.source_engine },
            confidence_score: 0.98
        });

    } catch (err) {
        removeTypingIndicator();
        const fallbackMsg = "I'm having trouble reaching the reasoning engine right now. Please check your network or API keys in Settings.";
        appendMessageElement('assistant', fallbackMsg, true);
        session.messages.push({ role: 'assistant', content: fallbackMsg });
        saveChatSessions();
    } finally {
        btnSendMessage.disabled = false;
        chatInput.focus();
    }
}

// Event Listeners Setup
function setupEvents() {
    // Textarea auto-expansion and Enter to submit
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    btnSendMessage.addEventListener('click', () => handleSendMessage());

    btnNewChat.addEventListener('click', () => createNewChatSession(true));

    btnClearCurrentChat.addEventListener('click', () => {
        const session = chatSessions.find(s => s.id === currentSessionId);
        if (session) {
            session.messages = [];
            session.title = 'New Chat';
            aiDecisionEngine.clearHistory();
            saveChatSessions();
            renderMessages([]);
            renderChatHistorySidebar();
        }
    });

    // Sidebar Toggles
    btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    btnMobileMenu.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Suggestion Cards Click
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.getAttribute('data-prompt');
            if (prompt) handleSendMessage(prompt);
        });
    });

    // Account & Settings Modal
    userAccountBar.addEventListener('click', () => accountModal.classList.add('open'));
    btnAccountSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        accountModal.classList.add('open');
    });
    btnCloseAccountModal.addEventListener('click', () => accountModal.classList.remove('open'));

    tabAuth.addEventListener('click', () => {
        tabAuth.classList.add('active');
        tabApiKeys.classList.remove('active');
        paneAuth.classList.add('active');
        paneApiKeys.classList.remove('active');
    });

    tabApiKeys.addEventListener('click', () => {
        tabApiKeys.classList.add('active');
        tabAuth.classList.remove('active');
        paneApiKeys.classList.add('active');
        paneAuth.classList.remove('active');
    });

    // Authentication Actions
    btnSignUp.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        const password = authPassword.value;
        authErrorMsg.textContent = '';

        if (!email || !password) {
            authErrorMsg.textContent = 'Please enter email and password.';
            return;
        }

        if (supabaseService.client) {
            const { data, error } = await supabaseService.client.auth.signUp({ email, password });
            if (error) {
                authErrorMsg.textContent = error.message;
            } else {
                setLoggedInUser(data.user || { email });
                accountModal.classList.remove('open');
            }
        } else {
            const guest = { email, id: 'user_' + Date.now() };
            localStorage.setItem('omni_guest_user', JSON.stringify(guest));
            setLoggedInUser(guest);
            accountModal.classList.remove('open');
        }
    });

    btnSignIn.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        const password = authPassword.value;
        authErrorMsg.textContent = '';

        if (!email || !password) {
            authErrorMsg.textContent = 'Please enter email and password.';
            return;
        }

        if (supabaseService.client) {
            const { data, error } = await supabaseService.client.auth.signInWithPassword({ email, password });
            if (error) {
                authErrorMsg.textContent = error.message;
            } else {
                setLoggedInUser(data.user);
                accountModal.classList.remove('open');
            }
        } else {
            const guest = { email, id: 'user_' + Date.now() };
            localStorage.setItem('omni_guest_user', JSON.stringify(guest));
            setLoggedInUser(guest);
            accountModal.classList.remove('open');
        }
    });

    btnSignOut.addEventListener('click', async () => {
        if (supabaseService.client) {
            await supabaseService.client.auth.signOut();
        }
        localStorage.removeItem('omni_guest_user');
        setLoggedOutState();
    });

    // Save API Keys
    btnSaveApiKeys.addEventListener('click', () => {
        aiDecisionEngine.setKeys({
            openRouterKey: inputOpenRouterKey.value,
            grokKey: inputGrokKey.value,
            geminiKey: inputGeminiApiKey.value
        });
        alert('API keys updated successfully!');
        accountModal.classList.remove('open');
    });

    // Download setup.bat modal
    btnDownloadAgent.addEventListener('click', () => downloadModal.classList.add('open'));
    btnCloseDownloadModal.addEventListener('click', () => downloadModal.classList.remove('open'));

    btnDownloadBatFile.addEventListener('click', () => {
        const batContent = `@echo off
cd /d "%~dp0"
title OmniNode AI - Universal PC and Android ADB Sync Agent
echo [*] Launching OmniNode AI Agent...
where git >nul 2>&1 && if exist ".git" git pull origin main --quiet
if not exist "agent\\node_modules" pushd agent & call npm install --no-audit --no-fund & popd
cd agent
node agent.js
pause`;
        const blob = new Blob([batContent], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'setup.bat';
        a.click();
    });
}

// Initial Boot
setupEvents();
checkAuthSession();
initChatSessions();
loadBackgroundData();
setInterval(loadBackgroundData, 3500);
