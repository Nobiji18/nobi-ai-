const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "switch",
  "case",
  "break",
  "continue",
  "class",
  "extends",
  "new",
  "this",
  "import",
  "from",
  "export",
  "default",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "throw",
  "typeof",
  "instanceof",
  "in",
  "of",
  "true",
  "false",
  "null",
  "undefined",
  "interface",
  "type",
  "enum",
  "implements",
  "public",
  "private",
  "protected",
  "static",
  "def",
  "elif",
  "lambda",
  "with",
  "as",
  "pass",
  "yield",
  "self",
  "None",
  "True",
  "False",
  "and",
  "or",
  "not",
  "package",
  "func",
  "fn",
  "struct",
  "impl",
  "mut",
  "pub",
  "use",
  "mod",
  "match",
  "void",
  "int",
  "string",
  "bool",
  "float",
  "double",
  "char",
]);

export type Token = { t: string; c: "kw" | "str" | "cmt" | "num" | "plain" };

const TOKEN_RE =
  /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][\w]*\b)/g;

export function tokenize(code: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, "g");
  while ((m = re.exec(code))) {
    if (m.index > last) out.push({ t: code.slice(last, m.index), c: "plain" });
    const t = m[0] ?? "";
    let c: Token["c"] = "plain";
    if (
      t.startsWith("//") ||
      t.startsWith("#") ||
      t.startsWith("/*") ||
      t.startsWith("<!--")
    ) {
      c = "cmt";
    } else if (t.startsWith('"') || t.startsWith("'") || t.startsWith("`")) {
      c = "str";
    } else if (/^\d/.test(t)) {
      c = "num";
    } else if (KEYWORDS.has(t)) {
      c = "kw";
    }
    out.push({ t, c });
    last = m.index + t.length;
  }
  if (last < code.length) out.push({ t: code.slice(last), c: "plain" });
  return out;
}

export function langFromPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "ts",
    tsx: "tsx",
    js: "js",
    jsx: "jsx",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    css: "css",
    html: "html",
    json: "json",
    md: "md",
    sh: "bash",
    sql: "sql",
    c: "c",
    cpp: "cpp",
    h: "c",
    rb: "ruby",
    php: "php",
  };
  return map[ext] ?? ext ?? "text";
}
