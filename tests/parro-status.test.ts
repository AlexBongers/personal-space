import assert from "node:assert/strict";
import test from "node:test";
import { parroSnapshotStatus, shouldSyncParro } from "../app/personal-space/parro-status.ts";
import { parroConnectOutcome } from "../app/personal-space/parro-connect-outcome.ts";

const now = Date.parse("2026-09-21T12:00:00Z");

test("old Parro snapshots remain stale after a successful cache reload", () => {
  const status = parroSnapshotStatus("2026-09-18T12:00:00Z", now);
  assert.equal(status.stale, true);
  assert.equal(status.date?.toISOString(), "2026-09-18T12:00:00.000Z");
  assert.equal(parroSnapshotStatus("2026-09-21T11:45:00Z", now).stale, false);
});

test("missing, malformed and future sync dates never imply a healthy sync", () => {
  for (const value of [undefined, "invalid", "2026-10-21T12:00:00Z"]) {
    assert.deepEqual(parroSnapshotStatus(value, now), { date: null, stale: true });
  }
});

test("a saved Parro connection survives a failed initial message sync", () => {
  assert.deepEqual(parroConnectOutcome(false, {
    connectionSaved: true,
    error: "Parro is gekoppeld, maar berichten konden niet worden opgehaald.",
  }, "Inloggen mislukt.", "Synchroniseren mislukt."), {
    connected: true,
    syncError: "Parro is gekoppeld, maar berichten konden niet worden opgehaald.",
  });
});

test("a saved connection without an error still reports a failed sync clearly", () => {
  assert.deepEqual(parroConnectOutcome(false, { connectionSaved: true }, "Inloggen mislukt.", "Synchroniseren mislukt."), {
    connected: true,
    syncError: "Synchroniseren mislukt.",
  });
});

test("a failed login without a saved connection stays on the login form", () => {
  assert.deepEqual(parroConnectOutcome(false, { error: "Onjuist wachtwoord." }, "Inloggen mislukt.", "Synchroniseren mislukt."), {
    connected: false,
    error: "Onjuist wachtwoord.",
  });
});

test("after connection handoff, status can load without auto-sync while manual retry remains enabled", () => {
  const staleSnapshot = "2026-09-20T12:00:00Z";
  const now = Date.parse("2026-09-21T12:00:00Z");
  assert.equal(shouldSyncParro("connected", false, staleSnapshot, false, now), false);
  assert.equal(shouldSyncParro("connected", true, staleSnapshot, false, now), true);
  assert.equal(shouldSyncParro("connected", false, staleSnapshot, true, now), true);
});

test("rejected reconnect never treats old saved tokens as a successful login", () => {
  for (const rejection of [{ state: "sign_in_required" }, { needsSignIn: true }]) {
    assert.deepEqual(parroConnectOutcome(false, {
      connectionSaved: true,
      ...rejection,
      error: "Parro heeft de inlogbevestiging niet geaccepteerd.",
    }, "Inloggen mislukt.", "Synchroniseren mislukt."), {
      connected: false,
      error: "Parro heeft de inlogbevestiging niet geaccepteerd.",
    });
  }
});

test("a successful reconnect dismisses the form without a sync warning", () => {
  assert.deepEqual(parroConnectOutcome(true, { ok: true, connectionSaved: true }, "Inloggen mislukt.", "Synchroniseren mislukt."), {
    connected: true,
    syncError: null,
  });
});

test("newly saved tokens allow partial connection when only message fetching fails", () => {
  assert.deepEqual(parroConnectOutcome(false, {
    state: "unavailable",
    connectionSaved: true,
    error: "Parro-groepen konden niet worden opgehaald.",
  }, "Inloggen mislukt.", "Synchroniseren mislukt."), {
    connected: true,
    syncError: "Parro-groepen konden niet worden opgehaald.",
  });
});
