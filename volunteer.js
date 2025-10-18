// volunteer.js - COMPLETE WORKING VERSION
window.requireAuth();
window.wireLogout();

var els = {
  badge: document.getElementById("profileBadge"),
  list: document.getElementById("list")
};

window.auth.onAuthStateChanged(function(user) {
  if (!user) return;
  els.badge.textContent = user.displayName || user.email;

  window.db.collection("orphanages").orderBy("postedat", "desc").get().then(function(snap) {
    var items = [];
    snap.forEach(function(d) { items.push(d.data()); });
    render(items);
  }).catch(function(e) {
    console.error("Error loading orphanages:", e);
    window.db.collection("orphanages").get().then(function(snap) {
      var items = [];
      snap.forEach(function(d) { items.push(d.data()); });
      render(items);
    });
  });
});

function render(data) {
  var locF = document.getElementById("flocation");
  var timeF = document.getElementById("ftime");
  var verF = document.getElementById("fverified");

  function doFilter() {
    var q = locF ? locF.value.trim() : "";
    var filtered = data.filter(function(d) {
      var verMatch = !verF || verF.value === "any" || (verF.value === "verified" ? d.verified : !d.verified);
      var areaMatch = window.contains(d.address || d.name, q);
      return areaMatch && window.withinRange(d.postedat, timeF ? timeF.value : "all") && verMatch;
    });
    els.list.innerHTML = filtered.map(card).join("") || '<div class="helper">No orphanages found.</div>';
    bindActions();
  }

  [locF, timeF, verF].forEach(function(e) {
    if (e) e.addEventListener("input", doFilter);
  });

  doFilter();
}

function card(d) {
  var vBadge = d.verified
    ? '<span class="badge">✓ Verified</span>'
    : '<span class="badge gray">Unverified</span>';
  var contact = d.contactemail ? '<span class="chip">' + d.contactemail + '</span>' : "";

  return (
    '<div class="item ' + (d.verified ? "highlight" : "") + '">' +
      '<div class="row"><div><b>' + (d.name || "Orphanage") + '</b> <span class="helper">• ' + (d.address || "-") + '</span></div><div>' + vBadge + '</div></div>' +
      '<div class="row contact-line"><span class="chip">Contact</span> ' + contact + '</div>' +
      '<div class="helper">Needs: ' + (d.needs || "-") + ' • ' + window.timeAgo(d.postedat) + '</div>' +
      '<form class="row v-form" data-id="' + d.id + '" data-name="' + (d.name || "Orphanage") + '" data-email="' + (d.contactemail || "") + '" style="gap:8px;flex-wrap:wrap">' +
        '<input class="input" name="message" placeholder="Say how you can help" style="min-width:260px">' +
        '<button class="btn small primary" type="submit">Contact</button>' +
      '</form>' +
      verifyToggleHTML(d) +
    '</div>'
  );
}

function verifyToggleHTML(d) {
  var user = window.auth.currentUser;
  var canToggle = window.ADMIN_EMAILS.indexOf(user && user.email) >= 0 || d.id === (user && user.uid);
  if (!canToggle) return "";
  return (
    '<label class="toggle helper"><input type="checkbox" class="verify" data-id="' + d.id + '" ' +
    (d.verified ? "checked" : "") + '> Mark verified</label>'
  );
}

function bindActions() {
  Array.prototype.forEach.call(document.querySelectorAll(".v-form"), function(form) {
    form.addEventListener("submit", function(e) {
      e.preventDefault();
      var orphanageId = form.getAttribute("data-id");
      var orphanageName = form.getAttribute("data-name");
      var orphanageEmail = form.getAttribute("data-email");
      var msg = new FormData(form).get("message") || "Happy to help.";

      sendVolunteerContact(orphanageId, orphanageName, orphanageEmail, msg).then(function() {
        alert("✓ Message sent! The orphanage will see your contact details in their inbox.");
        form.reset();
      }).catch(function(err) {
        console.error(err);
        alert("✗ Failed to send: " + (err.message || "Unknown error"));
      });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".verify"), function(cb) {
    cb.addEventListener("change", function() {
      var id = cb.getAttribute("data-id");
      window.db.collection("orphanages").doc(id).update({ verified: cb.checked }).then(function() {
        location.reload();
      }).catch(function(e) {
        console.error("Error updating verification:", e);
        alert("Failed to update verification status");
      });
    });
  });
}

function sendVolunteerContact(orphanageId, orphanageName, orphanageEmail, message) {
  var uid = window.auth.currentUser.uid;

  return window.db.collection("volunteers").doc(uid).get().then(function(doc) {
    var vol = doc.data() || {};

    var payload = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      type: "volunteerContact",
      verified: false,
      volunteerId: uid,
      volunteerName: vol.name || window.auth.currentUser.displayName || "Volunteer",
      volunteerEmail: window.auth.currentUser.email,
      volunteerContact: vol.contact || window.auth.currentUser.email,
      orphanageId: orphanageId,
      orphanageName: orphanageName,
      orphanageEmail: orphanageEmail,
      message: message,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    return window.db.collection("messages").add(payload);
  });
}

// ---------- EDIT PROFILE FEATURE ----------
(function() {
  var editBtn = document.getElementById("editProfileBtn");
  var modal = document.getElementById("editModal");
  var fieldsDiv = document.getElementById("editFields");
  var saveBtn = document.getElementById("saveProfileBtn");
  var cancelBtn = document.getElementById("cancelEditBtn");
  var msg = document.getElementById("editMsg");

  if (!editBtn) return;

  editBtn.addEventListener("click", function() {
    modal.classList.remove("hidden");
    loadProfileFields();
  });

  cancelBtn.addEventListener("click", function() {
    modal.classList.add("hidden");
  });

  saveBtn.addEventListener("click", function() {
    msg.textContent = "Saving...";
    var data = {};
    Array.from(fieldsDiv.querySelectorAll("input")).forEach(function(i) {
      data[i.id] = i.value;
    });
    var uid = window.auth.currentUser.uid;
    window.db.collection("volunteers").doc(uid).update(data).then(function() {
      msg.textContent = "Profile updated!";
      setTimeout(function() { modal.classList.add("hidden"); }, 500);
    }).catch(function(e) {
      msg.textContent = "Error: " + e.message;
    });
  });

  function loadProfileFields() {
    var uid = window.auth.currentUser.uid;
    window.db.collection("volunteers").doc(uid).get().then(function(doc) {
      var d = doc.data() || {};
      var html = ["name", "skills", "preferredarea", "contact"]
        .map(function(k) {
          return '<div><label>' + k.replace(/_/g, " ") + '</label><input id="' + k + '" class="input" value="' + (d[k] || "") + '"></div>';
        })
        .join("");
      fieldsDiv.innerHTML = html;
    });
  }
})();
