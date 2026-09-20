import mongoose from "mongoose";
import fs from "node:fs/promises";
await mongoose.connect("mongodb://127.0.0.1:27018/admin?directConnection=true");
try {
  await mongoose.connection.db
    .admin()
    .command({
      replSetInitiate: {
        _id: "ekharid",
        members: [{ _id: 0, host: "127.0.0.1:27018" }],
      },
    });
} catch (error) {
  if (error.codeName !== "AlreadyInitialized") throw error;
}
for (let i = 0; i < 30; i++) {
  const state = await mongoose.connection.db.admin().command({ hello: 1 });
  if (state.isWritablePrimary) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await mongoose.disconnect();
try {
  await fs.writeFile(
    ".env",
    "PORT=4000\nNODE_ENV=development\nAPP_ORIGIN=http://localhost:5173\nMONGODB_URI=mongodb://127.0.0.1:27018/ekharid?replicaSet=ekharid\nDEMO_MODE=true\n",
    { flag: "wx" },
  );
  console.log("Created local MongoDB configuration.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Existing .env preserved.");
}
console.log("Local MongoDB replica set is ready on port 27018.");
