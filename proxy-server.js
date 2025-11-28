const express = require("express");
const cors = require("cors");
const axios = require("axios");
const bodyParser = require("body-parser");

// ---------------- CONFIG ----------------
const PORT = 3001;
const DEFAULT_TARGET_URL = "https://api-dev.advision.digital";
const STORAGE_URL_BASE = "https://hel1.your-objectstorage.com";

// ---------------- EXPRESS APP ----------------
const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Pointauth"],
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ---------------- HELPERS ----------------
function handleStorage(req) {
  if (!req.path.includes("storage")) return null;

  const subpath = req.query.subpath;
  if (!subpath) return null;

  return `${STORAGE_URL_BASE}/${subpath}`;
}

async function handleRedirect(response, res) {
  if (response.status === 302 && response.headers.location) {
    console.log(`[PROXY] Following redirect → ${response.headers.location}`);
    const redirected = await axios.get(response.headers.location, { responseType: "json" });
    res.status(redirected.status).json(redirected.data);
    return true;
  }
  return false;
}

async function handleRequest(req, res) {
  try {
    let targetUrl = handleStorage(req) || DEFAULT_TARGET_URL + req.path;
    const isStorageFile = req.path.includes("storage");
		// const isSchedule = req.path === "/interface"
		// const responseType = isStorageFile ? "stream" : ( isSchedule ? "text" :  "json" )

    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        Pointauth: req.headers["pointauth"],
        Authorization: req.headers["authorization"],
      },
      responseType: isStorageFile ? "stream" : "json",
      validateStatus: () => true,
    });

    if (isStorageFile) {
      res.status(response.status);
      res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
      response.data.pipe(res);
    } else {
			console.log('returning status ' + response.status);
      res.status(response.status).json(response.data);
    }
  } catch (err) {
    console.error(`[PROXY ERROR] ${req.path}:`, err.message);
    res.status(err.response?.status || 500).json({
      error: `Proxy failed: ${err.message}`,
      route: req.path,
    });
  }
}

app.use((req, res) => handleRequest(req, res));

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}, forwarding requests to ${DEFAULT_TARGET_URL}`);
});
