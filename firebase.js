// Replace with your Firebase config
window.firebaseConfig = {
  apiKey: "AIzaSyBqHMbg0e_KgGS1nRCdBhIWhAyCaeuq95A",
  authDomain: "foodconnect-d3224.firebaseapp.com",
  projectId: "foodconnect-d3224",
  storageBucket: "foodconnect-d3224.appspot.com",
  messagingSenderId: "520939199219",
  appId: "1:520939199219:web:0e89135361538967fc7586"
};

// Init app (compat)
window.firebaseApp = firebase.initializeApp(window.firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();

// Helpers as globals
window.wireLogout = function() {
  var btn = document.getElementById("logoutBtn");
  if (btn) {
    btn.addEventListener("click", function() {
      window.auth.signOut().then(function() {
        window.location.href = "login.html";
      });
    });
  }
};

window.requireAuth = function() {
  window.auth.onAuthStateChanged(function(user) {
    if (!user) {
      window.location.href = "login.html";
    }
  });
};
