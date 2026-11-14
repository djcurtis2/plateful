// Offline page for the Yumjack app. Reads the grocery lists the website saved into the phone's
// native storage (Capacitor Preferences, key "yj_offline_lists") and saves ticks back to the same key.
(function () {
  var KEY = "yj_offline_lists";
  var root = document.getElementById("lists");
  var prefs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;

  document.getElementById("retry").addEventListener("click", function () {
    window.location.href = "https://yumjack.app";
  });

  function message(text) {
    var p = document.createElement("p");
    p.className = "empty";
    p.textContent = text;
    root.appendChild(p);
  }

  function load() {
    return prefs.get({ key: KEY }).then(function (r) {
      try {
        var all = r && r.value ? JSON.parse(r.value) : [];
        return Array.isArray(all) ? all : [];
      } catch (e) {
        return [];
      }
    });
  }

  // Re-read before writing so ticks made on one list never overwrite another list's changes.
  function saveTicks(id, ticks) {
    return load().then(function (all) {
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === id) {
          all[i].ticks = ticks;
          all[i].savedAt = new Date().toISOString();
        }
      }
      return prefs.set({ key: KEY, value: JSON.stringify(all) });
    }).catch(function () {});
  }

  function render(list) {
    var card = document.createElement("section");
    card.className = "card";
    var h = document.createElement("h2");
    h.textContent = list.title;
    card.appendChild(h);
    var ticks = (list.ticks || []).slice();
    var aisles = [];
    (list.lines || []).forEach(function (l) {
      var a = l.aisle || "";
      if (aisles.indexOf(a) < 0) aisles.push(a);
    });
    aisles.forEach(function (aisle) {
      if (aisle) {
        var h3 = document.createElement("h3");
        h3.textContent = aisle;
        card.appendChild(h3);
      }
      var ul = document.createElement("ul");
      list.lines.filter(function (l) { return (l.aisle || "") === aisle; }).forEach(function (l) {
        var li = document.createElement("li");
        var label = document.createElement("label");
        var box = document.createElement("input");
        box.type = "checkbox";
        box.checked = ticks.indexOf(l.key) >= 0;
        box.addEventListener("change", function () {
          var at = ticks.indexOf(l.key);
          if (box.checked && at < 0) ticks.push(l.key);
          if (!box.checked && at >= 0) ticks.splice(at, 1);
          saveTicks(list.id, ticks.slice());
        });
        var span = document.createElement("span");
        span.textContent = l.text;
        label.appendChild(box);
        label.appendChild(span);
        li.appendChild(label);
        ul.appendChild(li);
      });
      card.appendChild(ul);
    });
    root.appendChild(card);
  }

  if (!prefs) {
    message("Open this in the Yumjack app");
    return;
  }
  load().then(function (all) {
    if (!all.length) {
      message("No saved lists yet. Open a grocery list while you're online and it'll be saved here.");
      return;
    }
    all.forEach(render);
  }).catch(function () {
    message("No saved lists yet. Open a grocery list while you're online and it'll be saved here.");
  });
})();
