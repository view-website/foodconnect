window.requireAuth();
window.wireLogout();

var els = {
  badge: document.getElementById("profileBadge"),
  requests: document.getElementById("statRequests"),
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
    return loadDonors();
  });

  if (els.inbox) loadInbox(user.uid);

  var postBtn = document.getElementById("postRequest");
  if (postBtn) {
    postBtn.addEventListener("click", function() { postNeed(user); });
  }
});

function loadStats(uid) {
  return window.db.collection("messages").where("orphanageId", "==", uid).get().then(function(snap) {
    var accepted = 0, verified = 0;
    snap.forEach(function(d) {
      var x = d.data();
      if (x.status === "accepted") accepted++;
      if (x.verified) verified++;
    });
    if (els.requests) els.requests.textContent = snap.size;
    if (els.accepted) els.accepted.textContent = String(accepted);
    if (els.verified) els.verified.textContent = String(verified);
  }).catch(function(e) {
    console.error("Error loading stats:", e);
  });
}

function loadDonors() {
  return window.db.collection("donors").orderBy("postedat", "desc").get().then(function(snap) {
    var items = [];
    snap.forEach(function(d) { items.push(d.data()); });
    renderList(items);
  }).catch(function(e) {
    console.error("Error loading donors:", e);
    return window.db.collection("donors").get().then(function(snap) {
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
      var areaMatch = window.contains(d.location || d.name || d.type, q);
      return areaMatch && window.withinRange(d.postedat, timeF ? timeF.value : "all") && verMatch;
    });
    document.getElementById("list").innerHTML = filtered.map(card).join("") || '<div class="helper">No donors found.</div>';
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
  var pickupStr = d.pickuptime && typeof d.pickuptime.toDate === "function" 
    ? d.pickuptime.toDate().toLocaleString() 
    : "-";
  var contact = d.contactemail ? '<span class="chip">' + d.contactemail + '</span>' : "";

  return (
    '<div class="item ' + (d.verified ? "highlight" : "") + '">' +
      '<div class="row"><div><b>' + (d.name || "Donor") + '</b> <span class="helper">• ' + (d.type || "-") + ' • ' + (d.location || "-") + '</span></div><div>' + vBadge + '</div></div>' +
      '<div><b>Food:</b> ' + (d.fooddescription || "-") + ' • <b>Qty:</b> ' + (d.quantity || "-") + '</div>' +
      '<div class="row contact-line"><span class="chip">Contact</span> ' + contact + '</div>' +
      '<div class="row"><div class="helper">Pickup: ' + pickupStr + '</div><div class="helper">' + window.timeAgo(d.postedat) + '</div></div>' +
      '<div class="row"><button class="btn small primary req-btn" data-id="' + d.id + '" data-name="' + (d.name || "Donor") + '" data-email="' + (d.contactemail || "") + '">Request This</button>' + verifyToggleHTML(d) + '</div>' +
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
      var donorId = btn.getAttribute("data-id");
      var donorName = btn.getAttribute("data-name");
      var donorEmail = btn.getAttribute("data-email");
      sendOrphanageRequest(donorId, donorName, donorEmail);
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".verify"), function(cb) {
    cb.addEventListener("change", function() {
      var id = cb.getAttribute("data-id");
      window.db.collection("donors").doc(id).update({ verified: cb.checked }).then(loadDonors);
    });
  });
}

function sendOrphanageRequest(donorId, donorName, donorEmail) {
  var uid = window.auth.currentUser.uid;

  Promise.all([
    window.db.collection("orphanages").doc(uid).get(),
    window.db.collection("donors").doc(donorId).get()
  ]).then(function(arr) {
    var orphan = arr[0].data() || {};
    var donor = arr[1].data() || {};

    var payload = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      type: "orphanageRequest",
      status: "pending",
      verified: false,
      orphanageId: uid,
      orphanageName: orphan.name || window.auth.currentUser.displayName || "Orphanage",
      orphanageEmail: window.auth.currentUser.email,
      orphanageContact: orphan.contactemail || window.auth.currentUser.email,
      orphanageNeeds: orphan.needs || "",
      orphanageAddress: orphan.address || "",
      donorId: donorId,
      donorName: donorName,
      donorEmail: donorEmail,
      message: "Requesting this donation for our orphanage.",
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    return window.db.collection("messages").add(payload);
  }).then(function() {
    alert("✓ Request sent! The donor will see your contact details in their inbox.");
  }).catch(function(e) {
    console.error(e);
    alert("✗ Failed to send: " + (e.message || "Unknown error"));
  });
}

function postNeed(user) {
  console.log("postNeed called");

  if (!els.formMsg) {
    console.error("formMsg element not found!");
    alert("Error: Form message element not found!");
    return;
  }

  els.formMsg.textContent = "Posting...";
  els.formMsg.style.color = "#666";

  var needsEl = document.getElementById("oneeds");
  var descEl = document.getElementById("odesc");
  var addrEl = document.getElementById("oaddr");
  var latEl = document.getElementById("olat");
  var lngEl = document.getElementById("olng");
  var contactEl = document.getElementById("ocontact");

  console.log("Form elements:", {
    oneeds: !!needsEl,
    odesc: !!descEl,
    oaddr: !!addrEl,
    olat: !!latEl,
    olng: !!lngEl,
    ocontact: !!contactEl
  });

  if (!needsEl || !descEl || !addrEl || !contactEl) {
    console.error("Missing form elements!");
    els.formMsg.textContent = "Error: Form fields not found!";
    els.formMsg.style.color = "red";
    return;
  }

  var data = {
    id: user.uid,
    name: user.displayName || "Orphanage",
    needs: needsEl.value || "",
    description: descEl.value || "",
    address: addrEl.value || "",
    lat: latEl ? (parseFloat(latEl.value) || 0) : 0,
    lng: lngEl ? (parseFloat(lngEl.value) || 0) : 0,
    contactemail: contactEl.value || user.email,
    verified: false,
    postedat: firebase.firestore.FieldValue.serverTimestamp(),
    role: "orphanage"
  };

  console.log("Posting data:", data);

  window.db.collection("orphanages").doc(user.uid).set(data, { merge: true })
    .then(function() {
      console.log("Successfully posted to Firestore");
      els.formMsg.textContent = "✓ Request posted successfully!";
      els.formMsg.style.color = "green";
      setTimeout(function() { location.reload(); }, 1000);
    })
    .catch(function(error) {
      console.error("Error posting need:", error);
      els.formMsg.textContent = "✗ Error: " + error.message;
      els.formMsg.style.color = "red";
    });
}

function loadInbox(uid) {
  window.db.collection("messages")
    .where("orphanageId", "==", uid)
    .orderBy("timestamp", "desc")
    .onSnapshot(function(snap) {
      var items = [];
      snap.forEach(function(d) {
        var x = d.data();
        x.docId = d.id;
        items.push(x);
      });
      els.inbox.innerHTML = items.map(inboxCard).join("") || '<div class="helper">No messages yet.</div>';
      bindInboxActions();
    }, function(error) {
      console.error("Error loading inbox:", error);
      window.db.collection("messages")
        .where("orphanageId", "==", uid)
        .get()
        .then(function(snap) {
          var items = [];
          snap.forEach(function(d) {
            var x = d.data();
            x.docId = d.id;
            items.push(x);
          });
          els.inbox.innerHTML = items.map(inboxCard).join("") || '<div class="helper">No messages yet.</div>';
          bindInboxActions();
        });
    });
}

function inboxCard(m) {
  var when = window.timeAgo(m.timestamp);

  // Determine the message type label
  var typeLabel = "";
  if (m.type === "donorOffer") {
    typeLabel = "Donor Offer";
  } else if (m.type === "volunteerContact") {
    typeLabel = "Volunteer Message";
  } else {
    typeLabel = "Message";
  }

  // Determine who it's from
  var from = "";
  var contact = "";
  if (m.type === "donorOffer") {
    from = m.donorName || "Donor";
    contact = m.donorEmail || m.donorContact || "";
  } else if (m.type === "volunteerContact") {
    from = m.volunteerName || "Volunteer";
    contact = m.volunteerEmail || m.volunteerContact || "";
  }

  var canAccept = m.type === "donorOffer";

  return (
    '<div class="item">' +
      '<div class="row"><b>' + typeLabel + '</b><span class="helper"> • ' + when + '</span></div>' +
      '<div class="helper">From: <b>' + from + '</b> • ' + contact + '</div>' +
      '<div class="helper">' + (m.message || "-") + '</div>' +
      (canAccept ? '<div class="row"><button class="btn small primary accept" data-payload="' + m.docId + '">Accept</button></div>' : "") +
    '</div>'
  );
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
    window.db.collection("orphanages").doc(uid).update(data).then(function() {
      msg.textContent = "Profile updated!";
      setTimeout(function() { modal.classList.add("hidden"); location.reload(); }, 500);
    }).catch(function(e) {
      msg.textContent = "Error: " + e.message;
    });
  });

  function loadProfileFields() {
    var uid = window.auth.currentUser.uid;
    window.db.collection("orphanages").doc(uid).get().then(function(doc) {
      var d = doc.data() || {};
      var html = ["name", "needs", "description", "address", "lat", "lng", "contactemail"]
        .map(function(k) {
          return '<div><label>' + k.replace(/_/g, " ") + '</label><input id="' + k + '" class="input" value="' + (d[k] || "") + '"></div>';
        })
        .join("");
      fieldsDiv.innerHTML = html;
    });
  }
})();