const fs = require("fs");
const path = require("path");

var CSV_PATH = path.join(__dirname, "catalog.csv");
var OUT_PATH = path.join(__dirname, "data.js");

function splitLine(line) {
  var fields = [];
  var current = "";
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map(function (f) { return f.trim(); });
}

function parseCsv(text) {
  var lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  var headers = splitLine(lines[0]);
  return lines.slice(1).map(function (line) {
    var cols = splitLine(line);
    var row = {};
    headers.forEach(function (h, i) { row[h] = cols[i]; });
    return row;
  });
}

var rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8")).map(function (row) {
  return {
    year: Number(row["Year"]),
    make: row["Make"],
    model: row["Model"],
    productType: row["Product Type"],
  };
});

var body = rows.map(function (r) {
  return "  { year: " + r.year +
    ", make: " + JSON.stringify(r.make) +
    ", model: " + JSON.stringify(r.model) +
    ", productType: " + JSON.stringify(r.productType) + " },";
}).join("\n");

var output = "const FITMENT_DATA = [\n" + body + "\n];\n";

fs.writeFileSync(OUT_PATH, output);
console.log("Wrote " + rows.length + " rows to data.js");
