import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { read, mutate, id } from "./store.js";
import { scope, fail } from "./domain.js";
export async function exportReport(req, res) {
  const db = await read(),
    period = req.query.period || "monthly",
    days = { daily: 1, weekly: 7, monthly: 31 }[period],
    type = req.query.type || "procurement";
  if (
    !days ||
    !["procurement", "payments", "queue", "district", "state"].includes(type)
  )
    fail(400, "Invalid report selection.");
  const source =
    type === "payments"
      ? db.payments
      : type === "queue"
        ? db.slots
        : db.procurements;
  const records = source.filter(
    (p) =>
      scope(req.user, p) &&
      new Date(p.createdAt) >= new Date(Date.now() - days * 86400000),
  );
  let rows = records.map((p) =>
    type === "payments"
      ? {
          Date: p.createdAt.slice(0, 10),
          Farmer: p.farmerName,
          District: p.district,
          Amount: p.amount,
          Status: p.status,
          Reference: p.transactionId || "",
        }
      : type === "queue"
        ? {
            Date: p.date,
            Time: p.timeSlot,
            Token: p.tokenNumber,
            Centre: p.centreName,
            Farmer: p.farmerName,
            Status: p.status,
          }
        : {
            Date: p.createdAt.slice(0, 10),
            Farmer: p.farmerName,
            Centre: p.centreName,
            Crop: p.crop,
            Quantity: p.quantity,
            Amount: p.totalAmount,
            Status: p.status,
          },
  );
  if (["district", "state"].includes(type))
    rows = [...new Set(records.map((p) => p[type]))].map((name) => {
      const list = records.filter((p) => p[type] === name);
      return {
        Region: name,
        Procurements: list.length,
        Quantity: list.reduce((s, p) => s + p.quantity, 0),
        Amount: list.reduce((s, p) => s + p.totalAmount, 0),
      };
    });
  const keys = Object.keys(
      rows[0] || { Date: "", Farmer: "", Amount: "", Status: "" },
    ),
    format = req.params.format;
  if (!["csv", "pdf", "xlsx"].includes(format))
    fail(400, "Unsupported report format.");
  await mutate((d) => {
    d.reports.push({
      _id: id(),
      state: req.user.state,
      district: req.user.district,
      type,
      period,
      format,
      createdAt: new Date().toISOString(),
    });
    d.auditLogs.push({
      _id: id(),
      userId: req.user._id,
      name: req.user.name,
      role: req.user.role,
      action: `${type} report exported`,
      createdAt: new Date().toISOString(),
    });
  });
  res.attachment(`e-kharid-${type}-${period}.${format}`);
  if (format === "csv") {
    const escape = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    res
      .type("csv")
      .send(
        [
          keys.join(","),
          ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
        ].join("\r\n"),
      );
  } else if (format === "xlsx") {
    const wb = new ExcelJS.Workbook(),
      sheet = wb.addWorksheet("Report");
    sheet.columns = keys.map((key) => ({ header: key, key, width: 24 }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: "A1", to: { row: 1, column: keys.length } };
    await wb.xlsx.write(res);
    res.end();
  } else {
    res.type("pdf");
    const pdf = new PDFDocument({ margin: 40, size: "A4" });
    pdf.pipe(res);
    pdf.fontSize(20).text(`e-Kharid | ${type} report`);
    pdf
      .fontSize(10)
      .text(`${period} | Generated ${new Date().toISOString()}`)
      .moveDown();
    if (!rows.length) pdf.text("No records in this period.");
    for (const row of rows) {
      if (pdf.y > 700) pdf.addPage();
      pdf
        .fontSize(9)
        .text(keys.map((k) => `${k}: ${row[k]}`).join(" | "))
        .moveDown();
    }
    pdf.end();
  }
}
