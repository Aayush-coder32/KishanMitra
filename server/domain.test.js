import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { book, scope, encrypt } from "./domain.js";
const tomorrow = () =>
  new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const database = () => ({
  procurementCentres: [
    {
      _id: "c",
      name: "Centre",
      state: "UP",
      district: "Lucknow",
      capacity: 1,
      status: "Normal",
    },
  ],
  slots: [],
  queueTokens: [],
});
const farmer = { _id: "f", name: "Farmer", role: "farmer" };
const input = () => ({
  centreId: "c",
  date: tomorrow(),
  timeSlot: "09:00",
  crop: "Wheat",
  quantity: 10,
});
test("booking allocates a token and prevents duplicate active bookings", () => {
  const db = database();
  const slot = book(db, farmer, input());
  assert.equal(slot.tokenNumber, "A101");
  assert.equal(db.queueTokens.length, 1);
  assert.throws(() => book(db, farmer, input()), { status: 409 });
});
test("capacity is enforced across farmers", () => {
  const db = database();
  book(db, farmer, input());
  assert.throws(() => book(db, { ...farmer, _id: "other" }, input()), {
    status: 409,
  });
});
test("cancellation releases capacity and token numbers remain unique", () => {
  const db = database();
  const first = book(db, farmer, input());
  first.status = "CANCELLED";
  const second = book(db, farmer, input());
  assert.equal(second.tokenNumber, "A102");
});
test("past dates, invalid time windows and closed centres are rejected", () => {
  const db = database();
  assert.throws(() => book(db, farmer, { ...input(), date: "2000-01-01" }), {
    status: 400,
  });
  assert.throws(() => book(db, farmer, { ...input(), timeSlot: "01:00" }), {
    status: 400,
  });
  db.procurementCentres[0].status = "Closed";
  assert.throws(() => book(db, farmer, input()), { status: 400 });
});
test("jurisdiction isolation is enforced for each role", () => {
  const row = { farmerId: "f", state: "UP", district: "Lucknow" };
  assert.equal(scope(farmer, row), true);
  assert.equal(scope({ ...farmer, _id: "other" }, row), false);
  assert.equal(
    scope({ role: "district", state: "UP", district: "Lucknow" }, row),
    true,
  );
  assert.equal(
    scope({ role: "district", state: "Other", district: "Lucknow" }, row),
    false,
  );
  assert.equal(scope({ role: "state", state: "Other" }, row), false);
  assert.equal(scope({ role: "government" }, row), true);
});
test("identity encryption uses authenticated encryption and random nonces", () => {
  const key = crypto.randomBytes(32),
    text = "123456789012";
  const a = encrypt(text, key),
    b = encrypt(text, key);
  assert.notEqual(a, b);
  assert.ok(!a.includes(text));
  const raw = Buffer.from(a, "base64"),
    d = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  assert.equal(
    Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString(),
    text,
  );
});
