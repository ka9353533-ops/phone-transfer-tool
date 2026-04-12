const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// ── Settings ────────────────────────────────────────────────────────────────
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const HISTORY_FILE  = path.join(__dirname, 'history.json');

// Use temp directory for cloud deployment, or F:\ for local
const isCloud = process.env.NODE_ENV === 'production';
const defaultFolder = isCloud ? path.join(__dirname, 'uploads') : 'F:\\PhoneMedia';
let settings = { downloadFolder: defaultFolder, darkMode: false };
if (fs.existsSync(SETTINGS_FILE)) {
    try { settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }; } catch(e) {}
}

let history = [];
if (fs.existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch(e) {}
}

function saveSettings() { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); }
function saveHistory()  { fs.writeFileSync(HISTORY_FILE,  JSON.stringify(history,  null, 2)); }

function ensureDownloadFolder() {
    if (!fs.existsSync(settings.downloadFolder))
        fs.mkdirSync(settings.downloadFolder, { recursive: true });
}
ensureDownloadFolder();

// ── Helpers ──────────────────────────────────────────────────────────────────
function getLocalIP() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces))
        for (const i of ifaces[name])
            if (i.family === 'IPv4' && !i.internal) return i.address;
    return 'localhost';
}
function getSubnet(ip) { return ip.split('.').slice(0, 3).join('.'); }

// ── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => { ensureDownloadFolder(); cb(null, settings.downloadFolder); },
    filename:    (req, file, cb) => { cb(null, `${Date.now()}-${file.originalname}`); }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024, files: 100 } }).array('files', 100);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Connected devices ─────────────────────────────────────────────────────────
const connectedDevices = new Map();

// ── API ───────────────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => res.json(settings));
app.post('/api/settings', (req, res) => {
    const { downloadFolder, darkMode } = req.body;
    if (downloadFolder) settings.downloadFolder = downloadFolder;
    if (darkMode !== undefined) settings.darkMode = darkMode;
    saveSettings(); ensureDownloadFolder();
    res.json({ success: true, settings });
});

app.get('/api/devices', (req, res) => {
    const serverIP = getLocalIP();
    const clientIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').replace('::ffff:', '');
    res.json({
        serverIP,
        clientIP,
        clientSameNetwork: getSubnet(clientIP) === getSubnet(serverIP),
        devices: Array.from(connectedDevices.values())
    });
});

app.get('/api/history', (req, res) => res.json(history));
app.delete('/api/history', (req, res) => { history = []; saveHistory(); res.json({ success: true }); });

// File browser
app.get('/api/files', (req, res) => {
    ensureDownloadFolder();
    try {
        const files = fs.readdirSync(settings.downloadFolder).map(name => {
            const full = path.join(settings.downloadFolder, name);
            const stat = fs.statSync(full);
            const ext  = path.extname(name).toLowerCase();
            const isImg = ['.jpg','.jpeg','.png','.gif','.webp','.heic'].includes(ext);
            const isVid = ['.mp4','.mov','.avi','.mkv','.webm'].includes(ext);
            return { name, size: stat.size, modified: stat.mtime, isImg, isVid };
        }).sort((a, b) => new Date(b.modified) - new Date(a.modified));
        res.json({ folder: settings.downloadFolder, files });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/files/:name', (req, res) => {
    const file = path.join(settings.downloadFolder, req.params.name);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    fs.unlinkSync(file);
    res.json({ success: true });
});

// Serve individual files for preview
app.get('/media/:name', (req, res) => {
    const file = path.join(settings.downloadFolder, req.params.name);
    if (!fs.existsSync(file)) return res.status(404).send('Not found');
    res.sendFile(file);
});

// Upload
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
        if (err) return res.status(500).json({ error: err.message });
        if (!req.files?.length) return res.status(400).json({ error: 'No files received' });

        const deviceName = req.headers['x-device-name'] || 'Unknown Device';
        const entry = {
            id: Date.now(),
            device: deviceName,
            count: req.files.length,
            files: req.files.map(f => f.filename),
            folder: settings.downloadFolder,
            date: new Date().toISOString()
        };
        history.unshift(entry);
        if (history.length > 200) history = history.slice(0, 200);
        saveHistory();

        io.emit('files-received', entry);
        console.log(`✅ ${req.files.length} files from ${deviceName}`);
        res.json({ success: true, count: req.files.length });
    });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    const clientIP = socket.handshake.address.replace('::ffff:', '');
    const sameNetwork = getSubnet(clientIP) === getSubnet(getLocalIP());

    socket.on('register-device', (info) => {
        const device = { id: socket.id, name: info.name || 'Unknown', type: info.type || 'unknown', ip: clientIP, sameNetwork, connectedAt: new Date().toISOString() };
        connectedDevices.set(socket.id, device);
        io.emit('devices-updated', Array.from(connectedDevices.values()));
    });

    socket.on('disconnect', () => {
        connectedDevices.delete(socket.id);
        io.emit('devices-updated', Array.from(connectedDevices.values()));
    });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log('\n🚀 Phone Transfer Tool\n');
    console.log(`🖥️  PC:    http://localhost:${PORT}`);
    console.log(`📱 Phone: http://${ip}:${PORT}\n`);
    console.log(`💾 Saving to: ${settings.downloadFolder}\n`);
});
