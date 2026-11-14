import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_CALLBACK, appCallbackToWeb, appOAuthRedirect, isOtpType, randomNonce, safeNext, sha256Hex } from "./auth-links.ts";

test("safeNext keeps same-site paths and blocks other sites", () => {
  assert.equal(safeNext("/plan?week=2"), "/plan?week=2");
  assert.equal(safeNext(null), "/library");
  assert.equal(safeNext(""), "/library");
  assert.equal(safeNext("https://evil.example"), "/library");
  assert.equal(safeNext("//evil.example"), "/library");
  assert.equal(safeNext("/\\evil.example"), "/library");
});

test("app OAuth redirect uses the app's own link with next", () => {
  assert.equal(APP_CALLBACK, "app.yumjack.ios://auth/callback");
  assert.equal(appOAuthRedirect("/plan"), "app.yumjack.ios://auth/callback?next=%2Fplan");
});

test("app callback link becomes the website callback with the same query", () => {
  assert.equal(
    appCallbackToWeb("app.yumjack.ios://auth/callback?next=%2Flibrary&code=abc"),
    "https://yumjack.app/auth/callback?next=%2Flibrary&code=abc",
  );
  assert.equal(appCallbackToWeb("app.yumjack.ios://auth/callback?code=x", "http://localhost:3000"), "http://localhost:3000/auth/callback?code=x");
});

test("other links are not app callbacks", () => {
  assert.equal(appCallbackToWeb("https://yumjack.app/auth/callback?code=abc"), null);
  assert.equal(appCallbackToWeb("app.yumjack.ios://somewhere/else?code=abc"), null);
  assert.equal(appCallbackToWeb("evil.ios://auth/callback?code=abc"), null);
  assert.equal(appCallbackToWeb("not a url"), null);
});

test("only Supabase email link types are accepted", () => {
  for (const t of ["email", "magiclink", "signup", "invite", "recovery", "email_change"]) assert.equal(isOtpType(t), true);
  for (const t of [null, "", "sms", "phone_change", "EMAIL", "anything"]) assert.equal(isOtpType(t), false);
});

test("sha256Hex matches the known digest", async () => {
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("randomNonce is long, hex and different each time", () => {
  const a = randomNonce();
  const b = randomNonce();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});
