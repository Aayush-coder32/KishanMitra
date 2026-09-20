import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card } from "./UI";
const colors = ["#527948", "#8ba772", "#c9b16d", "#8baab2", "#c48e7a"];
function Bars({ rows, color = "#73975b" }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid vertical={false} stroke="#edf0eb" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} />
          <Tooltip />
          <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export default function DetailedAnalytics({ data }) {
  const crops = [...new Set(data.procurements.map((p) => p.crop))].map(
    (name) => ({
      name,
      value: data.procurements
        .filter((p) => p.crop === name)
        .reduce((s, p) => s + p.quantity, 0),
    }),
  );
  const payments = [...new Set(data.payments.map((p) => p.status))].map(
    (name) => ({
      name,
      value: data.payments
        .filter((p) => p.status === name)
        .reduce((s, p) => s + p.amount, 0),
    }),
  );
  const queue = data.centres.map((c) => ({
    name: c.name.split(" ")[0],
    value: data.slots.filter(
      (s) =>
        s.centreId === c._id && !["COMPLETED", "CANCELLED"].includes(s.status),
    ).length,
  }));
  const today = new Date().toISOString().slice(0, 10);
  const utilization = data.centres.map((c) => ({
    name: c.name.split(" ")[0],
    value: Math.round(
      (data.slots.filter(
        (s) =>
          s.centreId === c._id && s.date === today && s.status !== "CANCELLED",
      ).length /
        (c.capacity * 3)) *
        100,
    ),
  }));
  return (
    <>
      <div className="dashboard-two">
        <Card
          title="Crop-wise procurement"
          subtitle="Completed quantities · Quintals"
        >
          <Bars rows={crops} />
        </Card>
        <Card
          title="Payment status"
          subtitle="Value by recorded payment state · INR"
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={payments}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={4}
                >
                  {payments.map((p, i) => (
                    <Cell key={p.name} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            {payments.map((p, i) => (
              <span key={p.name}>
                <i style={{ background: colors[i % colors.length] }} />
                {p.name}
              </span>
            ))}
          </div>
        </Card>
      </div>
      <div className="dashboard-two">
        <Card
          title="Centre utilization today"
          subtitle="Booked visits / total daily capacity · Percent"
        >
          <Bars rows={utilization} color="#8baab2" />
        </Card>
        <Card
          title="Queue load by centre"
          subtitle="All active bookings, including future dates"
        >
          <Bars rows={queue} color="#c9b16d" />
        </Card>
      </div>
    </>
  );
}
