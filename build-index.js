const fs = require("fs");
const path = require("path");

var STORE = "https://partifyusa.com";
var OUT_PATH = path.join(__dirname, "vehicles.js");

var MAKES = [
  "Alfa Romeo", "Aston Martin", "Land Rover", "Mercedes-Benz", "Rolls-Royce",
  "Acura", "Audi", "Bentley", "BMW", "Buick", "Cadillac", "Chevrolet",
  "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford", "Genesis", "GMC", "Honda",
  "Hummer", "Hyundai", "Infiniti", "Isuzu", "Jaguar", "Jeep", "Kia",
  "Lamborghini", "Lexus", "Lincoln", "Lotus", "Maserati", "Mazda", "McLaren",
  "Mercury", "Mini", "Mitsubishi", "Nissan", "Oldsmobile", "Plymouth",
  "Pontiac", "Porsche", "RAM", "Saab", "Saturn", "Scion", "Smart", "Subaru",
  "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo",
];

var MAKE_SLUGS = MAKES
  .map(function (m) { return { make: m, slug: m.toLowerCase().replace(/[^a-z0-9]+/g, "-") }; })
  .sort(function (a, b) { return b.slug.length - a.slug.length; });

var MODEL_BLOCKLIST = [
  "parts", "paint", "accessories", "accessory", "components", "component",
  "touch", "oem", "kit", "kits", "bundle", "collection", "all", "new",
  "sale", "clearance", "merch", "gift", "apparel", "front", "rear", "side",
  "driver", "passenger", "bumper", "bumpers", "fender", "fenders", "hood",
  "hoods", "grille", "grilles", "mirror", "mirrors", "light", "lights",
  "headlight", "headlights", "tail", "taillight", "taillights", "door",
  "doors", "liner", "liners", "molding", "moldings", "absorber", "bracket",
  "panel", "panels", "valance", "spoiler", "skid", "step", "steps",
];

function isCategory(modelSlug) {
  return modelSlug.split("-").some(function (t) {
    return MODEL_BLOCKLIST.indexOf(t) !== -1;
  });
}

function smartTitle(slug) {
  return slug.split("-").map(function (tok) {
    if (!tok) return "";
    if (/\d/.test(tok) || tok.length <= 2) return tok.toUpperCase();
    return tok.charAt(0).toUpperCase() + tok.slice(1);
  }).join(" ").trim();
}

function parseHandle(handle) {
  for (var i = 0; i < MAKE_SLUGS.length; i++) {
    var s = MAKE_SLUGS[i].slug;
    if (handle.indexOf(s + "-") === 0) {
      var modelSlug = handle.slice(s.length + 1);
      if (!modelSlug || isCategory(modelSlug)) return null;
      return { make: MAKE_SLUGS[i].make, modelSlug: modelSlug, handle: handle };
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function firstProduct(handle) {
  for (var attempt = 1; attempt <= 4; attempt++) {
    var res = await fetch(STORE + "/collections/" + handle + "/products.json?limit=1");
    if (res.ok) {
      var data = await res.json();
      return (data.products && data.products[0]) || null;
    }
    if (res.status === 429) { await sleep(attempt * 1500); continue; }
    return null;
  }
  return null;
}

function pickModel(product, modelSlug) {
  var tags = (product.tags || []).map(String);
  var models = tags
    .filter(function (t) { return t.indexOf("Model_") === 0; })
    .map(function (t) { return t.slice(6).trim(); });
  for (var i = 0; i < models.length; i++) {
    if (models[i].toLowerCase().replace(/[^a-z0-9]+/g, "-") === modelSlug) return models[i];
  }
  return null;
}

async function enrich(candidates) {
  var index = {};
  var seen = {};
  var BATCH = 6;
  for (var i = 0; i < candidates.length; i += BATCH) {
    var batch = candidates.slice(i, i + BATCH);
    var results = await Promise.all(batch.map(function (c) {
      return firstProduct(c.handle).then(function (p) { return { c: c, p: p }; });
    }));
    results.forEach(function (r) {
      if (!r.p) return;
      var model = pickModel(r.p, r.c.modelSlug);
      if (!model) return;
      var make = r.c.make;
      var key = make + "|" + model;
      if (seen[key]) return;
      seen[key] = true;
      if (!index[make]) index[make] = [];
      index[make].push({ model: model, handle: r.c.handle });
    });
    if ((i / BATCH) % 20 === 0) console.log("...enriched " + Math.min(i + BATCH, candidates.length) + "/" + candidates.length);
  }
  Object.keys(index).forEach(function (make) {
    index[make].sort(function (a, b) { return a.model.localeCompare(b.model); });
  });
  return index;
}

async function fetchText(url) {
  var res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return res.text();
}

function extractLocs(xml) {
  var locs = [];
  var re = /<loc>([^<]+)<\/loc>/g;
  var m;
  while ((m = re.exec(xml)) !== null) locs.push(m[1].replace(/&amp;/g, "&"));
  return locs;
}

async function fetchAllHandles() {
  var index = await fetchText(STORE + "/sitemap.xml");
  var maps = extractLocs(index).filter(function (u) {
    return u.indexOf("sitemap_collections_") !== -1;
  });
  var handles = [];
  for (var i = 0; i < maps.length; i++) {
    var xml = await fetchText(maps[i]);
    extractLocs(xml).forEach(function (loc) {
      var mm = loc.match(/\/collections\/([^\/?]+)/);
      if (mm) handles.push(mm[1]);
    });
    console.log("...sitemap " + (i + 1) + "/" + maps.length + " (" + handles.length + " handles)");
  }
  return handles;
}

function candidatesFrom(handles) {
  var seen = {};
  var out = [];
  handles.forEach(function (h) {
    if (/^[0-9]/.test(h) || seen[h]) return;
    seen[h] = true;
    var parsed = parseHandle(h);
    if (parsed) out.push(parsed);
  });
  return out;
}

function writeFile(index) {
  var makes = Object.keys(index).sort();
  var ordered = {};
  makes.forEach(function (m) { ordered[m] = index[m]; });
  fs.writeFileSync(OUT_PATH, "const VEHICLE_INDEX = " + JSON.stringify(ordered) + ";\n");
}

(async function () {
  try {
    var handles = await fetchAllHandles();
    var candidates = candidatesFrom(handles);
    console.log("Verifying " + candidates.length + " candidate collections...");
    var index = await enrich(candidates);
    var makes = Object.keys(index);
    var models = makes.reduce(function (n, m) { return n + index[m].length; }, 0);
    writeFile(index);
    console.log("Wrote " + makes.length + " makes / " + models + " models to vehicles.js");
  } catch (e) {
    console.error("Build failed:", e.message);
    process.exit(1);
  }
})();
