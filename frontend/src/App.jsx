import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = '/api';
const PUBLIC_HOST = window.location.hostname;

function App() {
  const [view, setView] = useState('home');
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState('A-Z');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/repos`)
      .then(r => r.json())
      .then(d => { setRepos(d.repositories || []); setLoading(false); })
      .catch(() => { setError('Failed to connect to backend API. Is it running?'); setLoading(false); });
  }, []);

  const openRepo = (name) => {
    setSelectedRepo(name);
    setTags([]);
    setTagsLoading(true);
    setView('detail');
    fetch(`${API_URL}/repos/${name}/tags`)
      .then(r => r.json())
      .then(d => { setTags((d.tags || []).sort().reverse()); setTagsLoading(false); })
      .catch(() => setTagsLoading(false));
  };

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const CopyBtn = ({ text, id }) => (
    <button className={`copy-btn ${copied === id ? 'copied' : ''}`} onClick={() => copy(text, id)}>
      {copied === id ? '✓ Copied' : 'Copy'}
    </button>
  );

  const filtered = [...repos]
    .filter(r => r.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortOrder === 'A-Z' ? a.localeCompare(b) : b.localeCompare(a));

  return (
    <div className="app">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="nav-left">
          <div className="nav-logo" onClick={() => setView('home')}>
            <svg className="logo-svg" viewBox="0 0 24 24" fill="none">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span>My Hub</span>
          </div>
          <div className="nav-links">
            <button className={view !== 'docs' ? 'active' : ''} onClick={() => setView('home')}>Images</button>
            <button className={view === 'docs' ? 'active' : ''} onClick={() => setView('docs')}>Docs</button>
          </div>
        </div>
        <div className="registry-pill">
          <span className="pill-dot" />
          <span>{PUBLIC_HOST}</span>
        </div>
      </nav>

      <main className="main">
        {error && (
          <div className="alert-error">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            {error}
          </div>
        )}

        {/* ── Home ── */}
        {view === 'home' && (
          <div className="view">
            <div className="page-head">
              <div>
                <h1>Container Images</h1>
                <p className="sub">{repos.length} image{repos.length !== 1 ? 's' : ''} in registry</p>
              </div>
              <div className="controls">
                <label className="search-wrap">
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  <input placeholder="Search images…" value={search} onChange={e => setSearch(e.target.value)} />
                </label>
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                  <option value="A-Z">A → Z</option>
                  <option value="Z-A">Z → A</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="grid">
                {[...Array(6)].map((_, i) => <div key={i} className="card skeleton" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" width="32" height="32"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.5"/></svg>
                </div>
                <h3>{search ? 'No results' : 'No images yet'}</h3>
                <p>{search ? `Nothing matches "${search}".` : 'Push your first image to see it here.'}</p>
                {!search && <code className="hint">docker push {PUBLIC_HOST}/your-image:tag</code>}
              </div>
            ) : (
              <div className="grid">
                {filtered.map(repo => (
                  <div key={repo} className="card" onClick={() => openRepo(repo)}>
                    <div className="card-icon">
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.8"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </div>
                    <h3 className="card-name">{repo}</h3>
                    <p className="card-path">{PUBLIC_HOST}/{repo}</p>
                    <span className="card-cta">View tags →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Detail ── */}
        {view === 'detail' && selectedRepo && (
          <div className="view">
            <button className="back-btn" onClick={() => setView('home')}>
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              All Images
            </button>

            <div className="hero-card">
              <div className="hero-icon">
                <svg viewBox="0 0 24 24" fill="none" width="26" height="26"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.6"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </div>
              <div className="hero-info">
                <h1>{selectedRepo}</h1>
                <p>{PUBLIC_HOST}/{selectedRepo}</p>
              </div>
              <div className="hero-stat">
                <span className="stat-num">{tags.length}</span>
                <span className="stat-lbl">tags</span>
              </div>
            </div>

            {tags[0] && (
              <div className="latest-card">
                <span className="latest-label">Latest</span>
                <div className="latest-body">
                  <code>docker pull {PUBLIC_HOST}/{selectedRepo}:{tags[0]}</code>
                  <CopyBtn text={`docker pull ${PUBLIC_HOST}/${selectedRepo}:${tags[0]}`} id="latest" />
                </div>
              </div>
            )}

            <div className="section">
              <p className="section-label">All Tags</p>
              <div className="tag-list">
                {tagsLoading
                  ? [...Array(3)].map((_, i) => <div key={i} className="tag-row skeleton" style={{height: 56}} />)
                  : tags.map((tag, i) => (
                    <div key={tag} className="tag-row">
                      <div className="tag-left">
                        <span className="tag-name">{tag}</span>
                        {i === 0 && <span className="tag-latest">latest</span>}
                      </div>
                      <div className="tag-right">
                        <code>docker pull {PUBLIC_HOST}/{selectedRepo}:{tag}</code>
                        <CopyBtn text={`docker pull ${PUBLIC_HOST}/${selectedRepo}:${tag}`} id={tag} />
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ── Docs ── */}
        {view === 'docs' && (
          <div className="view">
            <div className="page-head">
              <div>
                <h1>Documentation</h1>
                <p className="sub">Push and pull images from this private registry</p>
              </div>
            </div>
            <div className="docs-grid">
              {[
                {
                  n: '01', title: 'Tag your image',
                  desc: 'Build locally and tag it with this registry domain.',
                  code: `docker build -t my-app:v1 .\ndocker tag my-app:v1 ${PUBLIC_HOST}/my-app:v1`,
                  id: 'tag'
                },
                {
                  n: '02', title: 'Push to this hub',
                  desc: 'SSL secured — no daemon.json edits needed.',
                  code: `docker push ${PUBLIC_HOST}/my-app:v1`,
                  id: 'push'
                },
                {
                  n: '03', title: 'Pull from this hub',
                  desc: 'Works on any machine without extra config.',
                  code: `docker pull ${PUBLIC_HOST}/my-app:v1`,
                  id: 'pull'
                },
              ].map(s => (
                <div key={s.n} className="doc-card">
                  <span className="doc-num">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                  <div className="code-block">
                    <div className="code-bar"><CopyBtn text={s.code} id={s.id} /></div>
                    <pre><code>{s.code}</code></pre>
                  </div>
                </div>
              ))}

              <div className="doc-card doc-wide">
                <span className="doc-num">04</span>
                <h3>HTTP fallback (no SSL)</h3>
                <p>If SSL isn't available, whitelist this host as an insecure registry on Linux:</p>
                <div className="code-block">
                  <div className="code-bar">
                    <CopyBtn
                      text={`sudo mkdir -p /etc/docker\necho '{"insecure-registries":["${PUBLIC_HOST}"]}' | sudo tee /etc/docker/daemon.json\nsudo systemctl restart docker`}
                      id="insecure"
                    />
                  </div>
                  <pre><code>{`sudo mkdir -p /etc/docker\necho '{"insecure-registries":["${PUBLIC_HOST}"]}' | sudo tee /etc/docker/daemon.json\nsudo systemctl restart docker`}</code></pre>
                </div>
                <p className="doc-note">
                  <b>Docker Desktop (Win/Mac):</b> Settings → Docker Engine → add{' '}
                  <code>{`"insecure-registries": ["${PUBLIC_HOST}"]`}</code>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
