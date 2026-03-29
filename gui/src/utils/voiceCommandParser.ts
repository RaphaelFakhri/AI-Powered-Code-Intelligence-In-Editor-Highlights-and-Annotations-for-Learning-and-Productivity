export interface SelectLinesIntent {
  startLine: number;
  endLine: number;
}

const WORD_TO_NUMBER: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

/**
 * Parse a number that may be digits ("11") or words ("eleven", "twenty one",
 * "one hundred thirty seven"). Returns null if nothing could be parsed.
 */
function parseNumber(value: string): number | null {
  const trimmed = value.trim().toLowerCase().replace(/-/g, " ");

  // Pure digits
  const asInt = Number.parseInt(trimmed, 10);
  if (/^\d+$/.test(trimmed) && Number.isFinite(asInt) && asInt >= 0) {
    return asInt;
  }

  // Word-form: split into tokens and accumulate
  const tokens = trimmed.split(/\s+/);
  let total = 0;
  let current = 0;
  let matched = false;

  for (const token of tokens) {
    // skip filler words Deepgram may insert
    if (token === "and" || token === "a") {
      continue;
    }
    const val = WORD_TO_NUMBER[token];
    if (val === undefined) {
      // unknown word — if we already have some value, stop; otherwise fail
      if (matched) {
        break;
      }
      return null;
    }
    matched = true;
    if (val === 100) {
      current = (current === 0 ? 1 : current) * 100;
    } else if (val >= 10 && val <= 90 && val % 10 === 0) {
      current += val;
    } else {
      current += val;
    }
  }

  if (!matched) {
    return null;
  }

  total += current;
  return total > 0 ? total : null;
}

function parsePositiveInt(value: string): number | null {
  const n = parseNumber(value);
  if (n === null || n < 1) {
    return null;
  }
  return n;
}

// A "number token" in the regex: either digits or one-or-more words
const NUM = `(\\d+(?:\\s+\\d+)*|[a-z]+(?:[\\s-]+[a-z]+)*)`;

export function parseSelectLinesIntent(
  transcript: string,
): SelectLinesIntent | null {
  const text = transcript
    .trim()
    .toLowerCase()
    .replace(/[.,!?]+/g, "");
  console.log(
    "[Voice:Parser] parseSelectLinesIntent input:",
    JSON.stringify(transcript),
    "normalized:",
    JSON.stringify(text),
  );
  if (!text) {
    console.log("[Voice:Parser] empty text, returning null");
    return null;
  }

  const rangePatterns: RegExp[] = [
    new RegExp(
      `(?:select|highlight)\\s+lines?\\s+${NUM}\\s*(?:to|through|-)\\s*${NUM}`,
    ),
    new RegExp(`lines?\\s+${NUM}\\s*(?:to|through|-)\\s*${NUM}`),
    // Handle Deepgram dropping "select/line" — bare "X to Y" with number words
    new RegExp(`${NUM}\\s+(?:to|through)\\s+${NUM}`),
  ];

  const singlePatterns: RegExp[] = [
    new RegExp(`(?:select|highlight)\\s+lines?\\s+${NUM}`),
    new RegExp(`lines?\\s+${NUM}`),
  ];

  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    console.log(
      "[Voice:Parser] range pattern:",
      pattern.source,
      "match:",
      JSON.stringify(match),
    );
    if (!match || match[1] === undefined || match[2] === undefined) {
      continue;
    }

    const start = parsePositiveInt(match[1]);
    const end = parsePositiveInt(match[2]);
    console.log(
      "[Voice:Parser] range match: start =",
      start,
      "end =",
      end,
      "from",
      JSON.stringify(match[1]),
      JSON.stringify(match[2]),
    );
    if (start === null || end === null) {
      continue;
    }
    const result = {
      startLine: Math.min(start, end),
      endLine: Math.max(start, end),
    };
    console.log("[Voice:Parser] returning intent:", JSON.stringify(result));
    return result;
  }

  for (const pattern of singlePatterns) {
    const match = text.match(pattern);
    console.log(
      "[Voice:Parser] single pattern:",
      pattern.source,
      "match:",
      JSON.stringify(match),
    );
    if (!match || match[1] === undefined) {
      continue;
    }

    const line = parsePositiveInt(match[1]);
    console.log(
      "[Voice:Parser] single line match:",
      line,
      "from",
      JSON.stringify(match[1]),
    );
    if (line === null) {
      continue;
    }
    const result = { startLine: line, endLine: line };
    console.log("[Voice:Parser] returning intent:", JSON.stringify(result));
    return result;
  }

  console.log("[Voice:Parser] no pattern matched, returning null");
  return null;
}
