const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3004;

// Password protection
app.use(basicAuth({
  users: { 'admin': 'selden' },
  challenge: true,
  realm: 'Mission Control'
}));

app.use(express.json());
app.use(express.static('public'));

// Serve data folder
app.use('/data', express.static('data'));

const CRON_FILE = path.join(process.env.HOME || '/root', '.openclaw', 'cron', 'jobs.json');
const SESSIONS_DIR = path.join(process.env.HOME || '/root', '.openclaw', 'agents');

// Get all agents (sessions)
app.get('/api/agents', (req, res) => {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      return res.json({ agents: [] });
    }
    
    const agents = [];
    const dirs = fs.readdirSync(SESSIONS_DIR);
    
    for (const dir of dirs) {
      const sessionPath = path.join(SESSIONS_DIR, dir, 'session');
      const metaFile = path.join(sessionPath, 'meta.json');
      
      if (fs.existsSync(metaFile)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
          agents.push({
            id: dir,
            kind: meta.kind || 'unknown',
            label: meta.label || dir,
            created: meta.createdAt,
            updated: meta.updatedAt
          });
        } catch (err) {
          console.error(`Error reading ${metaFile}:`, err.message);
        }
      }
    }
    
    res.json({ agents });
  } catch (error) {
    console.error('Error reading agents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all cron jobs
app.get('/api/cron/jobs', (req, res) => {
  try {
    if (!fs.existsSync(CRON_FILE)) {
      return res.json({ jobs: [] });
    }
    const data = JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
    res.json({ jobs: data.jobs || [] });
  } catch (error) {
    console.error('Error reading cron jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a cron job
app.delete('/api/cron/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!fs.existsSync(CRON_FILE)) {
      return res.status(404).json({ error: 'No jobs file found' });
    }
    
    const data = JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
    
    // Create backup
    const backupFile = CRON_FILE + '.bak';
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    
    // Filter out the job
    const initialCount = data.jobs.length;
    data.jobs = data.jobs.filter(job => job.id !== jobId);
    
    if (data.jobs.length === initialCount) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Write back
    fs.writeFileSync(CRON_FILE, JSON.stringify(data, null, 2));
    
    res.json({ success: true, jobId });
  } catch (error) {
    console.error('Error deleting cron job:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🎯 Mission Control running on http://localhost:${PORT}`);
  console.log(`🔒 Protected with password: selden`);
});
