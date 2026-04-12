# 📱 Phone Transfer Tool

Wirelessly transfer photos and videos from your phone to PC or cloud!

## 🚀 Features

- ✅ WiFi-based file transfer (no USB cable)
- ✅ Device detection and selection
- ✅ File browser with photo/video preview
- ✅ Transfer history with date/time/device
- ✅ Desktop notifications
- ✅ Dark mode
- ✅ PWA support (install as app)
- ✅ Cloud deployment ready

## 🏠 Local Setup

```bash
npm install
npm start
```

Then open:
- PC: `http://localhost:3000`
- Phone: `http://YOUR_IP:3000`

## ☁️ Deploy to Cloud (Free)

### Option 1: Render.com (Recommended)

1. **Create GitHub repo:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to https://render.com
   - Sign up (free)
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Render auto-detects settings from `render.yaml`
   - Click "Create Web Service"
   - Wait 2-3 minutes for deployment

3. **Done!** Your app will be live at `https://yourapp.onrender.com`

### Option 2: Railway.app

1. Push code to GitHub (same as above)
2. Go to https://railway.app
3. Sign up → "New Project" → "Deploy from GitHub"
4. Select your repo
5. Railway auto-deploys

### Option 3: Fly.io

```bash
npm install -g flyctl
flyctl auth signup
flyctl launch
flyctl deploy
```

## 📝 Notes

- **Local mode:** Files save to `F:\PhoneMedia` (or your custom path)
- **Cloud mode:** Files save to server's `uploads/` folder
- Free tier limits: Check your hosting provider's limits
- For production: Consider adding authentication/PIN protection

## 🔒 Security Tips

If deploying publicly:
- Add password protection
- Use HTTPS only
- Set file size limits
- Add rate limiting
- Consider adding user accounts

## 📱 Install as App

On your phone:
1. Open the URL in browser
2. Tap "Add to Home Screen" (iOS) or "Install App" (Android)
3. Use like a native app!

## 🛠️ Tech Stack

- Node.js + Express
- Socket.IO (real-time device detection)
- Multer (file uploads)
- Service Worker (PWA)
- Vanilla JS (no framework bloat)
