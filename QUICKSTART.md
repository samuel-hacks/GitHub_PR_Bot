# 🚀 Quick Start Guide

Get your GitHub PR Bot up and running in 10 minutes!

## Prerequisites Checklist
- [ ] Node.js installed (check: `node --version`)
- [ ] GitHub account
- [ ] API endpoint ready (or use the test API we provide)

## Step-by-Step Setup

### 1️⃣ Install Dependencies (1 minute)
```bash
npm install
```

### 2️⃣ Get GitHub Token (2 minutes)
1. Visit: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: "PR Bot"
4. Scopes: Select `repo`
5. Click "Generate" and **copy the token**

### 3️⃣ Configure Environment (2 minutes)
```bash
# Copy example env file
cp .env.example .env

# Edit with your favorite editor
nano .env
```

Fill in:
```env
GITHUB_TOKEN=ghp_paste_your_token_here
GITHUB_WEBHOOK_SECRET=any_random_string_you_want
API_ENDPOINT=http://localhost:4000/analyze
```

### 4️⃣ Test Locally (2 minutes)

**Terminal 1 - Start Test API:**
```bash
node test-api.js
```

**Terminal 2 - Start Bot:**
```bash
npm start
```

You should see:
```
GitHub PR Bot listening on port 3000
```

### 5️⃣ Deploy to Railway (3 minutes)

1. **Sign up**: Go to https://railway.app
2. **New Project**: Click "Deploy from GitHub repo"
3. **Connect**: Authorize Railway to access your repos
4. **Select**: Choose your bot repository
5. **Add Variables**: In Railway dashboard, go to "Variables" and add:
   ```
   GITHUB_TOKEN=your_token
   GITHUB_WEBHOOK_SECRET=your_secret
   API_ENDPOINT=your_actual_api_url
   ```
6. **Deploy**: Railway will automatically build and deploy
7. **Get URL**: Copy your Railway app URL (e.g., `https://github-pr-bot-production.up.railway.app`)

### 6️⃣ Configure GitHub Webhook (2 minutes)

1. Go to your GitHub repo → **Settings** → **Webhooks** → **Add webhook**
2. Fill in:
   - **Payload URL**: `https://your-railway-url.railway.app/webhook`
   - **Content type**: `application/json`
   - **Secret**: Your `GITHUB_WEBHOOK_SECRET`
   - **Events**: Select "Pull requests" only
3. Click **Add webhook**

### 7️⃣ Test It! (1 minute)

1. Create a new branch: `git checkout -b test-bot`
2. Make a change: `echo "# Test" >> test.md`
3. Commit: `git add . && git commit -m "Test bot"`
4. Push: `git push origin test-bot`
5. Open a Pull Request on GitHub
6. Check Railway logs - you should see your bot processing it!

## ✅ Success!

Your bot is now:
- ✅ Listening for PRs
- ✅ Fetching code changes
- ✅ Sending to your API

## 🆘 Quick Troubleshooting

**Bot not responding?**
- Check Railway logs for errors
- Verify webhook is green in GitHub (Settings → Webhooks → Recent Deliveries)
- Make sure all environment variables are set

**Can't deploy?**
- Ensure `package.json` exists
- Check Railway build logs
- Try deploying again

**Need help?**
- Check the full README.md
- Review the troubleshooting section
- Look at server logs for error messages

## 🎯 Next Steps

1. Replace test API with your real API endpoint
2. Customize the bot behavior in `server.js`
3. Add more features like PR comments, status checks, etc.

## 📚 Files Overview

- `server.js` - Main bot logic
- `package.json` - Dependencies
- `.env` - Your secrets (never commit!)
- `test-api.js` - Test API for local development
- `README.md` - Full documentation

Happy coding! 🎉
