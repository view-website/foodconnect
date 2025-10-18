// donor.js - COMPLETE WORKING VERSION
window.requireAuth();
window.wireLogout();

var els = {
  badge: document.getElementById("profileBadge"),
  offers: document.getElementById("statOffers"),
  accepted: document.getElementById("statAccepted"),
  verified: document.getElementById("statVerified"),
  list: document.getElementById("list"),
  formMsg: document.getElementById("formMsg"),
  inbox: document.getElementById("inboxList")
};

window.auth.onAuthStateChanged(function(user) {
  if (!user) return;
  els.badge.textContent = user.displayName || user.email;

  loadStats(user.uid).then(function() {
    return loadOrphanages();
  });

  if (els.inbox) loadInbox(user.uid);

  var postBtn = document.getElementById("postOffer");
  if (postBtn) {
    postBtn.addEventListener("click", function() { postOffer(user); });
  }
});

function loadStats(uid) {
  return window.db.collection("messages").where("donorId", "==", uid).get().then(function(snap) {
    var accepted = 0, verified = 0;
    snap.forEach(function(d) {
      var x = d.data();
      if (x.status === "accepted") accepted++;
      if (x.verified) verified++;
    });
    if (els.offers) els.offers.textContent = snap.size;
    if (els.accepted) els.accepted.textContent = String(accepted);
    if (els.verified) els.verified.textContent = String(verified);
  }).catch(function(e) {
    console.error("Error loading stats:", e);
  });
}

function loadOrphanages() {
  return window.db.collection("orphanages").orderBy("postedat", "desc").get().then(function(snap) {
    var items = [];
    snap.forEach(function(d) { items.push(d.data()); });
    renderList(items);
  }).catch(function(e) {
    console.error("Error loading orphanages:", e);
    return window.db.collection("orphanages").get().then(function(snap) {
      var items = [];
      snap.forEach(function(d) { items.push(d.data()); });
      renderList(items);
    });
  });
}

function renderList(data) {
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
      '<div class="row"><div><b>Needs:</b> ' + (d.needs || "-") + '</div></div>' +
      '<div class="helper">' + window.timeAgo(d.postedat) + '</div>' +
      '<div class="row"><button class="btn small primary req-btn" data-id="' + d.id + '" data-name="' + (d.name || "Orphanage") + '" data-email="' + (d.contactemail || "") + '">Offer Help</button>' + verifyToggleHTML(d) + '</div>' +
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
  Array.prototype.forEach.call(document.querySelectorAll(".req-btn"), function(btn) {
    btn.addEventListener("click", function() {
      var orphanageId = btn.getAttribute("data-id");
      var orphanageName = btn.getAttribute("data-name");
      var orphanageEmail = btn.getAttribute("data-email");
      sendDonorOffer(orphanageId, orphanageName, orphanageEmail);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".verify"), function(cb) {
    cb.addEventListener("change", function() {
      var id = cb.getAttribute("data-id");
      window.db.collection("orphanages").doc(id).update({ verified: cb.checked }).then(loadOrphanages);
    });
  });
}

function sendDonorOffer(orphanageId, orphanageName, orphanageEmail) {
  var uid = window.auth.currentUser.uid;

  Promise.all([
    window.db.collection("donors").doc(uid).get(),
    window.db.collection("orphanages").doc(orphanageId).get()
  ]).then(function(arr) {
    var donor = arr[0].data() || {};
    var orphan = arr[1].data() || {};

    var payload = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      type: "donorOffer",
      status: "pending",
      verified: false,
      donorId: uid,
      donorName: donor.name || window.auth.currentUser.displayName || "Donor",
      donorEmail: window.auth.currentUser.email,
      donorContact: donor.contactemail || window.auth.currentUser.email,
      donorType: donor.type || "",
      foodDescription: donor.fooddescription || "",
      quantity: donor.quantity || "",
      location: donor.location || "",
      orphanageId: orphanageId,
      orphanageName: orphanageName,
      orphanageEmail: orphanageEmail,
      message: "We can donate food. Contact me for details.",
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    return window.db.collection("messages").add(payload);
  }).then(function() {
    alert("✓ Offer sent! The orphanage will see your contact details in their inbox.");
  }).catch(function(e) {
    console.error(e);
    alert("✗ Failed to send: " + (e.message || "Unknown error"));
  });
}

function postOffer(user) {
  console.log("postOffer called");

  if (!els.formMsg) {
    console.error("formMsg element not found!");
    alert("Error: Form message element not found!");
    return;
  }

  els.formMsg.textContent = "Posting...";
  els.formMsg.style.color = "#666";

  var typeEl = document.getElementById("dtype");
  var descEl = document.getElementById("ddesc");
  var qtyEl = document.getElementById("dqty");
  var timeEl = document.getElementById("dtime");
  var locEl = document.getElementById("dloc");
  var contactEl = document.getElementById("dcontact");

  console.log("Form elements:", {
    dtype: !!typeEl,
    ddesc: !!descEl,
    dqty: !!qtyEl,
    dtime: !!timeEl,
    dloc: !!locEl,
    dcontact: !!contactEl
  });

  if (!typeEl || !descEl || !qtyEl || !locEl || !contactEl) {
    console.error("Missing form elements!");
    els.formMsg.textContent = "Error: Form fields not found!";
    els.formMsg.style.color = "red";
    return;
  }

  var data = {
    id: user.uid,
    name: user.displayName || "Donor",
    type: typeEl.value || "",
    fooddescription: descEl.value || "",
    quantity: qtyEl.value || "",
    pickuptime: timeEl && timeEl.value ? new Date(timeEl.value) : new Date(),
    location: locEl.value || "",
    contactemail: contactEl.value || user.email,
    verified: false,
    postedat: firebase.firestore.FieldValue.serverTimestamp(),
    role: "donor"
  };

  console.log("Posting data:", data);

  window.db.collection("donors").doc(user.uid).set(data, { merge: true })
    .then(function() {
      console.log("Successfully posted to Firestore");
      els.formMsg.textContent = "✓ Offer posted successfully!";
      els.formMsg.style.color = "green";
      setTimeout(function() { location.reload(); }, 1000);
    })
    .catch(function(error) {
      console.error("Error posting offer:", error);
      els.formMsg.textContent = "✗ Error: " + error.message;
      els.formMsg.style.color = "red";
    });
}

function loadInbox(uid) {
  window.db.collection("messages")
    .where("donorId", "==", uid)
    .orderBy("timestamp", "desc")
    .onSnapshot(function(snap) {
      var items = [];
      snap.forEach(function(d) {
        var x = d.data();
        x.docId = d.id;
        if (x.type === "orphanageRequest") {
          items.push(x);
        }
      });
      els.inbox.innerHTML = items.map(inboxCard).join("") || '<div class="helper">No messages yet.</div>';
      bindInboxActions();
    }, function(error) {
      console.error("Error loading inbox:", error);
      window.db.collection("messages")
        .where("donorId", "==", uid)
        .get()
        .then(function(snap) {
          var items = [];
          snap.forEach(function(d) {
            var x = d.data();
            x.docId = d.id;
            if (x.type === "orphanageRequest") {
              items.push(x);
            }
          });
          els.inbox.innerHTML = items.map(inboxCard).join("") || '<div class="helper">No messages yet.</div>';
          bindInboxActions();
        });
    });
}

function inboxCard(m) {
  var when = window.timeAgo(m.timestamp);
  var from = m.orphanageName || "Orphanage";
  var contact = m.orphanageEmail || m.orphanageContact || "";
  var canAccept = m.status === "pending";

  return (
    '<div class="item">' +
      '<div class="row"><b>Request from Orphanage</b><span class="helper"> • ' + when + '</span></div>' +
      '<div class="helper">From: <b>' + from + '</b> • ' + contact + '</div>' +
      '<div class="helper">' + (m.message || "-") + '</div>' +
      (canAccept ? '<div class="row"><button class="btn small primary accept" data-payload="' + m.docId + '">Accept</button></div>' : '<div class="helper" style="color:green">✓ Accepted</div>') +
    '</div>'
  );
}

function bindInboxActions() {
  Array.prototype.forEach.call(document.querySelectorAll(".accept"), function(btn) {
    btn.addEventListener("click", function() {
      var docId = btn.getAttribute("data-payload");
      window.db.collection("messages").doc(docId).update({ status: "accepted" }).then(function() {
        alert("✓ Accepted!");
      });
    });
  });
}

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
    window.db.collection("donors").doc(uid).update(data).then(function() {
      msg.textContent = "Profile updated!";
      setTimeout(function() { modal.classList.add("hidden"); location.reload(); }, 500);
    }).catch(function(e) {
      msg.textContent = "Error: " + e.message;
    });
  });

  function loadProfileFields() {
    var uid = window.auth.currentUser.uid;
    window.db.collection("donors").doc(uid).get().then(function(doc) {
      var d = doc.data() || {};
      var html = ["name", "type", "fooddescription", "quantity", "location", "contactemail"]
        .map(function(k) {
          return '<div><label>' + k.replace(/_/g, " ") + '</label><input id="' + k + '" class="input" value="' + (d[k] || "") + '"></div>';
        })
        .join("");
      fieldsDiv.innerHTML = html;
    });
  }
})();