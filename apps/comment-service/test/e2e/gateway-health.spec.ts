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