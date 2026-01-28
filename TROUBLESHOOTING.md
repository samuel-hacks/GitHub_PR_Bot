# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### 1. Webhook Not Triggering

#### Symptoms
- PR created but nothing happens
- No logs in Railway/Heroku
- Webhook shows red X in GitHub

#### Diagnosis Steps

**Check 1: Is webhook configured correctly?**
```
GitHub Repo → Settings → Webhooks → Your webhook
```
Look for:
- ✅ Green checkmark (recent successful delivery)
- ❌ Red X (failed deliveries)

Click on webhook → "Recent Deliveries" tab to see details

**Check 2: Is your bot URL correct?**
```
Webhook URL should be: https://your-bot-url.com/webhook
                       NOT: https://your-bot-url.com
```
Must include `/webhook` at the end!

**Check 3: Is your bot running?**
```bash
# Test health endpoint
curl https://your-bot-url.com/health

# Should return:
{"status":"healthy","timestamp":"..."}
```

#### Solutions

**Solution A: Fix webhook URL**
1. Go to GitHub webhook settings
2. Update Payload URL to include `/webhook`
3. Click "Update webhook"
4. Test with "Redeliver" button

**Solution B: Check bot logs**
```bash
# Railway: Check dashboard logs
# Heroku: heroku logs --tail
# Local: Check terminal output
```

**Solution C: Verify bot is deployed**
1. Check deployment status in Railway/Heroku
2. Ensure build succeeded
3. Restart if necessary

---

### 2. Invalid Signature Error

#### Symptoms
- Webhook shows failed delivery
- Bot logs: "Invalid signature - rejecting webhook"
- HTTP 401 error in GitHub delivery details

#### Root Cause
The `GITHUB_WEBHOOK_SECRET` in your bot doesn't match the secret in GitHub webhook configuration.

#### Solutions

**Solution A: Match the secrets**
1. Go to your bot's environment variables
2. Copy the exact value of `GITHUB_WEBHOOK_SECRET`
3. Go to GitHub webhook settings
4. Click "Edit"
5. Paste the EXACT same value in "Secret" field
6. Save

**Solution B: Generate new secret**
```bash
# Generate a new random secret
openssl rand -hex 32

# Or use any random string generator
```

Then update BOTH:
- Your bot's `.env` or Railway environment variables
- GitHub webhook secret field

---

### 3. Bot Not Fetching Files

#### Symptoms
- Webhook received
- Bot logs show "Processing PR"
- But "Error fetching PR files" appears
- HTTP 404 or 401 errors

#### Diagnosis

**Check 1: Is GITHUB_TOKEN set?**
```bash
# Check environment variables
echo $GITHUB_TOKEN

# Should output: ghp_xxxxxxxxxxxx
```

**Check 2: Does token have correct permissions?**
Token needs `repo` scope (or `public_repo` for public repos only)

**Check 3: Has token expired?**
GitHub tokens can expire. Check at https://github.com/settings/tokens

#### Solutions

**Solution A: Set or update token**
1. Generate new token at https://github.com/settings/tokens
2. Select `repo` scope
3. Update environment variable:
```bash
# Railway: Update in dashboard Variables tab
# Heroku: heroku config:set GITHUB_TOKEN=ghp_your_new_token
# Local: Update .env file
```

**Solution B: Verify token works**
```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/user

# Should return your GitHub user info
```

---

### 4. API Not Receiving Data

#### Symptoms
- Bot successfully fetches PR data
- Bot logs show "Sending data to API"
- But your API never receives anything
- Or bot shows "Error sending to API"

#### Diagnosis

**Check 1: Is API_ENDPOINT correct?**
```bash
# Bot logs should show:
Sending data to API: https://your-api.com/analyze

# Verify this is the right URL
```

**Check 2: Is API accessible?**
```bash
# Test from command line
curl -X POST https://your-api.com/analyze \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Should return 200 OK or similar
```

**Check 3: Check bot error logs**
Look for:
- `ECONNREFUSED` = API not running or wrong URL
- `ETIMEDOUT` = API too slow (>30s) or firewall blocking
- `404` = Wrong endpoint path
- `500` = API error processing request

#### Solutions

**Solution A: Fix API_ENDPOINT**
```bash
# Common mistakes:
❌ http://localhost:4000/analyze  # Only works locally
❌ https://your-api.com           # Missing /analyze
✅ https://your-api.com/analyze   # Correct

# Update environment variable
```

**Solution B: Check API CORS/Authentication**
If your API requires authentication:
```javascript
// Add auth header in server.js
await axios.post(API_ENDPOINT, prData, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
```

**Solution C: Test with test-api.js**
```bash
# Terminal 1
node test-api.js

# Terminal 2 - Update .env
API_ENDPOINT=http://localhost:4000/analyze

# Terminal 3
npm start

# This isolates if problem is with your bot or your API
```

---

### 5. Railway/Heroku Deployment Failed

#### Symptoms
- Push to GitHub but no deployment
- Build fails
- App crashes immediately

#### Common Causes

**Issue 1: Missing package.json or node_modules**
```bash
# Make sure you have:
package.json ✓
package-lock.json ✓

# Don't commit node_modules!
# It's in .gitignore
```

**Issue 2: Wrong start command**
Check `package.json`:
```json
{
  "scripts": {
    "start": "node server.js"  // ✓ Correct
  }
}
```

**Issue 3: Missing environment variables**
- Go to Railway/Heroku dashboard
- Check all required vars are set:
  - `GITHUB_TOKEN`
  - `GITHUB_WEBHOOK_SECRET`
  - `API_ENDPOINT`

**Issue 4: Port configuration**
```javascript
// In server.js, use process.env.PORT
const PORT = process.env.PORT || 3000;

// Railway/Heroku set PORT automatically
```

#### Solutions

**Solution A: Check build logs**
```bash
# Railway: View in dashboard
# Heroku: heroku logs --tail

# Look for:
# - npm install errors
# - Missing dependencies
# - Syntax errors
```

**Solution B: Test locally first**
```bash
npm install
npm start

# If works locally but not in production,
# problem is likely environment variables
```

**Solution C: Verify Railway/Heroku configuration**
- Railway: Check railway.json exists
- Heroku: Check Procfile if using one
- Both: Verify Node.js version compatibility

---

### 6. Bot Receiving Webhook But Not Processing

#### Symptoms
- Webhook delivery successful (green check)
- Bot logs: "Received pull_request event"
- But then nothing happens or "Action ignored"

#### Diagnosis

**Check: What PR action triggered it?**
Bot only processes: `opened`, `reopened`, `synchronize`

Bot ignores: `closed`, `edited`, `labeled`, etc.

#### Solutions

**Solution A: Check PR action**
Look at bot logs:
```
Received pull_request event
PR #42 - Action: edited  ← This is ignored
```

**Solution B: Trigger correct action**
- Open a NEW pull request
- Push new commits to existing PR
- Close then reopen a PR

**Solution C: Modify actions if needed**
In `server.js`, change this line:
```javascript
// Current (processes only these 3):
if (['opened', 'reopened', 'synchronize'].includes(action)) {

// To process more actions:
if (['opened', 'reopened', 'synchronize', 'edited'].includes(action)) {
```

---

### 7. Large PRs Timing Out

#### Symptoms
- Small PRs work fine
- Large PRs (100+ files) fail
- "Error: timeout of 30000ms exceeded"

#### Solutions

**Solution A: Increase timeout**
```javascript
// In server.js
await axios.post(API_ENDPOINT, prData, {
  timeout: 60000 // Increase to 60 seconds
});
```

**Solution B: Process asynchronously**
```javascript
// Return success immediately
res.status(200).send('Processing...');

// Then process in background
processPR(prData).catch(err => console.error(err));
```

**Solution C: Filter large files**
```javascript
// Skip very large files
const filesWithContent = await Promise.all(
  files
    .filter(f => f.changes < 1000) // Skip files with 1000+ changes
    .map(async (file) => {
      // ... fetch content
    })
);
```

---

### 8. Bot Works in Test Repo But Not Production Repo

#### Possible Causes

**Cause 1: Token permissions**
- Token might have access to test repo but not production repo
- Check token was created by someone with access to production repo

**Cause 2: Webhook not configured**
- Each repository needs its own webhook
- Configure webhook in production repo settings

**Cause 3: Private vs Public repo**
- Public repos: Need `public_repo` scope
- Private repos: Need full `repo` scope

#### Solutions

**Solution: Verify webhook in production repo**
1. Go to production repo → Settings → Webhooks
2. Add webhook if missing
3. Use same bot URL and secret
4. Test with a PR

---

## Debugging Tips

### 1. Enable Detailed Logging

Add to `server.js`:
```javascript
// Log all incoming webhooks
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  next();
});
```

### 2. Test Webhook Manually

```bash
# Send a test webhook
curl -X POST https://your-bot-url.com/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{"action":"opened","pull_request":{"number":1}}'

# Should see in logs:
# Received pull_request event
```

### 3. Verify GitHub API Access

```bash
# Test fetching PR files
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/pulls/1/files
```

### 4. Check Bot Health

```bash
# Should always return 200 OK
curl -v https://your-bot-url.com/health
```

### 5. Review GitHub Webhook Delivery

GitHub keeps history of all webhook deliveries:
1. Go to repo → Settings → Webhooks → Your webhook
2. Click "Recent Deliveries"
3. See request/response for each attempt
4. Click "Redeliver" to try again

---

## Getting Help

### Before Asking for Help

1. ✅ Check this troubleshooting guide
2. ✅ Review bot logs
3. ✅ Check GitHub webhook delivery status
4. ✅ Verify all environment variables are set
5. ✅ Test with a simple PR first

### What to Include

When asking for help, provide:
- Bot logs (last 50 lines)
- GitHub webhook delivery details
- Environment (Railway/Heroku/local)
- Description of what you expected vs what happened
- Steps to reproduce

### Useful Commands

```bash
# Check bot logs
# Railway: View in dashboard
# Heroku: heroku logs --tail --app your-app-name
# PM2: pm2 logs github-pr-bot

# Check environment
env | grep GITHUB
env | grep API

# Test connectivity
curl https://your-bot-url.com/health
curl https://api.github.com

# Restart bot
# Railway: Redeploy in dashboard
# Heroku: heroku restart
# PM2: pm2 restart github-pr-bot
```

---

## Prevention Checklist

To avoid issues from the start:

- [ ] Use strong random strings for secrets
- [ ] Store secrets in environment variables, never in code
- [ ] Test locally with test-api.js first
- [ ] Verify webhook URL includes `/webhook`
- [ ] Check GitHub token has correct scopes
- [ ] Monitor bot logs after first deployment
- [ ] Test with a small PR before large ones
- [ ] Keep dependencies updated: `npm update`

---

Remember: Most issues are configuration problems, not code bugs! 
Double-check your environment variables and webhook settings first. 🔍
