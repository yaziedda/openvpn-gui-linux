import {Connect, SendOTP, Disconnect, ClearAllSessions, GetStatus, GetProfiles, SaveProfile, DeleteProfile, BrowseConfig, GetSessionStats} from '../wailsjs/go/main/App';
import {EventsOn} from '../wailsjs/runtime/runtime';
import './style.css';

const app = document.getElementById('app');
app.innerHTML = `
    <div class="header">
        <div class="header-brand">
            <svg class="openvpn-logo" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <path d="M264.4 181.8c40.9 4.9 71.5 38.9 71.3 79.1-.1 32.6-20.6 61.9-51.7 73.7l30.7 162.8H194.9l31.2-162.5c-38.6-14.1-60.3-54.1-50.5-93.2 9.8-39 47.9-64.8 88.8-59.9" style="fill:#ffffff;fill-rule:evenodd;clip-rule:evenodd;"/>
                <path d="M256 14.6c139.3 0 253.1 108.8 256 244.9.1 88.5-48.2 170.2-126.7 214.4l-16.3-106c25.5-26.8 39.7-62.4 39.8-99.5-2.2-80.8-70-145.2-152.7-145.2s-150.5 64.4-152.7 145.2c.1 36.7 14.1 72.1 39.2 98.8l-16.4 106.4C48 429.3 0 347.7 0 259.5 2.9 123.4 116.7 14.6 256 14.6" style="fill:#ea580c;fill-rule:evenodd;clip-rule:evenodd;"/>
            </svg>
            <div class="brand-text">
                <span class="brand-title">OpenVPN</span>
                <span class="brand-sub">CONNECT</span>
            </div>
        </div>
        <div class="header-actions">
            <span class="status-pill disconnected" id="status-pill">Disconnected</span>
            <button class="btn-kill-hdr" id="btn-kill-hdr" title="Force kill & clear all OpenVPN sessions">✕ Kill All</button>
        </div>
    </div>

    <div class="content">
        <!-- 1. LOGIN / PROFILE VIEW (DISCONNECTED) -->
        <div id="login-form" class="card">
            <div class="form-group">
                <label>Profile</label>
                <div class="row">
                    <select id="profile-select"><option value="">-- Select Profile --</option></select>
                    <button class="btn-icon-del" id="btn-del" title="Delete Profile">✕</button>
                </div>
            </div>

            <div class="form-group">
                <label>Config File (.ovpn)</label>
                <div class="row">
                    <input type="text" id="config-file" readonly placeholder="No file selected"/>
                    <button class="btn-browse" id="btn-browse">Browse</button>
                </div>
            </div>

            <div class="form-group">
                <label>Username</label>
                <input type="text" id="username" placeholder="Username (if required)"/>
            </div>

            <div class="form-group">
                <label>Password</label>
                <input type="password" id="password" placeholder="Password (if required)"/>
            </div>

            <div class="profile-save-row">
                <input type="text" id="profile-name" placeholder="Save as profile name..."/>
                <button class="btn-save" id="btn-save">Save</button>
            </div>

            <div class="btn-actions-row">
                <button class="btn-connect" id="btn-connect">CONNECT</button>
            </div>
        </div>

        <!-- 2. CONNECTED HERO VIEW (OpenVPN Connect Style) -->
        <div id="connected-view" class="card hero-connected hidden">
            <div class="hero-top">
                <div class="hero-profile-info">
                    <div class="hero-profile-name" id="hero-profile-name">Connected Profile</div>
                    <div class="hero-profile-cfg" id="hero-profile-cfg">client.ovpn</div>
                </div>
                <div class="toggle-container" title="Click to Disconnect" id="hero-toggle-btn">
                    <div class="toggle-track active">
                        <div class="toggle-thumb"></div>
                    </div>
                </div>
            </div>

            <div class="network-grid">
                <div class="grid-card vpn-ip-card">
                    <span class="grid-label">YOUR VPN IP</span>
                    <span class="grid-value ip-highlight" id="stat-vpn-ip">--</span>
                </div>
                <div class="grid-card">
                    <span class="grid-label">SERVER ENDPOINT</span>
                    <span class="grid-value" id="stat-server-ip">--</span>
                </div>
                <div class="grid-card">
                    <span class="grid-label">DURATION</span>
                    <span class="grid-value" id="stat-duration">00:00:00</span>
                </div>
                <div class="grid-card">
                    <span class="grid-label">INTERFACE</span>
                    <span class="grid-value" id="stat-device">tun0</span>
                </div>
            </div>

            <div class="traffic-box">
                <div class="traffic-item">
                    <span class="traffic-icon">⬇</span>
                    <span class="traffic-label">BYTES IN</span>
                    <span class="traffic-val" id="stat-bytes-in">0 B</span>
                </div>
                <div class="traffic-divider"></div>
                <div class="traffic-item">
                    <span class="traffic-icon">⬆</span>
                    <span class="traffic-label">BYTES OUT</span>
                    <span class="traffic-val" id="stat-bytes-out">0 B</span>
                </div>
            </div>

            <div class="btn-actions-row" style="margin-top: 14px;">
                <button class="btn-disconnect" id="btn-disconnect">DISCONNECT</button>
                <button class="btn-kill-action" id="btn-clear-connected">KILL ALL</button>
            </div>
        </div>

        <!-- 3. CONNECTING / SPINNER VIEW -->
        <div id="connecting-view" class="card hero-connecting hidden">
            <div class="spinner-ring"></div>
            <div class="connecting-title">Connecting to VPN...</div>
            <div class="connecting-sub" id="connecting-profile-name">Establishing secure tunnel</div>
            <button class="btn-cancel-conn" id="btn-cancel-conn">CANCEL</button>
        </div>

        <!-- 4. OTP / 2FA VIEW -->
        <div id="otp-form" class="card hero-otp hidden">
            <div class="otp-icon">🔐</div>
            <div class="otp-title">Two-Factor Authentication</div>
            <div class="otp-desc">Enter your 6-digit Authenticator Code to complete the connection</div>
            <div class="form-group" style="margin: 14px 0;">
                <input type="text" id="otp" placeholder="000000" maxlength="8" autofocus class="otp-input"/>
            </div>
            <button class="btn-otp" id="btn-otp">SUBMIT CODE</button>
            <button class="btn-cancel-conn" id="btn-cancel-otp" style="margin-top: 8px;">CANCEL</button>
        </div>

        <!-- 5. COLLAPSIBLE LOG DRAWER -->
        <div class="log-drawer">
            <div class="log-header" id="log-toggle">
                <span>Console Log</span>
                <span class="log-toggle-icon" id="log-toggle-icon">▾</span>
            </div>
            <div class="log-box" id="log"></div>
        </div>
    </div>
`;

const $ = id => document.getElementById(id);
const loginForm = $('login-form');
const connectedView = $('connected-view');
const connectingView = $('connecting-view');
const otpForm = $('otp-form');
const statusPill = $('status-pill');
const logEl = $('log');
const profileSelect = $('profile-select');
const configInput = $('config-file');
const usernameInput = $('username');
const passwordInput = $('password');
const profileNameInput = $('profile-name');

let statsInterval = null;
let currentProfileName = '';

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(secs) {
    if (!secs || secs < 0) return '00:00:00';
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

async function loadProfiles() {
    const profiles = await GetProfiles();
    profileSelect.innerHTML = '<option value="">-- Select Profile --</option>';
    profiles.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        opt.dataset.config = p.config_file || '';
        opt.dataset.username = p.username || '';
        opt.dataset.password = p.password || '';
        profileSelect.appendChild(opt);
    });
}

profileSelect.addEventListener('change', () => {
    const opt = profileSelect.selectedOptions[0];
    if (opt && opt.value) {
        configInput.value = opt.dataset.config || '';
        usernameInput.value = opt.dataset.username || '';
        passwordInput.value = opt.dataset.password || '';
        profileNameInput.value = opt.value;
        currentProfileName = opt.value;
    }
});

$('btn-browse').addEventListener('click', async () => {
    const file = await BrowseConfig();
    if (file) {
        configInput.value = file;
        if (!profileNameInput.value) {
            const base = file.split('/').pop().replace(/\.(ovpn|conf)$/i, '');
            profileNameInput.value = base.toUpperCase();
        }
    }
});

$('btn-save').addEventListener('click', async () => {
    const name = profileNameInput.value.trim();
    if (!name || !configInput.value) return;
    await SaveProfile(name, usernameInput.value, passwordInput.value, configInput.value);
    await loadProfiles();
    profileSelect.value = name;
    currentProfileName = name;
});

$('btn-del').addEventListener('click', async () => {
    const name = profileSelect.value;
    if (!name) return;
    await DeleteProfile(name);
    configInput.value = '';
    usernameInput.value = '';
    passwordInput.value = '';
    profileNameInput.value = '';
    currentProfileName = '';
    await loadProfiles();
});

async function updateStats() {
    try {
        const s = await GetSessionStats();
        if (s) {
            $('stat-vpn-ip').textContent = s.vpn_ip || '--';
            $('stat-server-ip').textContent = s.server_ip || '--';
            $('stat-device').textContent = s.device || 'tun0';
            $('stat-duration').textContent = formatDuration(s.duration_secs);
            $('stat-bytes-in').textContent = formatBytes(s.bytes_in);
            $('stat-bytes-out').textContent = formatBytes(s.bytes_out);
            if (s.profile_name) $('hero-profile-name').textContent = s.profile_name;
            if (s.config_file) $('hero-profile-cfg').textContent = s.config_file;
        }
    } catch (e) {}
}

function updateUI(s) {
    statusPill.className = 'status-pill ' + s;
    const labels = {
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        waiting_2fa: '2FA Required',
        connected: 'Connected',
        auth_failed: 'Auth Failed'
    };
    statusPill.textContent = labels[s] || s;

    // Toggle views
    loginForm.classList.toggle('hidden', s === 'connecting' || s === 'waiting_2fa' || s === 'connected');
    connectingView.classList.toggle('hidden', s !== 'connecting');
    otpForm.classList.toggle('hidden', s !== 'waiting_2fa');
    connectedView.classList.toggle('hidden', s !== 'connected');

    if (s === 'connecting') {
        $('connecting-profile-name').textContent = currentProfileName || configInput.value.split('/').pop() || 'OpenVPN Server';
    }

    if (s === 'waiting_2fa') {
        $('otp').value = '';
        setTimeout(() => $('otp').focus(), 100);
    }

    if (s === 'connected') {
        $('hero-profile-name').textContent = currentProfileName || 'OpenVPN Tunnel';
        $('hero-profile-cfg').textContent = configInput.value.split('/').pop() || '';
        updateStats();
        if (!statsInterval) {
            statsInterval = setInterval(updateStats, 1000);
        }
    } else {
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
    }
}

$('btn-connect').addEventListener('click', async () => {
    const c = configInput.value;
    if (!c) {
        alert('Please select a .ovpn config file first');
        return;
    }
    currentProfileName = profileSelect.value || profileNameInput.value || c.split('/').pop().replace(/\.(ovpn|conf)$/i, '');
    $('btn-connect').disabled = true;
    await Connect(usernameInput.value, passwordInput.value, c, currentProfileName);
    $('btn-connect').disabled = false;
});

$('btn-otp').addEventListener('click', async () => {
    const otp = $('otp').value.trim();
    if (!otp) return;
    await SendOTP(otp);
    $('otp').value = '';
});

$('otp').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-otp').click(); });
passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-connect').click(); });

$('btn-disconnect').addEventListener('click', () => Disconnect());
$('hero-toggle-btn').addEventListener('click', () => Disconnect());
$('btn-cancel-conn').addEventListener('click', () => Disconnect());
$('btn-cancel-otp').addEventListener('click', () => Disconnect());

async function handleKillAll() {
    const btns = [$('btn-kill-hdr'), $('btn-clear-connected')].filter(Boolean);
    btns.forEach(b => { b.disabled = true; b.textContent = 'Killing...'; });
    try {
        await ClearAllSessions();
    } finally {
        btns.forEach(b => { b.disabled = false; b.textContent = b.id === 'btn-kill-hdr' ? '✕ Kill All' : 'KILL ALL'; });
    }
}

$('btn-kill-hdr').addEventListener('click', handleKillAll);
$('btn-clear-connected').addEventListener('click', handleKillAll);

// Log drawer toggle
let logExpanded = false;
$('log-toggle').addEventListener('click', () => {
    logExpanded = !logExpanded;
    logEl.classList.toggle('expanded', logExpanded);
    $('log-toggle-icon').textContent = logExpanded ? '▴' : '▾';
});

EventsOn('vpn-status', updateUI);
EventsOn('vpn-log', line => {
    logEl.textContent += line + '\n';
    logEl.scrollTop = logEl.scrollHeight;
});

GetStatus().then(updateUI);
loadProfiles();
