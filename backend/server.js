const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000;
const REGISTRY_URL = 'http://localhost:5000/v2';

app.use(cors());

app.get('/api/repos', async (req, res) => {
  try {
    const response = await axios.get(`${REGISTRY_URL}/_catalog`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching repos:', error.message);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

app.get('/api/repos/:repo_name/tags', async (req, res) => {
  const { repo_name } = req.params;
  try {
    const response = await axios.get(`${REGISTRY_URL}/${repo_name}/tags/list`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching tags for ${repo_name}:`, error.message);
    res.status(500).json({ error: `Failed to fetch tags for ${repo_name}` });
  }
});

app.listen(port, () => {
  console.log(`Backend API listening at http://localhost:${port}`);
});
