import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const gatewayBaseUrl = process.env.E2E_GATEWAY_BASE_URL ?? 'http://localhost:8000';

describe('console moderation API', () => {
  it('US-34: lists and transitions pending comments only within the selected application', async () => {
    const operatorResponse = await fetch(`${gatewayBaseUrl}/v1/local/auth/operator/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'operator', password: 'change-me-local-only' })
    });
    const operatorToken = (await operatorResponse.json() as { accessToken: string }).accessToken;
    const createResponse = await fetch(`${gatewayBaseUrl}/v1/console/applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` }, body: JSON.stringify({ name: 'Moderation E2E', slug: `moderation-${Date.now()}` })
    });
    const application = await createResponse.json() as { key: string };
    const commentIds = [`pending-${Date.now()}-one`.padEnd(26, '0'), `pending-${Date.now()}-two`.padEnd(26, '0')];
    const values = commentIds.map((commentId, index) => `('${commentId}', 'article', 'local-author', 'Author', 'https://example.test/avatar.png', 'Pending ${index + 1}', 'pending')`).join(', ');
    execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'comment', '-d', 'comment', '-v', 'ON_ERROR_STOP=1', '-c', `INSERT INTO comments (id, application_id, article_key, author_id, author_name, author_avatar_url, body, status) SELECT pending.id, application.id, pending.article_key, pending.author_id, pending.author_name, pending.author_avatar_url, pending.body, pending.status FROM applications application CROSS JOIN (VALUES ${values}) AS pending(id, article_key, author_id, author_name, author_avatar_url, body, status) WHERE application.key = '${application.key}'`]);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}`, 'X-Application-Key': application.key };
    const pendingResponse = await fetch(`${gatewayBaseUrl}/v1/console/moderation/pending`, { headers });
    expect(pendingResponse.status).toBe(200);
    await expect(pendingResponse.json()).resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ id: commentIds[0], status: 'pending' }), expect.objectContaining({ id: commentIds[1], status: 'pending' })]), total: 2 });
    expect((await fetch(`${gatewayBaseUrl}/v1/console/moderation/comments/${commentIds[0]}/approve`, { method: 'POST', headers })).status).toBe(204);
    expect((await fetch(`${gatewayBaseUrl}/v1/console/moderation/comments/${commentIds[1]}/reject`, { method: 'POST', headers, body: JSON.stringify({ rejectionCode: 'spam' }) })).status).toBe(204);
    const commentsResponse = await fetch(`${gatewayBaseUrl}/v1/console/comments?pageSize=50`, { headers });
    await expect(commentsResponse.json()).resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ id: commentIds[0], status: 'published' }), expect.objectContaining({ id: commentIds[1], status: 'rejected' })]) });
  });
});