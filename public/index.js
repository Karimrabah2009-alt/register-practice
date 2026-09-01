
  // ==========================================
  // HTML-ELEMENTE HOLEN
  // ==========================================

  const registerView = document.querySelector("#registerView");
  const loginView = document.querySelector("#loginView");

  const registerForm = document.querySelector("#registerForm");
  const registerMessage = document.querySelector("#registerMessage");

  const loginForm = document.querySelector("#loginForm");
  const loginMessage = document.querySelector("#loginMessage");

  const showLogin = document.querySelector("#showLogin");
  const showRegister = document.querySelector("#showRegister");


 const forgotPasswordView =
  document.querySelector("#forgotPasswordView");

const forgotPasswordButton =
  document.querySelector("#forgotPasswordButton");

const forgotPasswordForm =
  document.querySelector("#forgotPasswordForm");

const forgotPasswordMessage =
  document.querySelector("#forgotPasswordMessage");

const backToLogin =
  document.querySelector("#backToLogin");
  // ==========================================
  // REGISTER → LOGIN WECHSELN
  // ==========================================

  showLogin.addEventListener("click", () => {

    registerView.classList.add("hidden");
    loginView.classList.remove("hidden");

    // Alte Meldung entfernen
    registerMessage.textContent = "";

  });


  // ==========================================
  // LOGIN → REGISTER WECHSELN
  // ==========================================

  showRegister.addEventListener("click", () => {

    loginView.classList.add("hidden");
    registerView.classList.remove("hidden");

    // Alte Meldung entfernen
    loginMessage.textContent = "";

  });


  // ==========================================
  // REGISTRIERUNG
  // ==========================================

  registerForm.addEventListener("submit", async (event) => {

    // Verhindert normales Neuladen der Seite
    event.preventDefault();


    // Alte Meldung entfernen
    registerMessage.textContent = "";
    registerMessage.className = "message";


    // Eingaben aus dem Formular holen
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();


    try {

      // Daten an unser Backend schicken
      const response = await fetch("/register", { // Await waits for HTTP REQUEST

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          name,
          email,
          password
        })

      });


      // Antwort des Backends auslesen
      const message = await response.text(); // BODY BACKEND AS TEXT

      // Antwort auf der Webseite anzeigen
      registerMessage.textContent = message;

      // Registrierung erfolgreich PRÜFT HTTP STATUS CODE 
      if (response.ok) { 
        registerMessage.classList.add("success");
        registerForm.reset();
      } else {
        registerMessage.classList.add("error");
      }

    } catch (error) {

      // Falls Server überhaupt nicht erreichbar ist
      registerMessage.textContent =
        "Server nicht erreichbar.";

      registerMessage.classList.add("error");
      console.log(error);
    }
  });
  // ==========================================
  // LOGIN
  // ==========================================

  loginForm.addEventListener("submit", async (event) => {

    // Verhindert normales Neuladen der Seite
    event.preventDefault();


    // Alte Meldung entfernen
    loginMessage.textContent = "";
    loginMessage.className = "message";


    // Login-Daten holen
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {

      // Login-Daten ans Backend schicken
      const response = await fetch("/login", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          email,
          password
        })
      });
      // Antwort des Backends auslesen
      const message = await response.text();

      // Antwort auf Webseite anzeigen
      loginMessage.textContent = message;

      // Login erfolgreich
      
      if (response.ok) {
  window.location.href = "/dashboard";
} else {
  loginMessage.classList.add("error");
}

    } catch (error) {
      loginMessage.textContent =
        "Server nicht erreichbar.";

      loginMessage.classList.add("error");
      console.log(error);
    }
  });
  
  forgotPasswordButton.addEventListener("click", () => {

  loginView.classList.add("hidden");
  forgotPasswordView.classList.remove("hidden");

  loginMessage.textContent = "";

});


backToLogin.addEventListener("click", () => {

  forgotPasswordView.classList.add("hidden");
  loginView.classList.remove("hidden");

  forgotPasswordMessage.textContent = "";

});


forgotPasswordForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    forgotPasswordMessage.textContent = "";
    forgotPasswordMessage.className = "message";


    const email =
      document
        .querySelector("#forgotEmail")
        .value
        .trim();


    try {

      const response =
        await fetch("/forgot-password", {

          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            email
          })

        });


      const message =
        await response.text();


      forgotPasswordMessage.textContent =
        message;


      if (response.ok) {

        forgotPasswordMessage
          .classList
          .add("success");

        forgotPasswordForm.reset();

      } else {

        forgotPasswordMessage
          .classList
          .add("error");

      }


    } catch (error) {

      console.log(error);

      forgotPasswordMessage.textContent =
        "Anfrage konnte nicht gesendet werden.";

      forgotPasswordMessage
        .classList
        .add("error");

    }

  }
);