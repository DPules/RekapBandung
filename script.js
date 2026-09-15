let currentUser = null;
let currentKdkmp = null;

let barangList = [];
let opnameData = {};

let currentOpnameId = null;


/* =========================
   INITIALIZATION
========================= */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    const savedUser =
      sessionStorage.getItem("kdkmpUser");

    if (savedUser) {

      try {

        currentUser =
          JSON.parse(savedUser);

        initializeApp();

      } catch(e) {

        sessionStorage.removeItem("kdkmpUser");

      }

    }

    document
      .getElementById("loginForm")
      .addEventListener(
        "submit",
        login
      );

  }
);


/* =========================
   LOGIN
========================= */

function login(e) {

  e.preventDefault();

  const username =
    document
      .getElementById("username")
      .value
      .trim();

  const password =
    document
      .getElementById("password")
      .value;

  if (!username || !password) {

    showLoginMessage(
      "Username dan password wajib diisi."
    );

    return;
  }

  showLoginMessage(
    "Memproses login...",
    false
  );

  google.script.run

    .withSuccessHandler(
      function(result) {

        if (result.success) {

          currentUser = result.user;

          sessionStorage.setItem(
            "kdkmpUser",
            JSON.stringify(currentUser)
          );

          initializeApp();

        } else {

          showLoginMessage(
            result.message ||
            "Login gagal."
          );

        }

      }
    )

    .withFailureHandler(
      function(error) {

        showLoginMessage(
          "Terjadi kesalahan server."
        );

        console.error(error);

      }
    )

    .loginUser(
      username,
      password
    );

}