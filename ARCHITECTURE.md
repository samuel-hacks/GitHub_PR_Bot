# 🏗️ Bot Architecture Explained

## How Everything Works Together

### The Big Picture

```
GitHub Repository
      ↓
   [PR Created]
      ↓
   GitHub Webhook
      ↓
   Your Bot Server (server.js)
      ↓
   1. Verify request is from GitHub
   2. Fetch PR files
   3. Get file contents
   4. Package data
      ↓
   Your API Endpoint
```

## Component Breakdown

### 1. GitHub Webhook System

**What it is:**
GitHub webhooks are HTTP callbacks that GitHub sends when specific events happen in your repository.

**How it works:**
1. You configure a webhook URL in your GitHub repo settings
2. When someone creates/updates a PR, GitHub sends a POST request to your URL
3. The request contains all PR information in JSON format

**Security:**
- GitHub signs each webhook with a secret key
- Your bot verifies the signature to ensure it's really from GitHub
- This prevents unauthorized people from triggering your bot

### 2. Bot Server (server.js)

This is the heart of your bot. Let me break down each part:

#### Express Server Setup
```javascript
const app = express();
app.use(express.json());
```
- Creates a web server using Express.js
- Configures it to parse JSON data from GitHub

#### Signature Verification
```javascript
function verifyGitHubSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
```

**Why this matters:**
- GitHub sends a signature with each webhook
- We calculate what the signature SHOULD be using our secret
- If they match, the request is legit
- This prevents attackers from triggering your bot

#### Webhook Handler
```javascript
app.post('/webhook', async (req, res) => {
  // 1. Verify it's from GitHub
  if (!verifyGitHubSignature(req)) {
    return res.status(401).send('Invalid signature');
  }
  
  // 2. Check if it's a PR event
  const event = req.headers['x-github-event'];
  if (event === 'pull_request') {
    // 3. Process the PR
  }
});
```

**What happens here:**
1. Every GitHub webhook hits this endpoint
2. We verify the signature
3. We check if it's a PR event (ignore other events)
4. We process the PR if action is opened/reopened/synchronized

### 3. GitHub API Integration

#### Fetching PR Files
```javascript
async function getPRFiles(owner, repo, prNumber) {
  const response = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    { headers: { 'Authorization': `token ${GITHUB_TOKEN}` }}
  );
  return response.data;
}
```

**What this does:**
- Uses GitHub's REST API to get list of changed files
- Returns metadata: filename, additions, deletions, patch (diff)
- Requires authentication token to access

#### Getting File Contents
```javascript
async function getFileContent(owner, repo, path, ref) {
  const response = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
    { headers: { 'Authorization': `token ${GITHUB_TOKEN}` }}
  );
  return Buffer.from(response.data.content, 'base64').toString('utf8');
}
```

**What this does:**
- Fetches the actual content of each file
- GitHub returns content as base64 encoded
- We decode it to get the actual text
- Uses the PR's HEAD ref to get the PR version (not main branch)

### 4. Data Processing Flow

```javascript
// 1. Get list of changed files
const files = await getPRFiles(owner, repo, pr.number);

// 2. For each file, get its content
const filesWithContent = await Promise.all(
  files.map(async (file) => {
    const content = await getFileContent(owner, repo, file.filename, pr.head.sha);
    return { ...file, content };
  })
);

// 3. Package everything together
const prData = {
  repository: { owner, name, full_name },
  pull_request: { number, title, author, ... },
  files: filesWithContent,
  action: action
};

// 4. Send to your API
await sendToAPI(prData);
```

**Why this order:**
1. First get the list (one API call)
2. Then get contents in parallel (faster than sequential)
3. Combine all data into one clean package
4. Send to your API

### 5. Environment Variables

```env
GITHUB_TOKEN=ghp_...          # Authenticate with GitHub API
GITHUB_WEBHOOK_SECRET=xyz     # Verify webhook signatures
API_ENDPOINT=https://...      # Where to send PR data
PORT=3000                     # What port to run on
```

**Why environment variables?**
- Keep secrets out of code
- Easy to change without modifying code
- Different values for dev/staging/production
- Never committed to version control

## Data Flow Example

Let's trace what happens when you open a PR:

### 1. User Opens PR
```
User: git push origin feature-branch
User: [Creates PR on GitHub]
```

### 2. GitHub Sends Webhook
```json
POST https://your-bot.railway.app/webhook
Headers:
  x-github-event: pull_request
  x-hub-signature-256: sha256=abc123...
Body:
  {
    "action": "opened",
    "pull_request": {
      "number": 42,
      "title": "Add new feature",
      ...
    }
  }
```

### 3. Bot Receives & Verifies
```javascript
// Verify signature matches
✓ Signature valid
✓ Event is "pull_request"
✓ Action is "opened"
→ Process PR
```

### 4. Bot Fetches Files
```javascript
// GET /repos/user/repo/pulls/42/files
→ Returns: [
  { filename: "src/index.js", additions: 10, deletions: 5 },
  { filename: "README.md", additions: 3, deletions: 0 }
]
```

### 5. Bot Gets Contents
```javascript
// GET /repos/user/repo/contents/src/index.js?ref=feature-branch
→ Returns: { content: "Y29uc3QgZm9v..." } // base64
→ Decode: "const foo = 'bar';\n..."

// GET /repos/user/repo/contents/README.md?ref=feature-branch
→ Returns: { content: "IyBNeSBQcm9q..." } // base64
→ Decode: "# My Project\n..."
```

### 6. Bot Sends to Your API
```json
POST https://your-api.com/analyze
{
  "repository": { "owner": "user", "name": "repo" },
  "pull_request": {
    "number": 42,
    "title": "Add new feature",
    "author": "contributor"
  },
  "files": [
    {
      "filename": "src/index.js",
      "additions": 10,
      "deletions": 5,
      "content": "const foo = 'bar';\n..."
    },
    {
      "filename": "README.md",
      "additions": 3,
      "deletions": 0,
      "content": "# My Project\n..."
    }
  ]
}
```

### 7. Your API Processes
```javascript
// Your API receives the data
// You can now:
// - Run code analysis
// - Check for security issues
// - Run tests
// - Generate reports
// - Whatever you need!
```

## Security Considerations

### 1. Webhook Signature Verification
- **Purpose**: Ensures requests actually come from GitHub
- **How**: Uses HMAC-SHA256 with your secret
- **Impact**: Prevents malicious actors from triggering your bot

### 2. GitHub Token Security
- **Scope**: Only give necessary permissions
- **Storage**: Keep in environment variables, never in code
- **Rotation**: Can regenerate if compromised

### 3. HTTPS
- **Production**: Always use HTTPS for webhook endpoint
- **Why**: Protects data in transit
- **How**: Railway/Heroku provide HTTPS automatically

## Performance Considerations

### 1. Parallel File Fetching
```javascript
await Promise.all(files.map(async (file) => {...}))
```
- Fetches all file contents at once
- Much faster than one-by-one
- Important for PRs with many files

### 2. Timeout Handling
```javascript
axios.post(API_ENDPOINT, data, { timeout: 30000 })
```
- 30 second timeout for API calls
- Prevents bot from hanging
- Returns error if API is slow

### 3. Error Recovery
- Bot catches all errors
- Logs them for debugging
- Returns proper HTTP status codes
- Doesn't crash on single failure

## Scaling Considerations

### For Small Projects (< 100 PRs/day)
- Current setup is perfect
- Free tier Railway/Heroku works fine
- No special configuration needed

### For Larger Projects (> 100 PRs/day)
- Consider adding a queue (Redis/RabbitMQ)
- Process webhooks asynchronously
- Scale horizontally with load balancer
- Add caching for repeated API calls

## Testing Strategy

### Local Testing
1. Use test-api.js to simulate your real API
2. Use ngrok to expose local server
3. Create test PRs to trigger webhooks
4. Check logs to verify behavior

### Production Testing
1. Start with a test repository
2. Monitor Railway/Heroku logs
3. Verify webhook deliveries in GitHub
4. Check your API receives correct data

## Common Customizations

### 1. Filter Specific Files
```javascript
const filteredFiles = files.filter(f => 
  f.filename.endsWith('.js') || f.filename.endsWith('.py')
);
```

### 2. Add PR Comments
```javascript
await axios.post(
  `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
  { body: 'Analysis complete!' },
  { headers: { 'Authorization': `token ${GITHUB_TOKEN}` }}
);
```

### 3. Set PR Status
```javascript
await axios.post(
  `https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`,
  { state: 'success', description: 'All checks passed' },
  { headers: { 'Authorization': `token ${GITHUB_TOKEN}` }}
);
```

## Deployment Checklist

- [ ] All environment variables set
- [ ] Bot accessible via HTTPS
- [ ] Webhook configured in GitHub
- [ ] Webhook secret matches
- [ ] GitHub token has correct scopes
- [ ] API endpoint is reachable
- [ ] Test PR created and processed
- [ ] Logs show successful processing
- [ ] Your API receives data correctly

## Next Steps

1. Deploy and test with real PRs
2. Monitor logs for any issues
3. Customize based on your needs
4. Add more features as required
5. Scale as your usage grows

Remember: Start simple, test thoroughly, then expand! 🚀
