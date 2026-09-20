import "dotenv/config";
import fs from "node:fs/promises";
import { z } from "zod";
import mongoose from "mongoose";
import { initStore, mutate } from "../server/store.js";
const text = z.string().min(1).max(150);
const schema = z.object({
  states: z.array(z.object({ _id: text, name: text })),
  districts: z.array(z.object({ _id: text, name: text, state: text })),
  crops: z.array(
    z.object({ _id: text, name: text, price: z.number().positive() }),
  ),
  procurementCentres: z.array(
    z.object({
      _id: text,
      name: text,
      district: text,
      state: text,
      address: text,
      capacity: z.number().int().min(1).max(500),
      status: z.enum(["Normal", "Busy", "Full", "Closed"]),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
  ),
});
if (!process.argv[2] || !process.env.MONGODB_URI)
  throw Error(
    "Usage: node scripts/import-catalog.mjs catalog.json; MONGODB_URI required.",
  );
const catalog = schema.parse(
  JSON.parse(await fs.readFile(process.argv[2], "utf8")),
);
await initStore(process.env.MONGODB_URI);
await mutate((db) => {
  for (const [collection, rows] of Object.entries(catalog))
    for (const row of rows) {
      const current = db[collection].find((r) => r._id === row._id);
      if (current) Object.assign(current, row);
      else db[collection].push(row);
    }
});
await mongoose.disconnect();
console.log("Catalogue imported. Existing entries matched by ID were updated.");
