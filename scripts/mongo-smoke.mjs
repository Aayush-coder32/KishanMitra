import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import assert from "node:assert/strict";
import { initStore, mutate, read } from "../server/store.js";
import { book } from "../server/domain.js";
const replica = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
  binary: process.env.MONGOMS_SYSTEM_BINARY
    ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY }
    : { downloadDir: ".data/mongodb-binaries" },
});
try {
  await initStore(replica.getUri());
  await mutate((db) => {
    db.procurementCentres.push({
      _id: "c",
      name: "Centre",
      capacity: 1,
      status: "Normal",
      state: "UP",
      district: "Lucknow",
    });
  });
  const input = {
    centreId: "c",
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    timeSlot: "09:00",
    crop: "Wheat",
    quantity: 10,
  };
  const results = await Promise.allSettled([
    mutate((db) => book(db, { _id: "f1", name: "One" }, input)),
    mutate((db) => book(db, { _id: "f2", name: "Two" }, input)),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  let db = await read();
  assert.equal(db.slots.length, 1);
  assert.equal(db.queueTokens.length, 1);
  await assert.rejects(
    mutate((d) => {
      d.slots[0].status = "COMPLETED";
      throw Error("abort");
    }),
  );
  db = await read();
  assert.equal(db.slots[0].status, "WAITING");
  console.log(
    "PASS: real MongoDB replica-set persistence, concurrent capacity reservation and transaction rollback.",
  );
} finally {
  await mongoose.disconnect();
  await replica.stop();
}
