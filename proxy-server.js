const express = require("express");
const cors = require("cors");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
// Якщо ви проксуєте на інший сервер, використовуйте його URL.
// const URL = "https://api.advision.digital"; 
const URL = "http://localhost:9000"; 
const PORT = 3001;

// --- 1. Middleware Configuration ---

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Pointauth"],
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- 2. Proxy Handler Function ---

/**
 * Handles proxying the incoming request to the target URL.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {string} targetPath - The path to proxy.
 * @param {boolean} checkRedirect - Whether to follow a 302 redirect.
 */
async function handleProxy(req, res, targetPath, checkRedirect = false) {
  try {
    const targetUrl = URL + targetPath;

    console.log(`-----------------------------------`);
    console.log(`[PROXY] Caught: ${req.method} ${req.path}`);
    // *** ДОДАНО ДІАГНОСТИКУ QUERY PARAMETERS ***
    console.log(`[PROXY] Query Params (req.query):`, req.query); 
    console.log(`[PROXY] Proxying to: ${targetUrl} (with query params)`);
    console.log(`-----------------------------------`);

    const response = await axios({
      method: req.method,
      url: targetUrl,
      // Вбудована функція 'params: req.query' ПРАВИЛЬНО додає параметри запиту до targetUrl.
      params: req.query, 
      data: req.body,

      headers: {
        // Передача користувацьких заголовків
        Pointauth: req.headers["pointauth"],
        Authorization: req.headers["authorization"],
        
        // Стандартні заголовки
        Accept: "application/json",
        "Content-Type": req.headers["content-type"] || "application/json",
      },
      // Дозволяє axios не викидати помилку на не-2xx статуси (наприклад, 404, 500)
      validateStatus: () => true, 
    });

    // Handle 302 redirect logic (if requested)
    if (checkRedirect && response.status === 302 && response.headers.location) {      
      console.log(`[PROXY] Following redirect to: ${response.headers.location}`);
      const redirectedResponse = await axios.get(response.headers.location, {
        responseType: "json",
      });
      return res.status(redirectedResponse.status).json(redirectedResponse.data);
    }   
    
    // Send the response back to the original client
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error(`[PROXY ERROR] (${req.path}):`, err.message);
    res.status(err.response?.status || 500).send({
      error: `Proxy failed: ${err.message}`,
      route: req.path,
    });
  }
}

// --- 3. Catch-All Route (The Final Handler) ---

// Цей маршрут 'app.use' захоплює ВСІ запити, які не були оброблені раніше.
// Це ідеально підходить для проксі-сервера.
// Я залишив лише ОДИН такий маршрут, щоб уникнути плутанини.
app.use((req, res) => {
  handleProxy(req, res, req.path, false);
});


app.listen(PORT, () => console.log(`Proxy running on port ${PORT} and forwarding requests to ${URL}`));