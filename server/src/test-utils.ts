import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.js';
import { type DB, openDb } from './db.js';

export interface TestApi {
  db: DB;
  url: string;
  close: () => Promise<void>;
  get: (path: string) => Promise<any>;
  post: (path: string, body?: unknown) => Promise<any>;
  patch: (path: string, body?: unknown) => Promise<any>;
  del: (path: string) => Promise<any>;
  raw: (method: string, path: string, body?: unknown) => Promise<Response>;
}

/** Boots the real Express app on an ephemeral port against an in-memory database. */
export async function startTestApi(): Promise<TestApi> {
  const db = openDb(':memory:');
  const server: Server = await new Promise((done) => {
    const s = createApp(db).listen(0, () => done(s));
  });
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  const raw = (method: string, path: string, body?: unknown) =>
    fetch(url + path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const json = async (method: string, path: string, body?: unknown) => {
    const res = await raw(method, path, body);
    return res.json();
  };

  return {
    db,
    url,
    raw,
    get: (path) => json('GET', path),
    post: (path, body) => json('POST', path, body ?? {}),
    patch: (path, body) => json('PATCH', path, body ?? {}),
    del: (path) => json('DELETE', path),
    close: () =>
      new Promise((done) => {
        server.close(() => {
          db.close();
          done();
        });
      }),
  };
}
