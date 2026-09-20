import nodemailer from "nodemailer";
import { read, mutate, id } from "./store.js";
import { smsConfigured, sendSms } from "./sms.js";
export function startDelivery() {
  let running = false;
  const transport = process.env.EMAIL_HOST
    ? nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: process.env.EMAIL_PORT === "465",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      })
    : null;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const db = await read();
      const upcoming = db.slots.filter(
        (s) =>
          s.status === "WAITING" &&
          !s.reminded &&
          Date.parse(`${s.date}T${s.timeSlot}:00+05:30`) > Date.now() &&
          Date.parse(`${s.date}T${s.timeSlot}:00+05:30`) - Date.now() <
            86400000,
      );
      if (upcoming.length)
        await mutate((d) => {
          for (const slot of upcoming) {
            const current = d.slots.find((s) => s._id === slot._id);
            if (current.reminded) continue;
            current.reminded = true;
            d.notifications.push({
              _id: id(),
              farmerId: slot.farmerId,
              title: "Your procurement visit is coming up",
              message: `${slot.centreName} · ${slot.date} at ${slot.timeSlot}. Token ${slot.tokenNumber}. Check the live queue before leaving.`,
              read: false,
              createdAt: new Date().toISOString(),
            });
          }
        });
      for (const channel of ["email", "sms"]) {
        if (
          (channel === "email" && !transport) ||
          (channel === "sms" && !smsConfigured())
        )
          continue;
        for (const n of db.notifications
          .filter(
            (n) => !n[`${channel}Sent`] && (n[`${channel}Attempts`] || 0) < 3,
          )
          .slice(0, 10)) {
          const user = db.users.find((u) => u._id === n.farmerId);
          if (!user) continue;
          let sent = false;
          try {
            if (channel === "email")
              await transport.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: user.email,
                subject: `e-Kharid: ${n.title}`,
                text: n.message,
              });
            else
              await sendSms(user.mobile, `e-Kharid: ${n.title}. ${n.message}`);
            sent = true;
          } catch {}
          await mutate((d) => {
            const current = d.notifications.find((x) => x._id === n._id);
            current[`${channel}Attempts`] =
              (current[`${channel}Attempts`] || 0) + 1;
            current[`${channel}Sent`] = sent;
          });
        }
      }
    } catch {
    } finally {
      running = false;
    }
  }, 60000);
  timer.unref();
}
