/**
 * Test API Server
 * 
 * This is a simple test server that mimics your actual API.
 * Use this to test your GitHub bot locally before deploying.
 * 
 * Run this in a separate terminal:
 * node test-api.js
 */

const express = require('express');
const app = express();
const PORT = 4000;

app.use(express.json());

// Test endpoint that receives PR data from the bot
app.post('/analyze', (req, res) => {
  console.log('\n========================================');
  console.log('📥 Received PR Data from Bot');
  console.log('========================================\n');
  
  const data = req.body;
  
  console.log('Repository:', data.repository?.full_name);
  console.log('PR Number:', data.pull_request?.number);
  console.log('PR Title:', data.pull_request?.title);
  console.log('PR Author:', data.pull_request?.author);
  console.log('Action:', data.action);
  console.log('\nFiles Changed:', data.files?.length);
  
  if (data.files && data.files.length > 0) {
    console.log('\nFile Details:');
    data.files.forEach((file, index) => {
      console.log(`\n  ${index + 1}. ${file.filename}`);
      console.log(`     Status: ${file.status}`);
      console.log(`     Changes: +${file.additions} -${file.deletions}`);
      console.log(`     Content length: ${file.content?.length || 0} characters`);
      
      // Show first 200 characters of content
      if (file.content) {
        const preview = file.content.substring(0, 200);
        console.log(`     Preview: ${preview}${file.content.length > 200 ? '...' : ''}`);
      }
    });
  }
  
  console.log('\n========================================\n');
  
  // Send success response
  res.status(200).json({
    success: true,
    message: 'PR data received and processed',
    received_at: new Date().toISOString(),
    pr_number: data.pull_request?.number,
    files_analyzed: data.files?.length || 0
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'test-api' });
});

app.listen(PORT, () => {
  console.log(`🧪 Test API Server running on http://localhost:${PORT}`);
  console.log(`📍 Endpoint: http://localhost:${PORT}/analyze`);
  console.log('\n💡 Update your .env file:');
  console.log(`   API_ENDPOINT=http://localhost:${PORT}/analyze\n`);
});
