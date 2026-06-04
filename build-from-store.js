const fs = require("fs");
const path = require("path");

var STORE = "https://partifyusa.com";
var OUT_PATH = path.join(__dirname, "data.js");
var PAGE_SIZE = 250;
var MAX_PAGE = 100;

function tagValues(tags, prefix) {
  return tags
    .filter(function (t) { return t.indexOf(prefix) === 0; })
    .map(function (t) { return t.slice(prefix.length).trim(); })
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function fetchPage(url) {
  for (var attempt = 1; attempt <= 5; attempt++) {
    var res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429) {
      var retryAfter = Number(res.headers.get("retry-after")) || attempt * 2;
      console.log("Rate limited, waiting " + retryAfter + "s before retry...");
      await sleep(retryAfter * 1000);
      continue;
    }
    throw new Error("Fetch failed (" + res.status + ") for " + url);
  }
  throw new Error("Gave up after repeated rate limits for " + url);
}

async function fetchAllProducts() {
  var all = [];
  var hitCap = false;
  for (var page = 1; page <= MAX_PAGE; page++) {
    var url = STORE + "/products.json?limit=" + PAGE_SIZE + "&page=" + page;
    var data = await fetchPage(url);
    if (!data.products || data.products.length === 0) break;
    all = all.concat(data.products);
    if (page === MAX_PAGE) hitCap = true;
    await sleep(500);
  }
  if (hitCap) {
    console.warn("\nWARNING: reached the public endpoint's " + (MAX_PAGE * PAGE_SIZE) +
      "-product cap. Any products beyond that are missing.\n" +
      "To pull the full catalog you'll need the Shopify Admin API (token + cursor pagination).\n");
  }
  return all;
}

function rowsFromProducts(products) {
  var seen = {};
  var rows = [];
  products.forEach(function (p) {
    var make = (p.vendor || "").trim();
    var productType = (p.product_type || "").trim();
    var tags = Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",");
    tags = tags.map(function (t) { return String(t).trim(); });

    var years = tagValues(tags, "Year_").map(Number).filter(function (y) { return !isNaN(y); });
    var models = tagValues(tags, "Model_");

    if (!make || !productType || years.length === 0 || models.length === 0) return;

    years.forEach(function (year) {
      models.forEach(function (model) {
        var key = year + "|" + make + "|" + model + "|" + productType;
        if (seen[key]) return;
        seen[key] = true;
        rows.push({ year: year, make: make, model: model, productType: productType });
      });
    });
  });

  rows.sort(function (a, b) {
    return a.make.localeCompare(b.make) ||
      a.model.localeCompare(b.model) ||
      a.year - b.year ||
      a.productType.localeCompare(b.productType);
  });
  return rows;
}

function writeDataFile(rows) {
  var body = rows.map(function (r) {
    return "  { year: " + r.year +
      ", make: " + JSON.stringify(r.make) +
      ", model: " + JSON.stringify(r.model) +
      ", productType: " + JSON.stringify(r.productType) + " },";
  }).join("\n");
  fs.writeFileSync(OUT_PATH, "const FITMENT_DATA = [\n" + body + "\n];\n");
}

(async function () {
  try {
    var products = await fetchAllProducts();
    var rows = rowsFromProducts(products);
    writeDataFile(rows);
    console.log("Fetched " + products.length + " products, wrote " + rows.length + " fitment rows to data.js");
  } catch (e) {
    console.error("Build failed:", e.message);
    process.exit(1);
  }
})();
