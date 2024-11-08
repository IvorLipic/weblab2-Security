require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

// In-memory store to track failed login attempts
let loginAttempts = {};

let brokenAuth = false;

const LOGIN_ATTEMPT_LIMIT = 3;
const TIMEOUT_PERIOD = 10000;

// Check if a user has reached the login attempt limit
const isRateLimited = (username) => {
  const attempts = loginAttempts[username];
  if (attempts && attempts.count >= LOGIN_ATTEMPT_LIMIT) {
    const timeElapsed = Date.now() - attempts.lastAttempt;
    if (timeElapsed < TIMEOUT_PERIOD) {
      return true; // User is rate-limited
    }
  }
  return false;
};

pool.connect()
    .then(() => console.log("Connected to PostgreSQL"))
    .catch(err => console.error("Connection error", err.stack));

// SQL Injection API
app.post("/api/sql-injection", async (req, res) => {
    const { inputQuery, sqli } = req.body;

    //Try querying DB
    try {
      let query;
      // If enabled no validation
      if (sqli) {
        query = `SELECT * FROM users WHERE username = '${inputQuery}'`;
      } else { // Else validate it is a string and parametirize
        if(typeof inputQuery != "string") {
          return res.status(422).json({message : "Unprocessable entity."})
        }
        query = `SELECT * FROM users WHERE username = $1`;
      }
  
      const results = sqli
        ? await pool.query(query) // No parametirization
        : await pool.query(query, [`${inputQuery}`]); // Parametirization
  
      res.json(results.rows);
    } catch (err) {
      console.error(err);
      res.status(500).send("Database query error");
    }
});

//Login API
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  // If brokenAuth is false (disabled) check the num of failed logins
  if(!brokenAuth){
    if (isRateLimited(username)) {
      let timeLeft = TIMEOUT_PERIOD - (Date.now() - loginAttempts[username].lastAttempt);
      return res.status(429).json({ message: "Too many attempts. Please try again in " + timeLeft / 1000 + " seconds." });
    }
  }

  // SQL injection protection (string validation)
  if(typeof username != "string" || typeof password != "string") {
    return res.status(422).json({message : "Unprocessable entity."})
  }

  // Try querying DB
  try {
      const query = `SELECT * FROM users WHERE username = $1 AND password = $2`;
      const result = await pool.query(query, [username, password]);

      // If "login" is succesful return credentials
      if (result.rows.length > 0) {
          res.json({
              message: "Login successful",
              username: result.rows[0].username,
              password: result.rows[0].password,
          });
      // If not track failed login attempts
      } else {
          if (!loginAttempts[username]) {
            loginAttempts[username] = { count: 0, lastAttempt: Date.now() };
          }
          loginAttempts[username].count++;
          loginAttempts[username].lastAttempt = Date.now();
          res.status(401).json({ message: "Invalid username or password" });
      }
  } catch (err) {
      console.error(err);
      res.status(500).send("Database query error");
  }
});

// Toggles broken auth
app.post("/api/toggle-password", async (req, res) => {
  const { brokenAuth: newBrokenAuth } = req.body;

  brokenAuth = newBrokenAuth; // Set the flag

  loginAttempts = {}; // Reset the failed login store

  //Change password according to the flag
  let newPassword, msg;
  if(brokenAuth){
    newPassword = "12345"; // Bad password
    msg = "Broken auth enabled."
  } else {
    newPassword = "web1000$"; // Better password
    msg = "Broken auth disabled."
  }

  // Try querying DB (update password of admin)
  try {
      const query = `UPDATE users SET password = $1 WHERE username = 'admin'`;
      await pool.query(query, [newPassword]);
      res.json({ message: msg });
  } catch (err) {
      console.error(err);
      res.status(500).send("Database query error");
  }
});

// Serve the React build
if (process.env.NODE_ENV === "production") {
  const path = require("path");
  app.use(express.static(path.join(__dirname, "client", "build")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
