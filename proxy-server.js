const express = require("express");
const cors = require("cors");
const axios = require("axios");
const bodyParser = require("body-parser");
const { pipeline } = require("stream");

const app = express();
const PORT = 3001;
const DEFAULT_TARGET_URL = "https://api.advision.digital";
const STORAGE_URL_BASE = "https://hel1.your-objectstorage.com";
const STORAGE_2_URL_BASE = "http://api.advision.digital/public";

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Pointauth"],
  exposedHeaders: ["Content-Type"]
}));


app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

function handleStorage(req) {
  if (req.path.includes("storage")) {
    const subpath = req.query.subpath;
    return subpath ? `${STORAGE_URL_BASE}/${subpath}` : null;
  }
  if (req.path.includes("defaults")) {
    const subpath = req.query.subpath;
    return subpath ? `${STORAGE_2_URL_BASE}/${subpath}` : null;
  }
  return null;
}

async function handleRequest(req, res) {
  try {
    let targetUrl = handleStorage(req) || DEFAULT_TARGET_URL + req.path;
    const isStorageFile = req.path.includes("storage") || req.path.includes("defaults");
    const isMultipart = req.headers["content-type"]?.includes("multipart/form-data");

    const axiosConfig = {
      method: req.method,
      url: targetUrl,
      params: req.query,
      headers: {
        Pointauth: req.headers["pointauth"] || "",
        Authorization: req.headers["authorization"] || "",
        "Content-Type": req.headers["content-type"],
      },
      responseType: isStorageFile ? "stream" : "json",
      validateStatus: () => true,
    };

    axiosConfig.data = isMultipart ? req : req.body;

    const response = await axios(axiosConfig);

    if (isStorageFile) {
      res.setHeader("Access-Control-Allow-Origin", "*"); 
      res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
      
      pipeline(response.data, res, (err) => {
        if (err) console.error("[STREAM ERROR]", err.message);
      });
    } else {
      res.status(response.status).json(response.data);
    }
  } catch (err) {
    console.error(`[PROXY ERROR] ${req.path}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}

app.use(handleRequest);

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});