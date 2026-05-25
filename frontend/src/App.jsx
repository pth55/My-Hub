import React, { useState, useEffect } from 'react';
import './App.css';

// Nginx proxies /api to Node backend — no hardcoded IP needed
const API_URL = '/api';
// Reads whatever IP or domain is in the browser's URL bar at runtime
const PUBLIC_HOST = window.location.hostname;

function App() {
  const [view, setView] = useState('home');
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [tags, setTags] = useState([]);
  const [sortOrder, setSortOrder] = useState('A-Z');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/repos`)
      .then(res => res.json())
      .then(data => setRepos(data.repositories || []))
      .catch(() => setError('Failed to connect to Backend API. Is it running?'));
  }, []);

  const handleRepoClick = (repoName) => {
    setSelectedRepo(repoName);
    setView('detail');
    fetch(`${API_URL}/repos/${repoName}/tags`)
      .then(res => res.json())
      .then(data => {
        const sortedTags = (data.tags || []).sort().reverse();
        setTags(sortedTags);
      });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const sortedRepos = [...repos].sort((a, b) => {
    if (sortOrder === 'A-Z') return a.localeCompare(b);
    if (sortOrder === 'Z-A') return b.localeCompare(a);
    return 0;
  });

  return (
    <div className="App">
      <header className="navbar">
        <div className="nav-brand" onClick={() => setView('home')}>
          <span className="logo">🐳</span> My Hub
        </div>
        <div className="nav-links">
          <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Home</button>
          <button className={view === 'docs' ? 'active' : ''} onClick={() => setView('docs')}>Documentation</button>
        </div>
      </header>

      <main className="container">
        {error && <div className="error-banner">{error}</div>}

        {/* HOME VIEW */}
        {view === 'home' && (
          <section className="view-home">
            <div className="home-header">
              <h2>Stored Images</h2>
              <div className="filters">
                <label>Sort By: </label>
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                  <option value="A-Z">A - Z</option>
                  <option value="Z-A">Z - A</option>
                </select>
              </div>
            </div>
            <div className="grid">
              {sortedRepos.length === 0 && !error ? <p className="empty-msg">No images pushed yet.</p> : null}
              {sortedRepos.map(repo => (
                <div key={repo} className="card" onClick={() => handleRepoClick(repo)}>
                  <div className="card-icon">📦</div>
                  <h3>{repo}</h3>
                  <p>View tags and pull instructions &rarr;</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* IMAGE DETAIL VIEW */}
        {view === 'detail' && selectedRepo && (
          <section className="view-detail">
            <button className="back-btn" onClick={() => setView('home')}>&larr; Back to Home</button>
            <div className="detail-header">
              <h2>{selectedRepo}</h2>
              <div className="quick-pull">
                <span>Latest Pull Command:</span>
                <code>docker pull {PUBLIC_HOST}/{selectedRepo}:{tags[0] || 'latest'}</code>
                <button onClick={() => copyToClipboard(`docker pull ${PUBLIC_HOST}/${selectedRepo}:${tags[0] || 'latest'}`)}>Copy</button>
              </div>
            </div>

            <h3>Available Versions (Tags)</h3>
            <div className="tags-list">
              {tags.length === 0 ? <p>Loading tags...</p> : null}
              {tags.map(tag => (
                <div key={tag} className="tag-row">
                  <span className="tag-name">{tag}</span>
                  <div className="tag-actions">
                    <code>docker pull {PUBLIC_HOST}/{selectedRepo}:{tag}</code>
                    <button onClick={() => copyToClipboard(`docker pull ${PUBLIC_HOST}/${selectedRepo}:${tag}`)}>Copy</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* DOCUMENTATION VIEW */}
        {view === 'docs' && (
          <section className="view-docs">
            <h2>Documentation &amp; Setup</h2>
            <p>This registry is secured with a Let&apos;s Encrypt SSL certificate. No client-side Docker daemon changes are needed — standard push/pull commands just work.</p>

            <div className="doc-step">
              <h3>1. Tag Your Image</h3>
              <p>Build locally, then tag it with this registry&apos;s domain.</p>
              <pre><code>{`docker build -t my-app:v1 .
docker tag my-app:v1 ${PUBLIC_HOST}/my-app:v1`}</code></pre>
            </div>

            <div className="doc-step">
              <h3>2. Push to This Hub</h3>
              <pre><code>{`docker push ${PUBLIC_HOST}/my-app:v1`}</code></pre>
            </div>

            <div className="doc-step">
              <h3>3. Pull from This Hub</h3>
              <p>Browse the Home page to find the image you want, then run:</p>
              <pre><code>{`docker pull ${PUBLIC_HOST}/my-app:v1`}</code></pre>
            </div>

            <div className="doc-step">
              <h3>Fallback: HTTP-Only Setup</h3>
              <p>If SSL is not available (e.g., testing over plain HTTP), whitelist this host in your Docker daemon on Linux:</p>
              <pre><code>{`sudo mkdir -p /etc/docker && [ -f /etc/docker/daemon.json ] || echo '{}' | sudo tee /etc/docker/daemon.json
cat /etc/docker/daemon.json | jq '."insecure-registries" = (."insecure-registries" // []) + ["${PUBLIC_HOST}:80"] | ."insecure-registries" |= unique' | sudo tee /tmp/daemon.json && sudo mv /tmp/daemon.json /etc/docker/daemon.json
sudo systemctl restart docker`}</code></pre>
              <p>For Windows/Mac (Docker Desktop): go to Settings &gt; Docker Engine and add:</p>
              <pre><code>{`{
  "insecure-registries": ["${PUBLIC_HOST}:80"]
}`}</code></pre>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
