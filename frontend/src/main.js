import {Connect, SendOTP, Disconnect, GetStatus, GetProfiles, SaveProfile, DeleteProfile, BrowseConfig} from '../wailsjs/go/main/App';
import {EventsOn} from '../wailsjs/runtime/runtime';
import './style.css';

const app = document.getElementById('app');
app.innerHTML = `
    <div class="header">
        <div class="status-dot" id="dot"></div>
        <h1>OpenVPN Linux GUI</h1>
        <span class="status-text" id="status-text">Disconnected</span>
    </div>
    <div class="content">
        <div id="login-form">
            <div class="form-group">
                <label>Profile</label>
                <div class="row">
                    <select id="profile-select"><option value="">-- Select --</option></select>
                    <button class="btn-del" id="btn-del" title="Delete">✕</button>
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
                <input type="text" id="username"/>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="password"/>
            </div>
            <hr class="separator"/>
            <div class="form-group">
                <label>Save Profile As</label>
                <div class="row">
                    <input type="text" id="profile-name" placeholder="Profile name"/>
                    <button class="btn-save" id="btn-save">Save</button>
                </div>
            </div>
            <button class="btn-connect" id="btn-connect">Connect</button>
        </div>
        <div id="otp-form" class="hidden">
            <div class="form-group">
                <label>Authenticator Code</label>
                <input type="text" id="otp" placeholder="Enter code" autofocus/>
            </div>
            <button class="btn-otp" id="btn-otp">Submit</button>
        </div>
        <button class="btn-disconnect hidden" id="btn-disconnect">Disconnect</button>
        <div class="log-box" id="log"></div>
    </div>
`;

const $ = id => document.getElementById(id);
const loginForm = $('login-form');
const otpForm = $('otp-form');
const dot = $('dot');
const statusText = $('status-text');
const logEl = $('log');
const profileSelect = $('profile-select');
const configInput = $('config-file');
const usernameInput = $('username');
const passwordInput = $('password');
const profileNameInput = $('profile-name');
const btnDisconnect = $('btn-disconnect');

async function loadProfiles() {
    const profiles = await GetProfiles();
    profileSelect.innerHTML = '<option value="">-- Select --</option>';
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
    }
});

$('btn-browse').addEventListener('click', async () => {
    const file = await BrowseConfig();
    if (file) configInput.value = file;
});

$('btn-save').addEventListener('click', async () => {
    const name = profileNameInput.value.trim();
    if (!name || !configInput.value) return;
    await SaveProfile(name, usernameInput.value, passwordInput.value, configInput.value);
    await loadProfiles();
    profileSelect.value = name;
});

$('btn-del').addEventListener('click', async () => {
    const name = profileSelect.value;
    if (!name) return;
    await DeleteProfile(name);
    configInput.value = '';
    usernameInput.value = '';
    passwordInput.value = '';
    profileNameInput.value = '';
    await loadProfiles();
});

function updateUI(s) {
    dot.className = 'status-dot ' + s;
    const labels = {disconnected:'Disconnected', connecting:'Connecting...', waiting_2fa:'Awaiting 2FA', connected:'Connected', auth_failed:'Auth Failed'};
    statusText.textContent = labels[s] || s;
    loginForm.classList.toggle('hidden', s === 'connecting' || s === 'waiting_2fa' || s === 'connected');
    otpForm.classList.toggle('hidden', s !== 'waiting_2fa');
    btnDisconnect.classList.toggle('hidden', s !== 'connected' && s !== 'connecting' && s !== 'waiting_2fa');
    if (s === 'waiting_2fa') $('otp').focus();
}

$('btn-connect').addEventListener('click', async () => {
    const c = configInput.value;
    if (!c) return;
    $('btn-connect').disabled = true;
    await Connect(usernameInput.value, passwordInput.value, c);
    $('btn-connect').disabled = false;
});

$('btn-otp').addEventListener('click', async () => {
    const otp = $('otp').value;
    if (!otp) return;
    await SendOTP(otp);
    $('otp').value = '';
});

$('otp').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-otp').click(); });
passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-connect').click(); });
btnDisconnect.addEventListener('click', () => Disconnect());

EventsOn('vpn-status', updateUI);
EventsOn('vpn-log', line => { logEl.textContent += line + '\n'; logEl.scrollTop = logEl.scrollHeight; });

GetStatus().then(updateUI);
loadProfiles();
