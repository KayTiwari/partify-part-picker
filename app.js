(function () {
  "use strict";

  console.log("%cYou should hire me ;)", "font-size:15px;font-weight:700;color:#29b6e8;");

  var STORE = "https://partifyusa.com";
  var STORE_BASE = STORE + "/collections/";
  var STEPS = ["make", "model", "year", "productType"];
  var REQUIRED = ["make", "model", "year"];
  var GARAGE_KEY = "partify.garage";
  var PLACEHOLDERS = {
    make: "Select make",
    model: "Select model",
    year: "Select year",
    productType: "All parts",
  };

  var VI = (typeof VEHICLE_INDEX !== "undefined") ? VEHICLE_INDEX : {};
  var vehicleData = null;
  var loadToken = 0;
  var noPartsForYear = false;

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
    this.input.addEventListener("focus", function () { self.open(""); self.input.select(); });
    this.input.addEventListener("click", function () { self.open(""); self.input.select(); });
    this.input.addEventListener("input", function () { self.open(self.input.value); });
    this.input.addEventListener("keydown", function (e) { self.onKeydown(e); });
    this.input.addEventListener("blur", function () {
      setTimeout(function () { self.close(); }, 120);
    });
  };

  Combobox.prototype.setOptions = function (values) {
    this.options = values;
    this.input.disabled = values.length === 0;
    this.input.placeholder = PLACEHOLDERS[this.step];
  };

  Combobox.prototype.setLoading = function () {
    this.options = [];
    this.input.disabled = true;
    this.input.placeholder = "Loading…";
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
    var selIdx = this.filtered.indexOf(this.value);
    if (selIdx !== -1) this.activeIndex = selIdx;
    else if (this.filtered[0] === "" && this.filtered.length > 1) this.activeIndex = 1;
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
      li.addEventListener("mouseenter", function () {
        self.activeIndex = i;
        self.highlight();
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

  STEPS.forEach(function (step) {
    var root = form.querySelector('.combo[data-step="' + step + '"]');
    combos[step] = new Combobox(root, onCommit);
  });

  function makesList() {
    return Object.keys(VI).sort();
  }

  function modelsFor(make) {
    return (VI[make] || []).map(function (x) { return x.model; });
  }

  function handleFor(make, model) {
    var arr = VI[make] || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].model === model) return arr[i].handle;
    }
    return null;
  }

  function yearsFor(make, model) {
    var arr = VI[make] || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].model === model) return (arr[i].years || []).map(String);
    }
    return [];
  }

  function yearHandle(make, model, year) {
    var base = handleFor(make, model);
    return base ? year + "-" + base : null;
  }

  function fetchYear(handle) {
    var products = [];
    function page(n) {
      return fetch(STORE_BASE + handle + "/products.json?limit=250&page=" + n)
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          var list = data.products || [];
          products = products.concat(list);
          if (list.length === 250 && n < 100) return page(n + 1);
          return products;
        });
    }
    return page(1).then(function (all) {
      var countByType = {}, total = 0;
      all.forEach(function (p) {
        var pt = (p.product_type || "").trim();
        if (!pt) return;
        countByType[pt] = (countByType[pt] || 0) + 1;
        total += 1;
      });
      return { parts: Object.keys(countByType).sort(), countByType: countByType, total: total };
    });
  }

  function onCommit(changedStep) {
    loadToken++;
    noPartsForYear = false;
    var startIndex = STEPS.indexOf(changedStep) + 1;
    for (var i = startIndex; i < STEPS.length; i++) {
      combos[STEPS[i]].clear();
    }
    status.textContent = "";

    if (changedStep === "make") {
      combos.model.setOptions(modelsFor(combos.make.value));
      combos.year.setOptions([]);
      combos.productType.setOptions([]);
      vehicleData = null;
      afterChange();
    } else if (changedStep === "model") {
      combos.year.setOptions(yearsFor(combos.make.value, combos.model.value));
      combos.productType.setOptions([]);
      vehicleData = null;
      afterChange();
    } else if (changedStep === "year") {
      loadYear();
    } else {
      afterChange();
    }
  }

  function loadYear() {
    var token = loadToken;
    combos.productType.setLoading();
    vehicleData = null;
    afterChange();
    var handle = yearHandle(combos.make.value, combos.model.value, combos.year.value);
    fetchYear(handle).then(function (data) {
      if (token !== loadToken) return;
      if (data.total === 0) {
        vehicleData = null;
        noPartsForYear = true;
        combos.productType.setOptions([]);
      } else {
        vehicleData = data;
        combos.productType.setOptions(data.parts);
      }
      afterChange();
    }).catch(function () {
      if (token !== loadToken) return;
      vehicleData = null;
      combos.productType.setOptions([]);
      status.textContent = "Couldn't load parts for that year. Please try again.";
      afterChange();
    });
  }

  function vehicleChosen() {
    return Boolean(combos.make.value && combos.model.value && combos.year.value && vehicleData);
  }

  function updateSubmit() {
    submit.disabled = !vehicleChosen();
  }

  function nextHint() {
    if (!combos.make.value) return "Select a make to get started.";
    if (!combos.model.value) return "Select a model.";
    if (!combos.year.value) return "Select a year.";
    return "";
  }

  function updateCount() {
    count.classList.remove("finder__count--hint");
    if (noPartsForYear) {
      count.textContent = "No parts listed for this year yet.";
      return;
    }
    if (!vehicleChosen()) {
      count.textContent = nextHint();
      count.classList.add("finder__count--hint");
      return;
    }
    var pt = combos.productType.value;
    var vehicle = [combos.year.value, combos.make.value, combos.model.value].join(" ");
    if (pt) {
      var c = vehicleData.countByType[pt] || 0;
      count.textContent = c + " " + pt + (c === 1 ? " option for your " : " options for your ") + vehicle;
    } else {
      var t = vehicleData.total;
      count.textContent = t + (t === 1 ? " part fits your " : " parts fit your ") + vehicle;
    }
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
    var token = ++loadToken;
    noPartsForYear = false;
    STEPS.forEach(function (step) { combos[step].clear(); });
    combos.make.setOptions(makesList());
    combos.model.setOptions([]);
    combos.year.setOptions([]);
    combos.productType.setOptions([]);
    vehicleData = null;

    if (!state.make || makesList().indexOf(state.make) === -1) { afterChange(); return; }
    combos.make.value = state.make;
    combos.make.input.value = state.make;
    var models = modelsFor(state.make);
    combos.model.setOptions(models);

    if (!state.model || models.indexOf(state.model) === -1) { afterChange(); return; }
    combos.model.value = state.model;
    combos.model.input.value = state.model;
    var years = yearsFor(state.make, state.model);
    combos.year.setOptions(years);

    if (!state.year || years.indexOf(String(state.year)) === -1) { afterChange(); return; }
    combos.year.value = String(state.year);
    combos.year.input.value = String(state.year);

    combos.productType.setLoading();
    afterChange();
    fetchYear(yearHandle(state.make, state.model, state.year)).then(function (data) {
      if (token !== loadToken) return;
      if (data.total === 0) {
        vehicleData = null;
        noPartsForYear = true;
        combos.productType.setOptions([]);
        afterChange();
        return;
      }
      vehicleData = data;
      combos.productType.setOptions(data.parts);
      if (state.productType && data.parts.indexOf(state.productType) !== -1) {
        combos.productType.value = state.productType;
        combos.productType.input.value = state.productType;
      }
      afterChange();
    }).catch(function () {
      if (token !== loadToken) return;
      vehicleData = null;
      combos.productType.setOptions([]);
      status.textContent = "Couldn't load that vehicle.";
      afterChange();
    });
  }

  function buildUrl() {
    var url = STORE_BASE + yearHandle(combos.make.value, combos.model.value, combos.year.value);
    if (combos.productType.value) {
      var params = new URLSearchParams();
      params.set("filter.p.product_type", combos.productType.value);
      url += "?" + params.toString();
    }
    return url;
  }

  function isVehicle(state) {
    return Boolean(state && state.make && state.model && state.year);
  }

  var savedVehicle = null;
  try {
    var raw = window.localStorage.getItem(GARAGE_KEY);
    var parsed = raw ? JSON.parse(raw) : null;
    if (isVehicle(parsed)) {
      savedVehicle = { make: parsed.make, model: parsed.model, year: parsed.year };
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
        make: savedVehicle.make,
        model: savedVehicle.model,
        year: savedVehicle.year,
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
      make: combos.make.value,
      model: combos.model.value,
      year: combos.year.value,
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

  combos.make.setOptions(makesList());
  var initial = readUrlState();
  if (Object.keys(initial).length) {
    applyState(initial);
  } else {
    afterChange();
  }
  renderGarage();
})();
