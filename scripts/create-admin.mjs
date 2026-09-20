import "dotenv/config";
import bcrypt from "bcryptjs";
import { initStore, mutate, id } from "../server/store.js";
const {
  ADMIN_NAME: name,
  ADMIN_EMAIL: email,
  ADMIN_PASSWORD: password,
  ADMIN_ROLE: role,
  ADMIN_DISTRICT: district,
  ADMIN_STATE: state,
  ADMIN_MOBILE: mobile,
} = process.env;
if (
  !name ||
  !email ||
  !password ||
  password.length < 14 ||
  !["district", "state", "government"].includes(role) ||
  !district ||
  !state ||
  !mobile
)
  throw Error(
    "Set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD (14+ chars), ADMIN_ROLE, ADMIN_DISTRICT, ADMIN_STATE and ADMIN_MOBILE.",
  );
if (!process.env.MONGODB_URI)
  throw Error("MONGODB_URI is required for official provisioning.");
await initStore(process.env.MONGODB_URI);
const passwordHash = await bcrypt.hash(password, 12);
await mutate((db) => {
  if (
    db.users.some((u) => u.email === email.toLowerCase() || u.mobile === mobile)
  )
    throw Error("Account already exists.");
  db.users.push({
    _id: id(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
    district,
    state,
    mobile,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
});
console.log("Official account created.");
process.exit(0);
