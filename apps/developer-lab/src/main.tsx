import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const users = ['author', 'reactor', 'reporter-one', 'reporter-two', 'reporter-three', 'new-user'];

function Lab() {
  const [user, setUser] = useState(users[0]);
  const [result, setResult] = useState('Choose a seeded user and issue a local member token.');
  async function issueToken(): Promise<void> {
    const response = await fetch(`${apiBase}/v1/local/auth/member/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }) });
    setResult(JSON.stringify(await response.json(), null, 2));
  }
  return <main><header><strong>Comment Developer Lab</strong><span>Local only</span></header><section><h1>API workspace</h1><label>Simulated user<select value={user} onChange={(event) => setUser(event.target.value)}>{users.map((entry) => <option key={entry}>{entry}</option>)}</select></label><button type="button" onClick={issueToken}>Issue member token</button><pre>{result}</pre></section></main>;
}

createRoot(document.getElementById('root')!).render(<Lab />);