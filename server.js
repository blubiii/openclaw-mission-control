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

const CRON_FILE = path.join(process.env.HOME || '/root', '.openclaw', 'cron', 'jobs.json');

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
