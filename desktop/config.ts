import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LocalEnv } from "./server.ts";

/** The part of Electron's safeStorage that is used here, so the logic can be tested without Electron. */
export type SecretStorage = {
  encryptStringAsync(value: string): Promise<Buffer>;
  decryptStringAsync(value: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
};

type Keys = { google: string; parro: string };
type UserConfig = { googleClientId: string; googleClientSecret: string; googleCalendarSyncOnly: string; port?: number };

export const DEFAULT_PORT = 3210;

const newKey = () => randomBytes(32).toString("base64url");

const KEYCHAIN_HELP = "Personal Space kon zijn sleutels niet uit de macOS-sleutelhanger lezen. Start de app opnieuw en kies 'Sta altijd toe' als macOS om toegang vraagt.";

/** Encryption keys are created once and kept encrypted with the macOS Keychain. */
const loadKeys = async (dataDir: string, storage: SecretStorage): Promise<Keys> => {
  const path = join(dataDir, "keys.bin");
  if (existsSync(path)) {
    const decrypted = await storage.decryptStringAsync(readFileSync(path)).catch(() => { throw new Error(KEYCHAIN_HELP); });
    if (decrypted.shouldReEncrypt) writeFileSync(path, await storage.encryptStringAsync(decrypted.result), { mode: 0o600 });
    return JSON.parse(decrypted.result) as Keys;
  }
  const keys = { google: newKey(), parro: newKey() };
  const encrypted = await storage.encryptStringAsync(JSON.stringify(keys)).catch(() => { throw new Error(KEYCHAIN_HELP); });
  writeFileSync(path, encrypted, { mode: 0o600 });
  return keys;
};

/** config.json is for the user to edit: it holds the Google OAuth client. A template is written on first start. */
export const loadUserConfig = (dataDir: string): UserConfig => {
  const path = join(dataDir, "config.json");
  if (!existsSync(path)) {
    const template: UserConfig = { googleClientId: "", googleClientSecret: "", googleCalendarSyncOnly: "", port: DEFAULT_PORT };
    writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`, { mode: 0o600 });
    return template;
  }
  return JSON.parse(readFileSync(path, "utf8")) as UserConfig;
};

export const loadEnv = async (dataDir: string, storage: SecretStorage): Promise<LocalEnv> => {
  const keys = await loadKeys(dataDir, storage);
  const config = loadUserConfig(dataDir);
  return {
    GOOGLE_CLIENT_ID: config.googleClientId || undefined,
    GOOGLE_CLIENT_SECRET: config.googleClientSecret || undefined,
    GOOGLE_CALENDAR_SYNC_ONLY: config.googleCalendarSyncOnly || undefined,
    GOOGLE_TOKEN_ENCRYPTION_KEY: keys.google,
    PARRO_TOKEN_ENCRYPTION_KEY: keys.parro,
  };
};
