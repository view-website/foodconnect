// app.js - FIXED VERSION WITH PROPER ROLE RESOLUTION

function donorFields() {
  return '<div><label>Donor Type (optional)</label><input id="d_type" class="input" placeholder="Restaurant / Hotel / School"></div>';
}
function orphanageFields() {
  return '<div class="helper">No extra details needed now — add needs later in your dashboard.</div>';
}
function volunteerFields() {
  return '<div><label>Interests (optional)</label><input id="v_interests" class="input" placeholder="Transport, packing, coordination"></div>';
}

window.setupRegister = function() {
  var roleSel = document.getElementById("role");
  var dyn = document.getElementById("dynamicFields");
  var regBtn = document.getElementById("registerBtn");
  var msg = document.getElementById("regMsg");

  function render() {
    var role = roleSel.value;
    dyn.innerHTML = role === "donor" ? donorFields()
      : role === "orphanage" ? orphanageFields()
        : volunteerFields();
  }
  render();
  roleSel.addEventListener("change", render);

  regBtn.addEventListener("click", function() {
    var role = roleSel.value;
    var name = document.getElementById("name").value.trim();
    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;

    if (!name || !email || !password) {
      msg.textContent = "Please fill name, email and password.";
      msg.style.color = "#b00020";
      return;
    }

    msg.textContent = "Creating account...";
    msg.style.color = "#555";

    window.auth.createUserWithEmailAndPassword(email, password)
      .then(function(cred) {
        return cred.user.updateProfile({ displayName: name })
          .then(function() {
            var uid = cred.user.uid;
            var now = firebase.firestore.FieldValue.serverTimestamp();
            var base = {
              id: uid,
              name: name,
              role: role,
              verified: false,
              postedat: now
            };

            var collectionName;
            if (role === "donor") {
              base.type = (document.getElementById("d_type") ? document.getElementById("d_type").value.trim() : "") || "";
              base.contactemail = email;
              collectionName = "donors";
            } else if (role === "orphanage") {
              base.contactemail = email;
              collectionName = "orphanages";
            } else {
              base.skills = (document.getElementById("v_interests") ? document.getElementById("v_interests").value.trim() : "") || "";
              base.contact = email;
              collectionName = "volunteers";
            }

            return window.db.collection(collectionName).doc(uid).set(base).then(function() {
              return role;
            });
          })
          .then(function(role) {
            msg.textContent = "Account created! Redirecting...";
            msg.style.color = "#1d6b3a";

            setTimeout(function() {
              if (role === "donor") {
                window.location.href = "donor-dashboard.html";
              } else if (role === "orphanage") {
                window.location.href = "orphanage-dashboard.html";
              } else {
                window.location.href = "volunteer-dashboard.html";
              }
            }, 500);
          });
      })
      .catch(function(e) {
        console.error("Registration error:", e);
        msg.textContent = (e && e.message) ? e.message : "Registration failed.";
        msg.style.color = "#b00020";
      });
  });
};

window.setupLogin = function() {
  var emailInput = document.getElementById("email");
  var passwordInput = document.getElementById("password");
  var btn = document.getElementById("loginBtn");
  var msg = document.getElementById("loginMsg");

  btn.addEventListener("click", function() {
    var em = emailInput.value.trim();
    var pw = passwordInput.value;

    if (!em || !pw) {
      msg.textContent = "Enter email and password.";
      msg.style.color = "#b00020";
      return;
    }

    msg.textContent = "Signing in...";
    msg.style.color = "#555";

    window.auth.signInWithEmailAndPassword(em, pw)
      .then(function(cred) {
        var uid = cred.user.uid;

        console.log("Checking Firestore for user role:", uid);
        resolveRoleFromFirestore(uid).then(function(role) {
          if (!role) {
            msg.textContent = "No profile found. Please register first.";
            msg.style.color = "#b00020";
            return;
          }

          console.log("Firestore role found:", role);
          redirectByRole(role);
        });
      })
      .catch(function(e) {
        console.error("Login error:", e);
        msg.textContent = (e && e.message) ? e.message : "Login failed.";
        msg.style.color = "#b00020";
      });
  });
};

function resolveRoleFromFirestore(uid) {
  console.log("Checking donors collection for uid:", uid);

  return window.db.collection("donors").doc(uid).get()
    .then(function(donorDoc) {
      if (donorDoc.exists) {
        console.log("Found in donors collection");
        return "donor";
      }

      console.log("Not in donors, checking orphanages...");
      return window.db.collection("orphanages").doc(uid).get()
        .then(function(orphanDoc) {
          if (orphanDoc.exists) {
            console.log("Found in orphanages collection");
            return "orphanage";
          }

          console.log("Not in orphanages, checking volunteers...");
          return window.db.collection("volunteers").doc(uid).get()
            .then(function(volDoc) {
              if (volDoc.exists) {
                console.log("Found in volunteers collection");
                return "volunteer";
              }

              console.log("Not found in any collection!");
              return null;
            });
        });
    })
    .catch(function(error) {
      console.error("Error resolving role:", error);
      return null;
    });
}

function redirectByRole(role) {
  console.log("Redirecting to dashboard for role:", role);

  if (role === "donor") {
    window.location.href = "donor-dashboard.html";
  } else if (role === "orphanage") {
    window.location.href = "orphanage-dashboard.html";
  } else if (role === "volunteer") {
    window.location.href = "volunteer-dashboard.html";
  } else {
    console.error("Unknown role:", role);
    alert("Error: Unknown user role. Please contact support.");
  }
}