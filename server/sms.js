export const smsConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM,
  );
export async function sendSms(mobile, message) {
  if (!smsConfigured()) return false;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: `+91${mobile}`,
        From: process.env.TWILIO_FROM,
        Body: message,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error("SMS delivery failed.");
  return true;
}
