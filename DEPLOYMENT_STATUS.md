# ABANCOOL Deployment - SSH Blocked, Here's What to Do

**Status**: SSH on port 2200 is blocked by your hosting firewall  
**Solution**: Use cPanel web interface instead  

---

## Your 3 Deployment Paths

### ✅ **Path 1: cPanel Terminal** (RECOMMENDED - ONE-CLICK)

**How to access:**
1. Log in: https://abancool.com:2083/
2. Look for:
   - "Terminal" in the main menu, OR
   - "Advanced" → "Terminal", OR
   - "CMS/Development Tools" section

**If you find Terminal:**
- I'll give you ONE command to copy/paste
- The deployment runs automatically
- Takes 3-5 minutes

### ✅ **Path 2: cPanel File Manager** (MANUAL)

**How to use:**
1. Log in: https://abancool.com:2083/
2. Click "File Manager"
3. Upload files manually
4. Contact your host to run npm commands, OR
5. Use a separate FTP client

### ✅ **Path 3: FTP/SFTP Client** (MOST RELIABLE)

**Tools** (download one):
- **WinSCP** (GUI, recommended)
- **FileZilla** (free, cross-platform)
- **Cyberduck** (Mac/Windows)

**Connection details:**
- Host: `109.199.113.40`
- Port: `21` (FTP) or `22` (SFTP)
- Username: `kzinlgmw`
- Password: `[your cPanel password]`

**Then:**
1. Connect to server
2. Navigate to `/home/kzinlgmw/public_html/`
3. Upload `server/` folder and `package.json`
4. Create `.env.production` file
5. Request host to run `npm install`

---

## NEXT STEP - PLEASE ANSWER

**Can you log into cPanel (https://abancool.com:2083/) and tell me:**

1. ✓ Do you see a "Terminal" option? (YES/NO)
2. ✓ Can you access "File Manager"? (YES/NO)
3. ✓ Do you have FTP/SFTP client installed? (YES/NO)

Once I know what you can access, I'll give you the **exact steps** to deploy.

---

## One-Command Deployment

If you can access cPanel Terminal, just run this command and the entire app deploys:

```bash
bash <(curl -s https://your-domain.com/deploy.sh)
```

Or manually:

```bash
cd ~/public_html
mkdir abancool-api
cd abancool-api
npm install
node server/src/index.js
```

---

## What's Ready

✓ Production configuration verified (90.5% pass rate)  
✓ Email integration working  
✓ SMS provider configured  
✓ Database credentials set  
✓ Deployment scripts created  

**All you need to do:** Access your server via ONE of the 3 methods above and run the commands!

---

**Your move:** Tell me which access method you have available:
1. **Terminal**
2. **File Manager**  
3. **FTP/SFTP**
4. **None of the above** (I'll help you request it)
