import { beforeAll, describe, expect, it } from 'vitest';

const gatewayBaseUrl = process.env.E2E_GATEWAY_BASE_URL ?? 'http://localhost:8000';

async function waitForGateway(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${gatewayBaseUrl}/v1/health`).catch(() => undefined);
    if (response?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Kong gateway did not become ready');
}

describe('Kong gateway', () => {
  it('US-platform: forwards the service health endpoint', async () => {
    await waitForGateway();
    const response = await fetch(`${gatewayBaseUrl}/v1/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', environment: 'local' });
  });

  it('US-local-auth: permits seeded member-token issuance only in local', async () => {
    const response = await fetch(`${gatewayBaseUrl}/v1/local/auth/member/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'author' })
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ accessToken: expect.any(String) });
  });
});

describe('application API', () => {
  let operatorToken: string;

  beforeAll(async () => {
    await waitForGateway();
    const response = await fetch(`${gatewayBaseUrl}/v1/local/auth/operator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'operator', password: 'change-me-local-only' })
    });
    expect(response.status).toBe(201);
    operatorToken = (await response.json() as { accessToken: string }).accessToken;
  });

  it('US-0/0b/0c/0d: creates, lists, renames, disables, and re-enables an isolated application', async () => {
    const slug = `e2e-${Date.now()}`;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` };
    const createResponse = await fetch(`${gatewayBaseUrl}/v1/console/applications`, {
      method: 'POST', headers, body: JSON.stringify({ name: 'E2E application', slug })
    });
    expect(createResponse.status).toBe(201);
    const application = await createResponse.json() as { key: string; slug: string; status: string };
    expect(application).toMatchObject({ slug, status: 'active' });
    expect(application.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const settingsHeaders = { ...headers, 'X-Application-Key': application.key };
    const settingsResponse = await fetch(`${gatewayBaseUrl}/v1/console/settings`, { headers: settingsHeaders });
    expect(settingsResponse.status).toBe(200);
    await expect(settingsResponse.json()).resolves.toEqual({ commentIntervalSeconds: 60, dailyCommentLimit: 20, newUserCooldownHours: 24, yidunModerationEnabled: false, autoBanThresholdOne: 5, autoBanThresholdTwo: 10, autoBanThresholdThree: 20 });
    const updateSettingsResponse = await fetch(`${gatewayBaseUrl}/v1/console/settings`, { method: 'PUT', headers: settingsHeaders, body: JSON.stringify({ commentIntervalSeconds: 120, dailyCommentLimit: 10, newUserCooldownHours: 48 }) });
    expect(updateSettingsResponse.status).toBe(200);
    await expect(updateSettingsResponse.json()).resolves.toEqual({ commentIntervalSeconds: 120, dailyCommentLimit: 10, newUserCooldownHours: 48, yidunModerationEnabled: false, autoBanThresholdOne: 5, autoBanThresholdTwo: 10, autoBanThresholdThree: 20 });
    const sensitiveWordResponse = await fetch(`${gatewayBaseUrl}/v1/console/sensitive-words`, { method: 'POST', headers: settingsHeaders, body: JSON.stringify({ word: ' Example ' }) });
    expect(sensitiveWordResponse.status).toBe(201);
    const sensitiveWord = await sensitiveWordResponse.json() as { id: string; word: string };
    expect(sensitiveWord).toMatchObject({ word: 'example' });
    const sensitiveWordsResponse = await fetch(`${gatewayBaseUrl}/v1/console/sensitive-words`, { headers: settingsHeaders });
    await expect(sensitiveWordsResponse.json()).resolves.toEqual([expect.objectContaining({ id: sensitiveWord.id, word: 'example' })]);
    const duplicateWordResponse = await fetch(`${gatewayBaseUrl}/v1/console/sensitive-words`, { method: 'POST', headers: settingsHeaders, body: JSON.stringify({ word: 'EXAMPLE' }) });
    expect(duplicateWordResponse.status).toBe(409);
    await expect(duplicateWordResponse.json()).resolves.toMatchObject({ code: 'sensitive_word_exists' });
    expect((await fetch(`${gatewayBaseUrl}/v1/console/sensitive-words/${sensitiveWord.id}`, { method: 'DELETE', headers: settingsHeaders })).status).toBe(204);
    await expect((await fetch(`${gatewayBaseUrl}/v1/console/sensitive-words`, { headers: settingsHeaders })).json()).resolves.toEqual([]);

    const listResponse = await fetch(`${gatewayBaseUrl}/v1/console/applications`, { headers });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ key: application.key, slug })]));

    const updateResponse = await fetch(`${gatewayBaseUrl}/v1/console/applications/${application.key}`, {
      method: 'PATCH', headers, body: JSON.stringify({ name: 'Renamed application', status: 'disabled' })
    });
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({ name: 'Renamed application', status: 'disabled', slug });

    const enableResponse = await fetch(`${gatewayBaseUrl}/v1/console/applications/${application.key}`, {
      method: 'PATCH', headers, body: JSON.stringify({ status: 'active' })
    });
    expect(enableResponse.status).toBe(200);
    await expect(enableResponse.json()).resolves.toMatchObject({ status: 'active' });
  });
});

describe('public comments API', () => {
  it('US-10/1: creates a published root comment and lists it for its article', async () => {
    const operatorResponse = await fetch(`${gatewayBaseUrl}/v1/local/auth/operator/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'operator', password: 'change-me-local-only' })
    });
    const operatorToken = (await operatorResponse.json() as { accessToken: string }).accessToken;
    const slug = `comments-${Date.now()}`;
    const appResponse = await fetch(`${gatewayBaseUrl}/v1/console/applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` }, body: JSON.stringify({ name: 'Comments E2E', slug })
    });
    const application = await appResponse.json() as { key: string };
    const memberResponse = await fetch(`${gatewayBaseUrl}/v1/local/auth/member/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'author' }) });
    const memberToken = (await memberResponse.json() as { accessToken: string }).accessToken;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}`, 'X-Application-Key': application.key };
    const articleKey = `article-${Date.now()}`;
    const idempotencyKey = `comment-${Date.now()}`;
    const createResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ body: 'First comment' }) });
    expect(createResponse.status).toBe(201);
    const comment = await createResponse.json() as { id: string; status: string; body: string };
    expect(comment).toMatchObject({ status: 'published', body: 'First comment' });
    expect(comment.id).toHaveLength(26);
    const replayResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ body: 'First comment' }) });
    expect(replayResponse.status).toBe(201);
    await expect(replayResponse.json()).resolves.toMatchObject({ id: comment.id, body: 'First comment' });
    const operatorHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}`, 'X-Application-Key': application.key };
    const origin = 'https://comments.example.test';
    expect((await fetch(`${gatewayBaseUrl}/v1/console/origins`, { method: 'PUT', headers: operatorHeaders, body: JSON.stringify({ origin }) })).status).toBe(204);
    const allowedOriginResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { headers: { ...headers, Origin: origin } });
    expect(allowedOriginResponse.status).toBe(200);
    expect(allowedOriginResponse.headers.get('access-control-allow-origin')).toBe(origin);
    const preflightResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
    expect(preflightResponse.status).toBe(204);
    const rejectedOriginResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { headers: { ...headers, Origin: 'https://untrusted.example.test' } });
    expect(rejectedOriginResponse.status).toBe(403);
    await expect(rejectedOriginResponse.json()).resolves.toMatchObject({ code: 'origin_not_allowed' });
    const normalBlockResponse = await fetch(`${gatewayBaseUrl}/v1/console/users/local-author/block`, { method: 'PUT', headers: operatorHeaders, body: JSON.stringify({ mode: 'normal' }) });
    expect(normalBlockResponse.status).toBe(204);
    const blockedPostResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { method: 'POST', headers, body: JSON.stringify({ body: 'Blocked comment' }) });
    expect(blockedPostResponse.status).toBe(403);
    await expect(blockedPostResponse.json()).resolves.toMatchObject({ code: 'normal_blocked' });
    expect((await fetch(`${gatewayBaseUrl}/v1/console/users/local-author/block`, { method: 'DELETE', headers: operatorHeaders })).status).toBe(204);
    const intervalResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { method: 'POST', headers, body: JSON.stringify({ body: 'Too soon' }) });
    expect(intervalResponse.status).toBe(429);
    await expect(intervalResponse.json()).resolves.toMatchObject({ code: 'comment_interval_active', details: { retryAfterSeconds: expect.any(Number) } });
    const reactorTokenResponse = await fetch(`${gatewayBaseUrl}/v1/local/auth/member/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'reactor' }) });
    const reactorToken = (await reactorTokenResponse.json() as { accessToken: string }).accessToken;
    const reactorHeaders = { ...headers, Authorization: `Bearer ${reactorToken}` };
    const newUserTokenResponse = await fetch(`${gatewayBaseUrl}/v1/local/auth/member/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'new-user' }) });
    const newUserToken = (await newUserTokenResponse.json() as { accessToken: string }).accessToken;
    const newUserResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${newUserToken}` }, body: JSON.stringify({ body: 'New user comment' }) });
    expect(newUserResponse.status).toBe(429);
    await expect(newUserResponse.json()).resolves.toMatchObject({ code: 'new_user_cooldown_active' });
    const reactionResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${comment.id}/reactions/laugh`, { method: 'PUT', headers });
    expect(reactionResponse.status).toBe(200);
    await expect(reactionResponse.json()).resolves.toMatchObject({ counts: { laugh: 1 }, active: ['laugh'], tripleUsed: false });
    const tripleResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${comment.id}/triple-reaction`, { method: 'POST', headers });
    expect(tripleResponse.status).toBe(201);
    await expect(tripleResponse.json()).resolves.toMatchObject({ counts: { laugh: 1, cry: 1, cheer: 1 }, tripleUsed: true });
    const repeatedTriple = await fetch(`${gatewayBaseUrl}/v1/comments/${comment.id}/triple-reaction`, { method: 'POST', headers });
    expect(repeatedTriple.status).toBe(409);
    const listResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { headers });
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ id: comment.id, replyCount: 0, heat: 3 })]), nextCursor: null });

    const replyIdempotencyKey = `reply-${Date.now()}`;
    const replyResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${comment.id}/replies`, { method: 'POST', headers: { ...reactorHeaders, 'Idempotency-Key': replyIdempotencyKey }, body: JSON.stringify({ body: 'First reply' }) });
    expect(replyResponse.status).toBe(201);
    const reply = await replyResponse.json() as { id: string; rootCommentId: string };
    expect(reply.rootCommentId).toBe(comment.id);
    const replyReplayResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${comment.id}/replies`, { method: 'POST', headers: { ...reactorHeaders, 'Idempotency-Key': replyIdempotencyKey }, body: JSON.stringify({ body: 'First reply' }) });
    expect(replyReplayResponse.status).toBe(201);
    await expect(replyReplayResponse.json()).resolves.toMatchObject({ id: reply.id, rootCommentId: comment.id });
    const batchResponse = await fetch(`${gatewayBaseUrl}/v1/comments/batch`, { method: 'POST', headers, body: JSON.stringify({ articleKeys: [articleKey] }) });
    expect(batchResponse.status).toBe(201);
    await expect(batchResponse.json()).resolves.toMatchObject({ items: [{ articleKey, commentCount: 2, reactionCounts: { laugh: 1, cry: 1, cheer: 1 }, comments: [expect.objectContaining({ id: comment.id })] }] });
    const hotArticlesResponse = await fetch(`${gatewayBaseUrl}/v1/hot-articles`, { headers });
    expect(hotArticlesResponse.status).toBe(200);
    await expect(hotArticlesResponse.json()).resolves.toMatchObject({ items: [expect.objectContaining({ articleKey, commentCount: 2, reactionCount: 3, heat: 5 })] });
    for (const reporter of ['reporter-one', 'reporter-two', 'reporter-three', 'reporter-four', 'reporter-five']) {
      const reporterTokenResponse = await fetch(`${gatewayBaseUrl}/v1/local/auth/member/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: reporter }) });
      const reporterToken = (await reporterTokenResponse.json() as { accessToken: string }).accessToken;
      const reportResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${reply.id}/reports`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${reporterToken}` }, body: JSON.stringify({ reasonCategory: 'spam' }) });
      expect(reportResponse.status).toBe(204);
    }
    const autoBlockedResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { method: 'POST', headers: reactorHeaders, body: JSON.stringify({ body: 'Auto blocked comment' }) });
    expect(autoBlockedResponse.status).toBe(403);
    await expect(autoBlockedResponse.json()).resolves.toMatchObject({ code: 'normal_blocked' });
    const reportsResponse = await fetch(`${gatewayBaseUrl}/v1/console/reports?pageSize=50`, { headers: operatorHeaders });
    expect(reportsResponse.status).toBe(200);
    await expect(reportsResponse.json()).resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ commentId: reply.id, reportedAuthorId: 'local-reactor' })]), total: 5 });
    const autoBansResponse = await fetch(`${gatewayBaseUrl}/v1/console/auto-bans`, { headers: operatorHeaders });
    expect(autoBansResponse.status).toBe(200);
    await expect(autoBansResponse.json()).resolves.toMatchObject({ items: [expect.objectContaining({ memberId: 'local-reactor', mode: 'normal', triggerCount: 1 })], total: 1 });
    const auditLogsResponse = await fetch(`${gatewayBaseUrl}/v1/console/audit-logs?pageSize=50`, { headers: operatorHeaders });
    expect(auditLogsResponse.status).toBe(200);
    await expect(auditLogsResponse.json()).resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ action: 'user.auto_banned', targetType: 'user', targetId: 'local-reactor', metadata: { triggerCount: 1, reportCount: 5, mode: 'normal' } })]) });
    const usersResponse = await fetch(`${gatewayBaseUrl}/v1/console/users?pageSize=50`, { headers: operatorHeaders });
    expect(usersResponse.status).toBe(200);
    await expect(usersResponse.json()).resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ memberId: 'local-reactor', commentCount: 1, reportCount: 5, blockMode: 'normal' })]) });
    const userStatsResponse = await fetch(`${gatewayBaseUrl}/v1/console/users/local-reactor/stats`, { headers: operatorHeaders });
    expect(userStatsResponse.status).toBe(200);
    await expect(userStatsResponse.json()).resolves.toMatchObject({ memberId: 'local-reactor', commentCount: 1, reportCount: 5, blockMode: 'normal' });
    const branchResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${comment.id}/branch`, { headers });
    expect(branchResponse.status).toBe(200);
    await expect(branchResponse.json()).resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ id: reply.id, rootCommentId: comment.id })]), nextCursor: null });
    const muteResponse = await fetch(`${gatewayBaseUrl}/v1/users/local-reactor/mute`, { method: 'PUT', headers });
    expect(muteResponse.status).toBe(204);
    const mutedBranchResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${comment.id}/branch`, { headers });
    expect(mutedBranchResponse.status).toBe(200);
    await expect(mutedBranchResponse.json()).resolves.toEqual({ items: [], nextCursor: null });
    const unmuteResponse = await fetch(`${gatewayBaseUrl}/v1/users/local-reactor/mute`, { method: 'DELETE', headers });
    expect(unmuteResponse.status).toBe(204);
    const restoredBranchResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${comment.id}/branch`, { headers });
    await expect(restoredBranchResponse.json()).resolves.toMatchObject({ items: [expect.objectContaining({ id: reply.id })] });

    const secondMemberTokenResponse = await fetch(`${gatewayBaseUrl}/v1/local/auth/member/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'reporter-one' }) });
    const secondMemberToken = (await secondMemberTokenResponse.json() as { accessToken: string }).accessToken;
    const secondMemberHeaders = { ...headers, Authorization: `Bearer ${secondMemberToken}` };
    const secondCommentResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { method: 'POST', headers: secondMemberHeaders, body: JSON.stringify({ body: 'Second comment' }) });
    expect(secondCommentResponse.status).toBe(201);
    const secondComment = await secondCommentResponse.json() as { id: string };
    const reportResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${secondComment.id}/reports`, { method: 'POST', headers, body: JSON.stringify({ reasonCategory: 'spam' }) });
    expect(reportResponse.status).toBe(204);
    const duplicateReportResponse = await fetch(`${gatewayBaseUrl}/v1/comments/${secondComment.id}/reports`, { method: 'POST', headers, body: JSON.stringify({ reasonCategory: 'spam' }) });
    expect(duplicateReportResponse.status).toBe(409);
    const reportedListResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments?sort=oldest`, { headers });
    const reportedList = await reportedListResponse.json() as { items: Array<{ id: string }> };
    expect(reportedList.items).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: secondComment.id })]));
    const firstPageResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments?sort=oldest&limit=1`, { headers: secondMemberHeaders });
    expect(firstPageResponse.status).toBe(200);
    const firstPage = await firstPageResponse.json() as { items: Array<{ id: string }>; nextCursor: string };
    expect(firstPage.items).toEqual([expect.objectContaining({ id: comment.id })]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const secondPageResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments?sort=oldest&limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`, { headers: secondMemberHeaders });
    expect(secondPageResponse.status).toBe(200);
    await expect(secondPageResponse.json()).resolves.toMatchObject({ items: [expect.objectContaining({ id: secondComment.id })], nextCursor: null });

    const consoleHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}`, 'X-Application-Key': application.key };
    const searchResponse = await fetch(`${gatewayBaseUrl}/v1/console/comments?articleKey=${encodeURIComponent(articleKey)}&status=published`, { headers: consoleHeaders });
    expect(searchResponse.status).toBe(200);
    await expect(searchResponse.json()).resolves.toMatchObject({ page: 1, pageSize: 20, total: 3, items: expect.arrayContaining([expect.objectContaining({ id: comment.id, body: 'First comment' })]) });
    const deleteResponse = await fetch(`${gatewayBaseUrl}/v1/console/comments/${comment.id}`, { method: 'DELETE', headers: consoleHeaders });
    expect(deleteResponse.status).toBe(204);
    const deletedListResponse = await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments?sort=oldest`, { headers });
    expect(deletedListResponse.status).toBe(200);
    await expect(deletedListResponse.json()).resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ id: comment.id, status: 'deleted', body: '此評論已被 01 管理員刪除', replyCount: 1 })]) });
    const bulkUserDeleteResponse = await fetch(`${gatewayBaseUrl}/v1/console/comments/bulk-delete-by-user`, { method: 'POST', headers: consoleHeaders, body: JSON.stringify({ memberId: 'local-reporter-1' }) });
    expect(bulkUserDeleteResponse.status).toBe(201);
    await expect(bulkUserDeleteResponse.json()).resolves.toEqual({ deletedCount: 1 });
    const bulkArticleDeleteResponse = await fetch(`${gatewayBaseUrl}/v1/console/comments/bulk-delete-by-article`, { method: 'POST', headers: consoleHeaders, body: JSON.stringify({ articleKey }) });
    expect(bulkArticleDeleteResponse.status).toBe(201);
    await expect(bulkArticleDeleteResponse.json()).resolves.toEqual({ deletedCount: 1 });
    expect((await fetch(`${gatewayBaseUrl}/v1/console/users/local-author/block`, { method: 'PUT', headers: operatorHeaders, body: JSON.stringify({ mode: 'full' }) })).status).toBe(204);
    expect((await fetch(`${gatewayBaseUrl}/v1/articles/${articleKey}/comments`, { headers })).status).toBe(404);
    expect((await fetch(`${gatewayBaseUrl}/v1/console/users/local-author/block`, { method: 'DELETE', headers: operatorHeaders })).status).toBe(204);
  });
});