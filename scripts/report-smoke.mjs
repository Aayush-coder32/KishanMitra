import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { io } from "socket.io-client";
const base = "http://localhost:4000/api";
const config = await fetch(base + "/config").then((r) => r.json());
const creds = config.demoAccounts.find((a) => a.role === "district");
const login = await fetch(base + "/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "e-kharid",
  },
  body: JSON.stringify({
    login: creds.email,
    password: creds.password,
    role: "district",
  }),
});
assert.equal(login.status, 200);
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
for (const type of ["procurement", "payments", "queue", "district", "state"])
  for (const format of ["csv", "pdf", "xlsx"]) {
    const res = await fetch(
      `${base}/reports/${format}?type=${type}&period=monthly`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(res.status, 200);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (format === "pdf")
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    if (format === "xlsx") {
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(bytes);
      assert.ok(book.worksheets[0].rowCount > 0);
    }
    if (format === "csv") assert.ok(bytes.toString().includes(","));
  }
const socket = io("http://localhost:4000", {
  extraHeaders: { Cookie: cookie },
  transports: ["websocket"],
});
await new Promise((resolve, reject) => {
  socket.on("connect", resolve);
  socket.on("connect_error", reject);
  setTimeout(() => reject(Error("Socket timeout")), 10000).unref();
});
const changed = new Promise((resolve, reject) => {
  socket.once("changed", resolve);
  setTimeout(() => reject(Error("No real-time update")), 10000).unref();
});
const update = await fetch(base + "/official/centres/centre-0", {
  method: "PATCH",
  headers: {
    Cookie: cookie,
    "Content-Type": "application/json",
    "X-Requested-With": "e-kharid",
  },
  body: JSON.stringify({ status: "Normal", capacity: 12 }),
});
assert.equal(update.status, 200);
await changed;
socket.disconnect();
console.log(
  "PASS: 15 report exports (5 types × 3 formats), readable XLSX/PDF/CSV, authenticated real-time Socket.IO updates.",
);
