import { FormEvent, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createT, guide, localeLabels, Locale, locales, resolveLocale, TranslationKey } from './i18n';
import './styles.css';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const users = ['author', 'reactor', 'reporter-one', 'reporter-two', 'reporter-three', 'reporter-four', 'reporter-five', 'new-user'];
const localeStorageKey = 'comment-lab-locale';

interface Application { key: string; name: string; slug: string; status: string; }

function Lab() {
  const [locale, setLocale] = useState<Locale>(() => resolveLocale(window.localStorage.getItem(localeStorageKey)));
  const t = createT(locale);
  const [guideVisible, setGuideVisible] = useState(true);
  const [user, setUser] = useState(users[0]);
  const [memberToken, setMemberToken] = useState('');
  const [operatorToken, setOperatorToken] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationKey, setApplicationKey] = useState('');
  const [articleKey, setArticleKey] = useState('demo-article');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<string | null>(null);

  function switchLocale(next: Locale): void {
    setLocale(next);
    window.localStorage.setItem(localeStorageKey, next);
  }

  async function request(path: string, options: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${apiBase}${path}`, options);
    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : { status: response.status };
    setResult(JSON.stringify({ status: response.status, payload }, null, 2));
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return payload;
  }

  async function loadApplications(token = operatorToken): Promise<void> {
    const payload = await request('/v1/console/applications', { headers: { Authorization: `Bearer ${token}` } }) as Application[];
    setApplications(payload);
    setApplicationKey((current) => current || payload[0]?.key || '');
  }

  async function signInOperator(): Promise<void> {
    const payload = await request('/v1/local/auth/operator/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'operator', password: 'change-me-local-only' }) }) as { accessToken: string };
    setOperatorToken(payload.accessToken);
    await loadApplications(payload.accessToken);
  }

  async function createApplication(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const application = await request('/v1/console/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` }, body: JSON.stringify({ name: String(data.get('name')), slug: String(data.get('slug')) }) }) as Application;
    setApplications((current) => [...current, application]);
    setApplicationKey(application.key);
    event.currentTarget.reset();
  }

  async function issueToken(): Promise<void> {
    const payload = await request('/v1/local/auth/member/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }) }) as { accessToken: string };
    setMemberToken(payload.accessToken);
  }

  async function fullReset(): Promise<void> {
    if (!window.confirm(t('confirmReset'))) return;
    await request('/v1/local/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'RESET' }) });
    setApplications([]);
    setApplicationKey('');
    setMemberToken('');
    setResult(JSON.stringify({ status: 200, payload: { message: t('resetDone') } }, null, 2));
  }

  function memberHeaders(): HeadersInit { return { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}`, 'X-Application-Key': applicationKey }; }

  async function createComment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await request(`/v1/articles/${encodeURIComponent(articleKey)}/comments`, { method: 'POST', headers: memberHeaders(), body: JSON.stringify({ body }) });
    setBody('');
  }

  async function listComments(): Promise<void> {
    await request(`/v1/articles/${encodeURIComponent(articleKey)}/comments`, { headers: memberHeaders() });
  }

  return <main>
    <header>
      <strong>Comment Developer Lab</strong>
      <span>{t('tagline')}</span>
      <div className="locale-switch" role="group" aria-label="Language">
        {locales.map((entry) => <button key={entry} type="button" className={entry === locale ? 'active' : ''} onClick={() => switchLocale(entry)}>{localeLabels[entry]}</button>)}
      </div>
    </header>
    <section className="guide panel">
      <div className="guide-head">
        <h1>{t('guideTitle')}</h1>
        <button type="button" onClick={() => setGuideVisible((visible) => !visible)}>{guideVisible ? t('guideHide') : t('guideShow')}</button>
      </div>
      {guideVisible && <ol className="guide-steps">{guide[locale].map((step, index) => <li key={index}><strong>{step.title}</strong><span>{step.body}</span></li>)}</ol>}
    </section>
    <section className="workspace">
      <div className="panel">
        <h1>{t('identityPanelTitle')}</h1>
        <div className="actions">
          <button type="button" onClick={() => void signInOperator()}>{t('signInOperator')}</button>
          <button type="button" disabled={!operatorToken} onClick={() => void loadApplications()}>{t('refreshApps')}</button>
          <button type="button" className="danger" onClick={() => void fullReset()}>{t('fullReset')}</button>
        </div>
        <form onSubmit={(event) => void createApplication(event)} className="inline-form">
          <input name="name" required maxLength={100} placeholder={t('applicationName')} />
          <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={32} placeholder={t('applicationSlug')} />
          <button disabled={!operatorToken}>{t('createApp')}</button>
        </form>
        <label>{t('application')}
          <select value={applicationKey} onChange={(event) => setApplicationKey(event.target.value)}>
            <option value="">{t('selectApplication')}</option>
            {applications.map((application) => <option key={application.key} value={application.key}>{application.name} ({application.slug})</option>)}
          </select>
        </label>
        <label>{t('simulatedUser')}
          <select value={user} onChange={(event) => setUser(event.target.value)}>{users.map((entry) => <option key={entry}>{entry}</option>)}</select>
        </label>
        <button type="button" onClick={() => void issueToken()}>{t('issueToken')}</button>
      </div>
      <div className="panel">
        <h1>{t('comments')}</h1>
        <label>{t('articleKey')}<input value={articleKey} onChange={(event) => setArticleKey(event.target.value)} required /></label>
        <form onSubmit={(event) => void createComment(event)}>
          <label>{t('commentBody')}<textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={1000} /></label>
          <div className="actions">
            <button disabled={!memberToken || !applicationKey}>{t('postComment')}</button>
            <button type="button" disabled={!memberToken || !applicationKey} onClick={() => void listComments()}>{t('listComments')}</button>
          </div>
        </form>
      </div>
      <div className="response">
        <h2>{t('response')}</h2>
        <pre>{result ?? t('ready')}</pre>
      </div>
    </section>
  </main>;
}

export type { TranslationKey };
export default Lab;

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<Lab />);
}