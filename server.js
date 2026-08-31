require("dotenv").config();

const express = require("express"); // Wir laden das Express-Paket und speichern es in express.
const db = require("./database");
const bcrypt = require("bcrypt");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const crypto = require("crypto");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");


const app = express();  // VARIABLEN NAME FÜR EXPRESS ANWENDUNG
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", "loopback");
}

app.use(express.json());

app.use(
    session({ // SESSION SORGT FÜR DIE ERKENNUNG EINES NUTZER SCHICKT COOKIE MIT AN WEITERE REQUESTS
      store: new pgSession({
      pool: db,
      createTableIfMissing: true
    }),
        secret: process.env.SESSION_SECRET, // CRYPTO SIGNIEREN SERVER ERKENNT MANIPULATION
        resave: false, // nicht grundlos bei jeder request ändern
        saveUninitialized: false,  // nur besuchen keien daten speichern

      cookie:  {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);
app.use(express.static(__dirname + "/public"));



//===================
// RATE LIMIT
//==================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Zu viele Login-Versuche. Bitte versuche es später erneut."
}); 

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Zu viele Registrierungen. Bitte versuche es später erneut."
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,

  message: "Zu viele Passwort-Reset-Anfragen. Bitte versuche es später erneut."
});
// __________________________________________________


app.post("/register",registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).send("Alle felder müssen ausgefüllt werden");
    }
    if (name.length < 3) {
        return res.status(400).send("Name muss mindestens 3 zeichen lang sein");
    }
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

   if (!emailRegex.test(email)) {
     return res.status(400).send("Ungültige E-mail Adresse");
   }
   if (password.length < 8 ){
     return res.status(400).send("Password muss mindestens 8 Zeichen lang sein");
   }

    // warte auf bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    // warte auf insert 
    await db.query(
     `INSERT INTO users 
     (name, email, password, email_verified, verification_token) 
     VALUES ($1, $2, $3, $4, $5)`,
                             
     [name, email, hashedPassword, false, verificationToken]
);  // ERSTELLEN LINK
    const verificationLink =
   `${process.env.APP_URL}/verify-email?token=${verificationToken}`;

   // MAIL SENDING BEI RESEND VERABEITET WORDEN IST 
   const { data, error } = await resend.emails.send({
   from: "Elredion <noreply@elredion.de>",
  to: email,
  subject: "Bestätige deine E-Mail-Adresse",
  html: `
    <h1>E-Mail bestätigen</h1>
    <p>Klicke auf den folgenden Link, um deine E-Mail-Adresse zu bestätigen:</p>
    <a href="${verificationLink}">E-Mail bestätigen</a>
  `
});

if (error) {
  console.error("Resend Fehler:", error);

  return res
    .status(500)
    .send("Bestätigungsmail konnte nicht versendet werden.");
}
    res.send("Registrierung erfolgreich");

  } catch (error) {
     if(error.code === "23505") {
        return res.status(409).send("Email bereits registriert");
     }

    console.log(error);
    res.status(500).send("Registrierung fehlgeschlagen")
  }
});

// =========================================
// PASSWORD VERGESSEN ROUTE
// ==========================================
app.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {

  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).send("E-Mail-Adresse fehlt.");
    }

    const result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(200).send(
        "Falls ein Account mit dieser E-Mail existiert, wurde eine Nachricht versendet."
      );
    }

    const user = result.rows[0];
    
    if (
  user.password_reset_requested_at &&
  Date.now() - new Date(user.password_reset_requested_at).getTime() < 2 * 60 * 1000
) { 
  return res.status(200).send(
    "Falls ein Account mit dieser E-Mail existiert, wurde eine Nachricht versendet."
  );
}

    const resetToken = crypto
    .randomBytes(32)
    .toString("hex");

  const hashedResetToken = crypto
  .createHash("sha256")
  .update(resetToken)
  .digest("hex");

    const resetExpires = new Date(
    Date.now() + 30 * 60 * 1000
   );
 await db.query(
  `UPDATE users
   SET password_reset_token = $1,
       password_reset_expires = $2,
       password_reset_requested_at = NOW()
   WHERE id = $3`,
  [hashedResetToken, resetExpires, user.id]
);
   const resetLink =
  `${process.env.APP_URL}/reset-password?token=${resetToken}`;


   const { data, error } = await resend.emails.send({
   from: "Elredion <noreply@elredion.de>",
   to: user.email,
   subject: "Passwort zurücksetzen",
   html: `
    <h1>Passwort zurücksetzen</h1>
    <p>Klicke auf den folgenden Link, um ein neues Passwort zu setzen:</p>
    <a href="${resetLink}">Passwort zurücksetzen</a>
    <p>Der Link ist 30 Minuten gültig.</p>
  `
  });

if (error) {
  console.error("Resend Fehler:", error);

  return res
    .status(500)
    .send("Reset-Mail konnte nicht versendet werden.");
}
 res.send(
      "Falls ein Account mit dieser E-Mail existiert, wurde eine Nachricht versendet."
    );
  } catch (error) {

    console.error(error);

    res.status(500).send("Serverfehler.");

  }

});
// EMAIL VERIFIZIERUNG

app.get("/verify-email" , async (req, res) => {
   try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send("Verifizierungs-Token fehlt");
    }
   // Nutzer anhand des Verifizierungs-Tokens in der Datenbank suchen
    const result = await db.query (
      "SELECT * FROM users WHERE verification_token = $1",
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(400).send("Ungültiger Verifizierungs-Token");
      // Warum leaken wird das token ungültig ist
    }
    await db.query(
      `UPDATE users
       SET email_verified = TRUE,
       verification_token = NULL
       WHERE verification_token = $1`,
  [token]
 );
  res.sendFile(__dirname + "/verify-success.html");
   } catch  (error) {
      res.status(500).send("E-Mail Bestätigung fehlgeschlagen");
   }
});

// LOGIN ROUTE 
// LOGIN ROUTE
app.post("/login", loginLimiter, async (req, res) => {
  try {
    // Daten aus Request holen
    const { email, password } = req.body;

    // Prüfen, ob beide Felder vorhanden sind
    if (!email || !password) {
      return res
        .status(400)
        .send("Email und Passwort müssen ausgefüllt werden");
    }

    // Nutzer anhand seiner E-Mail suchen
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    // Nutzer existiert nicht
    if (result.rows.length === 0) {
      return res
        .status(401)
        .send("E-Mail oder Passwort falsch");
    }

    // Gefundenen Nutzer holen
    const user = result.rows[0]; // START INDEX 0 = ERSTER USER 
    

    // Eingegebenes Passwort mit Hash vergleichen
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    // Passwort falsch
    if (!passwordMatch) {
      return res
        .status(401)
        .send("E-Mail oder Passwort falsch");
    }

    if (!user.email_verified) {
    return res
    .status(403)
    .send("Bitte bestätige zuerst deine E-Mail-Adresse");
   }

    // Nutzer-ID in Session speichern
   // Neue Session-ID erzeugen
req.session.regenerate((error) => {
  if (error) {
    console.log(error);

    return res
      .status(500)
      .send("Login fehlgeschlagen");
  }

  // Nutzer-Daten in die neue Session speichern
  req.session.userId = user.id;

  req.session.sessionVersion = user.session_version;

  // Neue Session speichern
  req.session.save((error) => {
    if (error) {
      console.log(error);

      return res
        .status(500)
        .send("Login fehlgeschlagen");
    }

    res.send("Login erfolgreich");
  });
});

  } catch (error) {
    console.log(error);

    res
      .status(500)
      .send("Login fehlgeschlagen");
  }
});

async function requireValidSession(req, res, next) {
  try {
    if (!req.session.userId) {
      return res.status(401).send("Nicht eingeloggt");
    }

    const result = await db.query(
      "SELECT session_version FROM users WHERE id = $1",
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).send("Session ungültig");
    }

    const user = result.rows[0];

    if (req.session.sessionVersion !== user.session_version) {
      req.session.destroy(() => {});
      return res.status(401).send("Session abgelaufen. Bitte erneut einloggen.");
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).send("Serverfehler");
  }
}
// ========================================
// GESCHÜTZTE DASHBOARD ROUTE
// ========================================


app.get("/dashboard", requireValidSession, (req, res) => {
  
  res.sendFile(__dirname + "/dashboard.html");
});

//Daten des aktuell eingeloggten Nutzers für das Dashboard abrufen
app.get("/api/me", requireValidSession,  async (req, res) => {
 
  const result = await db.query(
    "SELECT id, name, email FROM users WHERE id = $1",
    [req.session.userId]
  );

  const user = result.rows[0];

  res.json({
    id: user.id,
    name: user.name,
    email: user.email
  });
});
app.post("/change-password", requireValidSession, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Eingaben prüfen
    if (!currentPassword || !newPassword) {
      return res.status(400).send("Bitte fülle alle Felder aus.");
    }

    if (newPassword.length < 8) {
      return res.status(400).send(
        "Das neue Passwort muss mindestens 8 Zeichen lang sein."
      );
    }

    // 2. Nutzer aus Datenbank laden
    const result = await db.query(
      "SELECT id, password FROM users WHERE id = $1",
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Account nicht gefunden.");
    }

    const user = result.rows[0];

    // 3. Aktuelles Passwort überprüfen
    const passwordCorrect = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordCorrect) {
      return res.status(401).send(
        "Das aktuelle Passwort ist nicht korrekt."
      );
    }

    // 4. Neues Passwort hashen
    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    // 5. Passwort speichern
    await db.query(
      `UPDATE users
       SET password = $1
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    res.status(200).send(
      "Passwort erfolgreich geändert."
    );

  } catch (error) {
    console.error("Passwort ändern fehlgeschlagen:", error);

    res.status(500).send("Serverfehler");
  }
});

// =======================
// CHANGE NAME ROUTE 
// =======================
app.post("/change-name", requireValidSession, async (req, res) => {
  try {
    const { newName } = req.body;

    // Prüfen, ob überhaupt ein Name gesendet wurde
    if (!newName) {
      return res.status(400).send("Bitte gib einen Namen ein.");
    }

    // Leerzeichen am Anfang und Ende entfernen
    const cleanName = newName.trim();

    // Länge prüfen
    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).send(
        "Der Name muss zwischen 2 und 100 Zeichen lang sein."
      );
    }

    // Namen in PostgreSQL ändern
    await db.query(
      "UPDATE users SET name = $1 WHERE id = $2",
      [cleanName, req.session.userId]
    );

    // Neuen Namen ans Frontend zurückgeben
    res.status(200).json({
      message: "Name erfolgreich geändert.",
      name: cleanName
    });

  } catch (error) {
    console.error("Name ändern fehlgeschlagen:", error);

    res.status(500).send("Serverfehler");
  }
});

app.post("/logout", (req, res) => {

  req.session.destroy((error) => {

    if (error) {
      console.log(error);
      return res.status(500).send("Logout fehlgeschlagen");
    }

    res.send("Logout erfolgreich");
  });

});
// PASSWORT ROUTE
app.get("/reset-password", (req, res) => {
  res.sendFile(__dirname + "/reset-password.html");
});
app.post("/reset-password", async (req, res) => {

  try {

    const { token, password } = req.body;

    if (!token || !password) {
      return res
        .status(400)
        .send("Token oder Passwort fehlt.");
    }
    const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

    if (password.length < 8) {
      return res
        .status(400)
        .send("Das Passwort muss mindestens 8 Zeichen lang sein.");
    }


    const result = await db.query(
  `SELECT * FROM users
   WHERE password_reset_token = $1
   AND password_reset_expires > NOW()`,
  [hashedToken]
);

if (result.rows.length === 0) {
  return res
    .status(400)
    .send("Der Reset-Link ist ungültig oder abgelaufen.");
}

  const user = result.rows[0];

  const hashedPassword = await bcrypt.hash(password, 10);

 await db.query(
  `UPDATE users
   SET password = $1,
       password_reset_token = NULL,
       password_reset_expires = NULL,
       session_version = session_version + 1
   WHERE id = $2`,
  [hashedPassword, user.id]
);
res.send("Passwort wurde erfolgreich geändert.");
  } catch (error) {

    console.error(error);

    res
      .status(500)
      .send("Serverfehler.");

  }

});
// ========================================
// SERVER STARTEN
// ========================================
/* git add .
git commit -m "Add forgot password rate limiter"
git push */

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server läuft auf ${HOST}:${PORT}`);
});