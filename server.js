require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and raw body (needed for signature verification)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Configuration from environment variables
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const API_ENDPOINT = process.env.API_ENDPOINT || 'https://your-api.com/analyze';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/**
 * Verify that the webhook request is actually from GitHub
 * This prevents unauthorized requests from triggering your bot
 */
function verifyGitHubSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !GITHUB_WEBHOOK_SECRET) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

/**
 * Fetch the files changed in a pull request
 */
async function getPRFiles(owner, repo, prNumber) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching PR files:', error.message);
    throw error;
  }
}

/**
 * Fetch the content of a specific file from the PR
 */
async function getFileContent(owner, repo, path, ref) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    // GitHub returns content as base64 encoded
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    return content;
  } catch (error) {
    console.error(`Error fetching file ${path}:`, error.message);
    return null;
  }
}

/**
 * Send PR data to your API
 */
async function sendToAPI(prData) {
  try {
    console.log('Sending data to API:', API_ENDPOINT);
    const response = await axios.post(API_ENDPOINT, prData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log('API Response:', response.status, response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending to API:', error.message);
    if (error.response) {
      console.error('API Error Response:', error.response.status, error.response.data);
    }
    throw error;
  }
}

/**
 * Main webhook endpoint
 */
app.post('/webhook', async (req, res) => {
  // Verify the request is from GitHub
  if (!verifyGitHubSignature(req)) {
    console.error('Invalid signature - rejecting webhook');
    return res.status(401).send('Invalid signature');
  }

  const event = req.headers['x-github-event'];
  const payload = req.body;

  console.log(`Received ${event} event`);

  // We only care about pull request events
  if (event === 'pull_request') {
    const action = payload.action;
    
    // Trigger on: opened, reopened, or synchronized (new commits pushed)
    if (['opened', 'reopened', 'synchronize'].includes(action)) {
      console.log(`Processing PR #${payload.pull_request.number} - Action: ${action}`);
      
      const pr = payload.pull_request;
      const owner = payload.repository.owner.login;
      const repo = payload.repository.name;
      
      try {
        // Fetch all files changed in the PR
        const files = await getPRFiles(owner, repo, pr.number);
        
        // Fetch content for each file
        const filesWithContent = await Promise.all(
          files.map(async (file) => {
            const content = await getFileContent(owner, repo, file.filename, pr.head.sha);
            return {
              filename: file.filename,
              status: file.status, // added, modified, removed, renamed
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes,
              patch: file.patch, // The actual diff
              content: content // Full file content
            };
          })
        );

        // Prepare data to send to your API
        const prData = {
          repository: {
            owner: owner,
            name: repo,
            full_name: payload.repository.full_name
          },
          pull_request: {
            number: pr.number,
            title: pr.title,
            description: pr.body,
            author: pr.user.login,
            source_branch: pr.head.ref,
            target_branch: pr.base.ref,
            url: pr.html_url,
            created_at: pr.created_at,
            updated_at: pr.updated_at
          },
          files: filesWithContent,
          action: action
        };

        // Send to your API
        await sendToAPI(prData);
        
        console.log(`Successfully processed PR #${pr.number}`);
        res.status(200).send('Webhook processed successfully');
        
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Error processing webhook');
      }
    } else {
      console.log(`Ignoring PR action: ${action}`);
      res.status(200).send('Action ignored');
    }
  } else {
    console.log(`Ignoring event type: ${event}`);
    res.status(200).send('Event ignored');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('GitHub PR Bot is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`GitHub PR Bot listening on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Verify required environment variables
  if (!GITHUB_WEBHOOK_SECRET) {
    console.warn('WARNING: GITHUB_WEBHOOK_SECRET not set!');
  }
  if (!GITHUB_TOKEN) {
    console.warn('WARNING: GITHUB_TOKEN not set!');
  }
  if (!API_ENDPOINT || API_ENDPOINT === 'https://your-api.com/analyze') {
    console.warn('WARNING: API_ENDPOINT not configured!');
  }
});
