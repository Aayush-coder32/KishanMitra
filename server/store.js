import mongoose from "mongoose";
import fs from "node:fs/promises";
import crypto from "node:crypto";
export const collections = [
  "users",
  "farmers",
  "districts",
  "states",
  "procurementCentres",
  "slots",
  "queueTokens",
  "procurements",
  "payments",
  "notifications",
  "documents",
  "crops",
  "reports",
  "auditLogs",
  "sessions",
  "challenges",
];
const fields = {
  users: {
    name: String,
    email: String,
    mobile: String,
    passwordHash: String,
    role: String,
    district: String,
    state: String,
  },
  farmers: {
    userId: String,
    farmerId: String,
    aadhaarEncrypted: String,
    panEncrypted: String,
  },
  slots: {
    farmerId: String,
    centreId: String,
    date: String,
    timeSlot: String,
    status: String,
  },
  payments: {
    farmerId: String,
    procurementId: String,
    amount: Number,
    status: String,
  },
  states: { name: String },
  districts: { name: String, state: String },
  procurementCentres: { name: String, district: String, state: String, capacity: Number, status: String, latitude: Number, longitude: Number },
  crops: { name: String, price: Number },
  queueTokens: { farmerId: String, centreId: String, date: String, timeSlot: String, tokenNumber: String, status: String },
  procurements: { farmerId: String, centreId: String, slotId: String, crop: String, quantity: Number, quality: String, price: Number, totalAmount: Number, status: String, verifiedBy: String },
  notifications: { farmerId: String, title: String, message: String, read: Boolean, createdAt: String },
  documents: { farmerId: String, state: String, district: String, type: String, mime: String, size: Number },
  reports: { district: String, state: String, type: String, period: String, format: String },
  auditLogs: { userId: String, name: String, role: String, action: String, createdAt: String },
  sessions: { userId: String, hash: String, expires: Number },
  challenges: { type: String, userId: String, hash: String, expires: Number, attempts: Number, data: mongoose.Schema.Types.Mixed },
};
export const models = Object.fromEntries(
  collections.map((name) => [
    name,
    mongoose.model(
      name,
      new mongoose.Schema(
        {
          _id: { type: String, default: () => crypto.randomUUID() },
          ...fields[name],
        },
        { strict: false, versionKey: false, collection: name },
      ),
    ),
  ]),
);
models.users.schema.index({ email: 1 }, { unique: true });
models.users.schema.index({ mobile: 1 }, { unique: true });
models.farmers.schema.index({ userId: 1 }, { unique: true });
models.slots.schema.index(
  { centreId: 1, date: 1, tokenNumber: 1 },
  { unique: true },
);
models.payments.schema.index({ procurementId: 1 }, { unique: true });
models.documents.schema.index({ farmerId: 1 });
models.notifications.schema.index({ farmerId: 1, createdAt: -1 });
const Revision = mongoose.model(
  "revision",
  new mongoose.Schema({ _id: String, version: Number }),
);
let state = Object.fromEntries(collections.map((k) => [k, []]));
let tail = Promise.resolve();
let mongo = false;
export const id = () => crypto.randomUUID();
export async function initStore(uri) {
  if (uri) {
    await mongoose.connect(uri);
    mongo = true;
    await Revision.updateOne(
      { _id: "lock" },
      { $setOnInsert: { version: 0 } },
      { upsert: true },
    );
  } else {
    await fs.mkdir(".data", { recursive: true });
    try {
      state = {
        ...state,
        ...JSON.parse(await fs.readFile(".data/db.json", "utf8")),
      };
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
}
export async function read() {
  return mongo
    ? Object.fromEntries(
        await Promise.all(
          collections.map(async (k) => [k, await models[k].find().lean()]),
        ),
      )
    : structuredClone(state);
}
export function mutate(fn) {
  const task = tail.then(async () => {
    if (mongo) {
      let result;
      await mongoose.connection.transaction(async (session) => {
        await Revision.updateOne(
          { _id: "lock" },
          { $inc: { version: 1 } },
          { session },
        );
        const db = {};
        for (const k of collections)
          db[k] = await models[k].find().session(session).lean();
        const before = structuredClone(db);
        result = await fn(db);
        for (const k of collections) {
          const old = new Map(
            before[k].map((row) => [row._id, JSON.stringify(row)]),
          );
          const current = new Set(db[k].map((row) => row._id));
          const operations = before[k]
            .filter((row) => !current.has(row._id))
            .map((row) => ({ deleteOne: { filter: { _id: row._id } } }));
          for (const row of db[k])
            if (old.get(row._id) !== JSON.stringify(row))
              operations.push({
                replaceOne: {
                  filter: { _id: row._id },
                  replacement: row,
                  upsert: true,
                },
              });
          if (operations.length)
            await models[k].bulkWrite(operations, { session });
        }
      });
      return result;
    }
    const draft = structuredClone(state);
    const result = await fn(draft);
    await fs.writeFile(".data/db.tmp", JSON.stringify(draft));
    await fs.rename(".data/db.tmp", ".data/db.json");
    state = draft;
    return result;
  });
  tail = task.catch(() => {});
  return task;
}
