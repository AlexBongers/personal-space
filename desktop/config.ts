import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LocalEnv } from "./server.ts";

/** The part of Electron's safeStorage that is used here, so the logic can be tested without Electron. */
export type SecretStorage = {
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
};

type Keys = { google: string; parro: string };
type UserConfig = { googleClientId: string; googleClientSecret: string; googleCalendarSyncOnly: string };

const newKey = () => randomBytes(32).toString("base64url");

/** Encryption keys are created once and kept encrypted with the macOS Keychain. */
const loadKeys = (dataDir: string, storage: SecretStorage): Keys => {
  const path = join(dataDir, "keys.bin");
  if (existsSync(path)) return JSON.parse(storage.decryptString(readFileSync(path))) as Keys;
  const keys = { google: newKey(), parro: newKey() };
  writeFileSync(path, storage.encryptString(JSON.stringify(keys)), { mode: 0o600 });
  return keys;
};

/** config.json is for the user to edit: it holds the Google OAuth client. A template is written on first start. */
const loadUserConfig = (dataDir: string): UserConfig => {
  const path = join(dataDir, "config.json");
  if (!existsSync(path)) {
    const template: UserConfig = { googleClientId: "", googleClientSecret: "", googleCalendarSyncOnly: "" };
    writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`, { mode: 0o600 });
    return template;
  }
  return JSON.parse(readFileSync(path, "utf8")) as UserConfig;
};

export const loadEnv = (dataDir: string, storage: SecretStorage): LocalEnv => {
  const keys = loadKeys(dataDir, storage);
  const config = loadUserConfig(dataDir);
  return {
    GOOGLE_CLIENT_ID: config.googleClientId || undefined,
    GOOGLE_CLIENT_SECRET: config.googleClientSecret || undefined,
    GOOGLE_CALENDAR_SYNC_ONLY: config.googleCalendarSyncOnly || undefined,
    GOOGLE_TOKEN_ENCRYPTION_KEY: keys.google,
    PARRO_TOKEN_ENCRYPTION_KEY: keys.parro,
  };
};
