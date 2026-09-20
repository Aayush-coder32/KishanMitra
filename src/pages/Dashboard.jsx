import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import {
  LayoutDashboard,
  UserRound,
  CalendarDays,
  Clock3,
  Wheat,
  Wallet,
  Bell,
  FileText,
  CircleHelp,
  LogOut,
  MapPin,
  Users,
  Building2,
  ChartNoAxesCombined,
  Settings,
  ShieldCheck,
  Globe,
  Menu,
  X,
  ArrowRight,
  Plus,
  ChevronRight,
  Check,
  Download,
  RefreshCw,
  Sun,
  Search,
  Leaf,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "./Landing";
import CentreMap from "../components/CentreMap";
import DetailedAnalytics from "../components/DetailedAnalytics";
import { api, errorMessage } from "../services/api";
import {
  Badge,
  Card,
  Empty,
  Loading,
  Field,
  Stat,
  Table,
  Modal,
  money,
  date,
} from "../components/UI";
const steps = [
  "WAITING",
  "CALLED",
  "IN-PROCESS",
  "VERIFICATION",
  "WEIGHING",
  "QUALITY CHECK",
  "COMPLETED",
];
const farmerMenu = [
  ["", "Overview", LayoutDashboard],
  ["profile", "My profile", UserRound],
  ["book", "Book a slot", CalendarDays],
  ["slots", "My bookings", FileText],
  ["queue", "Live queue", Clock3],
  ["procurement", "Procurement", Wheat],
  ["payments", "Payments", Wallet],
  ["notifications", "Notifications", Bell],
  ["documents", "My documents", ShieldCheck],
];
const officialMenu = [
  ["", "Overview", LayoutDashboard],
  ["farmers", "Farmers", Users],
  ["centres", "Procurement centres", Building2],
  ["slots", "Slot management", CalendarDays],
  ["queue", "Live queue", Clock3],
  ["procurement", "Procurement", Wheat],
  ["payments", "Payments", Wallet],
  ["notifications", "Notifications", Bell],
  ["reports", "Reports", FileText],
  ["documents", "Verification documents", ShieldCheck],
  ["analytics", "Analytics", ChartNoAxesCombined],
];
export default function Dashboard({ user, onLogout, config }) {
  const loc = useLocation(),
    nav = useNavigate(),
    page = loc.pathname.split("/")[2] || "";
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  const farmer = user.role === "farmer";
  const menu = farmer
    ? farmerMenu
    : [
        ...officialMenu,
        ...(["state", "government"].includes(user.role)
          ? [["districts", "Districts", MapPin]]
          : []),
        ...(user.role === "government"
          ? [
              ["states", "States", Globe],
              ["audit-logs", "Audit logs", ShieldCheck],
            ]
          : []),
      ];
  const load = useCallback(async () => {
    try {
      setData((await api.get("/dashboard")).data);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    load();
    const socket = io(
      import.meta.env.VITE_API_URL
        ? new URL(import.meta.env.VITE_API_URL).origin
        : window.location.origin,
      { withCredentials: true },
    );
    socket.on("changed", load);
    const timer = setInterval(load, 30000);
    return () => {
      socket.disconnect();
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    setMobile(false);
  }, [page]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function action(fn, message) {
    try {
      await fn();
      await load();
      setToast(message || "Changes saved.");
      return true;
    } catch (e) {
      setToast(errorMessage(e));
      return false;
    }
  }
  async function logout() {
    if (await action(() => api.post("/auth/logout"), "Signed out")) {
      onLogout();
      nav("/login");
    }
  }
  const title =
    menu.find((m) => m[0] === page)?.[1] ||
    { help: "Help & support", settings: "Settings" }[page] ||
    "Workspace";
  const active = data?.slots.find(
    (s) => !["COMPLETED", "CANCELLED"].includes(s.status),
  );
  return (
    <div className="workspace">
      <aside className={`sidebar ${mobile ? "visible" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-toggle icon-button"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          {farmer
            ? "FARMER WORKSPACE"
            : `${user.role.toUpperCase()} ADMINISTRATION`}
        </div>
        <nav>
          {menu.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={`/app/${path}`}
              end
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={19} />
              {label}
              {path === "notifications" &&
                data?.notifications.some((n) => !n.read) && (
                  <span className="notification-dot" />
                )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/app/help">
            <CircleHelp size={19} />
            Help & support
          </Link>
          {!farmer && (
            <Link to="/app/settings">
              <Settings size={19} />
              Settings
            </Link>
          )}
          <button onClick={logout}>
            <LogOut size={19} />
            Sign out
          </button>
          <div className="sidebar-person">
            <div className="avatar">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <strong>{user.name}</strong>
              <small>
                {farmer ? "Registered farmer" : `${user.role} administrator`}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <div>
            <button
              className="mobile-toggle icon-button"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} /> <strong>{title}</strong>
            </span>
          </div>
          <div className="top-actions">
            <span className="season">
              <Leaf size={15} /> Harvest season 2026–27
            </span>
            <button
              className="icon-button"
              title="Refresh data"
              onClick={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            >
              <RefreshCw size={18} className={refreshing ? "spin" : ""} />
            </button>
            <Link
              className="icon-button"
              to="/app/notifications"
              aria-label="Notifications"
            >
              <Bell size={20} />
            </Link>
            <span className="avatar small-avatar">{user.name[0]}</span>
          </div>
        </header>
        <main className="dashboard-content">
          {config?.demo && (
            <div className="demo-banner">
              <span>
                <span className="live-dot" /> DEMO WORKSPACE
              </span>{" "}
              Connected to {config.storage}. All activity here is for
              demonstration.
            </div>
          )}
          {error && (
            <div className="error">
              {error}
              <button onClick={load}>Retry</button>
            </div>
          )}
          {!data ? (
            <Loading />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {farmer
                      ? "YOUR FARM. YOUR PROGRESS."
                      : `${user.role === "government" ? "NATIONAL" : user.role === "state" ? user.state : user.district} PROCUREMENT MONITOR`}
                  </div>
                  <h1>
                    {!page
                      ? farmer
                        ? `Good day, ${user.name.split(" ")[0]}`
                        : `${user.role === "government" ? "National" : user.role === "state" ? "State" : "District"} overview`
                      : title}
                    {!page && farmer && <Sun size={28} className="sun" />}
                  </h1>
                  <p>
                    {!page
                      ? "Here’s what’s happening with your procurement today."
                      : descriptions[page] ||
                        "Your connected procurement workspace."}
                  </p>
                </div>
                {farmer && page !== "book" ? (
                  <Link className="button" to="/app/book">
                    <Plus size={18} />
                    Book a slot
                  </Link>
                ) : (
                  <span className="today">
                    <CalendarDays size={17} />
                    {date(new Date())}
                  </span>
                )}
              </div>
              {!menu.some((m) => m[0] === page) &&
                !["help", "settings"].includes(page) && (
                  <Card title="Page unavailable">
                    <p>This page is not available for your role.</p>
                    <Link className="text-link" to="/app">
                      Return to overview
                    </Link>
                  </Card>
                )}
              {!page && <Overview {...{ data, user, active, farmer }} />}
              {page === "book" && farmer && (
                <Booking
                  data={data}
                  action={action}
                  onDone={() => nav("/app/slots")}
                />
              )}
              {page === "slots" && <Slots {...{ data, user, action }} />}
              {page === "queue" && <Queue {...{ data, user, action }} />}
              {page === "procurement" && (
                <Procurement {...{ data, user, action }} />
              )}
              {page === "payments" && <Payments {...{ data, user, action }} />}
              {page === "profile" && farmer && <Profile action={action} />}
              {page === "documents" && (
                <Documents action={action} user={user} />
              )}
              {page === "notifications" && (
                <Notifications {...{ data, user, action }} />
              )}
              {page === "farmers" && !farmer && (
                <Farmers {...{ data, user, action }} />
              )}
              {page === "centres" && !farmer && (
                <Centres {...{ data, user, action }} />
              )}
              {["analytics", "states", "districts"].includes(page) &&
                !farmer && (
                  <>
                    <Analytics
                      data={data}
                      group={page === "districts" ? "district" : "state"}
                    />
                    {page === "analytics" && <DetailedAnalytics data={data} />}
                  </>
                )}
              {page === "reports" && !farmer && <Reports action={action} />}
              {page === "audit-logs" && user.role === "government" && <Audit />}
              {page === "help" && <Help />}
              {page === "settings" && (
                <Card title="Workspace settings">
                  <p>
                    Role and jurisdiction are assigned by the deployment
                    administrator.
                  </p>
                  <dl className="details">
                    <dt>Role</dt>
                    <dd>{user.role}</dd>
                    <dt>State</dt>
                    <dd>{user.state}</dd>
                    <dt>District</dt>
                    <dd>{user.district}</dd>
                    <dt>Session security</dt>
                    <dd>HTTP-only cookies · 15-minute access tokens</dd>
                  </dl>
                  <Link to="/forgot-password" className="button secondary">
                    Reset password
                  </Link>
                </Card>
              )}
            </>
          )}
          <div className="dashboard-footer">
            <span>
              <ShieldCheck size={14} /> Secure, transparent & farmer-first
            </span>
            <span>e-Kharid · SIH26032</span>
          </div>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label="Dismiss" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {farmer && (
        <nav className="bottom-nav">
          {[
            ["", "Home", LayoutDashboard],
            ["book", "Book slot", CalendarDays],
            ["queue", "Queue", Clock3],
            ["procurement", "Procurement", Wheat],
            ["profile", "Profile", UserRound],
          ].map(([p, l, I]) => (
            <NavLink end key={p} to={`/app/${p}`}>
              <I size={19} />
              {l}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
const descriptions = {
  book: "Choose a nearby centre and a convenient time for your harvest.",
  slots: "Your scheduled visits, all in one place.",
  queue: "Follow token progress and plan your arrival.",
  procurement: "From arrival to quality checks—follow every stage.",
  payments: "A clear view of your procurement payments.",
  documents: "Keep your verification documents together, securely.",
  notifications: "The latest updates from your procurement journey.",
  reports: "Export procurement records within your jurisdiction.",
  farmers: "Review farmer profiles and verification status.",
  centres: "Monitor capacity and availability across procurement centres.",
};
function Overview({ data, user, active, farmer }) {
  const total = data.payments.reduce((s, p) => s + p.amount, 0),
    pending = data.payments
      .filter((p) => p.status !== "COMPLETED")
      .reduce((s, p) => s + p.amount, 0);
  return (
    <>
      <div className="stats-grid">
        {farmer ? (
          <>
            <Stat
              label="Next procurement slot"
              value={
                active ? date(active.date).replace(/ 202\d/, "") : "Not booked"
              }
              detail={
                active
                  ? `${active.timeSlot} · ${active.centreName}`
                  : "Choose a time that works for you"
              }
              icon={CalendarDays}
            />
            <Stat
              label="Your token"
              value={active?.tokenNumber || "—"}
              detail={active ? active.status : "Book a slot to join the queue"}
              icon={Clock3}
              tone="blue"
            />
            <Stat
              label="Procurement completed"
              value={`${data.procurements.reduce((s, p) => s + p.quantity, 0)} q`}
              detail={`${data.procurements.length} completed deliveries`}
              icon={Wheat}
              tone="amber"
            />
            <Stat
              label="Total procurement value"
              value={money(total)}
              detail={`${money(pending)} awaiting payment`}
              icon={Wallet}
            />
          </>
        ) : (
          <>
            <Stat
              label="Registered farmers"
              value={data.farmers.length}
              detail="Within your jurisdiction"
              icon={Users}
            />
            <Stat
              label="Active bookings"
              value={
                data.slots.filter(
                  (s) => !["COMPLETED", "CANCELLED"].includes(s.status),
                ).length
              }
              detail="Across procurement centres"
              icon={CalendarDays}
              tone="blue"
            />
            <Stat
              label="Procurement volume"
              value={`${data.procurements.reduce((s, p) => s + p.quantity, 0)} q`}
              detail={`${data.procurements.length} completed procurements`}
              icon={Wheat}
              tone="amber"
            />
            <Stat
              label="Pending payments"
              value={money(pending)}
              detail={`${data.payments.filter((p) => p.status !== "COMPLETED").length} pending transactions`}
              icon={Wallet}
            />
          </>
        )}
      </div>
      {farmer ? (
        <>
          <div className="dashboard-two">
            <Card
              title="Your next visit"
              subtitle="A little planning for a smoother day"
              action={
                <Link to="/app/slots" className="text-link">
                  All bookings <ArrowUpRight size={15} />
                </Link>
              }
            >
              {active ? (
                <>
                  <div className="visit-top">
                    <span className="centre-icon">
                      <Building2 size={27} />
                    </span>
                    <div>
                      <h3>{active.centreName}</h3>
                      <p>
                        <MapPin size={13} />
                        {active.district}, {active.state}
                      </p>
                    </div>
                    <Badge>{active.status}</Badge>
                  </div>
                  <div className="visit-details">
                    <div>
                      <span>DATE</span>
                      <strong>{date(active.date)}</strong>
                    </div>
                    <div>
                      <span>TIME SLOT</span>
                      <strong>{active.timeSlot}</strong>
                    </div>
                    <div>
                      <span>CROP & QUANTITY</span>
                      <strong>
                        {active.crop} · {active.quantity} q
                      </strong>
                    </div>
                  </div>
                  <div className="ticket-footer">
                    <span>
                      Your digital token <strong>{active.tokenNumber}</strong>
                    </span>
                    <Link to="/app/queue">
                      Track live queue <ArrowRight size={16} />
                    </Link>
                  </div>
                </>
              ) : (
                <div className="book-prompt">
                  <div className="illustration-circle">
                    <CalendarDays size={43} />
                    <span>
                      <Plus size={17} />
                    </span>
                  </div>
                  <h3>Your next harvest starts here</h3>
                  <p>
                    Choose your centre, find an available time,
                    <br />
                    and let us take care of your token.
                  </p>
                  <Link className="button" to="/app/book">
                    Book your first slot <ArrowRight size={17} />
                  </Link>
                </div>
              )}
            </Card>
            <div className="journey-card">
              <div className="eyebrow">EVERY STEP, CONNECTED</div>
              <h3>Your procurement journey</h3>
              <p>From your field to your payment.</p>
              <div className="journey-list">
                {[
                  "Registration complete",
                  "Book your procurement slot",
                  "Visit & verify at the centre",
                  "Weighing & quality check",
                  "Procurement & payment",
                ].map((s, i) => (
                  <div
                    key={s}
                    className={i === 0 || (active && i === 1) ? "done" : ""}
                  >
                    <span>{i === 0 ? <Check size={13} /> : i + 1}</span>
                    <div>
                      <strong>{s}</strong>
                      <small>
                        {
                          [
                            "You’re ready to get started",
                            "Choose a convenient date and time",
                            "Bring your token and documents",
                            "Your crop, measured transparently",
                            "Track payment in your dashboard",
                          ][i]
                        }
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="dashboard-two lower">
            <Card
              title="Recent updates"
              action={
                <Link to="/app/notifications" className="text-link">
                  View all <ArrowRight size={15} />
                </Link>
              }
            >
              {data.notifications
                .slice(-3)
                .reverse()
                .map((n) => (
                  <div className="notification-row" key={n._id}>
                    <span className="feature-icon">
                      <Bell size={19} />
                    </span>
                    <div>
                      <strong>{n.title}</strong>
                      <p>{n.message}</p>
                      <small>{date(n.createdAt)}</small>
                    </div>
                  </div>
                ))}
              {!data.notifications.length && (
                <Empty title="You’re all caught up" />
              )}
            </Card>
            <Card
              title="Before you head out"
              subtitle="A quick checklist for your visit"
            >
              <div className="checklist">
                {[
                  "Carry your booking token and photo ID",
                  "Bring your crop and required documents",
                  "Check the live queue before leaving",
                  "Keep your registered mobile handy",
                ].map((t) => (
                  <p key={t}>
                    <span>
                      <Check size={13} />
                    </span>
                    {t}
                  </p>
                ))}
              </div>
              <Link to="/app/help" className="help-link">
                <CircleHelp size={18} />
                Need help with your visit?
                <ArrowRight size={17} />
              </Link>
            </Card>
          </div>
        </>
      ) : (
        <>
          <Card
            title={
              user.role === "government"
                ? "National procurement network"
                : "Procurement centre activity"
            }
            subtitle="Select a centre marker to view capacity and activity."
          >
            <CentreMap data={data} national={user.role === "government"} />
          </Card>
          <Analytics data={data} />
          <Card
            title="Recent bookings"
            action={
              <Link to="/app/slots" className="text-link">
                Manage slots <ArrowRight size={16} />
              </Link>
            }
          >
            <BookingTable rows={data.slots.slice(-5).reverse()} />
          </Card>
        </>
      )}
    </>
  );
}
function Booking({ data, action, onDone }) {
  const [district, setDistrict] = useState(data.centres[0]?.district || ""),
    [centre, setCentre] = useState(data.centres[0]?._id || ""),
    [day, setDay] = useState(
      new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    ),
    [time, setTime] = useState("09:00"),
    [busy, setBusy] = useState(false),
    [quantity, setQuantity] = useState(10),
    [crop, setCrop] = useState("Wheat"),
    [availability, setAvailability] = useState([]);
  useEffect(() => {
    if (centre)
      api
        .get("/availability", { params: { centreId: centre, date: day } })
        .then((r) => setAvailability(r.data))
        .catch(() => setAvailability([]));
  }, [centre, day, data]);
  const c = data.centres.find((c) => c._id === centre);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await action(
      () =>
        api.post("/farmer/slot", {
          centreId: centre,
          date: day,
          timeSlot: time,
          crop,
          quantity,
        }),
      "Your slot is confirmed. Your digital token is ready.",
    );
    setBusy(false);
    if (ok) onDone();
  }
  return (
    <div className="booking-layout">
      <Card
        title="Plan your procurement visit"
        subtitle="Availability is confirmed securely when you book."
      >
        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="District">
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setCentre(
                    data.centres.find((c) => c.district === e.target.value)
                      ?._id || "",
                  );
                }}
              >
                {[...new Set(data.centres.map((c) => c.district))].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Procurement centre">
              <select
                required
                value={centre}
                onChange={(e) => setCentre(e.target.value)}
              >
                {data.centres
                  .filter((c) => c.district === district)
                  .map((c) => (
                    <option
                      key={c._id}
                      value={c._id}
                      disabled={c.status === "Closed"}
                    >
                      {c.name}
                      {c.status === "Closed" ? " (Closed)" : ""}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Crop">
              <select value={crop} onChange={(e) => setCrop(e.target.value)}>
                {["Wheat", "Paddy", "Maize", "Mustard"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Quantity (quintals)"
              type="number"
              min="0.01"
              max="10000"
              step="0.01"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Field
              label="Preferred date"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              max={new Date(Date.now() + 30 * 86400000)
                .toISOString()
                .slice(0, 10)}
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <label className="field">
            <span>Select a time slot</span>
          </label>
          <div className="time-options">
            {["09:00", "11:00", "14:00"].map((t) => (
              <button
                type="button"
                key={t}
                className={time === t ? "selected" : ""}
                disabled={
                  availability.find((a) => a.timeSlot === t)?.available === 0
                }
                onClick={() => setTime(t)}
              >
                <Clock3 size={17} />
                <strong>{t}</strong>
                <small>
                  {availability.find((a) => a.timeSlot === t)?.available ?? "…"}{" "}
                  places available
                </small>
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button
              className="button"
              disabled={
                busy ||
                !centre ||
                availability.find((a) => a.timeSlot === time)?.available === 0
              }
            >
              {busy ? "Confirming…" : "Confirm booking"}
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </Card>
      <div className="booking-summary">
        <div className="feature-icon">
          <CalendarDays />
        </div>
        <h3>Your visit at a glance</h3>
        <dl className="details">
          <dt>Centre</dt>
          <dd>{c?.name || "Choose a centre"}</dd>
          <dt>Date</dt>
          <dd>{date(day)}</dd>
          <dt>Time</dt>
          <dd>{time}</dd>
          <dt>Your harvest</dt>
          <dd>
            {crop} · {quantity} quintals
          </dd>
          <dt>Capacity per window</dt>
          <dd>{c?.capacity || 0} farmers</dd>
        </dl>
        <p>
          <ShieldCheck size={18} />
          Your token is generated once your booking is confirmed.
        </p>
      </div>
    </div>
  );
}
function BookingTable({ rows, actions }) {
  return (
    <Table
      rows={rows}
      columns={[
        {
          key: "tokenNumber",
          label: "Token",
          render: (r) => (
            <strong className="token-text">{r.tokenNumber}</strong>
          ),
        },
        { key: "farmerName", label: "Farmer" },
        { key: "centreName", label: "Procurement centre" },
        {
          key: "date",
          label: "Visit",
          render: (r) => (
            <>
              {date(r.date)}
              <small className="block">{r.timeSlot}</small>
            </>
          ),
        },
        { key: "crop", label: "Crop" },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge>{r.status}</Badge>,
        },
        ...(actions
          ? [{ key: "actions", label: "Action", render: actions }]
          : []),
      ]}
    />
  );
}
function Slots({ data, user, action }) {
  const [cancel, setCancel] = useState(null);
  return (
    <>
      <Card
        title="Procurement bookings"
        subtitle={`${data.slots.length} bookings in your workspace`}
      >
        <BookingTable
          rows={[...data.slots].reverse()}
          actions={
            user.role === "farmer"
              ? (r) =>
                  r.status === "WAITING" && (
                    <button
                      className="text-button danger"
                      onClick={() => setCancel(r)}
                    >
                      Cancel
                    </button>
                  )
              : undefined
          }
        />
      </Card>
      {cancel && (
        <Modal title="Cancel this booking?" onClose={() => setCancel(null)}>
          <p>
            Token {cancel.tokenNumber} at {cancel.centreName} will be cancelled.
            You can book a new slot afterwards.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setCancel(null)}
            >
              Keep booking
            </button>
            <button
              className="button"
              onClick={async () => {
                if (
                  await action(
                    () => api.delete(`/farmer/slots/${cancel._id}`),
                    "Booking cancelled.",
                  )
                )
                  setCancel(null);
              }}
            >
              Cancel booking
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Queue({ data, user, action }) {
  const [queue, setQueue] = useState(null);
  useEffect(() => {
    if (user.role === "farmer")
      api
        .get("/farmer/queue")
        .then((r) => setQueue(r.data))
        .catch(() => {});
  }, [data, user.role]);
  if (user.role !== "farmer")
    return (
      <>
        <div className="centre-grid">
          {data.centres.map((c) => {
            const rows = data.slots.filter(
              (s) =>
                s.centreId === c._id &&
                !["COMPLETED", "CANCELLED"].includes(s.status),
            );
            return (
              <Card
                key={c._id}
                title={c.name}
                action={<Badge>{c.status}</Badge>}
              >
                <div className="queue-number">
                  {rows.length}
                  <small>farmers with active bookings</small>
                </div>
                <p className="muted">Capacity: {c.capacity} per time window</p>
              </Card>
            );
          })}
        </div>
        <Procurement data={data} user={user} action={action} />
      </>
    );
  return queue ? (
    <>
      <div className="queue-hero">
        <div className="eyebrow">
          <span className="live-dot" /> LIVE QUEUE
        </div>
        <h2>{queue.centreName}</h2>
        <p>
          {date(queue.date)} · {queue.timeSlot}
        </p>
        <div className="queue-stats">
          <div>
            <small>Current token</small>
            <strong>{queue.currentToken}</strong>
          </div>
          <div className="your-token">
            <small>Your token</small>
            <strong>{queue.tokenNumber}</strong>
          </div>
          <div>
            <small>Farmers ahead</small>
            <strong>{queue.ahead}</strong>
          </div>
          <div>
            <small>Estimated wait</small>
            <strong>
              {queue.waitMinutes}
              <em> min</em>
            </strong>
          </div>
        </div>
        <Badge>{queue.status}</Badge>
        <p className="muted">
          Waiting time is an estimate based on 8 minutes per farmer in your time
          window. Check your booked date before travelling.
        </p>
      </div>
      <Timeline status={queue.status} />
    </>
  ) : (
    <Card title="Your live queue">
      <Empty
        title="Your place in line starts with a booking"
        action={
          <Link className="button" to="/app/book">
            Book a slot
          </Link>
        }
      />
    </Card>
  );
}
function Timeline({ status }) {
  return (
    <Card title="Procurement progress">
      <div className="timeline">
        {steps.map((s, i) => (
          <div key={s} className={i <= steps.indexOf(status) ? "complete" : ""}>
            <span>
              {i < steps.indexOf(status) ? <Check size={15} /> : i + 1}
            </span>
            <strong>{s.toLowerCase().replaceAll("-", " ")}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}
function Procurement({ data, user, action }) {
  const [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false);
  const active = data.slots.filter(
    (s) => !["COMPLETED", "CANCELLED"].includes(s.status),
  );
  async function advance(slot) {
    if (slot.status === "QUALITY CHECK") {
      setSelected(slot);
      return;
    }
    await action(
      () =>
        api.patch(`/official/slots/${slot._id}`, {
          status: steps[steps.indexOf(slot.status) + 1],
        }),
      "Procurement stage updated.",
    );
  }
  return (
    <>
      {user.role === "farmer" ? (
        active.map((s) => <Timeline key={s._id} status={s.status} />)
      ) : (
        <Card
          title="Active procurement"
          subtitle="Move each token through verification, weighing and quality checks."
        >
          <BookingTable
            rows={active}
            actions={
              user.role === "district"
                ? (r) => (
                    <button
                      className="button small secondary"
                      onClick={() => advance(r)}
                    >
                      {steps[steps.indexOf(r.status) + 1]?.toLowerCase()}
                      <ArrowRight size={14} />
                    </button>
                  )
                : undefined
            }
          />
        </Card>
      )}
      <Card title="Completed procurements">
        <Table
          rows={data.procurements}
          columns={[
            { key: "tokenNumber", label: "Token" },
            { key: "farmerName", label: "Farmer" },
            { key: "crop", label: "Crop" },
            { key: "quantity", label: "Quantity (q)" },
            { key: "quality", label: "Grade" },
            { key: "price", label: "Price / q", render: (r) => money(r.price) },
            {
              key: "totalAmount",
              label: "Total",
              render: (r) => <strong>{money(r.totalAmount)}</strong>,
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status}</Badge>,
            },
          ]}
        />
      </Card>
      {selected && (
        <Modal title="Complete procurement" onClose={() => setSelected(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const d = Object.fromEntries(new FormData(e.target));
              if (
                await action(
                  () =>
                    api.patch(`/official/slots/${selected._id}`, {
                      ...d,
                      status: "COMPLETED",
                    }),
                  "Procurement complete. Payment record created.",
                )
              )
                setSelected(null);
              setBusy(false);
            }}
          >
            <p>
              {selected.farmerName} · {selected.crop} · {selected.tokenNumber}
            </p>
            <Field
              label="Measured quantity (quintals)"
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              required
              defaultValue={selected.quantity}
            />
            <Field label="Quality grade">
              <select name="quality">
                <option>A</option>
                <option>B</option>
                <option>C</option>
              </select>
            </Field>
            <p className="muted">
              The configured crop price will be used to calculate the
              procurement amount.
            </p>
            <button className="button" disabled={busy}>
              Approve & complete
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Payments({ data, user, action }) {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <div className="stats-grid three">
        <Stat
          label="Total procurement value"
          value={money(data.payments.reduce((s, p) => s + p.amount, 0))}
          detail="Recorded procurement amount"
          icon={Wallet}
        />
        <Stat
          label="Payment completed"
          value={money(
            data.payments
              .filter((p) => p.status === "COMPLETED")
              .reduce((s, p) => s + p.amount, 0),
          )}
          detail="Confirmed by procurement officials"
          icon={ShieldCheck}
        />
        <Stat
          label="Awaiting payment"
          value={money(
            data.payments
              .filter((p) => p.status !== "COMPLETED")
              .reduce((s, p) => s + p.amount, 0),
          )}
          detail="Follow status below"
          icon={Clock3}
          tone="amber"
        />
      </div>
      <Card
        title="Payment history"
        subtitle="Payment tracking records bank updates; it does not transfer funds."
      >
        <Table
          rows={data.payments}
          columns={[
            { key: "farmerName", label: "Farmer" },
            {
              key: "amount",
              label: "Amount",
              render: (r) => <strong>{money(r.amount)}</strong>,
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status}</Badge>,
            },
            {
              key: "paymentDate",
              label: "Paid on",
              render: (r) => date(r.paymentDate),
            },
            { key: "transactionId", label: "Bank reference" },
            ...(user.role === "district"
              ? [
                  {
                    key: "action",
                    label: "Action",
                    render: (r) =>
                      r.status !== "COMPLETED" && (
                        <button
                          className="text-button"
                          onClick={() => setSelected(r)}
                        >
                          Update status
                        </button>
                      ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      {selected && (
        <Modal title="Update payment record" onClose={() => setSelected(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const d = Object.fromEntries(new FormData(e.target));
              if (
                await action(
                  () => api.patch(`/official/payments/${selected._id}`, d),
                  "Payment status updated.",
                )
              )
                setSelected(null);
            }}
          >
            <p>
              {selected.farmerName} · {money(selected.amount)}
            </p>
            <Field label="Next payment status">
              <select name="status">
                {(
                  {
                    "NOT INITIATED": ["PROCESSING", "ON HOLD"],
                    PROCESSING: ["COMPLETED", "FAILED", "ON HOLD"],
                    FAILED: ["PROCESSING"],
                    "ON HOLD": ["PROCESSING"],
                  }[selected.status] || []
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Bank transaction reference (required for completion)"
              name="transactionId"
            />
            <button className="button">Save payment update</button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Profile({ action }) {
  const [p, setP] = useState(null);
  useEffect(() => {
    api.get("/farmer/profile").then((r) => setP(r.data));
  }, []);
  if (!p) return <Loading />;
  return (
    <Card
      title="Your farmer profile"
      action={<Badge>{p.verificationStatus}</Badge>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action(
            () =>
              api.put(
                "/farmer/profile",
                Object.fromEntries(new FormData(e.target)),
              ),
            "Profile saved.",
          );
        }}
      >
        <div className="form-grid">
          <Field label="Full name" name="name" defaultValue={p.name} required />
          <Field label="Farmer ID" value={p.farmerId} readOnly />
          <Field label="Email" value={p.email} readOnly />
          <Field label="Mobile" value={p.mobile} readOnly />
          <Field
            label="Address"
            name="address"
            defaultValue={p.address || ""}
          />
          <Field
            label="Village"
            name="village"
            defaultValue={p.village || ""}
          />
          <Field label="Aadhaar (masked)" value={p.aadhaar} readOnly />
          <Field label="PAN (masked)" value={p.pan} readOnly />
          <Field label="District" value={p.district} readOnly />
          <Field label="State" value={p.state} readOnly />
        </div>
        <button className="button">Save changes</button>
      </form>
    </Card>
  );
}
function Documents({ action, user }) {
  const [docs, setDocs] = useState([]),
    [busy, setBusy] = useState(false);
  const location = useLocation();
  const load = () => api.get("/documents").then((r) => setDocs(r.data));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      {location.state?.message && (
        <div className="error">{location.state.message}</div>
      )}
      {user.role === "farmer" && (
        <Card
          title="Upload a document"
          subtitle="Encrypted storage · PDF, JPG or PNG · Maximum 5 MB"
        >
          <form
            className="upload-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              setBusy(true);
              if (
                await action(
                  () => api.post("/documents", new FormData(form)),
                  "Document securely uploaded.",
                )
              ) {
                form.reset();
                await load();
              }
              setBusy(false);
            }}
          >
            <Field label="Document type">
              <select name="type">
                {[
                  "Profile Photo",
                  "Aadhaar Document",
                  "PAN Document",
                  "Signature",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Choose file"
              type="file"
              name="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
            />
            <button className="button" disabled={busy}>
              {busy ? "Uploading…" : "Upload document"}
            </button>
          </form>
        </Card>
      )}
      <Card
        title={
          user.role === "farmer"
            ? "Your documents"
            : "Farmer verification documents"
        }
      >
        <Table
          rows={docs}
          columns={[
            { key: "type", label: "Document" },
            {
              key: "createdAt",
              label: "Uploaded",
              render: (r) => date(r.createdAt),
            },
            {
              key: "size",
              label: "Size",
              render: (r) => `${Math.ceil(r.size / 1024)} KB`,
            },
            {
              key: "action",
              label: "Download",
              render: (r) => (
                <button
                  className="text-button"
                  onClick={() =>
                    download(
                      `/documents/${r._id}`,
                      `${r.type}.${r.mime === "application/pdf" ? "pdf" : r.mime === "image/png" ? "png" : "jpg"}`,
                      action,
                    )
                  }
                >
                  <Download size={17} />
                  Download
                </button>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
function Notifications({ data, user, action }) {
  return (
    <>
      {user.role !== "farmer" && (
        <Card
          title="Publish an announcement"
          subtitle="Delivered to farmers within your jurisdiction."
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              if (
                await action(
                  () =>
                    api.post(
                      "/official/notifications",
                      Object.fromEntries(new FormData(form)),
                    ),
                  "Announcement published.",
                )
              )
                form.reset();
            }}
          >
            <Field
              label="Title"
              name="title"
              minLength={3}
              maxLength={100}
              required
            />
            <Field label="Message">
              <textarea
                name="message"
                minLength={5}
                maxLength={1000}
                required
                rows={4}
              />
            </Field>
            <button className="button">Publish announcement</button>
          </form>
        </Card>
      )}
      <Card title="Your updates">
        {data.notifications.length ? (
          [...data.notifications].reverse().map((n) => (
            <div
              className={`notification-row ${!n.read ? "unread" : ""}`}
              key={n._id}
            >
              <span className="feature-icon">
                <Bell size={19} />
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>{date(n.createdAt)}</small>
              </div>
              {!n.read && (
                <button
                  className="text-button"
                  onClick={() =>
                    action(
                      () => api.patch(`/notifications/${n._id}`),
                      "Marked as read.",
                    )
                  }
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty title="You’re all caught up" />
        )}
      </Card>
    </>
  );
}
function Farmers({ data, user, action }) {
  const [search, setSearch] = useState("");
  return (
    <Card
      title="Registered farmers"
      action={
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search farmers"
            placeholder="Search farmers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      }
    >
      <Table
        rows={data.farmers.filter((f) =>
          `${f.name} ${f.mobile}`.toLowerCase().includes(search.toLowerCase()),
        )}
        columns={[
          { key: "name", label: "Farmer" },
          { key: "mobile", label: "Mobile" },
          { key: "district", label: "District" },
          { key: "state", label: "State" },
          {
            key: "verificationStatus",
            label: "Verification",
            render: (r) => <Badge>{r.verificationStatus}</Badge>,
          },
          ...(user.role === "district"
            ? [
                {
                  key: "action",
                  label: "Action",
                  render: (r) =>
                    r.verificationStatus !== "VERIFIED" && (
                      <button
                        className="text-button"
                        onClick={() =>
                          action(
                            () => api.patch(`/official/farmers/${r._id}`),
                            "Farmer verified.",
                          )
                        }
                      >
                        Verify farmer
                      </button>
                    ),
                },
              ]
            : []),
        ]}
      />
    </Card>
  );
}
function Centres({ data, user, action }) {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <Card
        title="Centre locations"
        subtitle="Select a marker for centre activity."
      >
        <CentreMap data={data} national={user.role === "government"} />
      </Card>
      <div className="centre-grid">
        {data.centres.map((c) => (
          <Card key={c._id} title={c.name} action={<Badge>{c.status}</Badge>}>
            <p className="muted">
              <MapPin size={15} />
              {c.address}
            </p>
            <dl className="details">
              <dt>District</dt>
              <dd>{c.district}</dd>
              <dt>Capacity / window</dt>
              <dd>{c.capacity} farmers</dd>
              <dt>Active bookings</dt>
              <dd>
                {
                  data.slots.filter(
                    (s) =>
                      s.centreId === c._id &&
                      !["COMPLETED", "CANCELLED"].includes(s.status),
                  ).length
                }
              </dd>
            </dl>
            <a
              className="text-link"
              href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=13/${c.latitude}/${c.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              View location <ArrowUpRight size={15} />
            </a>
            {user.role === "district" && (
              <button
                className="button secondary small"
                onClick={() => setSelected(c)}
              >
                Manage centre
              </button>
            )}
          </Card>
        ))}
      </div>
      {selected && (
        <Modal
          title="Manage procurement centre"
          onClose={() => setSelected(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action(
                  () =>
                    api.patch(
                      `/official/centres/${selected._id}`,
                      Object.fromEntries(new FormData(e.target)),
                    ),
                  "Centre updated.",
                )
              )
                setSelected(null);
            }}
          >
            <Field label="Status">
              <select name="status" defaultValue={selected.status}>
                {["Normal", "Busy", "Full", "Closed"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Capacity per time window"
              name="capacity"
              type="number"
              min="1"
              max="500"
              defaultValue={selected.capacity}
              required
            />
            <button className="button">Save centre</button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Analytics({ data, group = "district" }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      day: new Date(d).toLocaleDateString("en-IN", { weekday: "short" }),
      quantity: data.procurements
        .filter((p) => p.createdAt.startsWith(d))
        .reduce((s, p) => s + p.quantity, 0),
      bookings: data.slots.filter((p) => p.createdAt.startsWith(d)).length,
    };
  });
  const grouped = [...new Set(data.centres.map((c) => c[group]))].map(
    (name) => ({
      name,
      quantity: data.procurements
        .filter((p) => p[group] === name)
        .reduce((s, p) => s + p.quantity, 0),
      centres: data.centres.filter((c) => c[group] === name).length,
      farmers: data.farmers.filter((f) => f[group] === name).length,
    }),
  );
  return (
    <>
      <div className="dashboard-two">
        <Card
          title="Procurement trend"
          subtitle="Last 7 days · Quantity in quintals"
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f7950" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#2f7950" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0eb" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="quantity"
                  stroke="#2f7950"
                  strokeWidth={3}
                  fill="url(#area)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card
          title="Daily bookings"
          subtitle="Actual booking activity · Last 7 days"
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <CartesianGrid vertical={false} stroke="#edf0eb" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="bookings" fill="#81a894" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card title={`${group === "state" ? "State" : "District"} performance`}>
        <Table
          rows={grouped}
          columns={[
            { key: "name", label: group === "state" ? "State" : "District" },
            { key: "centres", label: "Active centres" },
            { key: "farmers", label: "Registered farmers" },
            { key: "quantity", label: "Procurement (q)" },
          ]}
        />
      </Card>
    </>
  );
}
async function download(url, filename, action) {
  await action(async () => {
    const r = await api.get(url, { responseType: "blob" }),
      href = URL.createObjectURL(r.data),
      a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }, "Download ready.");
}
function Reports({ action }) {
  const [period, setPeriod] = useState("monthly"),
    [type, setType] = useState("procurement");
  return (
    <Card
      title="Generate a procurement report"
      subtitle="Exports include only records accessible to your role."
    >
      <Field label="Report type">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {["procurement", "payments", "queue", "district", "state"].map(
            (t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)} report
              </option>
            ),
          )}
        </select>
      </Field>
      <Field label="Reporting period">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="daily">Last 24 hours</option>
          <option value="weekly">Last 7 days</option>
          <option value="monthly">Last 31 days</option>
        </select>
      </Field>
      <div className="report-options">
        {["pdf", "csv", "xlsx"].map((f) => (
          <button
            key={f}
            onClick={() =>
              download(
                `/reports/${f}?period=${period}&type=${type}`,
                `e-kharid-${period}.${f}`,
                action,
              )
            }
          >
            <FileText size={30} />
            <strong>{f.toUpperCase()}</strong>
            <span>
              Download report <Download size={16} />
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
function Audit() {
  const [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api
      .get("/government/audit-logs")
      .then((r) => setRows(r.data.reverse()))
      .catch((e) => setError(errorMessage(e)));
  }, []);
  return (
    <Card title="Administrative audit trail">
      {error ? (
        <p className="error">{error}</p>
      ) : rows ? (
        <Table
          rows={rows}
          columns={[
            {
              key: "createdAt",
              label: "Timestamp",
              render: (r) => new Date(r.createdAt).toLocaleString("en-IN"),
            },
            { key: "name", label: "User" },
            { key: "role", label: "Role" },
            { key: "action", label: "Action" },
          ]}
        />
      ) : (
        <Loading />
      )}
    </Card>
  );
}
function Help() {
  return (
    <Card
      title="A little help for your next step"
      subtitle="Answers to common procurement questions."
    >
      {[
        [
          "How do I book a slot?",
          "Open Book a slot, choose your district, centre, crop and available date. Confirm to receive your digital token. You can hold one active booking at a time.",
        ],
        [
          "When should I arrive?",
          "Use your booked date and time window. Check Live queue before travelling. Waiting times are estimates and may change with verification and crop quality checks.",
        ],
        [
          "Can I change my booking?",
          "You can cancel a waiting booking in My bookings, then select a new slot. Once processing begins, contact the centre.",
        ],
        [
          "When will I receive payment?",
          "Payments are updated by district officials after procurement. Open Payments to see the latest status and bank reference. Contact your centre for payment dates or failed transactions.",
        ],
        [
          "How are my documents protected?",
          "Documents are encrypted on the server and downloads require an authenticated account with access to the record.",
        ],
        [
          "Need more help?",
          "Contact your district procurement office or centre directly. This demonstration does not operate a public support helpline.",
        ],
      ].map(([q, a]) => (
        <details className="faq" key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </Card>
  );
}
