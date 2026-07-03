// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserModel } from '@/database/models/user';

import { GET, POST } from './route';

vi.mock('@/database/models/user', () => ({
  UserModel: {
    deleteUserByEmail: vi.fn(),
    getUserDeletionPreview: vi.fn(),
  },
}));

const postJson = (body: unknown) => {
  return POST(
    new Request('http://localhost/api/dev/delete-user', {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
  );
};

const previewUser = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  email: 'user@example.com',
  emailVerified: true,
  id: 'auth-id',
  role: 'user',
  userId: 'business-id',
  username: 'demo',
};

const relatedCounts = {
  accounts: 1,
  authSessions: 2,
  passkeys: 0,
  twoFactor: 0,
  verifications: 1,
};

describe('/api/dev/delete-user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns available actions from GET', async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.actions).toEqual(['lookup', 'delete']);
  });

  it('rejects invalid action', async () => {
    const response = await postJson({ action: 'purge', email: 'user@example.com' });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Invalid action');
  });

  it('rejects lookup without email', async () => {
    const response = await postJson({ action: 'lookup' });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('email');
  });

  it('returns lookup preview when user exists', async () => {
    vi.mocked(UserModel.getUserDeletionPreview).mockResolvedValue({
      found: true,
      relatedCounts,
      user: previewUser,
    });

    const response = await postJson({ action: 'lookup', email: 'user@example.com' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.action).toBe('lookup');
    expect(payload.result.found).toBe(true);
    expect(UserModel.getUserDeletionPreview).toHaveBeenCalledWith('user@example.com');
  });

  it('returns lookup not found result', async () => {
    vi.mocked(UserModel.getUserDeletionPreview).mockResolvedValue({ found: false });

    const response = await postJson({ action: 'lookup', email: 'missing@example.com' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.result.found).toBe(false);
  });

  it('rejects delete without confirmEmail', async () => {
    const response = await postJson({ action: 'delete', email: 'user@example.com' });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('confirmEmail');
  });

  it('rejects delete when confirmEmail does not match', async () => {
    const response = await postJson({
      action: 'delete',
      confirmEmail: 'other@example.com',
      email: 'user@example.com',
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('confirmEmail must match email');
  });

  it('deletes user when confirmation matches', async () => {
    vi.mocked(UserModel.deleteUserByEmail).mockResolvedValue({
      deleted: {
        relatedCounts,
        user: previewUser,
      },
      found: true,
    });

    const response = await postJson({
      action: 'delete',
      confirmEmail: 'user@example.com',
      email: 'user@example.com',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.action).toBe('delete');
    expect(payload.result.found).toBe(true);
    expect(UserModel.deleteUserByEmail).toHaveBeenCalledWith('user@example.com');
  });
});
