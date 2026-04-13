const socket = io();
let selectedDevice = null;
let selectedFiles = [];

// ── Theme ────────────────────────────────────────────────────────────────────
function loadTheme() {
    fetch('/api/settings').then(r => r.json()).then(s => {
        document.documentElement.setAttribute('data-theme', s.darkMode ? 'dark' : 'light');
        document.getElementById('darkToggle').textContent = s.darkMode ? '☀️' : '🌙';
    });
}
document.getElementById('darkToggle')?.addEventListener('click', async () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark';
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ darkMode: !current })
    });
    loadTheme();
});
loadTheme();

// ── PWA ──────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => console.log('✅ PWA ready'));
}

// ── Notifications ────────────────────────────────────────────────────────────
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}
function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192.png' });
    }
}
requestNotificationPermission();

// ── Device detection ─────────────────────────────────────────────────────────
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    if (/windows/i.test(ua)) return 'windows';
    if (/mac/i.test(ua)) return 'mac';
    return 'unknown';
}
function getDeviceIcon(type) {
    return { android: '📱', ios: '🍎', windows: '🖥️', mac: '💻', unknown: '📟' }[type] || '📟';
}
function getDeviceName() {
    const type = getDeviceType();
    return { android: 'Android Phone', ios: 'iPhone/iPad', windows: 'Windows PC', mac: 'Mac', unknown: 'Device' }[type];
}

socket.emit('register-device', { name: getDeviceName(), type: getDeviceType() });

// ── Network check ────────────────────────────────────────────────────────────
async function checkNetwork() {
    try {
        const res = await fetch('/api/devices');
        const data = await res.json();
        const bar = document.getElementById('networkBar');
        const dot = document.getElementById('networkDot');
        const text = document.getElementById('networkText');
        if (data.clientSameNetwork) {
            bar.className = 'network-bar ok';
            dot.className = 'dot green';
            text.textContent = `✅ Connected (${data.clientIP})`;
        } else {
            bar.className = 'network-bar warn';
            dot.className = 'dot yellow';
            text.textContent = `⚠️ Not on same WiFi. Connect to same network.`;
        }
    } catch (e) {}
}
checkNetwork();
setInterval(checkNetwork, 10000);

// ── Devices ──────────────────────────────────────────────────────────────────
function renderDevices(devices) {
    const list = document.getElementById('devicesList');
    if (!devices?.length) {
        list.innerHTML = '<div class="no-devices">⏳ Waiting for devices...<br><small>Open this page on your phone</small></div>';
        return;
    }
    list.innerHTML = devices.map(d => `
        <div class="device-card ${d.id === selectedDevice?.id ? 'selected' : ''} ${!d.sameNetwork ? 'offline' : ''}"
             onclick="${d.sameNetwork ? `selectDevice('${d.id}','${d.name}','${d.type}')` : 'alert(\"Device not on same WiFi\")'}"
             id="device-${d.id}">
            <div class="device-info">
                <div class="device-icon">${getDeviceIcon(d.type)}</div>
                <div>
                    <div class="device-name">${d.name}</div>
                    <div class="device-ip">${d.ip}</div>
                </div>
            </div>
            <span class="device-badge ${d.sameNetwork ? 'badge-same' : 'badge-diff'}">
                ${d.sameNetwork ? '✅ Same WiFi' : '❌ Different'}
            </span>
        </div>
    `).join('');
}
function selectDevice(id, name, type) {
    selectedDevice = { id, name, type };
    document.getElementById('selectedDeviceName').textContent = name;
    document.getElementById('uploadSection').classList.add('visible');
    fetch('/api/devices').then(r => r.json()).then(d => renderDevices(d.devices));
}
socket.on('devices-updated', renderDevices);
socket.on('files-received', (data) => {
    showNotification('Upload Complete!', `${data.count} files saved to ${data.folder}`);
});
fetch('/api/devices').then(r => r.json()).then(d => renderDevices(d.devices));

// ── Upload ───────────────────────────────────────────────────────────────────
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const status = document.getElementById('status');
const fileCount = document.getElementById('fileCount');

uploadArea?.addEventListener('click', () => fileInput.click());
fileInput?.addEventListener('change', (e) => {
    selectedFiles = Array.from(e.target.files);
    fileCount.textContent = selectedFiles.length ? `${selectedFiles.length} file(s) selected` : '';
    uploadBtn.disabled = !selectedFiles.length;
});
uploadArea?.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea?.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    selectedFiles = Array.from(e.dataTransfer.files);
    fileCount.textContent = `${selectedFiles.length} file(s) selected`;
    uploadBtn.disabled = !selectedFiles.length;
});

uploadBtn?.addEventListener('click', async () => {
    if (!selectedFiles.length) return;
    uploadBtn.disabled = true;
    progress.style.display = 'block';
    status.style.display = 'none';
    
    // Show file count
    const totalFiles = selectedFiles.length;
    console.log(`Starting upload of ${totalFiles} files...`);

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('files', f));

    const xhr = new XMLHttpRequest();
    
    // Progress tracking
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = pct + '%';
            progressFill.textContent = pct + '%';
        }
    });
    
    // Success handler
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            status.className = 'status success';
            status.textContent = `✅ ${response.count} file(s) uploaded successfully!`;
            status.style.display = 'block';
            console.log(`✅ Upload complete: ${response.count} files`);
            
            // Clear selection
            selectedFiles = [];
            fileInput.value = '';
            fileCount.textContent = '';
            
            // Reset progress after 3 seconds
            setTimeout(() => { 
                progress.style.display = 'none'; 
                progressFill.style.width = '0%'; 
            }, 3000);
        } else {
            let errorMsg = 'Upload failed';
            try {
                const response = JSON.parse(xhr.responseText);
                errorMsg = response.error || errorMsg;
            } catch(e) {
                errorMsg = xhr.responseText || errorMsg;
            }
            console.error('❌ Upload failed:', errorMsg);
            status.className = 'status error';
            status.textContent = '❌ ' + errorMsg;
            status.style.display = 'block';
            progress.style.display = 'none';
        }
        uploadBtn.disabled = false;
    });
    
    // Error handler
    xhr.addEventListener('error', (e) => {
        console.error('❌ Network error during upload');
        status.className = 'status error';
        status.textContent = '❌ Network error. Check your connection and try again.';
        status.style.display = 'block';
        progress.style.display = 'none';
        uploadBtn.disabled = false;
    });
    
    // Timeout handler (30 minutes for large uploads)
    xhr.timeout = 1800000; // 30 minutes
    xhr.addEventListener('timeout', () => {
        console.error('❌ Upload timeout');
        status.className = 'status error';
        status.textContent = '❌ Upload timeout. Try uploading fewer files at once.';
        status.style.display = 'block';
        progress.style.display = 'none';
        uploadBtn.disabled = false;
    });

    xhr.open('POST', '/upload');
    xhr.setRequestHeader('x-device-name', selectedDevice?.name || 'Unknown');
    xhr.send(formData);
});
