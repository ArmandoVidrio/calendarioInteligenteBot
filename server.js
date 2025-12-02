// server.js
import express from "express";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import morgan from "morgan";

const app = express();
app.use(morgan("dev"));

// Load credentials.json
const credentialsPath = path.resolve("credentials.json");
const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

const { client_id, client_secret } = credentials.web;

// IMPORTANT: replace this with your Firebase App Hosting URL ❗
const REDIRECT_URI = "https://<TU_DOMINIO>.firebaseapp.com/auth/callback";

const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
];

const oauth2Client = new OAuth2Client(
  client_id,
  client_secret,
  REDIRECT_URI
);

// -------- LOGIN ------------
app.get("/auth/login", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: SCOPES,
  });

  res.json({ login_url: authUrl });
});

// -------- CALLBACK ------------
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expiry_date,
      scopes: tokens.scope,
    });

  } catch (error) {
    console.error("Callback error", error);
    res.status(500).json({ error: "Failed to exchange code" });
  }
});


// -------- EXAMPLE: call Google Calendar API with stored token ----------
app.get("/calendar/list", async (req, res) => {
  const accessToken = req.query.access_token;

  if (!accessToken) {
    return res.status(400).json({
      error: "Missing access_token in query parameters"
    });
  }

  try {
    const client = new OAuth2Client();
    client.setCredentials({ access_token: accessToken });

    const result = await client.request({
      url: "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    });

    res.json(result.data);
  } catch (error) {
    console.error("Calendar API error:", error);
    res.status(500).json({ error: "Failed to fetch calendar list" });
  }
});


// -------- HEALTH CHECK ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Firebase/Cloud Run compatible server listen
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
