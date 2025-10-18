window.ADMIN_EMAILS = [
  // "admin@example.com"
];

window.timeAgo = function(ts) {
  if (!ts) return "";
  var d = ts && typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  var diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
};

window.withinRange = function(ts, filter) {
  if (filter === "all") return true;
  var d = ts && typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  var hrs = (Date.now() - d.getTime()) / 1000 / 3600;
  if (filter === "24h") return hrs <= 24;
  if (filter === "7d") return hrs <= 24 * 7;
  return true;
};

window.contains = function(haystack, needle) {
  if (!needle) return true;
  return String(haystack || "").toLowerCase().includes(String(needle).toLowerCase());
};

// Find a request doc in a top-level collection by our custom payload id
window.findRequestDocById = function(collectionName, payloadId) {
  return window.db.collection(collectionName).where("id", "==", payloadId).limit(1).get()
    .then(function(snap) { var d = null; snap.forEach(function(x) { d = { ref: x.ref, data: x.data() }; }); return d; });
};
