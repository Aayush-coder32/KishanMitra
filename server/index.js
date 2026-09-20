import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { Server } from "socket.io";
import multer from "multer";
import nodemailer from "nodemailer";
import { exportReport } from "./reports.js";
import { z } from "zod";
import { initStore, read, mutate, id } from "./store.js";
import { book, scope, fail, steps, encrypt } from "./domain.js";
import { seed } from "./seed.js";
import { seedActivity } from "./demo-activity.js";
import { startDelivery } from "./notification-worker.js";
const prod = process.env.NODE_ENV === "production",
  demo = !prod && process.env.DEMO_MODE !== "false";
if (prod && !process.env.APP_ORIGIN?.startsWith('https://')) throw new Error('Production APP_ORIGIN must be an explicit HTTPS origin.');
if (
  prod &&
  (!process.env.MONGODB_URI ||
    !process.env.EMAIL_HOST ||
    !process.env.IDENTITY_KEY ||
    !process.env.JWT_SECRET ||
    !process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_REFRESH_SECRET.length < 32)
)
  throw new Error(
    "Production requires MongoDB, SMTP, encryption key and strong JWT secrets.",
  );
const secret = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex"),
  refreshSecret =
    process.env.JWT_REFRESH_SECRET || crypto.randomBytes(48).toString("hex");
await fs.mkdir(".data", { recursive: true });
let key;
if (
  process.env.IDENTITY_KEY &&
  /^[a-f0-9]{64}$/i.test(process.env.IDENTITY_KEY)
)
  key = Buffer.from(process.env.IDENTITY_KEY, "hex");
else if (prod) throw new Error("IDENTITY_KEY must be 64 hex characters");
else {
  try {
    key = await fs.readFile(".data/identity.key");
  } catch {
    key = crypto.randomBytes(32);
    await fs.writeFile(".data/identity.key", key);
  }
}
await initStore(process.env.MONGODB_URI);
let demoPassword = process.env.DEMO_PASSWORD;
if (demo) {
  if (!demoPassword) {
    try {
      demoPassword = await fs.readFile(".data/demo-password", "utf8");
    } catch {
      demoPassword = crypto.randomBytes(12).toString("base64url");
      await fs.writeFile(".data/demo-password", demoPassword);
    }
  }
  await seed(demoPassword);
  await seedActivity();
}
const app = express(),
  http = createServer(app),
  origin = process.env.APP_ORIGIN || "http://localhost:5173";
const io = new Server(http, { cors: { origin, credentials: true } });
app.set("trust proxy", 1);
app.use(helmet({contentSecurityPolicy:{directives:{imgSrc:["'self'","data:","https://*.tile.openstreetmap.org"],connectSrc:["'self'"]}}}));
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api", rateLimit({ windowMs: 60000, limit: 250 }));
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== origin
  )
    return res.status(403).json({ message: "Untrusted request origin." });
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers["x-requested-with"] !== "e-kharid"
  )
    return res.status(403).json({ message: "Missing request verification." });
  next();
});
const safe = (u) => {
  const { passwordHash, failedLogins, lockedUntil, ...rest } = u;
  return rest;
};
const cookie = {
  httpOnly: true,
  secure: prod,
  sameSite: prod ? "none" : "lax",
  path: "/",
};
const digest = (s) => crypto.createHash("sha256").update(s).digest("hex");
const audit = (db, u, action) =>
  db.auditLogs.push({
    _id: id(),
    userId: u._id,
    name: u.name,
    role: u.role,
    action,
    createdAt: new Date().toISOString(),
  });
function notify(db, user, title, message) {
  db.notifications.push({
    _id: id(),
    farmerId: user,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  });
}
function changed() {
  io.emit("changed");
}
async function sendCode(email, code) {
  if (!process.env.EMAIL_HOST) {
    if (!demo) fail(503, "Email delivery is not configured.");
    return;
  }
  await nodemailer
    .createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_PORT === "465",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    })
    .sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: "Your e-Kharid verification code",
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
    });
}
async function auth(req, res, next) {
  try {
    const token = jwt.verify(req.cookies.access, secret);
    const db = await read();
    const u = db.users.find(
      (u) => u._id === token.sub && u.status === "ACTIVE",
    );
    if (
      !u ||
      !db.sessions.some((s) => s._id === token.sid && s.expires > Date.now())
    )
      fail(401, "Please sign in again.");
    req.user = u;
    req.sid = token.sid;
    next();
  } catch {
    res.status(401).json({ message: "Please sign in to continue." });
  }
}
function roles(...allowed) {
  return (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : res
          .status(403)
          .json({ message: "This action is unavailable for your role." });
}
async function session(res, u, remember = false) {
  const sid = id(),
    token = jwt.sign({ sub: u._id, sid }, refreshSecret, {
      expiresIn: remember ? "30d" : "1d",
    });
  await mutate((db) => {
    db.sessions.push({
      _id: sid,
      userId: u._id,
      hash: digest(token),
      expires: Date.now() + (remember ? 30 : 1) * 86400000,
    });
    audit(db, u, "Login");
  });
  res.cookie(
    "access",
    jwt.sign({ sub: u._id, sid }, secret, { expiresIn: "15m" }),
    { ...cookie, maxAge: 900000 },
  );
  res.cookie("refresh", token, {
    ...cookie,
    maxAge: (remember ? 30 : 1) * 86400000,
  });
}
const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 30 });
app.use("/api/auth", authLimit);
app.get("/api/config", (req, res) =>
  res.json({
    demo,
    storage: process.env.MONGODB_URI ? "MongoDB" : "Local demo",
    demoAccounts: demo
      ? ["farmer", "district", "state", "government"].map((role) => ({
          role,
          email: `${role}@demo.ekharid.in`,
          password: demoPassword,
        }))
      : [],
  }),
);
app.get("/api/health", async (req, res) => {
  await read();
  res.json({ status: "ok" });
});
app.post("/api/auth/login", async (req, res) => {
  const { login, password, role, remember } = z
    .object({
      login: z.string().min(3).max(150),
      password: z.string().max(128),
      role: z.enum(["farmer", "district", "state", "government"]),
      remember: z.boolean().optional(),
    })
    .parse(req.body);
  const db = await read(),
    u = db.users.find(
      (u) =>
        (u.email === login.toLowerCase() || u.mobile === login) &&
        u.role === role,
    );
  if (u?.lockedUntil > Date.now())
    fail(429, "Account temporarily locked. Try again in 15 minutes.");
  if (
    !u ||
    !(await bcrypt.compare(password, u.passwordHash)) ||
    u.status !== "ACTIVE"
  ) {
    if (u)
      await mutate((d) => {
        const row = d.users.find((x) => x._id === u._id);
        row.failedLogins = (row.failedLogins || 0) + 1;
        if (row.failedLogins >= 5) row.lockedUntil = Date.now() + 900000;
      });
    fail(401, "Email, password or selected role is incorrect.");
  }
  await mutate((d) => {
    const row = d.users.find((x) => x._id === u._id);
    row.failedLogins = 0;
    row.lockedUntil = 0;
  });
  await session(res, u, remember);
  res.json(safe(u));
});
app.post("/api/auth/refresh", async (req, res) => {
  let t;
  try {
    t = jwt.verify(req.cookies.refresh, refreshSecret);
  } catch {
    fail(401, "Session expired.");
  }
  const nextToken = jwt.sign(
    { sub: t.sub, sid: t.sid, nonce: id() },
    refreshSecret,
    { expiresIn: "1d" },
  );
  await mutate((db) => {
    const s = db.sessions.find(
      (s) =>
        s._id === t.sid &&
        s.hash === digest(req.cookies.refresh) &&
        s.expires > Date.now(),
    );
    if (!s) fail(401, "Session expired.");
    s.hash = digest(nextToken);
    s.expires = Date.now() + 86400000;
  });
  res.cookie(
    "access",
    jwt.sign({ sub: t.sub, sid: t.sid }, secret, { expiresIn: "15m" }),
    { ...cookie, maxAge: 900000 },
  );
  res.cookie("refresh", nextToken, { ...cookie, maxAge: 86400000 });
  res.json({ ok: true });
});
app.get("/api/auth/me", auth, (req, res) => res.json(safe(req.user)));
app.post("/api/auth/logout", auth, async (req, res) => {
  await mutate((db) => {
    db.sessions = db.sessions.filter((s) => s._id !== req.sid);
    audit(db, req.user, "Logout");
  });
  res.clearCookie("access", cookie);
  res.clearCookie("refresh", cookie);
  res.json({ ok: true });
});
const registration = z.object({
  name: z.string().min(2).max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().email().max(150),
  password: z.string().min(10).max(128),
  aadhaar: z.string().regex(/^\d{12}$/),
  pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/),
  dob: z.string().min(10),
  gender: z.string(),
  address: z.string().min(5).max(300),
  village: z.string().min(2),
  district: z.string().min(2),
  state: z.string().min(2),
  pin: z.string().regex(/^\d{6}$/),
  land: z.string().min(2),
  crop: z.string(),
  quantity: z.coerce.number().positive(),
  consent: z.literal(true),
});
app.post("/api/auth/register", async (req, res) => {
  const data = registration.parse(req.body);
  if (new Date(data.dob) > new Date() || Number.isNaN(Date.parse(data.dob)))
    fail(400, "Enter a valid date of birth.");
  const code = String(crypto.randomInt(100000, 1000000)),
    challengeId = id();
  await sendCode(data.email, code);
  const hash = await bcrypt.hash(data.password, 12);
  await mutate((db) => {
    if (
      db.users.some(
        (u) => u.email === data.email.toLowerCase() || u.mobile === data.mobile,
      )
    )
      fail(409, "An account already exists with these details.");
    db.challenges.push({
      _id: challengeId,
      type: "register",
      hash: digest(code),
      expires: Date.now() + 600000,
      attempts: 0,
      data: {
        ...data,
        password: undefined,
        passwordHash: hash,
        aadhaar: undefined,
        pan: undefined,
        aadhaarEncrypted: encrypt(data.aadhaar, key),
        panEncrypted: encrypt(data.pan, key),
        aadhaarLast4: data.aadhaar.slice(-4),
        panLast4: data.pan.slice(-4),
      },
    });
  });
  res.json({
    challengeId,
    ...(demo && !process.env.EMAIL_HOST ? { demoCode: code } : {}),
  });
});
app.post("/api/auth/verify-otp", async (req, res) => {
  const { challengeId, code } = z
    .object({ challengeId: z.string(), code: z.string().length(6) })
    .parse(req.body);
  const result = await mutate((db) => {
    const c = db.challenges.find(
      (c) => c._id === challengeId && c.type === "register",
    );
    if (!c || c.expires < Date.now() || c.attempts >= 5) return { error: true };
    c.attempts++;
    if (c.hash !== digest(code)) return { error: true };
    const d = c.data;
    if (
      db.users.some(
        (u) => u.email === d.email.toLowerCase() || u.mobile === d.mobile,
      )
    )
      return { error: true };
    const u = {
      _id: id(),
      name: d.name,
      email: d.email.toLowerCase(),
      mobile: d.mobile,
      passwordHash: d.passwordHash,
      role: "farmer",
      state: d.state,
      district: d.district,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };
    db.users.push(u);
    db.farmers.push({
      ...d,
      passwordHash: undefined,
      _id: id(),
      userId: u._id,
      farmerId: `EK-${crypto.randomInt(100000, 999999)}`,
      verificationStatus: "PENDING",
    });
    db.challenges = db.challenges.filter((x) => x._id !== c._id);
    notify(
      db,
      u._id,
      "Registration complete",
      "Upload your documents to complete verification.",
    );
    return { user: u };
  });
  if (result.error) fail(400, "Invalid or expired verification code.");
  await session(res, result.user);
  res.json(safe(result.user));
});
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const db = await read(),
    u = db.users.find((u) => u.email === email.toLowerCase());
  const challengeId = id(),
    code = String(crypto.randomInt(100000, 1000000));
  if (u) {
    await sendCode(email, code);
    await mutate((d) =>
      d.challenges.push({
        _id: challengeId,
        type: "reset",
        userId: u._id,
        hash: digest(code),
        expires: Date.now() + 600000,
        attempts: 0,
      }),
    );
  }
  res.json({
    message: "If your account exists, a code has been sent.",
    challengeId,
    ...(demo && u ? { demoCode: code } : {}),
  });
});
app.post("/api/auth/reset-password", async (req, res) => {
  const d = z
    .object({
      challengeId: z.string(),
      code: z.string().length(6),
      password: z.string().min(10).max(128),
    })
    .parse(req.body);
  const hash = await bcrypt.hash(d.password, 12);
  const ok = await mutate((db) => {
    const c = db.challenges.find(
      (x) => x._id === d.challengeId && x.type === "reset",
    );
    if (!c || c.expires < Date.now() || c.attempts >= 5) return false;
    c.attempts++;
    if (c.hash !== digest(d.code)) return false;
    const u = db.users.find((x) => x._id === c.userId);
    u.passwordHash = hash;
    u.lockedUntil = 0;
    u.failedLogins = 0;
    db.sessions = db.sessions.filter((s) => s.userId !== u._id);
    db.challenges = db.challenges.filter((x) => x._id !== c._id);
    return true;
  });
  if (!ok) fail(400, "Invalid or expired code.");
  res.json({ ok: true });
});
app.use("/api", auth);
app.get("/api/catalog", async (req, res) => {
  const db = await read();
  res.json({
    centres: db.procurementCentres.filter(
      (c) => req.user.role === "farmer" || scope(req.user, c),
    ),
    crops: db.crops,
    districts: db.districts,
    states: db.states,
  });
});
app.get("/api/availability", roles("farmer"), async (req, res) => {
  const query = z
      .object({
        centreId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(req.query),
    db = await read(),
    centre = db.procurementCentres.find((c) => c._id === query.centreId);
  if (!centre) fail(404, "Centre not found.");
  res.json(
    ["09:00", "11:00", "14:00"].map((timeSlot) => ({
      timeSlot,
      available:
        ["Closed", "Full"].includes(centre.status) ||
        Date.parse(`${query.date}T${timeSlot}:00+05:30`) < Date.now()
          ? 0
          : Math.max(
              0,
              centre.capacity -
                db.slots.filter(
                  (s) =>
                    s.centreId === centre._id &&
                    s.date === query.date &&
                    s.timeSlot === timeSlot &&
                    s.status !== "CANCELLED",
                ).length,
            ),
    })),
  );
});
app.get("/api/farmer/profile", roles("farmer"), async (req, res) => {
  const db = await read(),
    f = db.farmers.find((f) => f.userId === req.user._id) || {};
  const { aadhaarEncrypted, panEncrypted, ...rest } = f;
  res.json({
    ...safe(req.user),
    ...rest,
    aadhaar: f.aadhaarLast4 ? `XXXX XXXX ${f.aadhaarLast4}` : "Not provided",
    pan: f.panLast4 ? `XXXXXX${f.panLast4}` : "Not provided",
  });
});
app.put("/api/farmer/profile", roles("farmer"), async (req, res) => {
  const d = z
    .object({
      name: z.string().min(2).max(100),
      address: z.string().max(300),
      village: z.string().max(100),
    })
    .parse(req.body);
  await mutate((db) => {
    Object.assign(
      db.users.find((x) => x._id === req.user._id),
      { name: d.name },
    );
    Object.assign(
      db.farmers.find((x) => x.userId === req.user._id),
      d,
    );
    audit(db, req.user, "Profile updated");
  });
  res.json({ ok: true });
});
app.post("/api/farmer/slot", roles("farmer"), async (req, res) => {
  const d = z
    .object({
      centreId: z.string(),
      crop: z.string(),
      quantity: z.coerce.number().positive().max(10000),
      date: z.string(),
      timeSlot: z.string(),
    })
    .parse(req.body);
  const slot = await mutate((db) => {
    if (!db.crops.some((c) => c.name === d.crop)) fail(400, "Invalid crop.");
    const slot = book(db, req.user, d);
    notify(
      db,
      req.user._id,
      "Slot confirmed",
      `${slot.tokenNumber} · ${slot.centreName} · ${slot.date} at ${slot.timeSlot}`,
    );
    audit(db, req.user, "Slot booked");
    return slot;
  });
  changed();
  res.status(201).json(slot);
});
app.delete("/api/farmer/slots/:id", roles("farmer"), async (req, res) => {
  await mutate((db) => {
    const s = db.slots.find(
      (s) => s._id === req.params.id && s.farmerId === req.user._id,
    );
    if (!s) fail(404, "Booking not found.");
    if (s.status !== "WAITING")
      fail(409, "Only waiting bookings can be cancelled.");
    s.status = "CANCELLED";
    Object.assign(
      db.queueTokens.find((x) => x._id === s._id),
      { status: s.status },
    );
    notify(
      db,
      req.user._id,
      "Booking cancelled",
      `Token ${s.tokenNumber} has been cancelled.`,
    );
    audit(db, req.user, "Slot cancelled");
  });
  changed();
  res.json({ ok: true });
});
app.get("/api/farmer/queue", roles("farmer"), async (req, res) => {
  const db = await read(),
    slot = db.slots.find(
      (s) =>
        s.farmerId === req.user._id &&
        !["COMPLETED", "CANCELLED"].includes(s.status),
    );
  if (!slot) return res.json(null);
  const line = db.slots
    .filter(
      (s) =>
        s.centreId === slot.centreId &&
        s.date === slot.date &&
        s.timeSlot === slot.timeSlot &&
        !["COMPLETED", "CANCELLED"].includes(s.status),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ahead = line.findIndex((s) => s._id === slot._id);
  res.json({
    ...slot,
    ahead,
    waitMinutes: ahead * 8,
    currentToken: line[0]?.tokenNumber,
  });
});
for (const [route, collection] of Object.entries({
  slots: "slots",
  procurement: "procurements",
  payment: "payments",
  notifications: "notifications",
}))
  app.get(`/api/farmer/${route}`, roles("farmer"), async (req, res) =>
    res.json((await read())[collection].filter((x) => scope(req.user, x))),
  );
app.patch("/api/notifications/:id", async (req, res) => {
  await mutate((db) => {
    const n = db.notifications.find(
      (x) => x._id === req.params.id && x.farmerId === req.user._id,
    );
    if (!n) fail(404, "Notification not found.");
    n.read = true;
  });
  res.json({ ok: true });
});
app.get("/api/dashboard", async (req, res) => {
  const db = await read(),
    filter = (arr) => arr.filter((r) => scope(req.user, r));
  const slots = filter(db.slots),
    procurements = filter(db.procurements),
    payments = filter(db.payments);
  res.json({
    slots,
    procurements,
    payments,
    centres: db.procurementCentres.filter(
      (c) => req.user.role === "farmer" || scope(req.user, c),
    ),
    farmers: db.users
      .filter(
        (u) =>
          u.role === "farmer" &&
          (req.user.role === "farmer"
            ? u._id === req.user._id
            : scope(req.user, u)),
      )
      .map((u) => ({
        ...safe(u),
        verificationStatus: db.farmers.find((f) => f.userId === u._id)
          ?.verificationStatus,
      })),
    notifications: db.notifications.filter((n) => n.farmerId === req.user._id),
    districts: db.districts.filter(
      (d) => req.user.role === "government" || d.state === req.user.state,
    ),
    states: db.states,
  });
});
app.patch("/api/official/slots/:id", roles("district"), async (req, res) => {
  const input = z
    .object({
      status: z.enum(steps),
      quantity: z.coerce.number().positive().optional(),
      quality: z.enum(["A", "B", "C"]).optional(),
    })
    .parse(req.body);
  await mutate((db) => {
    const slot = db.slots.find(
      (s) => s._id === req.params.id && scope(req.user, s),
    );
    if (!slot) fail(404, "Booking not found.");
    if (steps.indexOf(input.status) !== steps.indexOf(slot.status) + 1)
      fail(409, "Follow the procurement stages in order.");
    slot.status = input.status;
    db.queueTokens.find((x) => x._id === slot._id).status = input.status;
    if (input.status === "COMPLETED") {
      if (!input.quantity || !input.quality)
        fail(400, "Measured quantity and quality grade are required.");
      const crop = db.crops.find((c) => c.name === slot.crop),
        p = {
          ...slot,
          _id: id(),
          slotId: slot._id,
          quantity: input.quantity,
          quality: input.quality,
          price: crop.price,
          totalAmount: Math.round(input.quantity * crop.price * 100) / 100,
          verifiedBy: req.user._id,
          createdAt: new Date().toISOString(),
        };
      db.procurements.push(p);
      db.payments.push({
        _id: id(),
        farmerId: p.farmerId,
        farmerName: p.farmerName,
        procurementId: p._id,
        state: p.state,
        district: p.district,
        amount: p.totalAmount,
        status: "NOT INITIATED",
        createdAt: p.createdAt,
      });
    }
    notify(
      db,
      slot.farmerId,
      "Procurement update",
      `${slot.tokenNumber}: ${input.status.toLowerCase()}`,
    );
    audit(db, req.user, `Token ${slot.tokenNumber}: ${input.status}`);
  });
  changed();
  res.json({ ok: true });
});
app.patch("/api/official/payments/:id", roles("district"), async (req, res) => {
  const input = z
    .object({
      status: z.enum(["PROCESSING", "COMPLETED", "FAILED", "ON HOLD"]),
      transactionId: z.string().max(100).optional(),
    })
    .parse(req.body);
  await mutate((db) => {
    const p = db.payments.find(
      (p) => p._id === req.params.id && scope(req.user, p),
    );
    if (!p) fail(404, "Payment not found.");
    const allowed = {
      "NOT INITIATED": ["PROCESSING", "ON HOLD"],
      PROCESSING: ["COMPLETED", "FAILED", "ON HOLD"],
      FAILED: ["PROCESSING"],
      "ON HOLD": ["PROCESSING"],
    };
    if (!allowed[p.status]?.includes(input.status))
      fail(409, "Invalid payment transition.");
    if (input.status === "COMPLETED" && !input.transactionId?.trim())
      fail(400, "A bank transaction reference is required.");
    Object.assign(p, input, {
      paymentDate:
        input.status === "COMPLETED" ? new Date().toISOString() : null,
    });
    notify(
      db,
      p.farmerId,
      "Payment update",
      `Payment of ₹${p.amount} is ${p.status.toLowerCase()}.`,
    );
    audit(db, req.user, `Payment status: ${p.status}`);
  });
  changed();
  res.json({ ok: true });
});
app.patch("/api/official/farmers/:id", roles("district"), async (req, res) => {
  await mutate((db) => {
    const u = db.users.find(
      (u) =>
        u._id === req.params.id && u.role === "farmer" && scope(req.user, u),
    );
    if (!u) fail(404, "Farmer not found.");
    const f = db.farmers.find((f) => f.userId === u._id);
    if (!demo && ['Aadhaar Document','PAN Document','Signature'].some(type => !db.documents.some(d => d.farmerId === u._id && d.type === type))) fail(409,'Review the required identity documents and signature before verification.');
    f.verificationStatus = "VERIFIED";
    audit(db, req.user, "Farmer verified");
    notify(
      db,
      u._id,
      "Verification complete",
      "Your farmer profile has been verified.",
    );
  });
  changed();
  res.json({ ok: true });
});
app.patch("/api/official/centres/:id", roles("district"), async (req, res) => {
  const d = z
    .object({
      status: z.enum(["Normal", "Busy", "Full", "Closed"]),
      capacity: z.coerce.number().int().min(1).max(500),
    })
    .parse(req.body);
  await mutate((db) => {
    const c = db.procurementCentres.find(
      (c) => c._id === req.params.id && scope(req.user, c),
    );
    if (!c) fail(404, "Centre not found.");
    Object.assign(c, d);
    audit(db, req.user, "Centre modified");
    if (c.status === "Closed")
      for (const s of db.slots.filter(
        (s) =>
          s.centreId === c._id &&
          !["COMPLETED", "CANCELLED"].includes(s.status),
      ))
        notify(
          db,
          s.farmerId,
          "Centre closure",
          `${c.name} is closed. Please contact the centre about your booking.`,
        );
  });
  changed();
  res.json({ ok: true });
});
app.post(
  "/api/official/notifications",
  roles("district", "state", "government"),
  async (req, res) => {
    const d = z
      .object({
        title: z.string().min(3).max(100),
        message: z.string().min(5).max(1000),
      })
      .parse(req.body);
    await mutate((db) => {
      for (const u of db.users.filter(
        (u) => u.role === "farmer" && scope(req.user, u),
      ))
        notify(db, u._id, d.title, d.message);
      audit(db, req.user, "Announcement published");
    });
    changed();
    res.json({ ok: true });
  },
);
await fs.mkdir("uploads", { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    cb(
      null,
      ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype),
    ),
});
app.post(
  "/api/documents",
  roles("farmer"),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) fail(400, "Choose a PDF, PNG or JPEG up to 5 MB.");
    const type = z
      .enum(["Profile Photo", "Aadhaar Document", "PAN Document", "Signature"])
      .parse(req.body.type);
    const b = req.file.buffer;
    const valid =
      req.file.mimetype === "application/pdf"
        ? b.subarray(0, 5).toString() === "%PDF-"
        : req.file.mimetype === "image/png"
          ? b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : b[0] === 255 && b[1] === 216 && b[2] === 255;
    if (!valid) fail(400, "File content does not match the selected format.");
    const documentId = id();
    await fs.writeFile(
      path.join("uploads", documentId),
      encrypt(b.toString("base64"), key),
    );
    await mutate((db) => {
      db.documents.push({
        _id: documentId,
        farmerId: req.user._id,
        state: req.user.state,
        district: req.user.district,
        type,
        mime: req.file.mimetype,
        size: b.length,
        createdAt: new Date().toISOString(),
      });
      audit(db, req.user, "Document uploaded");
    });
    res.status(201).json({ ok: true });
  },
);
app.get("/api/documents", async (req, res) =>
  res.json((await read()).documents.filter((d) => scope(req.user, d))),
);
app.get("/api/documents/:id", async (req, res) => {
  const d = (await read()).documents.find(
    (d) => d._id === req.params.id && scope(req.user, d),
  );
  if (!d) fail(404, "Document not found.");
  const b = Buffer.from(
    await fs.readFile(path.join("uploads", d._id), "utf8"),
    "base64",
  );
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    b.subarray(0, 12),
  );
  decipher.setAuthTag(b.subarray(12, 28));
  const data = Buffer.concat([
    decipher.update(b.subarray(28)),
    decipher.final(),
  ]).toString();
  res
    .set({
      "Content-Type": d.mime,
      "Content-Disposition": `attachment; filename="${d.type.replaceAll(" ", "-")}.${d.mime === "application/pdf" ? "pdf" : d.mime === "image/png" ? "png" : "jpg"}"`,
      "Cache-Control": "no-store",
    })
    .send(Buffer.from(data, "base64"));
});
for (const role of ["district", "state", "government"])
  for (const [route, collection] of Object.entries({
    farmers: "users",
    centres: "procurementCentres",
    queue: "queueTokens",
    procurement: "procurements",
    payments: "payments",
    districts: "districts",
    states: "states",
    "audit-logs": "auditLogs",
    reports: "reports",
    analytics: "procurements",
    dashboard: "slots",
  }))
    app.get(`/api/${role}/${route}`, roles(role), async (req, res) => {
      if (route === "audit-logs" && role !== "government")
        fail(403, "Government access required.");
      const db = await read();
      res.json(
        db[collection]
          .filter(
            (r) =>
              (collection !== "users" || r.role === "farmer") &&
              (route === "audit-logs" || scope(req.user, r)),
          )
          .map((r) => (collection === "users" ? safe(r) : r)),
      );
    });
app.get(
  "/api/reports/:format",
  roles("district", "state", "government"),
  exportReport,
);
app.use("/api", (req, res) =>
  res.status(404).json({ message: "API endpoint not found." }),
);
if (prod) {
  app.use(express.static("dist"));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
}
app.use((err, req, res, next) => {
  const status =
    err instanceof z.ZodError
      ? 400
      : err instanceof multer.MulterError
        ? 400
        : err.status || 500;
  res
    .status(status)
    .json({
      message:
        err instanceof z.ZodError
          ? err.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : status === 500
            ? "Something went wrong. Please try again."
            : err.message,
    });
});
io.use(async (socket, next) => {
  try {
    const cookies = Object.fromEntries(
      (socket.handshake.headers.cookie || "")
        .split(";")
        .map((x) => x.trim().split("=")),
    );
    const t = jwt.verify(cookies.access, secret),
      db = await read();
    if (!db.sessions.some((s) => s._id === t.sid && s.expires > Date.now()))
      throw Error();
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});
startDelivery();
http.listen(Number(process.env.PORT || 4000), "0.0.0.0", () =>
  console.log(
    `e-Kharid API listening on ${process.env.PORT || 4000} (${demo ? "demo" : "production"})`,
  ),
);
