const express = require("express");
const cors = require("cors");

const analyzeString = require("./utils/analyzer");


const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;


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
      is_palindrome: value.toLowerCase() === value.toLowerCase().split("").reverse().join(""),
      unique_characters: [...new Set(value)].length,
      word_count: value.trim().split(/\s+/).length,
      sha256_hash: require("crypto").createHash("sha256").update(value).digest("hex"),
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

app.get("/strings/:string_value", (req, res) => {
  const { string_value } = req.params;

  const record = stringsDB.find((item) => item.value === string_value);
  if (!record)
    return res.status(404).json({ error: "String not found in the system" });

  res.json(record);
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
    results = results.filter((item) => item.properties.is_palindrome === val);
    filtersApplied.is_palindrome = val;
  }

  if (min_length !== undefined) {
    const val = parseInt(min_length);
    if (isNaN(val)) return res.status(400).json({ error: "min_length must be an integer" });
    results = results.filter((item) => item.properties.length >= val);
    filtersApplied.min_length = val;
  }

  if (max_length !== undefined) {
    const val = parseInt(max_length);
    if (isNaN(val)) return res.status(400).json({ error: "max_length must be an integer" });
    results = results.filter((item) => item.properties.length <= val);
    filtersApplied.max_length = val;
  }

  if (word_count !== undefined) {
    const val = parseInt(word_count);
    if (isNaN(val)) return res.status(400).json({ error: "word_count must be an integer" });
    results = results.filter((item) => item.properties.word_count === val);
    filtersApplied.word_count = val;
  }

  if (contains_character !== undefined) {
    if (contains_character.length !== 1)
      return res.status(400).json({ error: "contains_character must be a single character" });
    results = results.filter((item) =>
      item.value.includes(contains_character)
    );
    filtersApplied.contains_character = contains_character;
  }

  res.json({
    data: results,
    count: results.length,
    filters_applied: filtersApplied,
  });
});

console.log("DB Snapshot:", stringsDB);



app.get("/strings/filter-by-natural-language", (req, res) => {
  const { query } = req.query;
  if (!query)
    return res.status(400).json({ error: "Missing query parameter" });

  const lower = query.toLowerCase();
  const filters = {};

  if (lower.includes("palindromic")) filters.is_palindrome = true;

  if (lower.includes("single word")) filters.word_count = 1;

  const longerMatch = lower.match(/longer than (\d+)/);
  if (longerMatch) filters.min_length = parseInt(longerMatch[1]) + 1;

  const containMatch = lower.match(/containing the letter (\w)/);
  if (containMatch) filters.contains_character = containMatch[1];

  if (Object.keys(filters).length === 0)
    return res
      .status(400)
      .json({ error: "Unable to parse natural language query" });

  
  let results = [...stringsDB];
  if (filters.is_palindrome)
    results = results.filter((x) => x.properties.is_palindrome);
  if (filters.word_count)
    results = results.filter((x) => x.properties.word_count === filters.word_count);
  if (filters.min_length)
    results = results.filter((x) => x.properties.length >= filters.min_length);
  if (filters.contains_character)
    results = results.filter((x) =>
      x.value.includes(filters.contains_character)
    );

  res.json({
    data: results,
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters: filters,
    },
  });
});


app.delete("/strings/:string_value", (req, res) => {
  const { string_value } = req.params;
  const index = stringsDB.findIndex((item) => item.value === string_value);

  if (index === -1)
    return res.status(404).json({ error: "String not found in the system" });

  stringsDB.splice(index, 1);
  res.status(204).send();
});


app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);