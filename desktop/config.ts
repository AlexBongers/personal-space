import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LocalEnv } from "./server.ts";

/** The part of Electron's safeStorage that is used here, so the logic can be tested without Electron. */
export type SecretStorage = {
  encryptStringAsync(value: string): Promise<Buffer>;
  decryptStringAsync(value: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
};

type Keys = { google: string; parro: string };
type UserConfig = {
  googleClientId: string;
  googleClientSecret: string;
  googleCalendarSyncOnly: string;
  port?: number;
  /** Time of the daily overview notification, such as "07:30"; empty turns it off. */
  briefingTime?: string;
  notifyParro?: boolean;
  notifyGmail?: boolean;
  /** Minutes before a calendar event that its notification appears; 0 turns it off. */
  eventReminderMinutes?: number;
  /** An extra folder that also receives the daily backup, for example in iCloud Drive. */
  backupDir?: string;
};

export type Settings = Required<Omit<UserConfig, "googleClientId" | "googleClientSecret" | "googleCalendarSyncOnly">>;

export const DEFAULT_SETTINGS: Settings = { port: 3210, briefingTime: "07:30", notifyParro: true, notifyGmail: true, eventReminderMinutes: 10, backupDir: "" };

export const DEFAULT_PORT = DEFAULT_SETTINGS.port;

const newKey = () => randomBytes(32).toString("base64url");

/** The stored keys could not be decrypted: the Keychain refused access, or its key is not the one keys.bin was made with. */
export class KeychainError extends Error {}

const KEYCHAIN_HELP = "Personal Space kon zijn sleutels niet ontsleutelen met de macOS-sleutelhanger. Dat gebeurt als de toegang werd geweigerd of als de sleutel in de sleutelhanger niet meer dezelfde is.";

/** Encryption keys are created once and kept encrypted with the macOS Keychain. */
const loadKeys = async (dataDir: string, storage: SecretStorage): Promise<Keys> => {
  const path = join(dataDir, "keys.bin");
  if (existsSync(path)) {
    const decrypted = await storage.decryptStringAsync(readFileSync(path)).catch(() => { throw new KeychainError(KEYCHAIN_HELP); });
    if (decrypted.shouldReEncrypt) writeFileSync(path, await storage.encryptStringAsync(decrypted.result), { mode: 0o600 });
    return JSON.parse(decrypted.result) as Keys;
  }
  const keys = { google: newKey(), parro: newKey() };
  const encrypted = await storage.encryptStringAsync(JSON.stringify(keys)).catch(() => { throw new KeychainError(KEYCHAIN_HELP); });
  writeFileSync(path, encrypted, { mode: 0o600 });
  return keys;
};

/**
 * Sets unreadable keys aside so new ones are made on the next load. The workspace is not encrypted and stays intact;
 * only the Google and Parro connections must be made again. The old file is kept in case the Keychain key comes back.
 */
export const setKeysAside = (dataDir: string, now = new Date()) =>
  renameSync(join(dataDir, "keys.bin"), join(dataDir, `keys.bin.unreadable-${now.toISOString().replaceAll(":", "-")}`));

/** config.json is for the user to edit: it holds the Google OAuth client. A template is written on first start. */
export const loadUserConfig = (dataDir: string): UserConfig => {
  const path = join(dataDir, "config.json");
  if (!existsSync(path)) {
    const template: UserConfig = { googleClientId: "", googleClientSecret: "", googleCalendarSyncOnly: "", ...DEFAULT_SETTINGS };
    writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`, { mode: 0o600 });
    return template;
  }
  return JSON.parse(readFileSync(path, "utf8")) as UserConfig;
};

/** The desktop settings from config.json, with defaults for everything that is missing. */
export const loadSettings = (dataDir: string): Settings => {
  const config = loadUserConfig(dataDir);
  const pick = <K extends keyof Settings>(key: K): Settings[K] =>
    typeof config[key] === typeof DEFAULT_SETTINGS[key] ? config[key] as Settings[K] : DEFAULT_SETTINGS[key];
  return { port: pick("port"), briefingTime: pick("briefingTime"), notifyParro: pick("notifyParro"), notifyGmail: pick("notifyGmail"), eventReminderMinutes: pick("eventReminderMinutes"), backupDir: pick("backupDir") };
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
