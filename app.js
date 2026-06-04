(function () {
  "use strict";

  console.log("%cYou should hire me ;)", "font-size:15px;font-weight:700;color:#29b6e8;");

  var STEPS = ["year", "make", "model", "productType"];
  var REQUIRED = ["year", "make", "model"];
  var STORE_BASE = "https://partifyusa.com/collections/";
  var GARAGE_KEY = "partify.garage";
  var PLACEHOLDERS = {
    year: "Select year",
    make: "Select make",
    model: "Select model",
    productType: "All parts",
  };

  function Combobox(root, onCommit) {
    this.root = root;
    this.step = root.getAttribute("data-step");
    this.optional = REQUIRED.indexOf(this.step) === -1;
    this.input = root.querySelector(".combo__input");
    this.list = root.querySelector(".combo__list");
    this.onCommit = onCommit;
    this.options = [];
    this.value = "";
    this.activeIndex = -1;
    this.filtered = [];
    this.bind();
  }

  Combobox.prototype.bind = function () {
    var self = this;
    this.input.addEventListener("focus", function () { self.open(""); });
    this.input.addEventListener("click", function () { self.open(""); });
    this.input.addEventListener("input", function () { self.open(self.input.value); });
    this.input.addEventListener("keydown", function (e) { self.onKeydown(e); });
    this.input.addEventListener("blur", function () {
      setTimeout(function () { self.close(); }, 120);
    });
  };

  Combobox.prototype.setOptions = function (values) {
    this.options = values;
    this.input.disabled = values.length === 0;
    if (values.length === 0) this.input.placeholder = PLACEHOLDERS[this.step];
  };

  Combobox.prototype.clear = function () {
    this.value = "";
    this.input.value = "";
    this.input.placeholder = PLACEHOLDERS[this.step];
  };

  Combobox.prototype.open = function (query) {
    if (this.input.disabled) return;
    var q = query.trim().toLowerCase();
    this.filtered = this.options.filter(function (v) {
      return String(v).toLowerCase().indexOf(q) !== -1;
    });
    if (this.optional && this.value !== "") this.filtered.unshift("");
    this.render();
    this.list.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    this.activeIndex = this.filtered.length ? 0 : -1;
    if (this.filtered[0] === "" && this.filtered.length > 1) this.activeIndex = 1;
    this.highlight();
  };

  Combobox.prototype.render = function () {
    var self = this;
    this.list.innerHTML = "";
    if (this.filtered.length === 0) {
      var empty = document.createElement("li");
      empty.className = "combo__empty";
      empty.textContent = "No matches";
      this.list.appendChild(empty);
      return;
    }
    this.filtered.forEach(function (value, i) {
      var li = document.createElement("li");
      li.className = value === "" ? "combo__option combo__option--clear" : "combo__option";
      li.id = self.step + "-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", value === self.value ? "true" : "false");
      li.textContent = value === "" ? PLACEHOLDERS[self.step] : value;
      li.addEventListener("mousedown", function (e) {
        e.preventDefault();
        self.commit(value);
      });
      self.list.appendChild(li);
    });
  };

  Combobox.prototype.highlight = function () {
    var items = this.list.querySelectorAll(".combo__option");
    for (var i = 0; i < items.length; i++) {
      var on = i === this.activeIndex;
      items[i].classList.toggle("is-active", on);
      if (on) {
        this.input.setAttribute("aria-activedescendant", items[i].id);
        items[i].scrollIntoView({ block: "nearest" });
      }
    }
    if (this.activeIndex === -1) this.input.removeAttribute("aria-activedescendant");
  };

  Combobox.prototype.onKeydown = function (e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.list.hidden) { this.open(""); return; }
      this.activeIndex = Math.min(this.activeIndex + 1, this.filtered.length - 1);
      this.highlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
      this.highlight();
    } else if (e.key === "Enter") {
      if (!this.list.hidden && this.activeIndex >= 0) {
        e.preventDefault();
        this.commit(this.filtered[this.activeIndex]);
      }
    } else if (e.key === "Escape") {
      this.close();
    }
  };

  Combobox.prototype.commit = function (value) {
    this.value = value;
    this.input.value = value;
    this.list.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    this.onCommit(this.step, value);
  };

  Combobox.prototype.close = function () {
    this.list.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    var typed = this.input.value.trim();
    if (typed === this.value) return;
    if (this.optional && typed === "") { this.commit(""); return; }
    var match = this.options.filter(function (v) {
      return String(v).toLowerCase() === typed.toLowerCase();
    })[0];
    if (match !== undefined && match !== this.value) {
      this.commit(match);
    } else if (match === undefined) {
      this.input.value = this.value;
    }
  };

  var form = document.getElementById("fitment-form");
  var submit = document.getElementById("submit");
  var status = document.getElementById("status");
  var count = document.getElementById("count");
  var reset = document.getElementById("reset");
  var garage = document.getElementById("garage");
  var garageVehicle = document.getElementById("garage-vehicle");
  var combos = {};

  function onCommit(changedStep) {
    var startIndex = STEPS.indexOf(changedStep) + 1;
    for (var i = startIndex; i < STEPS.length; i++) {
      combos[STEPS[i]].clear();
    }
    for (var j = startIndex; j < STEPS.length; j++) {
      combos[STEPS[j]].setOptions(optionsFor(STEPS[j]));
    }
    status.textContent = "";
    afterChange();
  }

  STEPS.forEach(function (step) {
    var root = form.querySelector('.combo[data-step="' + step + '"]');
    combos[step] = new Combobox(root, onCommit);
  });

  function selectionsBefore(step) {
    var picked = {};
    for (var i = 0; i < STEPS.length; i++) {
      if (STEPS[i] === step) break;
      var value = combos[STEPS[i]].value;
      if (value) picked[STEPS[i]] = value;
    }
    return picked;
  }

  function rowsMatching(filters) {
    return FITMENT_DATA.filter(function (row) {
      return Object.keys(filters).every(function (key) {
        return String(row[key]) === String(filters[key]);
      });
    });
  }

  function optionsFor(step) {
    var index = STEPS.indexOf(step);
    if (index > 0 && combos[STEPS[index - 1]].value === "") return [];
    var rows = rowsMatching(selectionsBefore(step));
    var seen = {};
    rows.forEach(function (row) { seen[row[step]] = true; });
    var values = Object.keys(seen);
    if (step === "year") {
      values.sort(function (a, b) { return Number(b) - Number(a); });
    } else {
      values.sort();
    }
    return values;
  }

  function vehicleChosen() {
    return REQUIRED.every(function (step) { return combos[step].value !== ""; });
  }

  function updateSubmit() {
    submit.disabled = !vehicleChosen();
  }

  function updateCount() {
    if (!vehicleChosen()) {
      count.textContent = "";
      return;
    }
    var rows = rowsMatching({
      year: combos.year.value,
      make: combos.make.value,
      model: combos.model.value,
    });
    var types = {};
    rows.forEach(function (row) { types[row.productType] = true; });
    var n = Object.keys(types).length;
    count.textContent = n + (n === 1 ? " part fits your " : " parts fit your ") +
      combos.year.value + " " + combos.make.value + " " + combos.model.value;
  }

  function syncUrl() {
    var params = new URLSearchParams();
    STEPS.forEach(function (step) {
      if (combos[step].value) params.set(step, combos[step].value);
    });
    var query = params.toString();
    try {
      history.replaceState(null, "", query ? "?" + query : location.pathname);
    } catch (e) {}
  }

  function anyChosen() {
    return STEPS.some(function (step) { return combos[step].value !== ""; });
  }

  function afterChange() {
    updateSubmit();
    updateCount();
    syncUrl();
    reset.hidden = !anyChosen();
  }

  function readUrlState() {
    var params = new URLSearchParams(location.search);
    var state = {};
    STEPS.forEach(function (step) {
      if (params.has(step)) state[step] = params.get(step);
    });
    return state;
  }

  function applyState(state) {
    STEPS.forEach(function (step) { combos[step].clear(); });
    for (var i = 0; i < STEPS.length; i++) {
      var step = STEPS[i];
      var options = optionsFor(step);
      combos[step].setOptions(options);
      var value = state[step];
      if (value != null && options.indexOf(String(value)) !== -1) {
        combos[step].value = String(value);
        combos[step].input.value = String(value);
      } else {
        for (var j = i + 1; j < STEPS.length; j++) {
          combos[STEPS[j]].setOptions(optionsFor(STEPS[j]));
        }
        break;
      }
    }
    status.textContent = "";
    afterChange();
  }

  function buildUrl() {
    var slug = [combos.make.value, combos.model.value]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    var url = STORE_BASE + slug;
    if (combos.productType.value) {
      var params = new URLSearchParams();
      params.set("filter.p.product_type", combos.productType.value);
      url += "?" + params.toString();
    }
    return url;
  }

  function isVehicle(state) {
    return Boolean(state && state.year && state.make && state.model);
  }

  var savedVehicle = null;
  try {
    var raw = window.localStorage.getItem(GARAGE_KEY);
    var parsed = raw ? JSON.parse(raw) : null;
    if (isVehicle(parsed)) {
      savedVehicle = { year: parsed.year, make: parsed.make, model: parsed.model };
    }
  } catch (e) {}

  function persistGarage() {
    try {
      if (savedVehicle) {
        window.localStorage.setItem(GARAGE_KEY, JSON.stringify(savedVehicle));
      } else {
        window.localStorage.removeItem(GARAGE_KEY);
      }
    } catch (e) {}
  }

  function renderGarage() {
    if (savedVehicle) {
      garageVehicle.textContent = [savedVehicle.year, savedVehicle.make, savedVehicle.model].join(" ");
      garage.hidden = false;
    } else {
      garage.hidden = true;
    }
  }

  function setSavedVehicle(vehicle) {
    savedVehicle = vehicle;
    persistGarage();
    renderGarage();
  }

  document.getElementById("garage-use").addEventListener("click", function () {
    if (savedVehicle) {
      applyState({
        year: savedVehicle.year,
        make: savedVehicle.make,
        model: savedVehicle.model,
      });
    }
  });

  document.getElementById("garage-clear").addEventListener("click", function () {
    setSavedVehicle(null);
  });

  reset.addEventListener("click", function () {
    applyState({});
    status.textContent = "";
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (submit.disabled) return;
    setSavedVehicle({
      year: combos.year.value,
      make: combos.make.value,
      model: combos.model.value,
    });
    var url = buildUrl();
    var link = document.createElement("a");
    link.href = url;
    link.textContent = url;
    link.target = "_blank";
    link.rel = "noopener";
    status.textContent = "Opening ";
    status.appendChild(link);
    status.appendChild(document.createTextNode(" in a new tab."));
    window.open(url, "_blank", "noopener");
  });

  document.addEventListener("mousedown", function (e) {
    STEPS.forEach(function (step) {
      if (!combos[step].root.contains(e.target)) combos[step].close();
    });
  });

  combos.year.setOptions(optionsFor("year"));
  var initial = readUrlState();
  if (Object.keys(initial).length) {
    applyState(initial);
  } else {
    afterChange();
  }
  renderGarage();
})();
