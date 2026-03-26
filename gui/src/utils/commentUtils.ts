const BLOCK_COMMENT_FORMATS: Record<
  string,
  { prefix: string; suffix: string }
> = {
  js: { prefix: "/*", suffix: "*/" },
  jsx: { prefix: "/*", suffix: "*/" },
  ts: { prefix: "/*", suffix: "*/" },
  tsx: { prefix: "/*", suffix: "*/" },
  mjs: { prefix: "/*", suffix: "*/" },
  cjs: { prefix: "/*", suffix: "*/" },
  css: { prefix: "/*", suffix: "*/" },
  scss: { prefix: "/*", suffix: "*/" },
  less: { prefix: "/*", suffix: "*/" },
  html: { prefix: "<!--", suffix: "-->" },
  xml: { prefix: "<!--", suffix: "-->" },
  svelte: { prefix: "<!--", suffix: "-->" },
  vue: { prefix: "<!--", suffix: "-->" },
  markdown: { prefix: "<!--", suffix: "-->" },
  md: { prefix: "<!--", suffix: "-->" },
  go: { prefix: "/*", suffix: "*/" },
  rust: { prefix: "/*", suffix: "*/" },
  c: { prefix: "/*", suffix: "*/" },
  cpp: { prefix: "/*", suffix: "*/" },
  cc: { prefix: "/*", suffix: "*/" },
  h: { prefix: "/*", suffix: "*/" },
  hpp: { prefix: "/*", suffix: "*/" },
  cs: { prefix: "/*", suffix: "*/" },
  csharp: { prefix: "/*", suffix: "*/" },
  java: { prefix: "/*", suffix: "*/" },
  kt: { prefix: "/*", suffix: "*/" },
  kotlin: { prefix: "/*", suffix: "*/" },
  swift: { prefix: "/*", suffix: "*/" },
  scala: { prefix: "/*", suffix: "*/" },
  php: { prefix: "/*", suffix: "*/" },
  lua: { prefix: "--[[", suffix: "]]" },
  hs: { prefix: "{-", suffix: "-}" },
  lhs: { prefix: "{-", suffix: "-}" },
  purescript: { prefix: "{-", suffix: "-}" },
  agda: { prefix: "{-", suffix: "-}" },
  idris: { prefix: "{-", suffix: "-}" },
};

const SINGLE_LINE_COMMENTS: Record<string, string> = {
  py: "#",
  python: "#",
  rb: "#",
  ruby: "#",
  sh: "#",
  bash: "#",
  zsh: "#",
  shell: "#",
  yaml: "#",
  yml: "#",
  r: "#",
  graphql: "#",
  proto: "//",
  tf: "#",
  hcl: "#",
  dockerfile: "#",
  makefile: "#",
  cmake: "#",
  ex: "#",
  exs: "#",
  erl: "%",
  tfvars: "#",
  sql: "--",
  toml: "#",
  json: "//",
  zig: "//",
};

export function formatComment(text: string, filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase() || "";
  const blockFormat = BLOCK_COMMENT_FORMATS[ext];
  const singleLinePrefix = SINGLE_LINE_COMMENTS[ext];

  if (blockFormat) {
    const lines = text.split("\n");
    const paddedLines = lines.map((line) => (line ? `  ${line}` : ""));
    const body = paddedLines.join("\n");
    return `${blockFormat.prefix}\n${body}\n${blockFormat.suffix}`;
  }

  if (singleLinePrefix) {
    const lines = text.split("\n");
    return lines.map((line) => `${singleLinePrefix} ${line}`).join("\n");
  }

  const defaultPrefix = SINGLE_LINE_COMMENTS[ext] || "//";
  const lines = text.split("\n");
  return lines.map((line) => `${defaultPrefix} ${line}`).join("\n");
}
