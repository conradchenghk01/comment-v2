import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { createT, defaultLocale, guide, Locale, locales, resolveLocale, TranslationKey, translations } from '../src/i18n.js';

const setItem = vi.fn();
const getItem = vi.fn<() => string | null>(() => null);

vi.stubGlobal('localStorage', { getItem, setItem });
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

const fetchCalls: Array<{ path: string; method: string; body?: string }> = [];
let commentsFixture: Record<string, unknown> = { items: [] };
let branchFixture: Record<string, unknown> = { items: [] };
let reactionFixture: Record<string, unknown> = { counts: { laugh: 0, cry: 0, cheer: 0 }, active: [], tripleUsed: false };

let seedCommentCounter = 0;

vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = String(input).replace(/^https?:\/\/[^/]+/, '');
  const pathNoQuery = path.split('?')[0];
  fetchCalls.push({ path, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
  let payload: unknown = {};
  if (pathNoQuery === '/v1/local/auth/operator/login' || pathNoQuery === '/v1/local/auth/member/token') payload = { accessToken: 'token-123' };
  else if (pathNoQuery === '/v1/console/applications') payload = [{ key: 'app-1', name: 'Demo App', slug: 'demo-app', status: 'active' }];
  else if (pathNoQuery.includes('/triple-reaction') || pathNoQuery.includes('/reactions/')) payload = reactionFixture;
  else if (pathNoQuery.includes('/branch')) payload = branchFixture;
  else if (pathNoQuery.includes('/replies') && init?.method === 'POST') {
    seedCommentCounter++;
    payload = { id: `seed-reply-${seedCommentCounter}`, rootCommentId: 'root-1', authorName: 'reactor', body: 'seed reply', status: 'published', createdAt: '2026-09-01T10:05:00Z', replyCount: 0, reactionCounts: { laugh: 0, cry: 0, cheer: 0 }, viewerReactions: [], viewerTripleUsed: false };
  }
  else if (pathNoQuery.includes('/replies')) payload = { id: 'reply-new', rootCommentId: 'root-1', authorName: 'author', body: '回覆內容', status: 'published', createdAt: '2026-09-01T10:05:00Z', replyCount: 0, reactionCounts: { laugh: 0, cry: 0, cheer: 0 }, viewerReactions: [], viewerTripleUsed: false };
  else if (pathNoQuery.includes('/comments') && init?.method === 'POST') {
    seedCommentCounter++;
    payload = { id: `seed-root-${seedCommentCounter}`, rootCommentId: null, authorName: 'author', body: 'seed root', status: 'published', createdAt: '2026-09-01T10:00:00Z', replyCount: 0, reactionCounts: { laugh: 0, cry: 0, cheer: 0 }, viewerReactions: [], viewerTripleUsed: false };
  }
  else if (pathNoQuery.includes('/comments')) payload = commentsFixture;
  else if (pathNoQuery === '/v1/local/reset') payload = { message: 'ok' };
  const text = () => Promise.resolve(JSON.stringify(payload));
  const json = () => Promise.resolve(payload);
  return { ok: true, status: 200, text, json } as Response;
}));

const { default: Lab } = await import('../src/main.js');

function renderLab(container: HTMLElement): Root {
  const root = createRoot(container);
  act(() => { root.render(<Lab />); });
  return root;
}

function click(button: HTMLButtonElement): void {
  act(() => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('i18n dictionary', () => {
  it('keeps every locale keyed identically', () => {
    expect(locales).toEqual(['zh', 'en']);
    const zhKeys = Object.keys(translations.zh) as TranslationKey[];
    for (const locale of locales) {
      expect(Object.keys(translations[locale]).sort()).toEqual([...zhKeys].sort());
    }
    expect(defaultLocale).toBe('zh');
  });

  it('translates each key in both locales', () => {
    for (const key of Object.keys(translations.zh) as TranslationKey[]) {
      expect(createT('zh')(key)).toBe(translations.zh[key]);
      expect(createT('en')(key)).toBe(translations.en[key]);
      expect(createT('zh')(key)).not.toBe('');
    }
  });

  it('resolves stored locale preferences with a Chinese fallback', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('zh')).toBe('zh');
    expect(resolveLocale('fr')).toBe('zh');
    expect(resolveLocale(null)).toBe('zh');
    expect(resolveLocale(undefined)).toBe('zh');
  });

  it('ships five parallel guide steps per locale', () => {
    expect(guide.zh).toHaveLength(5);
    expect(guide.en).toHaveLength(5);
    expect(guide.zh.map((step) => step.title)).toEqual(['登入操作員', '建立或選擇應用', '取得用戶 token', '發佈與查看留言', '完全重置（危險操作）']);
    expect(guide.en.map((step) => step.title)).toEqual(['Sign in operator', 'Create or select an application', 'Issue a member token', 'Post and list comments', 'Full reset (dangerous)']);
  });
});

describe('Lab language switching', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="lab"></div>';
    container = document.getElementById('lab')!;
    getItem.mockReturnValue(null);
    setItem.mockClear();
  });

  it('defaults to Traditional Chinese with the guide hidden', () => {
    renderLab(container);
    expect(container.textContent).toContain('使用指南');
    expect(container.textContent).toContain('身份與應用');
    expect(container.textContent).toContain('發給我 token');
    expect(container.textContent).not.toContain('User guide');
    expect(container.querySelector('.user-radios')).toBeTruthy();
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(8);
    expect(container.textContent).not.toContain('獨立的留言空間');
  });

  it('switches to English, persists it, and switches back', () => {
    renderLab(container);
    const enButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'EN')!;
    click(enButton);
    expect(container.textContent).toContain('User guide');
    expect(container.textContent).toContain('Identity & application');
    expect(setItem).toHaveBeenCalledWith('comment-lab-locale', 'en');
    const zhButton = [...container.querySelectorAll('button')].find((button) => button.textContent === '中文')!;
    click(zhButton);
    expect(container.textContent).toContain('使用指南');
    expect(setItem).toHaveBeenCalledWith('comment-lab-locale', 'zh');
  });

  it('restores a persisted English preference', () => {
    getItem.mockReturnValue('en');
    renderLab(container);
    expect(container.textContent).toContain('User guide');
  });

  it('falls back to Chinese for unknown stored values', () => {
    getItem.mockReturnValue('fr');
    renderLab(container);
    expect(container.textContent).toContain('使用指南');
  });

  it('collapses and reopens the guide', () => {
    renderLab(container);
    const showButton = [...container.querySelectorAll('button')].find((button) => button.textContent === '顯示指南')!;
    click(showButton);
    expect(container.textContent).toContain('獨立的留言空間');
    const hideButton = [...container.querySelectorAll('button')].find((button) => button.textContent === '隱藏指南')!;
    click(hideButton);
    expect(container.textContent).not.toContain('獨立的留言空間');
  });

  it('renders radio buttons for all simulated users', () => {
    renderLab(container);
    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(8);
    const labels = [...radios].map((r) => r.getAttribute('value'));
    expect(labels).toContain('author');
    expect(labels).toContain('new-user');
  });

  it('shows a viewer badge warning when no token is issued', () => {
    renderLab(container);
    const badge = container.querySelector('.viewer-badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toContain('尚未發出 token');
  });
});

describe('Lab comment board interactions', () => {
  let container: HTMLElement;

  const rootComment = { id: 'root-1', rootCommentId: null, authorName: 'author', body: '第一則留言', status: 'published', createdAt: '2026-09-01T10:00:00Z', replyCount: 1, reactionCounts: { laugh: 2, cry: 0, cheer: 0 }, viewerReactions: [], viewerTripleUsed: false };
  const childComment = { id: 'reply-1', rootCommentId: 'root-1', authorName: 'reactor', body: '第一則回覆', status: 'published', createdAt: '2026-09-01T10:01:00Z', replyCount: 0, reactionCounts: { laugh: 0, cry: 0, cheer: 0 }, viewerReactions: [], viewerTripleUsed: false };

  beforeEach(() => {
    document.body.innerHTML = '<div id="lab"></div>';
    container = document.getElementById('lab')!;
    fetchCalls.length = 0;
    commentsFixture = { items: [rootComment] };
    branchFixture = { items: [childComment] };
    reactionFixture = { counts: { laugh: 0, cry: 0, cheer: 0 }, active: [], tripleUsed: false };
  });

  function findButton(label: string): HTMLButtonElement {
    return ([...container.querySelectorAll('button')] as HTMLButtonElement[]).find((button) => button.textContent?.startsWith(label))!;
  }

  async function signInAndLoadBoard(): Promise<void> {
    renderLab(container);
    await act(async () => { click(findButton('登入操作員')); });
    await act(async () => { click(findButton('發給我 token')); });
    await act(async () => { click(findButton('查看留言')); });
  }

  it('renders the comment board with status badges and reply controls', async () => {
    await signInAndLoadBoard();
    expect(container.textContent).toContain('第一則留言');
    expect(container.querySelector('.comment')).toBeTruthy();
    expect(findButton('回覆')).toBeTruthy();
    expect(container.textContent).toContain('😂 2');
  });

  it('loads replies as a nested thread', async () => {
    await signInAndLoadBoard();
    expect(container.textContent).toContain('查看 1 則回覆');
    expect(container.querySelector('.reply')).toBeFalsy();
    const toggleBtn = findButton('查看 1 則回覆');
    await act(async () => { click(toggleBtn); });
    expect(container.textContent).toContain('第一則回覆');
    expect(container.querySelector('.reply')).toBeTruthy();
    const branchCall = fetchCalls.find((call) => call.path.includes('/branch'));
    expect(branchCall).toBeTruthy();
  });

  it('toggles an emoji reaction via PUT', async () => {
    await signInAndLoadBoard();
    fetchCalls.length = 0;
    reactionFixture = { counts: { laugh: 3, cry: 0, cheer: 0 }, active: ['laugh'], tripleUsed: false };
    const laughButton = ([...container.querySelectorAll('button.emoji')] as HTMLButtonElement[]).find((button) => button.textContent?.includes('😂'))!;
    await act(async () => { click(laughButton); });
    const reactionCall = fetchCalls.find((call) => call.path.includes('/reactions/laugh'));
    expect(reactionCall?.method).toBe('PUT');
    expect(container.textContent).toContain('😂 3');
    expect(laughButton.classList.contains('active')).toBe(true);
  });

  it('fires the triple reaction via POST and disables afterwards', async () => {
    await signInAndLoadBoard();
    fetchCalls.length = 0;
    reactionFixture = { counts: { laugh: 1, cry: 1, cheer: 1 }, active: ['laugh', 'cry', 'cheer'], tripleUsed: true };
    const tripleButton = findButton('3連');
    await act(async () => { click(tripleButton); });
    const tripleCall = fetchCalls.find((call) => call.path.includes('/triple-reaction'));
    expect(tripleCall?.method).toBe('POST');
    expect(container.textContent).toContain('🎉 1');
    expect(findButton('3連').disabled).toBe(true);
  });

  it('switches the composer into reply mode and posts to the replies endpoint', async () => {
    await signInAndLoadBoard();
    fetchCalls.length = 0;
    await act(async () => { click(findButton('回覆')); });
    expect(container.textContent).toContain('回覆給：');
    const textarea = container.querySelector('textarea')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, '回覆內容');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { click(findButton('發佈回覆')); });
    const replyCall = fetchCalls.find((call) => call.path.includes('/comments/root-1/replies'));
    expect(replyCall?.method).toBe('POST');
    expect(replyCall?.body).toContain('回覆內容');
    expect(container.textContent).not.toContain('回覆給：');
  });

  it('cancels reply mode without posting', async () => {
    await signInAndLoadBoard();
    await act(async () => { click(findButton('回覆')); });
    expect(container.textContent).toContain('回覆給：');
    await act(async () => { click(findButton('取消回覆')); });
    expect(container.textContent).not.toContain('回覆給：');
  });

  it('opens the report dialog and submits a report, hiding the comment after refresh', async () => {
    await signInAndLoadBoard();
    fetchCalls.length = 0;
    await act(async () => { click(findButton('檢舉')); });
    expect(container.textContent).toContain('檢舉原因');
    await act(async () => { click(findButton('送出檢舉')); });
    const reportCall = fetchCalls.find((call) => call.path.includes('/reports'));
    expect(reportCall?.method).toBe('POST');
    expect(reportCall?.body).toContain('"reasonCategory":"spam"');
  });

  it('cancels the report dialog without submitting', async () => {
    await signInAndLoadBoard();
    fetchCalls.length = 0;
    await act(async () => { click(findButton('檢舉')); });
    await act(async () => { click(findButton('取消檢舉')); });
    expect(fetchCalls.find((call) => call.path.includes('/reports'))).toBeUndefined();
    expect(container.textContent).not.toContain('檢舉原因');
  });
});

describe('Lab post comment modal', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="lab"></div>';
    container = document.getElementById('lab')!;
    fetchCalls.length = 0;
    commentsFixture = { items: [] };
    branchFixture = { items: [] };
    reactionFixture = { counts: { laugh: 0, cry: 0, cheer: 0 }, active: [], tripleUsed: false };
  });

  function findButton(label: string): HTMLButtonElement {
    return ([...container.querySelectorAll('button')] as HTMLButtonElement[]).find((button) => button.textContent?.startsWith(label))!;
  }

  async function signInAndLoadBoard(): Promise<void> {
    renderLab(container);
    await act(async () => { click(findButton('登入操作員')); });
    await act(async () => { click(findButton('發給我 token')); });
  }

  it('shows a success modal after posting a comment', async () => {
    await signInAndLoadBoard();
    const textarea = container.querySelector('textarea')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, '測試留言');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { click(findButton('發佈留言')); });
    expect(container.textContent).toContain('留言發佈成功！');
  });

  it('closes the modal when the close button is clicked', async () => {
    await signInAndLoadBoard();
    const textarea = container.querySelector('textarea')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, '測試留言');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { click(findButton('發佈留言')); });
    expect(container.textContent).toContain('留言發佈成功！');
    await act(async () => { click(findButton('關閉')); });
    expect(container.textContent).not.toContain('留言發佈成功！');
  });
});

describe('Lab comment board visibility (sidebar vs inline)', () => {
  let container: HTMLElement;

  const rootComment = { id: 'root-1', rootCommentId: null, authorName: 'author', body: '第一則留言', status: 'published', createdAt: '2026-09-01T10:00:00Z', replyCount: 0, reactionCounts: { laugh: 0, cry: 0, cheer: 0 }, viewerReactions: [], viewerTripleUsed: false };

  beforeEach(() => {
    document.body.innerHTML = '<div id="lab"></div>';
    container = document.getElementById('lab')!;
    fetchCalls.length = 0;
    commentsFixture = { items: [rootComment] };
    branchFixture = { items: [] };
    reactionFixture = { counts: { laugh: 0, cry: 0, cheer: 0 }, active: [], tripleUsed: false };
  });

  function findButton(label: string): HTMLButtonElement {
    return ([...container.querySelectorAll('button')] as HTMLButtonElement[]).find((button) => button.textContent?.startsWith(label))!;
  }

  async function signInAndLoadBoard(): Promise<void> {
    renderLab(container);
    await act(async () => { click(findButton('登入操作員')); });
    await act(async () => { click(findButton('發給我 token')); });
    await act(async () => { click(findButton('查看留言')); });
  }

  it('renders the comment-sidebar element in the DOM', async () => {
    await signInAndLoadBoard();
    const sidebar = container.querySelector('.comment-sidebar');
    expect(sidebar).toBeTruthy();
    expect(sidebar!.textContent).toContain('第一則留言');
  });

  it('renders the inline comment-board element in the DOM', async () => {
    await signInAndLoadBoard();
    const board = container.querySelector('.comment-board');
    expect(board).toBeTruthy();
    expect(board!.textContent).toContain('第一則留言');
  });

  it('both sidebar and inline board show the same comments', async () => {
    await signInAndLoadBoard();
    const sidebarComments = container.querySelectorAll('.comment-sidebar .comment');
    const boardComments = container.querySelectorAll('.comment-board .comment');
    expect(sidebarComments.length).toBe(1);
    expect(boardComments.length).toBe(1);
  });
});

describe('Lab seed data generation', () => {
  let container: HTMLElement;

  const rootComment = { id: 'root-1', rootCommentId: null, authorName: 'author', body: '第一則留言', status: 'published', createdAt: '2026-09-01T10:00:00Z', replyCount: 0, reactionCounts: { laugh: 0, cry: 0, cheer: 0 }, viewerReactions: [], viewerTripleUsed: false };

  beforeEach(() => {
    document.body.innerHTML = '<div id="lab"></div>';
    container = document.getElementById('lab')!;
    fetchCalls.length = 0;
    seedCommentCounter = 0;
    commentsFixture = { items: [rootComment] };
    branchFixture = { items: [] };
    reactionFixture = { counts: { laugh: 0, cry: 0, cheer: 0 }, active: [], tripleUsed: false };
  });

  function findButton(label: string): HTMLButtonElement {
    return ([...container.querySelectorAll('button')] as HTMLButtonElement[]).find((button) => button.textContent?.startsWith(label))!;
  }

  async function signInAndLoadBoard(): Promise<void> {
    renderLab(container);
    await act(async () => { click(findButton('登入操作員')); });
    await act(async () => { click(findButton('發給我 token')); });
    await act(async () => { click(findButton('查看留言')); });
  }

  it('shows the seed data button', async () => {
    await signInAndLoadBoard();
    expect(findButton('生成種子資料')).toBeTruthy();
  });

  it('posts root comments and replies from different users when clicked', async () => {
    await signInAndLoadBoard();
    fetchCalls.length = 0;
    await act(async () => { click(findButton('生成種子資料')); });
    const memberTokenCalls = fetchCalls.filter((call) => call.path === '/v1/local/auth/member/token');
    expect(memberTokenCalls.length).toBe(8);
    const rootPostCalls = fetchCalls.filter((call) => call.path.includes('/comments') && !call.path.includes('/replies') && call.method === 'POST' && call.path.includes('/articles/'));
    expect(rootPostCalls.length).toBe(4);
    const replyPostCalls = fetchCalls.filter((call) => call.path.includes('/replies') && call.method === 'POST');
    expect(replyPostCalls.length).toBe(3);
  });

  it('shows a success modal after seeding', async () => {
    await signInAndLoadBoard();
    await act(async () => { click(findButton('生成種子資料')); });
    expect(container.textContent).toContain('已生成種子留言與回覆');
  });

  it('refreshes the comment list after seeding', async () => {
    await signInAndLoadBoard();
    fetchCalls.length = 0;
    await act(async () => { click(findButton('生成種子資料')); });
    const listCall = fetchCalls.find((call) => call.method === 'GET' && call.path.includes('/comments'));
    expect(listCall).toBeTruthy();
  });
});
