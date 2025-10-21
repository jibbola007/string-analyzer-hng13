const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let stringsDB = [];


app.post("/strings", (req, res) => {
  const { value } = req.body;


  if (value === undefined) {
    return res.status(400).json({ error: "Missing 'value' in request body" });
  }

  
  if (typeof value !== "string") {
    return res.status(422).json({ error: "'value' must be a string" });
  }

  
  const normalized = value.toLowerCase();
  const exists = stringsDB.find((s) => s.value.toLowerCase() === normalized);
  if (exists) {
    return res.status(409).json({ error: "String already exists" });
  }

  
  const newEntry = {
    id: stringsDB.length + 1,
    value,
    properties: {
      length: value.length,
      is_palindrome:
        value.toLowerCase() === value.toLowerCase().split("").reverse().join(""),
      unique_characters: [...new Set(value)].length,
      word_count: value.trim().split(/\s+/).length,
      sha256_hash: crypto.createHash("sha256").update(value).digest("hex"),
      character_frequency_map: Object.entries(
        value.split("").reduce((acc, c) => {
          acc[c] = (acc[c] || 0) + 1;
          return acc;
        }, {})
      ).reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {}),
      created_at: new Date().toISOString(),
    },
  };

  stringsDB.push(newEntry);
  return res.status(201).json(newEntry);
});


app.get("/strings", (req, res) => {
  let results = [...stringsDB];

  const { length, is_palindrome, word_count, unique_characters } = req.query;
  if (length) results = results.filter((s) => s.properties.length == length);
  if (is_palindrome)
    results = results.filter(
      (s) => s.properties.is_palindrome == (is_palindrome === "true")
    );
  if (word_count)
    results = results.filter((s) => s.properties.word_count == word_count);
  if (unique_characters)
    results = results.filter(
      (s) => s.properties.unique_characters == unique_characters
    );

  res.json({
    data: results,
    count: results.length,
    filters_applied: req.query,
  });
});


app.get("/strings/:value", (req, res) => {
  const { value } = req.params;
  const found = stringsDB.find((s) => s.value.toLowerCase() === value.toLowerCase());
  if (!found) return res.status(404).json({ error: "String not found in the system" });
  res.json(found);
});


app.delete("/strings/:value", (req, res) => {
  const { value } = req.params;
  const index = stringsDB.findIndex((s) => s.value.toLowerCase() === value.toLowerCase());
  if (index === -1)
    return res.status(404).json({ error: "String not found in the system" });

  stringsDB.splice(index, 1);
  res.json({ message: "String deleted successfully" });
});


app.get("/strings/filter-by-natural-language", (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing natural language query" });

  const query = q.toLowerCase();
  let results = [...stringsDB];

  if (query.includes("palindrome")) {
    results = results.filter((s) => s.properties.is_palindrome);
  } else if (query.includes("long") || query.includes("short")) {
    results = results.sort((a, b) =>
      query.includes("long") ? b.properties.length - a.properties.length : a.properties.length - b.properties.length
    );
  } else if (query.includes("unique")) {
    results = results.sort((a, b) => b.properties.unique_characters - a.properties.unique_characters);
  }

  res.json({
    query,
    matched: results.length,
    data: results,
  });
});


app.get("/", (req, res) => {
  res.send("String Analyzer API is running!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
