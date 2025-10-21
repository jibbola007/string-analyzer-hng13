
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


let stringsDB = [];


function analyzeString(value) {
  const sha256_hash = crypto.createHash("sha256").update(value).digest("hex");
  const length = value.length;
  const lower = value.toLowerCase();
  const is_palindrome = lower === lower.split("").reverse().join("");
  const word_count = value.trim() === "" ? 0 : value.trim().split(/\s+/).length;
  const character_frequency_map = value.split("").reduce((acc, ch) => {
    acc[ch] = (acc[ch] || 0) + 1;
    return acc;
  }, {});
  const unique_characters = Object.keys(character_frequency_map).length;
  const created_at = new Date().toISOString();

  return {
    id: sha256_hash,
    value,
    properties: {
      length,
      is_palindrome,
      unique_characters,
      word_count,
      sha256_hash,
      character_frequency_map,
    },
    created_at,
  };
}


app.post("/strings", (req, res) => {
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: 'Missing "value" field' });
  }

  if (typeof value !== "string") {
    return res.status(422).json({ error: '"value" must be a string' });
  }

  const sha256_hash = crypto.createHash("sha256").update(value).digest("hex");
  const exists = stringsDB.find((s) => s.properties.sha256_hash === sha256_hash);
  if (exists) {
    return res.status(409).json({ error: "String already exists in the system" });
  }

  const record = analyzeString(value);
  stringsDB.push(record);

  return res.status(201).json({
    id: record.id,
    value: record.value,
    properties: record.properties,
    created_at: record.created_at,
  });
});


app.get("/strings/:string_value", (req, res) => {
  const { string_value } = req.params;
  const lower = string_value.toLowerCase();

  const record = stringsDB.find((r) => r.value.toLowerCase() === lower);
  if (!record) return res.status(404).json({ error: "String not found in the system" });

  return res.status(200).json({
    id: record.id,
    value: record.value,
    properties: record.properties,
    created_at: record.created_at,
  });
});


app.get("/strings", (req, res) => {
  let results = [...stringsDB];
  const filtersApplied = {};

  const {
    is_palindrome,
    min_length,
    max_length,
    word_count,
    contains_character,
  } = req.query;

  if (is_palindrome !== undefined) {
    const val = is_palindrome === "true";
    results = results.filter((r) => r.properties.is_palindrome === val);
    filtersApplied.is_palindrome = val;
  }

  if (min_length !== undefined) {
    const v = parseInt(min_length, 10);
    if (isNaN(v)) return res.status(400).json({ error: "min_length must be an integer" });
    results = results.filter((r) => r.properties.length >= v);
    filtersApplied.min_length = v;
  }

  if (max_length !== undefined) {
    const v = parseInt(max_length, 10);
    if (isNaN(v)) return res.status(400).json({ error: "max_length must be an integer" });
    results = results.filter((r) => r.properties.length <= v);
    filtersApplied.max_length = v;
  }

  if (word_count !== undefined) {
    const v = parseInt(word_count, 10);
    if (isNaN(v)) return res.status(400).json({ error: "word_count must be an integer" });
    results = results.filter((r) => r.properties.word_count === v);
    filtersApplied.word_count = v;
  }

  if (contains_character !== undefined) {
    if (typeof contains_character !== "string" || contains_character.length !== 1) {
      return res.status(400).json({ error: "contains_character must be a single character" });
    }
    results = results.filter((r) => r.value.includes(contains_character));
    filtersApplied.contains_character = contains_character;
  }

  return res.status(200).json({
    data: results.map((r) => ({
      id: r.id,
      value: r.value,
      properties: r.properties,
      created_at: r.created_at,
    })),
    count: results.length,
    filters_applied: filtersApplied,
  });
});


app.get("/strings/filter-by-natural-language", (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query parameter" });

  const lower = query.toLowerCase();
  const parsedFilters = {};

  
  if (lower.includes("palindromic") || lower.includes("palindrome")) {
    parsedFilters.is_palindrome = true;
  }

  if (lower.includes("single word") || lower.includes("single-word")) {
    parsedFilters.word_count = 1;
  }

  const longer = lower.match(/longer than (\d+)/);
  if (longer) {
    parsedFilters.min_length = parseInt(longer[1], 10) + 1;
  }

  const shorter = lower.match(/shorter than (\d+)/);
  if (shorter) {
    parsedFilters.max_length = parseInt(shorter[1], 10) - 1;
  }

  const contains = lower.match(/containing the letter (\w)/);
  if (contains) parsedFilters.contains_character = contains[1];

  
  if (lower.includes("first vowel")) {
   
    parsedFilters.contains_character = "a";
  }

  if (Object.keys(parsedFilters).length === 0) {
    return res.status(400).json({ error: "Unable to parse natural language query" });
  }

 
  let results = [...stringsDB];
  if (parsedFilters.is_palindrome) results = results.filter((r) => r.properties.is_palindrome);
  if (parsedFilters.word_count !== undefined) results = results.filter((r) => r.properties.word_count === parsedFilters.word_count);
  if (parsedFilters.min_length !== undefined) results = results.filter((r) => r.properties.length >= parsedFilters.min_length);
  if (parsedFilters.max_length !== undefined) results = results.filter((r) => r.properties.length <= parsedFilters.max_length);
  if (parsedFilters.contains_character !== undefined) results = results.filter((r) => r.value.includes(parsedFilters.contains_character));

  return res.status(200).json({
    data: results.map((r) => ({
      id: r.id,
      value: r.value,
      properties: r.properties,
      created_at: r.created_at,
    })),
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters: parsedFilters,
    },
  });
});


app.delete("/strings/:string_value", (req, res) => {
  const { string_value } = req.params;
  const lower = string_value.toLowerCase();
  const idx = stringsDB.findIndex((r) => r.value.toLowerCase() === lower);
  if (idx === -1) return res.status(404).json({ error: "String not found in the system" });

  stringsDB.splice(idx, 1);
  return res.status(204).send();
});


app.get("/", (req, res) => res.send("String Analyzer API is running"));


app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
