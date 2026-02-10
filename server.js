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
const TASKS_FILE = path.join(__dirname, 'data', 'tasks.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');

// Helper to read/write JSON files safely
function readJSON(filepath, defaultValue = {}) {
  try {
    if (!fs.existsSync(filepath)) return defaultValue;
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (error) {
    console.error(`Error reading ${filepath}:`, error);
    return defaultValue;
  }
}

function writeJSON(filepath, data) {
  try {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filepath}:`, error);
    return false;
  }
}

// Get all agents (sessions)
app.get('/api/agents', (req, res) => {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      return res.json({ agents: [] });
    }
    
    const agents = [];
    const dirs = fs.readdirSync(SESSIONS_DIR);
    
    for (const dir of dirs) {
      const sessionsFile = path.join(SESSIONS_DIR, dir, 'sessions', 'sessions.json');
      
      if (fs.existsSync(sessionsFile)) {
        try {
          const sessionsData = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
          const sessionKeys = Object.keys(sessionsData);
          
          let mostRecentSession = null;
          let mostRecentTime = 0;
          
          for (const key of sessionKeys) {
            const session = sessionsData[key];
            if (session.updatedAt > mostRecentTime) {
              mostRecentTime = session.updatedAt;
              mostRecentSession = session;
            }
          }
          
          if (mostRecentSession) {
            agents.push({
              id: dir,
              label: mostRecentSession.origin?.label || dir,
              sessionCount: sessionKeys.length,
              lastActive: new Date(mostRecentTime).toISOString(),
              channel: mostRecentSession.lastChannel || 'unknown'
            });
          } else {
            agents.push({
              id: dir,
              label: dir,
              sessionCount: 0,
              lastActive: null,
              channel: 'none'
            });
          }
        } catch (err) {
          console.error(`Error reading ${sessionsFile}:`, err.message);
          agents.push({
            id: dir,
            label: dir,
            sessionCount: 0,
            lastActive: null,
            channel: 'unknown'
          });
        }
      } else {
        agents.push({
          id: dir,
          label: dir,
          sessionCount: 0,
          lastActive: null,
          channel: 'none'
        });
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

// Create a cron job
app.post('/api/cron/jobs', (req, res) => {
  try {
    const newJob = req.body;
    
    // Validate required fields
    if (!newJob.name || !newJob.schedule || !newJob.payload) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Generate ID if not provided
    if (!newJob.id) {
      newJob.id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Default values
    newJob.enabled = newJob.enabled !== false;
    newJob.sessionTarget = newJob.sessionTarget || 'isolated';
    
    const data = readJSON(CRON_FILE, { jobs: [] });
    data.jobs = data.jobs || [];
    data.jobs.push(newJob);
    
    if (writeJSON(CRON_FILE, data)) {
      res.json({ success: true, job: newJob });
    } else {
      res.status(500).json({ error: 'Failed to write cron file' });
    }
  } catch (error) {
    console.error('Error creating cron job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a cron job
app.put('/api/cron/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const updates = req.body;
    
    const data = readJSON(CRON_FILE, { jobs: [] });
    const jobIndex = data.jobs.findIndex(j => j.id === jobId);
    
    if (jobIndex === -1) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Merge updates
    data.jobs[jobIndex] = { ...data.jobs[jobIndex], ...updates };
    
    // Create backup
    const backupFile = CRON_FILE + '.bak';
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    
    if (writeJSON(CRON_FILE, data)) {
      res.json({ success: true, job: data.jobs[jobIndex] });
    } else {
      res.status(500).json({ error: 'Failed to write cron file' });
    }
  } catch (error) {
    console.error('Error updating cron job:', error);
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

// Get all tasks
app.get('/api/tasks', (req, res) => {
  const data = readJSON(TASKS_FILE, { tasks: [] });
  res.json(data);
});

// Create a task
app.post('/api/tasks', (req, res) => {
  try {
    const newTask = req.body;
    
    // Validate
    if (!newTask.title || !newTask.description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Generate ID and timestamps
    newTask.id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    newTask.status = newTask.status || 'not_started';
    newTask.priority = newTask.priority || 'medium';
    newTask.createdAt = new Date().toISOString();
    newTask.updatedAt = new Date().toISOString();
    
    const data = readJSON(TASKS_FILE, { tasks: [] });
    data.tasks = data.tasks || [];
    data.tasks.push(newTask);
    
    if (writeJSON(TASKS_FILE, data)) {
      res.json({ success: true, task: newTask });
    } else {
      res.status(500).json({ error: 'Failed to write tasks file' });
    }
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a task
app.put('/api/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    const data = readJSON(TASKS_FILE, { tasks: [] });
    const taskIndex = data.tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Merge updates and update timestamp
    updates.updatedAt = new Date().toISOString();
    data.tasks[taskIndex] = { ...data.tasks[taskIndex], ...updates };
    
    if (writeJSON(TASKS_FILE, data)) {
      res.json({ success: true, task: data.tasks[taskIndex] });
    } else {
      res.status(500).json({ error: 'Failed to write tasks file' });
    }
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a task
app.delete('/api/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    
    const data = readJSON(TASKS_FILE, { tasks: [] });
    const initialCount = data.tasks.length;
    data.tasks = data.tasks.filter(t => t.id !== taskId);
    
    if (data.tasks.length === initialCount) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (writeJSON(TASKS_FILE, data)) {
      res.json({ success: true, taskId });
    } else {
      res.status(500).json({ error: 'Failed to write tasks file' });
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get settings
app.get('/api/settings', (req, res) => {
  const data = readJSON(SETTINGS_FILE, {
    interface: {
      proactiveMode: true,
      notificationStyle: 'summary',
      responseLength: 'concise'
    },
    cadence: {
      heartbeatInterval: 30,
      dailySummaryTime: '08:00',
      quietHoursStart: '23:00',
      quietHoursEnd: '08:00'
    },
    personality: {
      tone: 'professional',
      verbosity: 'balanced',
      humor: 'occasional',
      formality: 'casual'
    }
  });
  res.json(data);
});

// Update settings
app.put('/api/settings', (req, res) => {
  try {
    const currentSettings = readJSON(SETTINGS_FILE, {});
    const newSettings = { ...currentSettings, ...req.body };
    
    if (writeJSON(SETTINGS_FILE, newSettings)) {
      res.json({ success: true, settings: newSettings });
    } else {
      res.status(500).json({ error: 'Failed to write settings file' });
    }
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🧪 LaboratoryOS running on http://localhost:${PORT}`);
  console.log(`🔒 Protected with password: selden`);
});
