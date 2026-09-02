export type Locale = 'zh' | 'en';

export const locales: readonly Locale[] = ['zh', 'en'];
export const defaultLocale: Locale = 'zh';

export const localeLabels: Record<Locale, string> = { zh: '中文', en: 'EN' };

const zh = {
  tagline: '本地 Kong 用戶端',
  identityPanelTitle: '身份與應用',
  guideTitle: '使用指南',
  guideHide: '隱藏指南',
  guideShow: '顯示指南',
  signInOperator: '登入操作員',
  refreshApps: '重新整理應用',
  fullReset: '完全重置',
  applicationName: '應用名稱',
  applicationSlug: '應用 slug（例：news-site）',
  createApp: '建立應用',
  application: '應用',
  selectApplication: '選擇應用',
  simulatedUser: '模擬用戶',
  issueToken: '發給我 token',
  comments: '留言',
  articleKey: '文章 key',
  commentBody: '留言內容',
  postComment: '發佈留言',
  listComments: '查看留言',
  commentBoard: '留言列表',
  reply: '回覆',
  postReply: '發佈回覆',
  cancelReply: '取消回覆',
  replyingTo: '回覆給：',
  triple: '3連',
  report: '檢舉',
  reportOwnComment: '無法檢舉自己的留言',
  reportReason: '檢舉原因',
  reportSubmit: '送出檢舉',
  reportCancel: '取消檢舉',
  reportDone: '已檢舉。該留言及其子留言已隱藏（僅對你隱藏）。',
  reportedAlready: '你已檢舉過這則留言。',
  noComments: '尚無留言。發佈第一則，或按「查看留言」重新整理。',
  response: 'API 回應',
  ready: '就緒。先以本地操作員登入，建立或選擇應用，再取得用戶 token。',
  confirmReset: '這會刪除所有應用、留言與資料，並重建資料庫 schema。確定繼續？',
  resetDone: '本地環境已重置。請重新登入操作員並建立應用。',
  viewingAs: '目前視角：{user}',
  switchedUser: '已切換用戶，請重新按「發給我 token」',
  noTokenWarning: '尚未發出 token — 請先按「發給我 token」',
  postSuccess: '留言發佈成功！',
  postSuccessReply: '回覆發佈成功！',
  postFailed: '留言發佈失敗',
  postFailedReply: '回覆發佈失敗',
  modalClose: '關閉',
  modalErrorReason: '原因',
  commentSidebar: '留言列表',
  seedData: '生成種子資料',
  seedDone: '已生成種子留言與回覆，來自不同用戶。',
  seedFailed: '種子資料生成失敗',
  viewReplies: '查看 {count} 則回覆',
  collapseReplies: '收起回覆'
} as const;

export type TranslationKey = keyof typeof zh;

const en: Record<TranslationKey, string> = {
  tagline: 'Local Kong client',
  identityPanelTitle: 'Identity & application',
  guideTitle: 'User guide',
  guideHide: 'Hide guide',
  guideShow: 'Show guide',
  signInOperator: 'Sign in operator',
  refreshApps: 'Refresh apps',
  fullReset: 'Full reset',
  applicationName: 'Application name',
  applicationSlug: 'application-slug (e.g. news-site)',
  createApp: 'Create app',
  application: 'Application',
  selectApplication: 'Select an application',
  simulatedUser: 'Simulated user',
  issueToken: 'Issue member token',
  comments: 'Comments',
  articleKey: 'Article key',
  commentBody: 'Comment',
  postComment: 'Post comment',
  listComments: 'List comments',
  commentBoard: 'Comment board',
  reply: 'Reply',
  postReply: 'Post reply',
  cancelReply: 'Cancel reply',
  replyingTo: 'Replying to:',
  triple: 'Triple',
  report: 'Report',
  reportOwnComment: 'Cannot report your own comment',
  reportReason: 'Report reason',
  reportSubmit: 'Submit report',
  reportCancel: 'Cancel report',
  reportDone: 'Reported. That comment and its replies are now hidden (for you only).',
  reportedAlready: 'You already reported this comment.',
  noComments: 'No comments yet. Post the first one, or press "List comments" to refresh.',
  response: 'API response',
  ready: 'Ready. Sign in as the local operator, create or select an application, then issue a member token.',
  confirmReset: 'This deletes ALL applications, comments, and data, then recreates the database schema. Continue?',
  resetDone: 'Local environment reset. Sign in again and create an application.',
  viewingAs: 'Viewing as: {user}',
  switchedUser: 'User switched — press "Issue member token" again',
  noTokenWarning: 'No token issued — press "Issue member token" first',
  postSuccess: 'Comment posted successfully!',
  postSuccessReply: 'Reply posted successfully!',
  postFailed: 'Failed to post comment',
  postFailedReply: 'Failed to post reply',
  modalClose: 'Close',
  modalErrorReason: 'Reason',
  commentSidebar: 'Comments',
  seedData: 'Generate seed data',
  seedDone: 'Seed comments and replies generated from different users.',
  seedFailed: 'Failed to generate seed data',
  viewReplies: 'View {count} replies',
  collapseReplies: 'Collapse replies'
};

export const translations: Record<Locale, Record<TranslationKey, string>> = { zh, en };

export function createT(locale: Locale): (key: TranslationKey) => string {
  return (key: TranslationKey): string => translations[locale][key];
}

/** Resolves a persisted locale preference, falling back to the default (Traditional Chinese). */
export function resolveLocale(stored: string | null | undefined): Locale {
  return stored === 'en' || stored === 'zh' ? stored : defaultLocale;
}

export interface GuideStep { title: string; body: string; }

export const guide: Record<Locale, GuideStep[]> = {
  zh: [
    {
      title: '登入操作員',
      body: '按「登入操作員」，以本地預設帳號（operator / change-me-local-only）取得管理權限。建立應用、重新整理列表與完全重置都需要操作員身份；token 會自動保留在本次工作階段。'
    },
    {
      title: '建立或選擇應用',
      body: '每個應用都是獨立的留言空間（各自的金鑰、敏感詞與設定）。輸入名稱與 slug（小寫字母與連字號、至少 3 個字元）後按「建立應用」，或從「應用」下拉選單選擇既有應用。'
    },
    {
      title: '取得用戶 token',
      body: '在「模擬用戶」選擇要扮演的身份（author、reactor、reporter-one～five、new-user），再按「發給我 token」。之後的留言請求都會以該用戶身份送出；切換不同用戶可以觀察權限與審核行為。'
    },
    {
      title: '發佈與查看留言',
      body: '填入文章 key（同一篇文章必須使用同一個 key），撰寫內容後按「發佈留言」，下方列表會即時顯示留言與回覆。在留言上按「回覆」可撰寫子留言；😂/😭/🎉 按鈕可加入或取消表情反應，「3連」一次送出三個表情（每帳號限一次）；「檢舉」可檢舉他人的留言——檢舉後該留言（含子留言）會對你完全隱藏，但其他人仍看得到。每個請求的完整 API 回應都會顯示在回應區。'
    },
    {
      title: '完全重置（危險操作）',
      body: '「完全重置」會刪除所有應用、留言與資料，並重建資料庫 schema，適合需要乾淨環境重新開始時使用；執行前會再要求確認。'
    }
  ],
  en: [
    {
      title: 'Sign in operator',
      body: 'Press "Sign in operator" to authenticate with the seeded local account (operator / change-me-local-only). Creating applications, refreshing the list, and the full reset all require the operator identity; the token is kept for this session automatically.'
    },
    {
      title: 'Create or select an application',
      body: 'Each application is an isolated comment space (own key, sensitive words, and settings). Enter a name and a slug (lowercase letters and hyphens, at least 3 characters) and press "Create app", or pick an existing application from the "Application" dropdown.'
    },
    {
      title: 'Issue a member token',
      body: 'Choose the identity to simulate under "Simulated user" (author, reactor, reporter-one…five, new-user), then press "Issue member token". Every comment request is sent as that user; switch users to observe permissions and moderation behaviour.'
    },
    {
      title: 'Post and list comments',
      body: 'Set the article key (the same article must use the same key), write the comment, and press "Post comment" — the board below refreshes with roots and replies. Press "Reply" on a comment to compose a sub-comment; the 😂/😭/🎉 buttons toggle emoji reactions, "Triple" fires all three at once (once per account); "Report" reports someone else\'s comment — once reported, that comment (and its replies) is hidden entirely for you, while others still see it. The full API response for each request appears in the response panel below.'
    },
    {
      title: 'Full reset (dangerous)',
      body: '"Full reset" deletes ALL applications, comments, and data, then recreates the database schema. Use it when you want a clean slate; it asks for confirmation before running.'
    }
  ]
};
