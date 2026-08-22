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


const app = express();  // VARIABLEN NAME FÜR EXPRESS ANWENDUNG

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
app.use(express.static(__dirname)); // PUBLIC
app.use("/bilder", express.static(__dirname + "/bilder"));


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
     await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Bestätige deine E-Mail-Adresse",
      html: `
       <h1>E-Mail bestätigen</h1>
        <p>Klicke auf den folgenden Link, um deine E-Mail-Adresse zu bestätigen:</p>
         <a href="${verificationLink}">E-Mail bestätigen</a>
  `
});
    res.send("Registrierung erfolgreich");

  } catch (error) {
     if(error.code === "23505") {
        return res.status(409).send("Email bereits registriert");
     }

    console.log(error);
    res.status(500).send("Registrierung fehlgeschlagen")
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
  res.send("Email erfolgreich bestätigt");
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
    req.session.userId = user.id // ID / 7,10,18;

    // Session sicher speichern
    req.session.save((error) => {
      if (error) {
        console.log(error);

        return res
          .status(500)
          .send("Login fehlgeschlagen");
      }

      res.send("Login erfolgreich");
    });

  } catch (error) {
    console.log(error);

    res
      .status(500)
      .send("Login fehlgeschlagen");
  }
});


// ========================================
// GESCHÜTZTE DASHBOARD ROUTE
// ========================================


app.get("/dashboard", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Nicht eingeloggt");
  }

  res.sendFile(__dirname + "/dashboard.html");
});

//Daten des aktuell eingeloggten Nutzers für das Dashboard abrufen
app.get("/api/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Nicht eingeloggt");
  }

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

app.post("/logout", (req, res) => {

  req.session.destroy((error) => {

    if (error) {
      console.log(error);
      return res.status(500).send("Logout fehlgeschlagen");
    }

    res.send("Logout erfolgreich");
  });

});
// ========================================
// SERVER STARTEN
// ========================================

app.listen(3000, () => {
  console.log("Server läuft auf Port 3000");
});