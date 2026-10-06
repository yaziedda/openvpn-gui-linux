import {Connect, SendOTP, Disconnect, ClearAllSessions, GetStatus, GetProfiles, GetLastProfile, SaveProfile, DeleteProfile, BrowseConfig, GetSessionStats} from '../wailsjs/go/main/App';
import {EventsOn} from '../wailsjs/runtime/runtime';
import './style.css';

const app = document.getElementById('app');
app.innerHTML = `
    <header class="app-header">
        <div class="header-brand">
            <div class="logo-wrapper">
                <svg class="openvpn-logo" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                    <path d="M264.4 181.8c40.9 4.9 71.5 38.9 71.3 79.1-.1 32.6-20.6 61.9-51.7 73.7l30.7 162.8H194.9l31.2-162.5c-38.6-14.1-60.3-54.1-50.5-93.2 9.8-39 47.9-64.8 88.8-59.9" style="fill:#ffffff;fill-rule:evenodd;clip-rule:evenodd;"/>
                    <path d="M256 14.6c139.3 0 253.1 108.8 256 244.9.1 88.5-48.2 170.2-126.7 214.4l-16.3-106c25.5-26.8 39.7-62.4 39.8-99.5-2.2-80.8-70-145.2-152.7-145.2s-150.5 64.4-152.7 145.2c.1 36.7 14.1 72.1 39.2 98.8l-16.4 106.4C48 429.3 0 347.7 0 259.5 2.9 123.4 116.7 14.6 256 14.6" style="fill:#ea580c;fill-rule:evenodd;clip-rule:evenodd;"/>
                </svg>
            </div>
            <div class="brand-text">
                <span class="brand-title">OpenVPN</span>
                <span class="brand-badge">CONNECT</span>
            </div>
        </div>
        <div class="header-actions">
            <div class="status-indicator disconnected" id="status-pill">
                <span class="status-dot"></span>
                <span class="status-text" id="status-text">Disconnected</span>
                <span class="status-latency hidden" id="status-latency"></span>
            </div>
            <button class="btn-icon-action" id="btn-kill-hdr" title="Force kill all sessions (Ctrl+K)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    </header>

    <main class="app-body">
        <!-- 1. LOGIN / CONFIG VIEW (DISCONNECTED) -->
        <section id="login-form" class="panel">
            <div class="field-group">
                <label for="profile-select">VPN PROFILE</label>
                <div class="field-row">
                    <div class="select-wrapper">
                        <select id="profile-select">
                            <option value="">-- Select Profile --</option>
                        </select>
                    </div>
                    <button class="btn-icon-danger" id="btn-del" title="Delete Profile">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="field-group">
                <label for="config-file">CONFIG FILE (.OVPN)</label>
                <div class="field-row">
                    <input type="text" id="config-file" readonly placeholder="No configuration selected" class="input-readonly"/>
                    <button class="btn-secondary" id="btn-browse">Browse</button>
                </div>
            </div>

            <div class="field-group">
                <label>CREDENTIALS</label>
                <div class="credentials-stack">
                    <div class="input-with-icon">
                        <svg class="input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <input type="text" id="username" placeholder="Username (if required)" autocomplete="off"/>
                    </div>
                    <div class="input-with-icon">
                        <svg class="input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <input type="password" id="password" placeholder="Password (if required)"/>
                    </div>
                </div>
            </div>

            <div class="save-profile-bar">
                <input type="text" id="profile-name" placeholder="Save as profile name..."/>
                <button class="btn-secondary btn-sm" id="btn-save">Save</button>
            </div>

            <div class="form-action">
                <button class="btn-primary" id="btn-connect">
                    <span>CONNECT</span>
                    <span class="key-hint">↵</span>
                </button>
            </div>
        </section>

        <!-- 2. CONNECTED HERO VIEW -->
        <section id="connected-view" class="panel hero-panel hidden">
            <div class="hero-header">
                <div class="hero-details">
                    <div class="hero-title-row">
                        <span class="hero-status-dot"></span>
                        <h2 class="hero-title" id="hero-profile-name">Connected</h2>
                    </div>
                    <span class="hero-subtitle" id="hero-profile-cfg">client.ovpn</span>
                </div>
                <div class="switch-toggle active" id="hero-toggle-btn" title="Click to Disconnect">
                    <div class="switch-handle"></div>
                </div>
            </div>

            <!-- Live Network Throughput Chart -->
            <div class="chart-container">
                <div class="chart-header">
                    <span class="chart-title">NETWORK TRAFFIC</span>
                    <div class="chart-stats">
                        <span class="stat-pill download" id="chart-rx-speed">↓ 0 B/s</span>
                        <span class="stat-pill upload" id="chart-tx-speed">↑ 0 B/s</span>
                        <span class="stat-pill peak" id="chart-peak-speed">Peak: 0 B/s</span>
                    </div>
                </div>
                <div class="canvas-wrap">
                    <canvas id="network-chart" width="370" height="85"></canvas>
                </div>
            </div>

            <!-- Metrics Grid with 1-Click Copy -->
            <div class="metrics-grid">
                <div class="metric-card copyable" id="card-vpn-ip" title="Click to copy IP">
                    <div class="metric-header">
                        <span class="metric-label">YOUR VPN IP</span>
                        <svg class="copy-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </div>
                    <div class="metric-value highlight" id="stat-vpn-ip">--</div>
                </div>

                <div class="metric-card copyable" id="card-server-ip" title="Click to copy server endpoint">
                    <div class="metric-header">
                        <span class="metric-label">SERVER ENDPOINT</span>
                        <svg class="copy-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </div>
                    <div class="metric-value" id="stat-server-ip">--</div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">DURATION</span>
                    </div>
                    <div class="metric-value font-mono" id="stat-duration">00:00:00</div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">INTERFACE</span>
                    </div>
                    <div class="metric-value font-mono" id="stat-device">tun0</div>
                </div>
            </div>

            <!-- Cumulative Transfer -->
            <div class="transfer-strip">
                <div class="transfer-side">
                    <svg class="transfer-icon rx" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                    <span class="transfer-label">DOWNLOADED</span>
                    <span class="transfer-val" id="stat-bytes-in">0 B</span>
                </div>
                <div class="transfer-divider"></div>
                <div class="transfer-side">
                    <svg class="transfer-icon tx" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                    <span class="transfer-label">UPLOADED</span>
                    <span class="transfer-val" id="stat-bytes-out">0 B</span>
                </div>
            </div>

            <div class="connected-footer">
                <button class="btn-disconnect-outline" id="btn-disconnect">Disconnect</button>
                <button class="btn-danger-outline" id="btn-clear-connected">Kill All</button>
            </div>
        </section>

        <!-- 3. CONNECTING STATE -->
        <section id="connecting-view" class="panel connecting-panel hidden">
            <div class="radar-container">
                <div class="radar-ring"></div>
                <div class="radar-dot"></div>
            </div>
            <h3 class="state-title">Securing Connection...</h3>
            <p class="state-subtitle" id="connecting-profile-name">Establishing tunnel & routing table</p>
            <button class="btn-secondary btn-sm" id="btn-cancel-conn">Cancel</button>
        </section>

        <!-- 4. OTP / 2FA STATE -->
        <section id="otp-form" class="panel otp-panel hidden">
            <div class="otp-shield-wrap" id="otp-shield-wrap">
                <div class="otp-shield-pulse"></div>
                <div class="otp-shield">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                </div>
            </div>
            <h3 class="state-title" id="otp-title">Two-Factor Authentication</h3>
            <p class="state-subtitle" id="otp-desc">Enter your 6-digit Authenticator code</p>
            <div class="otp-input-wrap">
                <input type="text" id="otp" placeholder="000 000" maxlength="8" autofocus class="otp-field"/>
            </div>
            <div class="otp-buttons">
                <button class="btn-primary" id="btn-otp">
                    <span class="btn-spinner hidden" id="otp-spinner"></span>
                    <span id="btn-otp-text">Verify Code</span>
                </button>
                <button class="btn-secondary" id="btn-cancel-otp">Cancel</button>
            </div>
        </section>

        <!-- 5. COLLAPSIBLE CONSOLE DRAWER -->
        <section class="log-section">
            <button class="log-toggle-bar" id="log-toggle" type="button">
                <div class="log-toggle-label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                    <span>Console Log</span>
                </div>
                <div class="log-toggle-right">
                    <span class="shortcut-tip">Ctrl+L</span>
                    <span class="chevron-arrow" id="log-toggle-icon">▾</span>
                </div>
            </button>
            <div class="log-body" id="log"></div>
        </section>
    </main>

    <!-- TOAST NOTIFICATION -->
    <div id="toast" class="toast hidden"></div>
`;

const $ = id => document.getElementById(id);
const loginForm = $('login-form');
const connectedView = $('connected-view');
const connectingView = $('connecting-view');
const otpForm = $('otp-form');
const statusPill = $('status-pill');
const statusText = $('status-text');
const statusLatency = $('status-latency');
const logEl = $('log');
const profileSelect = $('profile-select');
const configInput = $('config-file');
const usernameInput = $('username');
const passwordInput = $('password');
const profileNameInput = $('profile-name');

let statsInterval = null;
let currentProfileName = '';
let currentStatus = 'disconnected';

// Throughput chart state
const MAX_CHART_POINTS = 30;
let chartData = [];
for (let i = 0; i < MAX_CHART_POINTS; i++) {
    chartData.push({ rx: 0, tx: 0 });
}
let lastBytesIn = null;
let lastBytesOut = null;
let lastPollTime = null;
let peakRate = 0;

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bps) {
    if (!bps || bps <= 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bps) / Math.log(k));
    const val = (bps / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1);
    return `${val} ${sizes[i]}`;
}

function formatDuration(secs) {
    if (!secs || secs < 0) return '00:00:00';
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// Toast notification
let toastTimeout = null;
function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    // Force reflow for animation
    void toast.offsetWidth;
    toast.classList.add('visible');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.classList.add('hidden'), 200);
    }, 1800);
}

async function copyToClipboard(text, label) {
    if (!text || text === '--' || text === '-') return;
    try {
        await navigator.clipboard.writeText(text);
        showToast(`${label || text} copied ✓`);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(`${label || text} copied ✓`);
    }
}

// 1-Click Copy event bindings
$('card-vpn-ip').addEventListener('click', () => {
    const ip = $('stat-vpn-ip').textContent.trim();
    copyToClipboard(ip, 'VPN IP');
});
$('card-server-ip').addEventListener('click', () => {
    const srv = $('stat-server-ip').textContent.trim();
    copyToClipboard(srv, 'Server Endpoint');
});

// Canvas chart rendering
function renderChart() {
    const canvas = $('network-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 370;
    const height = 85;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
    }
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Subtle horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    [0.25, 0.5, 0.75].forEach(pct => {
        const y = Math.round(height * pct);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    });
    ctx.stroke();

    // Scale calculation with minimum headroom (10 KB/s)
    let maxVal = 10 * 1024;
    for (const d of chartData) {
        if (d.rx > maxVal) maxVal = d.rx;
        if (d.tx > maxVal) maxVal = d.tx;
    }
    maxVal *= 1.15; // 15% top padding

    function drawStream(dataKey, strokeColor, fillColor) {
        if (chartData.length < 2) return;
        const step = width / (MAX_CHART_POINTS - 1);
        const points = chartData.map((d, i) => {
            const x = i * step;
            const y = height - (d[dataKey] / maxVal) * (height - 8) - 4;
            return { x, y };
        });

        // Fill area under spline
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, height);
        ctx.lineTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            const cpX = (points[i].x + points[i + 1].x) / 2;
            const cpY = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, cpX, cpY);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.lineTo(last.x, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, fillColor);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // Stroke line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            const cpX = (points[i].x + points[i + 1].x) / 2;
            const cpY = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, cpX, cpY);
        }
        ctx.lineTo(last.x, last.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Glowing cursor head at latest point
        ctx.beginPath();
        ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
    }

    // Draw upload (amber) first, download (emerald) on top
    drawStream('tx', '#f59e0b', 'rgba(245, 158, 11, 0.18)');
    drawStream('rx', '#10b981', 'rgba(16, 185, 129, 0.24)');
}

async function loadProfiles() {
    try {
        const [profiles, lastProfile] = await Promise.all([
            GetProfiles(),
            GetLastProfile().catch(() => '')
        ]);

        profileSelect.innerHTML = '<option value="">-- Select Profile --</option>';
        let selectedIndex = -1;

        profiles.forEach((p, idx) => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.name;
            opt.dataset.config = p.config_file || '';
            opt.dataset.username = p.username || '';
            opt.dataset.password = p.password || '';
            profileSelect.appendChild(opt);

            // Match remembered profile
            if (lastProfile && p.name === lastProfile) {
                selectedIndex = idx + 1;
            }
        });

        // Fallback to previous default if no remembered profile
        if (selectedIndex === -1 && profiles.length > 0) {
            for (let i = 0; i < profiles.length; i++) {
                if (profiles[i].name.toLowerCase() === 'dxtr') {
                    selectedIndex = i + 1;
                    break;
                }
            }
            if (selectedIndex === -1) selectedIndex = 1;
        }

        if (selectedIndex > 0) {
            profileSelect.selectedIndex = selectedIndex;
            profileSelect.dispatchEvent(new Event('change'));
        }
    } catch (e) {
        console.error('Failed to load profiles:', e);
    }
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
    showToast(`Saved ${name} ✓`);
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
    showToast(`Deleted ${name}`);
});

async function updateStats() {
    try {
        const s = await GetSessionStats();
        if (!s) return;

        $('stat-vpn-ip').textContent = s.vpn_ip || '--';
        $('stat-server-ip').textContent = s.server_ip || '--';
        $('stat-device').textContent = s.device || 'tun0';
        $('stat-duration').textContent = formatDuration(s.duration_secs);
        $('stat-bytes-in').textContent = formatBytes(s.bytes_in);
        $('stat-bytes-out').textContent = formatBytes(s.bytes_out);
        if (s.profile_name) $('hero-profile-name').textContent = s.profile_name;
        if (s.config_file) $('hero-profile-cfg').textContent = s.config_file;

        // Latency RTT indicator
        if (s.ping_ms && s.ping_ms > 0) {
            statusLatency.textContent = `· ${s.ping_ms}ms`;
            statusLatency.classList.remove('hidden');
        } else {
            statusLatency.classList.add('hidden');
        }

        // Real-time speed & chart update
        const now = Date.now();
        if (lastPollTime !== null && s.bytes_in !== undefined && s.bytes_out !== undefined) {
            const dt = Math.max(0.4, (now - lastPollTime) / 1000);
            const rxDelta = Math.max(0, s.bytes_in - lastBytesIn);
            const txDelta = Math.max(0, s.bytes_out - lastBytesOut);
            const curRxRate = rxDelta / dt;
            const curTxRate = txDelta / dt;

            peakRate = Math.max(peakRate, curRxRate, curTxRate);

            $('chart-rx-speed').textContent = `↓ ${formatSpeed(curRxRate)}`;
            $('chart-tx-speed').textContent = `↑ ${formatSpeed(curTxRate)}`;
            $('chart-peak-speed').textContent = `Peak: ${formatSpeed(peakRate)}`;

            chartData.push({ rx: curRxRate, tx: curTxRate });
            if (chartData.length > MAX_CHART_POINTS) {
                chartData.shift();
            }
            renderChart();
        }

        lastBytesIn = s.bytes_in;
        lastBytesOut = s.bytes_out;
        lastPollTime = now;
    } catch (e) {
        console.error('Error updating stats:', e);
    }
}

function updateUI(s) {
    currentStatus = s;
    statusPill.className = 'status-indicator ' + s;
    const labels = {
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        waiting_2fa: '2FA Required',
        verifying_2fa: 'Verifying...',
        connected: 'Secured',
        auth_failed: 'Auth Failed'
    };
    statusText.textContent = labels[s] || s;

    if (s !== 'connected') {
        statusLatency.classList.add('hidden');
    }

    // Toggle panels
    loginForm.classList.toggle('hidden', s === 'connecting' || s === 'waiting_2fa' || s === 'verifying_2fa' || s === 'connected');
    connectingView.classList.toggle('hidden', s !== 'connecting');
    otpForm.classList.toggle('hidden', s !== 'waiting_2fa' && s !== 'verifying_2fa');
    connectedView.classList.toggle('hidden', s !== 'connected');

    if (s === 'connecting') {
        $('connecting-profile-name').textContent = currentProfileName || configInput.value.split('/').pop() || 'OpenVPN Server';
    }

    if (s === 'waiting_2fa') {
        $('otp').disabled = false;
        $('btn-otp').disabled = false;
        $('btn-otp-text').textContent = 'Verify Code';
        $('otp-spinner').classList.add('hidden');
        $('otp-shield-wrap').classList.remove('verifying');
        $('otp-title').textContent = 'Two-Factor Authentication';
        $('otp-desc').textContent = 'Enter your 6-digit Authenticator code';
        $('otp').value = '';
        setTimeout(() => $('otp').focus(), 100);
    }

    if (s === 'verifying_2fa') {
        $('otp').disabled = true;
        $('btn-otp').disabled = true;
        $('btn-otp-text').textContent = 'Verifying...';
        $('otp-spinner').classList.remove('hidden');
        $('otp-shield-wrap').classList.add('verifying');
        $('otp-title').textContent = 'Verifying Code...';
        $('otp-desc').textContent = 'Validating code & securing tunnel...';
    }

    if (s === 'connected') {
        showToast('Connected to VPN ✓');
        $('hero-profile-name').textContent = currentProfileName || 'OpenVPN Tunnel';
        $('hero-profile-cfg').textContent = configInput.value.split('/').pop() || '';

        // Reset chart baseline
        lastBytesIn = null;
        lastBytesOut = null;
        lastPollTime = null;
        peakRate = 0;
        chartData = [];
        for (let i = 0; i < MAX_CHART_POINTS; i++) {
            chartData.push({ rx: 0, tx: 0 });
        }
        renderChart();

        updateStats();
        if (!statsInterval) {
            statsInterval = setInterval(updateStats, 1000);
        }
    } else {
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
        lastBytesIn = null;
        lastBytesOut = null;
        lastPollTime = null;
    }
}

// Connection action handlers
$('btn-connect').addEventListener('click', async () => {
    const c = configInput.value;
    if (!c) {
        showToast('Please select a config file first');
        return;
    }
    currentProfileName = profileSelect.value || profileNameInput.value || c.split('/').pop().replace(/\.(ovpn|conf)$/i, '');
    $('btn-connect').disabled = true;
    try {
        await Connect(usernameInput.value, passwordInput.value, c, currentProfileName);
    } finally {
        $('btn-connect').disabled = false;
    }
});

$('btn-otp').addEventListener('click', async () => {
    const otp = $('otp').value.trim();
    if (!otp) return;

    // Instant interactive feedback before backend roundtrip
    $('otp').disabled = true;
    $('btn-otp').disabled = true;
    $('btn-otp-text').textContent = 'Verifying...';
    $('otp-spinner').classList.remove('hidden');
    $('otp-shield-wrap').classList.add('verifying');
    $('otp-title').textContent = 'Verifying Code...';
    $('otp-desc').textContent = 'Validating code & securing tunnel...';
    statusPill.className = 'status-indicator verifying_2fa';
    statusText.textContent = 'Verifying...';

    await SendOTP(otp);
});

$('btn-disconnect').addEventListener('click', () => Disconnect());
$('hero-toggle-btn').addEventListener('click', () => Disconnect());
$('btn-cancel-conn').addEventListener('click', () => Disconnect());
$('btn-cancel-otp').addEventListener('click', () => Disconnect());

async function handleKillAll() {
    const hdrBtn = $('btn-kill-hdr');
    const connBtn = $('btn-clear-connected');
    if (hdrBtn) hdrBtn.disabled = true;
    if (connBtn) { connBtn.disabled = true; connBtn.textContent = 'Killing...'; }

    try {
        showToast('Killing OpenVPN sessions...');
        await ClearAllSessions();
    } finally {
        if (hdrBtn) hdrBtn.disabled = false;
        if (connBtn) { connBtn.disabled = false; connBtn.textContent = 'Kill All'; }
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

// Global Power-User Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    // Ctrl+K -> Kill all sessions
    if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleKillAll();
        return;
    }

    // Ctrl+L -> Toggle log drawer
    if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        $('log-toggle').click();
        return;
    }

    // Escape -> Disconnect or cancel
    if (e.key === 'Escape') {
        if (currentStatus === 'connected' || currentStatus === 'connecting' || currentStatus === 'waiting_2fa' || currentStatus === 'verifying_2fa') {
            e.preventDefault();
            Disconnect();
        }
        return;
    }

    // Enter -> Connect or verify OTP
    if (e.key === 'Enter') {
        if (currentStatus === 'waiting_2fa') {
            e.preventDefault();
            $('btn-otp').click();
        } else if (currentStatus === 'verifying_2fa') {
            e.preventDefault();
            // already verifying
        } else if (currentStatus === 'disconnected' || !currentStatus) {
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            if (activeTag !== 'BUTTON') {
                e.preventDefault();
                $('btn-connect').click();
            }
        }
    }
});

// Wails Event listeners
EventsOn('vpn-status', updateUI);
EventsOn('vpn-log', line => {
    logEl.textContent += line + '\n';
    logEl.scrollTop = logEl.scrollHeight;
});

// Startup initialization
GetStatus().then(updateUI);
loadProfiles();
