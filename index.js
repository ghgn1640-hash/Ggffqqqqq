
const express = require("express");
const crypto = require("node:crypto");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "50kb" }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TA1_API_KEY;
const records = new Map();
const MAX_RECORDS = 1000;

app.get("/", (req, res) => {
  res.json({
    name: "TA1 API MAX",
    version: "1.0.0",
    status: "online",
    endpoints: ["/health", "/api/data"]
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: Math.floor(process.uptime()),
    time: new Date().toISOString()
  });
});

function protect(req, res, next) {
  if (!API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "Server chưa cấu hình TA1_API_KEY"
    });
  }

  const auth = req.get("authorization") || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : "";

  const a = Buffer.from(token);
  const b = Buffer.from(API_KEY);

  if (a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({
      ok: false,
      error: "API key không hợp lệ"
    });
  }

  next();
}

app.post("/api/data", protect, (req, res) => {
  if (records.size >= MAX_RECORDS) {
    return res.status(503).json({
      ok: false,
      error: "Bộ nhớ tạm đã đầy"
    });
  }

  const id = crypto.randomUUID();
  const record = {
    id,
    data: req.body,
    createdAt: new Date().toISOString()
  };

  records.set(id, record);

  res.status(201).json({
    ok: true,
    message: "Đã nhận dữ liệu",
    record
  });
});

app.get("/api/data/:id", protect, (req, res) => {
  const record = records.get(req.params.id);

  if (!record) {
    return res.status(404).json({
      ok: false,
      error: "Không tìm thấy dữ liệu"
    });
  }

  res.json({ ok: true, record });
});

app.use((err, req, res, next) => {
  if (err.status === 413) {
    return res.status(413).json({
      ok: false,
      error: "Dữ liệu vượt quá giới hạn"
    });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      ok: false,
      error: "JSON không hợp lệ"
    });
  }

  console.error(err);
  res.status(500).json({
    ok: false,
    error: "Lỗi máy chủ"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TA1 API MAX listening on ${PORT}`);
});
