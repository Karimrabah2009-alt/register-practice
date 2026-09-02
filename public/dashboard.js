 // =====================================
    // USER LADEN
    // =====================================
     let csrfToken = null;

async function loadCsrfToken() {
  const response = await fetch("/api/csrf-token");

  if (!response.ok) {
    throw new Error("CSRF-Token konnte nicht geladen werden.");
  }

  const data = await response.json();
  csrfToken = data.csrfToken;
}

    async function loadUser() {

      try {

        const response =
          await fetch("/api/me");


        if (!response.ok) {

          window.location.href = "/";

          return;
        }


        const user =
          await response.json();


        const initial =
          user.name.charAt(0).toUpperCase();



        // TOPBAR

        document.getElementById("profileName").textContent =
          user.name;

        document.getElementById("profileEmail").textContent =
          user.email;

        document.getElementById("userInitial").textContent =
          initial;



        // SIDEBAR

        document.getElementById("sidebarName").textContent =
          user.name;

        document.getElementById("sidebarInitial").textContent =
          initial;



        // OVERVIEW

        document.getElementById("welcomeName").textContent =
          user.name;

        document.getElementById("overviewEmail").textContent =
          user.email;

        document.getElementById("securityOverviewEmail").textContent =
          user.email;



        // PROFILE

        document.getElementById("profilePageName").textContent =
          user.name;

        document.getElementById("profilePageEmail").textContent =
          user.email;

        document.getElementById("profilePageId").textContent =
          user.id;



        // SECURITY

        document.getElementById("securityEmail").textContent =
          user.email;


      } catch (error) {

        console.error(
          "Nutzerdaten konnten nicht geladen werden:",
          error
        );

      }

    }



    // =====================================
    // PAGE NAVIGATION
    // =====================================

    const navLinks =
      document.querySelectorAll(".nav-link");


    const pages = {

      overview: {

        element:
          document.getElementById("overviewPage"),

        eyebrow:
          "ACCOUNT OVERVIEW",

        title:
          "Übersicht"

      },


      profile: {

        element:
          document.getElementById("profilePage"),

        eyebrow:
          "PERSONAL INFORMATION",

        title:
          "Mein Profil"

      },


      security: {

        element:
          document.getElementById("securityPage"),

        eyebrow:
          "ACCOUNT SECURITY",

        title:
          "Sicherheit"

      },


      sessions: {

        element:
          document.getElementById("sessionsPage"),

        eyebrow:
          "ACTIVE SESSIONS",

        title:
          "Sessions"

      }

    };


    function openPage(pageName) {

      const selectedPage =
        pages[pageName];


      if (!selectedPage) {
        return;
      }


      Object.values(pages).forEach((page) => {

        page.element.classList.remove("active");

      });


      selectedPage.element.classList.add("active");


      document.getElementById("pageEyebrow").textContent =
        selectedPage.eyebrow;


      document.getElementById("pageTitle").textContent =
        selectedPage.title;


      navLinks.forEach((link) => {

        link.classList.toggle(
          "active",
          link.dataset.page === pageName
        );

      });

    }


    navLinks.forEach((link) => {

      link.addEventListener("click", () => {

        openPage(
          link.dataset.page
        );

      });

    });


    document
      .querySelectorAll("[data-open-page]")
      .forEach((button) => {

        button.addEventListener("click", () => {

          openPage(
            button.dataset.openPage
          );

        });

      });



    // =====================================
    // PASSWORT FORMULAR
    // =====================================

    const changePasswordButton =
      document.getElementById(
        "changePasswordButton"
      );


    const changePasswordForm =
      document.getElementById(
        "changePasswordForm"
      );


    const cancelPasswordButton =
      document.getElementById(
        "cancelPasswordButton"
      );


    const savePasswordButton =
      document.getElementById(
        "savePasswordButton"
      );


    const passwordMessage =
      document.getElementById(
        "passwordMessage"
      );



    // PASSWORT FORMULAR ÖFFNEN

    changePasswordButton.addEventListener(
      "click",
      () => {

        changePasswordForm.classList.add("active");

        passwordMessage.textContent = "";

        document
          .getElementById("currentPassword")
          .focus();

      }
    );



    // PASSWORT FORMULAR SCHLIESSEN

    cancelPasswordButton.addEventListener(
      "click",
      () => {

        changePasswordForm.classList.remove("active");

        document.getElementById("currentPassword").value =
          "";

        document.getElementById("newPassword").value =
          "";

        passwordMessage.textContent =
          "";

      }
    );



    // =====================================
    // PASSWORT SPEICHERN
    // =====================================

    savePasswordButton.addEventListener(
      "click",
      async () => {

        const currentPassword =
          document.getElementById(
            "currentPassword"
          ).value;


        const newPassword =
          document.getElementById(
            "newPassword"
          ).value;


        passwordMessage.textContent =
          "";


        if (!currentPassword || !newPassword) {

          passwordMessage.textContent =
            "Bitte fülle beide Felder aus.";

          return;
        }


        if (newPassword.length < 8) {

          passwordMessage.textContent =
            "Das neue Passwort muss mindestens 8 Zeichen lang sein.";

          return;
        }


        try {

          savePasswordButton.disabled =
            true;

          savePasswordButton.textContent =
            "Wird gespeichert...";


          const response =
            await fetch("/change-password", {

              method: "POST",

              headers: {

                "Content-Type":
                  "application/json",
                  "x-csrf-token": csrfToken

              },

              body: JSON.stringify({

                currentPassword,
                newPassword

              })

            });


          const message =
            await response.text();


          if (!response.ok) {

            passwordMessage.textContent =
              message;

            return;
          }


          passwordMessage.textContent =
            message;


          document.getElementById(
            "currentPassword"
          ).value = "";


          document.getElementById(
            "newPassword"
          ).value = "";


        } catch (error) {

          console.error(
            "Passwort ändern fehlgeschlagen:",
            error
          );


          passwordMessage.textContent =
            "Verbindung zum Server fehlgeschlagen.";


        } finally {

          savePasswordButton.disabled =
            false;

          savePasswordButton.textContent =
            "Passwort speichern";

        }

      }
    );



    // =====================================
    // PROFIL / NAME BEARBEITEN
    // =====================================

    const editNameButton =
      document.getElementById(
        "editNameButton"
      );


    const editNameForm =
      document.getElementById(
        "editNameForm"
      );


    const newNameInput =
      document.getElementById(
        "newName"
      );


    const saveNameButton =
      document.getElementById(
        "saveNameButton"
      );


    const cancelNameButton =
      document.getElementById(
        "cancelNameButton"
      );


    const nameMessage =
      document.getElementById(
        "nameMessage"
      );



    // NAME FORMULAR ÖFFNEN

    editNameButton.addEventListener(
      "click",
      () => {

        editNameForm.classList.add("active");


        newNameInput.value =
          document
            .getElementById("profilePageName")
            .textContent
            .trim();


        nameMessage.textContent =
          "";


        newNameInput.focus();

      }
    );



    // NAME BEARBEITEN ABBRECHEN

    cancelNameButton.addEventListener(
      "click",
      () => {

        editNameForm.classList.remove("active");

        newNameInput.value =
          "";

        nameMessage.textContent =
          "";

      }
    );



    // =====================================
    // NAME SPEICHERN
    // =====================================

    saveNameButton.addEventListener(
      "click",
      async () => {

        const newName =
          newNameInput.value.trim();


        nameMessage.textContent =
          "";


        if (newName.length < 2) {

          nameMessage.textContent =
            "Der Name muss mindestens 2 Zeichen lang sein.";

          return;
        }


        if (newName.length > 100) {

          nameMessage.textContent =
            "Der Name darf maximal 100 Zeichen lang sein.";

          return;
        }


        try {

          saveNameButton.disabled =
            true;

          saveNameButton.textContent =
            "Wird gespeichert...";


          const response =
            await fetch("/change-name", {

              method: "POST",

              headers: {

                "Content-Type":
                  "application/json",
                  "x-csrf-token": csrfToken

              },

              body: JSON.stringify({

                newName

              })

            });



          if (!response.ok) {

            const message =
              await response.text();


            nameMessage.textContent =
              message;


            return;
          }



          const data =
            await response.json();



          // PROFIL AKTUALISIEREN

          document.getElementById(
            "profilePageName"
          ).textContent = data.name;



          // TOPBAR AKTUALISIEREN

          document.getElementById(
            "profileName"
          ).textContent = data.name;



          // SIDEBAR AKTUALISIEREN

          document.getElementById(
            "sidebarName"
          ).textContent = data.name;



          // WILLKOMMEN TEXT

          document.getElementById(
            "welcomeName"
          ).textContent = data.name;



          // INITIALEN AKTUALISIEREN

          const initial =
            data.name
              .charAt(0)
              .toUpperCase();


          document.getElementById(
            "userInitial"
          ).textContent = initial;


          document.getElementById(
            "sidebarInitial"
          ).textContent = initial;



          nameMessage.textContent =
            data.message;


        } catch (error) {

          console.error(
            "Name ändern fehlgeschlagen:",
            error
          );


          nameMessage.textContent =
            "Verbindung zum Server fehlgeschlagen.";


        } finally {

          saveNameButton.disabled =
            false;


          saveNameButton.textContent =
            "Speichern";

        }

      }
    );



    // =====================================
    // LOGOUT
    // =====================================

    const logoutButton =
      document.getElementById(
        "logoutButton"
      );


    logoutButton.addEventListener(
      "click",
      async () => {

        try {

          const response =
            await fetch("/logout", {

              method: "POST",
              headers: {
                 "x-csrf-token": csrfToken
              }
            });


          if (response.ok) {

            window.location.href =
              "/";

            return;
          }


          console.error(
            "Logout fehlgeschlagen."
          );


        } catch (error) {

          console.error(
            "Logout fehlgeschlagen:",
            error
          );

        }

      }
    );



    // =====================================
    // START
    // =====================================

    async function startDashboard() {
  await loadCsrfToken();
  await loadUser();
}

startDashboard();


 const SESSION_TIMEOUT = 30 * 60 * 1000;

let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(() => {
    window.location.href = "/";
  }, SESSION_TIMEOUT);
}

["click", "keydown", "scroll"].forEach((eventName) => {
  document.addEventListener(eventName, resetInactivityTimer);
});

resetInactivityTimer();