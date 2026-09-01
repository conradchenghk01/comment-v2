import { describe, expect, it } from 'vitest';

const gatewayBaseUrl = process.env.E2E_GATEWAY_BASE_URL ?? 'http://localhost:8000';

interface MemberTokenResponse { accessToken: string; }

async function operatorLogin(): Promise<string> {
  const response = await fetch(`${gatewayBaseUrl}/v1/local/auth/operator/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'operator', password: 'change-me-local-only' })
  });
  return (await response.json() as { accessToken: string }).accessToken;
}

async function memberToken(user: string): Promise<string> {
  const response = await fetch(`${gatewayBaseUrl}/v1/local/auth/member/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user })
  });
  return (await response.json() as MemberTokenResponse).accessToken;
}

describe('content moderation flow', () => {
  it('US-14/US-6/US-7: routes sensitive-word hits to pending, hides them from others, and exposes rejectionCode to the author', async () => {
    const operatorToken = await operatorLogin();
    const createResponse = await fetch(`${gatewayBaseUrl}/v1/console/applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` }, body: JSON.stringify({ name: 'Moderation Flow E2E', slug: `moderation-flow-${Date.now()}` })
    });
    const application = await createResponse.json() as { key: string };
    const consoleHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}`, 'X-Application-Key': application.key };

    // Enable Yidun moderation for this application and register a sensitive word.
    expect((await fetch(`${gatewayBaseUrl}/v1/console/settings`, { method: 'PUT', headers: consoleHeaders, body: JSON.stringify({ commentIntervalSeconds: 0, yidunModerationEnabled: true }) })).status).toBe(200);
    expect((await fetch(`${gatewayBaseUrl}/v1/console/sensitive-words`, { method: 'POST', headers: consoleHeaders, body: JSON.stringify({ word: 'forbidden' }) })).status).toBe(201);

    const authorToken = await memberToken('author');
    const reactorToken = await memberToken('reactor');
    const memberHeaders = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Application-Key': application.key });

    // US-14: a comment containing the sensitive word is created as pending.
    const flaggedResponse = await fetch(`${gatewayBaseUrl}/v1/articles/moderation-article/comments`, {
      method: 'POST', headers: memberHeaders(authorToken), body: JSON.stringify({ body: 'This mentions forbidden content' })
    });
    expect(flaggedResponse.status).toBe(201);
    const flagged = await flaggedResponse.json() as { id: string; status: string };
    expect(flagged.status).toBe('pending');

    // A clean comment is published immediately.
    const cleanResponse = await fetch(`${gatewayBaseUrl}/v1/articles/moderation-article/comments`, {
      method: 'POST', headers: memberHeaders(authorToken), body: JSON.stringify({ body: 'A perfectly clean comment' })
    });
    expect(cleanResponse.status).toBe(201);
    const clean = await cleanResponse.json() as { id: string; status: string };
    expect(clean.status).toBe('published');

    // US-6: the author sees their own pending comment.
    const authorListResponse = await fetch(`${gatewayBaseUrl}/v1/articles/moderation-article/comments?sort=newest`, { headers: memberHeaders(authorToken) });
    const authorList = await authorListResponse.json() as { items: Array<{ id: string; status: string; rejectionCode: string | null }> };
    expect(authorList.items.map((item) => item.id)).toContain(flagged.id);
    expect(authorList.items.find((item) => item.id === flagged.id)?.status).toBe('pending');

    // Other members do not see the pending comment.
    const reactorListResponse = await fetch(`${gatewayBaseUrl}/v1/articles/moderation-article/comments?sort=newest`, { headers: memberHeaders(reactorToken) });
    const reactorList = await reactorListResponse.json() as { items: Array<{ id: string }> };
    expect(reactorList.items.map((item) => item.id)).not.toContain(flagged.id);
    expect(reactorList.items.map((item) => item.id)).toContain(clean.id);

    // The operator rejects the pending comment with a rejection code.
    expect((await fetch(`${gatewayBaseUrl}/v1/console/moderation/comments/${flagged.id}/reject`, { method: 'POST', headers: consoleHeaders, body: JSON.stringify({ rejectionCode: 'violates_guidelines' }) })).status).toBe(204);

    // US-7: the author sees the rejected comment with its rejection code.
    const afterRejectResponse = await fetch(`${gatewayBaseUrl}/v1/articles/moderation-article/comments?sort=newest`, { headers: memberHeaders(authorToken) });
    const afterReject = await afterRejectResponse.json() as { items: Array<{ id: string; status: string; rejectionCode: string | null }> };
    const rejected = afterReject.items.find((item) => item.id === flagged.id);
    expect(rejected?.status).toBe('rejected');
    expect(rejected?.rejectionCode).toBe('violates_guidelines');

    // Other members still do not see the rejected comment.
    const reactorAfterReject = await fetch(`${gatewayBaseUrl}/v1/articles/moderation-article/comments?sort=newest`, { headers: memberHeaders(reactorToken) });
    const reactorAfterRejectList = await reactorAfterReject.json() as { items: Array<{ id: string }> };
    expect(reactorAfterRejectList.items.map((item) => item.id)).not.toContain(flagged.id);

    // The approve path publishes a second pending comment.
    const secondFlaggedResponse = await fetch(`${gatewayBaseUrl}/v1/articles/moderation-article/comments`, {
      method: 'POST', headers: memberHeaders(authorToken), body: JSON.stringify({ body: 'Another forbidden mention' })
    });
    const secondFlagged = await secondFlaggedResponse.json() as { id: string; status: string };
    expect(secondFlagged.status).toBe('pending');
    expect((await fetch(`${gatewayBaseUrl}/v1/console/moderation/comments/${secondFlagged.id}/approve`, { method: 'POST', headers: consoleHeaders })).status).toBe(204);
    const reactorAfterApprove = await fetch(`${gatewayBaseUrl}/v1/articles/moderation-article/comments?sort=newest`, { headers: memberHeaders(reactorToken) });
    const reactorAfterApproveList = await reactorAfterApprove.json() as { items: Array<{ id: string }> };
    expect(reactorAfterApproveList.items.map((item) => item.id)).toContain(secondFlagged.id);
  });
});
