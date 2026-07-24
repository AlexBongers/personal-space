import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/db', () => ({
  getDb: () => {
    const mockStmt = {
      get: vi.fn(() => ({ value: 'light' })),
      run: vi.fn(),
    };
    return {
      prepare: vi.fn(() => mockStmt),
    };
  },
}));

vi.mock('../src/seed', () => ({
  seedDb: vi.fn(),
}));

import { app } from '../src/index';

describe('Server health endpoint', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/theme returns theme', async () => {
    const res = await request(app).get('/api/theme');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('theme');
  });
});
