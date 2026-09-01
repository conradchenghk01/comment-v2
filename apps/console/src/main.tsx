import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const rejectionCodes = ['violates_guidelines', 'spam', 'harassment', 'hate', 'sexual_content', 'misinformation'] as const;

interface Application { key: string; name: string; slug: string; status: string; }
interface Page<T> { items: T[]; page: number; pageSize: number; total: number; }
interface CommentRecord { id: string; articleKey: string; rootCommentId: string | null; authorId: string; authorName: string; authorAvatarUrl: string | null; body: string; status: string; createdAt: string; replyCount: number; heat: number; }
interface ConsoleUser { memberId: string; commentCount: number; reportCount: number; blockMode: 'normal' | 'full' | null; }
interface ReportRecord { id: string; reporterId: string; commentId: string; reportedAuthorId: string; reasonCategory: string; createdAt: string; }
interface AutoBanRecord { memberId: string; mode: 'normal' | 'full'; expiresAt: string | null; triggerCount: number; }
interface AuditLog { id: string; operatorId: string | null; action: string; targetType: string; targetId: string; metadata: Record<string, unknown>; createdAt: string; }
interface SensitiveWord { id: string; word: string; createdAt: string; }
interface ApplicationSettings {
  commentIntervalSeconds: number; dailyCommentLimit: number; newUserCooldownHours: number; yidunModerationEnabled: boolean;
  autoBanThresholdOne: number; autoBanThresholdTwo: number; autoBanThresholdThree: number;
  autoBanDurationOneHours: number; autoBanDurationTwoHours: number; autoBanDurationThreeHours: number;
}

type Tab = 'moderation' | 'comments' | 'users' | 'reports' | 'settings' | 'words' | 'origins' | 'audit';
const tabs: { id: Tab; label: string }[] = [
  { id: 'moderation', label: 'Moderation' },
  { id: 'comments', label: 'Comments' },
  { id: 'users', label: 'Users' },
  { id: 'reports', label: 'Reports & bans' },
  { id: 'settings', label: 'Settings' },
  { id: 'words', label: 'Sensitive words' },
  { id: 'origins', label: 'Origins' },
  { id: 'audit', label: 'Audit log' }
];

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

function Console() {
  const [operatorToken, setOperatorToken] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationKey, setApplicationKey] = useState('');
  const [tab, setTab] = useState<Tab>('moderation');
  const [notice, setNotice] = useState('Sign in as the local operator to begin.');

  const request = useCallback(async (path: string, options: RequestInit = {}): Promise<unknown> => {
    const response = await fetch(`${apiBase}${path}`, options);
    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : null;
    if (!response.ok) {
      if (response.status === 401) {
        setOperatorToken('');
        setNotice('Session expired. Sign in again.');
        throw new Error('Session expired');
      }
      const message = (payload as { message?: string } | null)?.message ?? `Request failed (${response.status})`;
      setNotice(message);
      throw new Error(message);
    }
    return payload;
  }, []);

  const operatorHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${operatorToken}`,
    'X-Application-Key': applicationKey
  }), [operatorToken, applicationKey]);

  async function signInOperator(): Promise<void> {
    const payload = await request('/v1/local/auth/operator/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'operator', password: 'change-me-local-only' })
    }) as { accessToken: string };
    setOperatorToken(payload.accessToken);
    const apps = await request('/v1/console/applications', { headers: { Authorization: `Bearer ${payload.accessToken}` } }) as Application[];
    setApplications(apps);
    setApplicationKey((current) => current || apps[0]?.key || '');
    setNotice(`Signed in. ${apps.length} application(s) available.`);
  }

  const ready = operatorToken !== '' && applicationKey !== '';

  return <main>
    <header>
      <strong>Comment Console</strong>
      <span>{operatorToken ? `Operator session active${applicationKey ? ` · ${applicationKey}` : ''}` : 'Local operator sign-in'}</span>
    </header>
    {!operatorToken ? (
      <section className="signin">
        <h1>Operations console</h1>
        <p>Sign in with the local operator account to review pending comments, manage members, and configure applications.</p>
        <button type="button" onClick={() => void signInOperator()}>Sign in with local operator</button>
      </section>
    ) : (
      <section className="workspace">
        <nav className="tabs">
          {tabs.map((entry) => <button key={entry.id} type="button" className={tab === entry.id ? 'active' : ''} onClick={() => setTab(entry.id)}>{entry.label}</button>)}
        </nav>
        <label className="app-select">Application
          <select value={applicationKey} onChange={(event) => setApplicationKey(event.target.value)}>
            {applications.map((application) => <option key={application.key} value={application.key}>{application.name} ({application.slug})</option>)}
          </select>
        </label>
        <p className="notice" role="status">{notice}</p>
        {tab === 'moderation' && <ModerationTab headers={operatorHeaders()} ready={ready} onNotice={setNotice} request={request} />}
        {tab === 'comments' && <CommentsTab headers={operatorHeaders()} ready={ready} onNotice={setNotice} request={request} />}
        {tab === 'users' && <UsersTab headers={operatorHeaders()} ready={ready} onNotice={setNotice} request={request} />}
        {tab === 'reports' && <ReportsTab headers={operatorHeaders()} ready={ready} onNotice={setNotice} request={request} />}
        {tab === 'settings' && <SettingsTab headers={operatorHeaders()} ready={ready} onNotice={setNotice} request={request} />}
        {tab === 'words' && <WordsTab headers={operatorHeaders()} ready={ready} onNotice={setNotice} request={request} />}
        {tab === 'origins' && <OriginsTab headers={operatorHeaders()} ready={ready} onNotice={setNotice} request={request} />}
        {tab === 'audit' && <AuditTab headers={operatorHeaders()} ready={ready} onNotice={setNotice} request={request} />}
      </section>
    )}
  </main>;
}

interface TabProps {
  headers: HeadersInit;
  ready: boolean;
  onNotice: (message: string) => void;
  request: (path: string, options?: RequestInit) => Promise<unknown>;
}

function usePage<T>(path: string, headers: HeadersInit, ready: boolean, onNotice: (message: string) => void, request: TabProps['request']): { page: Page<T> | null; reload: () => void } {
  const [page, setPage] = useState<Page<T> | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!ready) return;
    void request(path, { headers }).then((payload) => setPage(payload as Page<T>)).catch(() => undefined);
  }, [path, headers, ready, nonce, request, onNotice]);
  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { page, reload };
}

function Pager({ page, onPage }: { page: Page<unknown> | null; onPage: (page: number) => void }): ReactNode {
  if (!page) return null;
  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));
  return <div className="pager">
    <button type="button" disabled={page.page <= 1} onClick={() => onPage(page.page - 1)}>Previous</button>
    <span>Page {page.page} of {totalPages} · {page.total} total</span>
    <button type="button" disabled={page.page >= totalPages} onClick={() => onPage(page.page + 1)}>Next</button>
  </div>;
}

function ModerationTab({ headers, ready, onNotice, request }: TabProps): ReactNode {
  const [currentPage, setCurrentPage] = useState(1);
  const path = `/v1/console/moderation/pending?page=${currentPage}&pageSize=10`;
  const { page, reload } = usePage<CommentRecord>(path, headers, ready, onNotice, request);

  async function transition(commentId: string, action: 'approve' | 'reject', rejectionCode?: string): Promise<void> {
    try {
      await request(`/v1/console/moderation/comments/${encodeURIComponent(commentId)}/${action}`, {
        method: 'POST',
        headers,
        body: rejectionCode ? JSON.stringify({ rejectionCode }) : undefined
      });
      onNotice(`${action === 'approve' ? 'Approved' : 'Rejected'} comment ${commentId}.`);
      reload();
    } catch { /* notice already set */ }
  }

  return <div className="tab-panel">
    <h2>Pending comments</h2>
    {!page ? <p className="empty">Loading…</p> : page.items.length === 0 ? <p className="empty">No pending comments.</p> : (
      <ul className="comment-list">
        {page.items.map((comment) => <li key={comment.id} className="comment-card">
          <div className="comment-meta"><strong>{comment.authorName}</strong> · {comment.articleKey} · {formatTime(comment.createdAt)}</div>
          <p className="comment-body">{comment.body}</p>
          <div className="actions">
            <button type="button" onClick={() => void transition(comment.id, 'approve')}>Approve</button>
            {rejectionCodes.map((code) => <button key={code} type="button" className="danger" onClick={() => void transition(comment.id, 'reject', code)}>Reject: {code}</button>)}
          </div>
        </li>)}
      </ul>
    )}
    <Pager page={page} onPage={setCurrentPage} />
  </div>;
}

function CommentsTab({ headers, ready, onNotice, request }: TabProps): ReactNode {
  const [currentPage, setCurrentPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [articleKey, setArticleKey] = useState('');
  const [search, setSearch] = useState({ keyword: '', status: '', articleKey: '' });
  const params = new URLSearchParams({ page: String(currentPage), pageSize: '10' });
  if (search.keyword) params.set('keyword', search.keyword);
  if (search.status) params.set('status', search.status);
  if (search.articleKey) params.set('articleKey', search.articleKey);
  const { page, reload } = usePage<CommentRecord>(`/v1/console/comments?${params}`, headers, ready, onNotice, request);

  async function remove(commentId: string): Promise<void> {
    try {
      await request(`/v1/console/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE', headers });
      onNotice(`Deleted comment ${commentId}.`);
      reload();
    } catch { /* notice already set */ }
  }

  async function bulkDeleteByArticle(): Promise<void> {
    if (!search.articleKey) { onNotice('Enter an article key filter first.'); return; }
    try {
      const payload = await request('/v1/console/comments/bulk-delete-by-article', { method: 'POST', headers, body: JSON.stringify({ articleKey: search.articleKey }) }) as { deletedCount: number };
      onNotice(`Deleted ${payload.deletedCount} comment(s) on ${search.articleKey}.`);
      reload();
    } catch { /* notice already set */ }
  }

  return <div className="tab-panel">
    <h2>Comment search</h2>
    <div className="filters">
      <label>Keyword<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search body text" /></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Any status</option><option value="pending">pending</option><option value="published">published</option><option value="rejected">rejected</option><option value="deleted">deleted</option></select></label>
      <label>Article key<input value={articleKey} onChange={(event) => setArticleKey(event.target.value)} placeholder="Filter by article" /></label>
      <button type="button" onClick={() => { setCurrentPage(1); setSearch({ keyword, status, articleKey }); }}>Search</button>
    </div>
    {!page ? <p className="empty">Loading…</p> : page.items.length === 0 ? <p className="empty">No comments match.</p> : (
      <ul className="comment-list">
        {page.items.map((comment) => <li key={comment.id} className="comment-card">
          <div className="comment-meta"><strong>{comment.authorName}</strong> · {comment.articleKey} · <span className={`status status-${comment.status}`}>{comment.status}</span> · {formatTime(comment.createdAt)}</div>
          <p className="comment-body">{comment.body}</p>
          <div className="actions">
            {comment.status !== 'deleted' && <button type="button" className="danger" onClick={() => void remove(comment.id)}>Delete</button>}
          </div>
        </li>)}
      </ul>
    )}
    <div className="actions">
      <button type="button" className="danger" onClick={() => void bulkDeleteByArticle()}>Bulk delete by article filter</button>
    </div>
    <Pager page={page} onPage={setCurrentPage} />
  </div>;
}

function UsersTab({ headers, ready, onNotice, request }: TabProps): ReactNode {
  const [currentPage, setCurrentPage] = useState(1);
  const { page, reload } = usePage<ConsoleUser>(`/v1/console/users?page=${currentPage}&pageSize=10`, headers, ready, onNotice, request);

  async function setBlock(memberId: string, mode: 'normal' | 'full' | null): Promise<void> {
    try {
      if (mode === null) {
        await request(`/v1/console/users/${encodeURIComponent(memberId)}/block`, { method: 'DELETE', headers });
        onNotice(`Removed block for ${memberId}.`);
      } else {
        await request(`/v1/console/users/${encodeURIComponent(memberId)}/block`, { method: 'PUT', headers, body: JSON.stringify({ mode }) });
        onNotice(`Set ${mode} block for ${memberId}.`);
      }
      reload();
    } catch { /* notice already set */ }
  }

  async function bulkDeleteByUser(memberId: string): Promise<void> {
    try {
      const payload = await request('/v1/console/comments/bulk-delete-by-user', { method: 'POST', headers, body: JSON.stringify({ memberId }) }) as { deletedCount: number };
      onNotice(`Deleted ${payload.deletedCount} comment(s) by ${memberId}.`);
      reload();
    } catch { /* notice already set */ }
  }

  return <div className="tab-panel">
    <h2>Application members</h2>
    {!page ? <p className="empty">Loading…</p> : page.items.length === 0 ? <p className="empty">No members found.</p> : (
      <table className="data-table">
        <thead><tr><th>Member</th><th>Comments</th><th>Reports</th><th>Block</th><th>Actions</th></tr></thead>
        <tbody>
          {page.items.map((user) => <tr key={user.memberId}>
            <td>{user.memberId}</td>
            <td>{user.commentCount}</td>
            <td>{user.reportCount}</td>
            <td>{user.blockMode ? <span className={`status status-${user.blockMode}`}>{user.blockMode}</span> : '—'}</td>
            <td className="actions">
              {user.blockMode ? <button type="button" onClick={() => void setBlock(user.memberId, null)}>Unblock</button> : <>
                <button type="button" onClick={() => void setBlock(user.memberId, 'normal')}>Block (normal)</button>
                <button type="button" className="danger" onClick={() => void setBlock(user.memberId, 'full')}>Block (full)</button>
              </>}
              <button type="button" className="danger" onClick={() => void bulkDeleteByUser(user.memberId)}>Delete all comments</button>
            </td>
          </tr>)}
        </tbody>
      </table>
    )}
    <Pager page={page} onPage={setCurrentPage} />
  </div>;
}

function ReportsTab({ headers, ready, onNotice, request }: TabProps): ReactNode {
  const [reportsPage, setReportsPage] = useState(1);
  const [bansPage, setBansPage] = useState(1);
  const reports = usePage<ReportRecord>(`/v1/console/reports?page=${reportsPage}&pageSize=10`, headers, ready, onNotice, request);
  const bans = usePage<AutoBanRecord>(`/v1/console/auto-bans?page=${bansPage}&pageSize=10`, headers, ready, onNotice, request);

  return <div className="tab-panel">
    <h2>Reports</h2>
    {!reports.page ? <p className="empty">Loading…</p> : reports.page.items.length === 0 ? <p className="empty">No reports.</p> : (
      <table className="data-table">
        <thead><tr><th>Reported author</th><th>Reporter</th><th>Reason</th><th>Comment</th><th>Created</th></tr></thead>
        <tbody>
          {reports.page.items.map((report) => <tr key={report.id}>
            <td>{report.reportedAuthorId}</td>
            <td>{report.reporterId}</td>
            <td>{report.reasonCategory}</td>
            <td title={report.commentId}>{report.commentId.slice(0, 12)}…</td>
            <td>{formatTime(report.createdAt)}</td>
          </tr>)}
        </tbody>
      </table>
    )}
    <Pager page={reports.page} onPage={setReportsPage} />
    <h2>Automatic bans</h2>
    {!bans.page ? <p className="empty">Loading…</p> : bans.page.items.length === 0 ? <p className="empty">No automatic bans.</p> : (
      <table className="data-table">
        <thead><tr><th>Member</th><th>Mode</th><th>Expires</th><th>Triggers</th></tr></thead>
        <tbody>
          {bans.page.items.map((ban) => <tr key={ban.memberId}>
            <td>{ban.memberId}</td>
            <td><span className={`status status-${ban.mode}`}>{ban.mode}</span></td>
            <td>{ban.expiresAt ? formatTime(ban.expiresAt) : 'Permanent'}</td>
            <td>{ban.triggerCount}</td>
          </tr>)}
        </tbody>
      </table>
    )}
    <Pager page={bans.page} onPage={setBansPage} />
  </div>;
}

function SettingsTab({ headers, ready, onNotice, request }: TabProps): ReactNode {
  const [settings, setSettings] = useState<ApplicationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    void request('/v1/console/settings', { headers }).then((payload) => setSettings(payload as ApplicationSettings)).catch(() => undefined);
  }, [headers, ready, request]);

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const payload = await request('/v1/console/settings', { method: 'PUT', headers, body: JSON.stringify(settings) }) as ApplicationSettings;
      setSettings(payload);
      onNotice('Settings saved.');
    } catch { /* notice already set */ } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="tab-panel"><h2>Settings</h2><p className="empty">Loading…</p></div>;
  return <div className="tab-panel">
    <h2>Application settings</h2>
    <form onSubmit={(event) => void save(event)} className="settings-form">
      <label>Comment interval (seconds)<input type="number" min={0} max={86400} value={settings.commentIntervalSeconds} onChange={(event) => setSettings({ ...settings, commentIntervalSeconds: Number(event.target.value) })} /></label>
      <label>Daily comment limit<input type="number" min={1} max={10000} value={settings.dailyCommentLimit} onChange={(event) => setSettings({ ...settings, dailyCommentLimit: Number(event.target.value) })} /></label>
      <label>New user cooldown (hours)<input type="number" min={0} max={8760} value={settings.newUserCooldownHours} onChange={(event) => setSettings({ ...settings, newUserCooldownHours: Number(event.target.value) })} /></label>
      <label className="checkbox"><input type="checkbox" checked={settings.yidunModerationEnabled} onChange={(event) => setSettings({ ...settings, yidunModerationEnabled: event.target.checked })} /> Yidun moderation enabled</label>
      <h3>Auto-ban thresholds (reports)</h3>
      <label>Threshold one<input type="number" min={1} max={10000} value={settings.autoBanThresholdOne} onChange={(event) => setSettings({ ...settings, autoBanThresholdOne: Number(event.target.value) })} /></label>
      <label>Threshold two<input type="number" min={1} max={10000} value={settings.autoBanThresholdTwo} onChange={(event) => setSettings({ ...settings, autoBanThresholdTwo: Number(event.target.value) })} /></label>
      <label>Threshold three<input type="number" min={1} max={10000} value={settings.autoBanThresholdThree} onChange={(event) => setSettings({ ...settings, autoBanThresholdThree: Number(event.target.value) })} /></label>
      <h3>Auto-ban durations (hours)</h3>
      <label>Duration one<input type="number" min={1} max={8760} value={settings.autoBanDurationOneHours} onChange={(event) => setSettings({ ...settings, autoBanDurationOneHours: Number(event.target.value) })} /></label>
      <label>Duration two<input type="number" min={1} max={8760} value={settings.autoBanDurationTwoHours} onChange={(event) => setSettings({ ...settings, autoBanDurationTwoHours: Number(event.target.value) })} /></label>
      <label>Duration three<input type="number" min={1} max={8760} value={settings.autoBanDurationThreeHours} onChange={(event) => setSettings({ ...settings, autoBanDurationThreeHours: Number(event.target.value) })} /></label>
      <button disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
    </form>
  </div>;
}

function WordsTab({ headers, ready, onNotice, request }: TabProps): ReactNode {
  const [words, setWords] = useState<SensitiveWord[] | null>(null);
  const [word, setWord] = useState('');

  useEffect(() => {
    if (!ready) return;
    void request('/v1/console/sensitive-words', { headers }).then((payload) => setWords(payload as SensitiveWord[])).catch(() => undefined);
  }, [headers, ready, request]);

  async function add(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await request('/v1/console/sensitive-words', { method: 'POST', headers, body: JSON.stringify({ word }) });
      setWord('');
      onNotice(`Added sensitive word "${word}".`);
      const payload = await request('/v1/console/sensitive-words', { headers }) as SensitiveWord[];
      setWords(payload);
    } catch { /* notice already set */ }
  }

  async function remove(wordId: string): Promise<void> {
    try {
      await request(`/v1/console/sensitive-words/${encodeURIComponent(wordId)}`, { method: 'DELETE', headers });
      onNotice('Removed sensitive word.');
      setWords((current) => current?.filter((entry) => entry.id !== wordId) ?? null);
    } catch { /* notice already set */ }
  }

  return <div className="tab-panel">
    <h2>Sensitive words</h2>
    <form onSubmit={(event) => void add(event)} className="inline-form">
      <input value={word} onChange={(event) => setWord(event.target.value)} required minLength={1} maxLength={100} placeholder="Word to block" />
      <button>Add word</button>
    </form>
    {!words ? <p className="empty">Loading…</p> : words.length === 0 ? <p className="empty">No sensitive words configured.</p> : (
      <ul className="word-list">
        {words.map((entry) => <li key={entry.id}><span>{entry.word}</span><button type="button" className="danger" onClick={() => void remove(entry.id)}>Remove</button></li>)}
      </ul>
    )}
  </div>;
}

function OriginsTab({ headers, ready, onNotice, request }: TabProps): ReactNode {
  const [origins, setOrigins] = useState<string[] | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (!ready) return;
    void request('/v1/console/origins', { headers }).then((payload) => setOrigins(payload as string[])).catch(() => undefined);
  }, [headers, ready, request]);

  async function add(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await request('/v1/console/origins', { method: 'PUT', headers, body: JSON.stringify({ origin }) });
      setOrigin('');
      onNotice(`Added origin ${origin}.`);
      const payload = await request('/v1/console/origins', { headers }) as string[];
      setOrigins(payload);
    } catch { /* notice already set */ }
  }

  async function remove(target: string): Promise<void> {
    try {
      await request('/v1/console/origins', { method: 'DELETE', headers, body: JSON.stringify({ origin: target }) });
      onNotice(`Removed origin ${target}.`);
      setOrigins((current) => current?.filter((entry) => entry !== target) ?? null);
    } catch { /* notice already set */ }
  }

  return <div className="tab-panel">
    <h2>Allowed origins</h2>
    <form onSubmit={(event) => void add(event)} className="inline-form">
      <input value={origin} onChange={(event) => setOrigin(event.target.value)} required type="url" placeholder="https://example.com" />
      <button>Add origin</button>
    </form>
    {!origins ? <p className="empty">Loading…</p> : origins.length === 0 ? <p className="empty">No origins registered.</p> : (
      <ul className="word-list">
        {origins.map((entry) => <li key={entry}><span>{entry}</span><button type="button" className="danger" onClick={() => void remove(entry)}>Remove</button></li>)}
      </ul>
    )}
  </div>;
}

function AuditTab({ headers, ready, onNotice, request }: TabProps): ReactNode {
  const [currentPage, setCurrentPage] = useState(1);
  const { page } = usePage<AuditLog>(`/v1/console/audit-logs?page=${currentPage}&pageSize=10`, headers, ready, onNotice, request);

  return <div className="tab-panel">
    <h2>Audit log</h2>
    {!page ? <p className="empty">Loading…</p> : page.items.length === 0 ? <p className="empty">No audit events.</p> : (
      <table className="data-table">
        <thead><tr><th>Time</th><th>Action</th><th>Operator</th><th>Target</th><th>Metadata</th></tr></thead>
        <tbody>
          {page.items.map((entry) => <tr key={entry.id}>
            <td>{formatTime(entry.createdAt)}</td>
            <td>{entry.action}</td>
            <td>{entry.operatorId ?? 'system'}</td>
            <td>{entry.targetType}:{entry.targetId.slice(0, 12)}…</td>
            <td><code>{JSON.stringify(entry.metadata)}</code></td>
          </tr>)}
        </tbody>
      </table>
    )}
    <Pager page={page} onPage={setCurrentPage} />
  </div>;
}

createRoot(document.getElementById('root')!).render(<Console />);