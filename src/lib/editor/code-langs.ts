import { LanguageDescription, LanguageSupport, StreamLanguage } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { rust } from "@codemirror/lang-rust";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { elm } from "@codemirror/legacy-modes/mode/elm";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { properties } from "@codemirror/legacy-modes/mode/properties";

const legacy = (lang: typeof shell) => new LanguageSupport(StreamLanguage.define(lang));

export const codeLanguages: LanguageDescription[] = [
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "ts", "tsx", "jsx", "typescript", "mjs", "cjs"],
    support: javascript({ jsx: true, typescript: true }),
  }),
  LanguageDescription.of({ name: "html", alias: ["xml", "svg", "vue"], support: html() }),
  LanguageDescription.of({ name: "css", alias: ["scss", "sass", "less"], support: css() }),
  LanguageDescription.of({ name: "rust", alias: ["rs"], support: rust() }),
  LanguageDescription.of({ name: "python", alias: ["py", "py3"], support: python() }),
  LanguageDescription.of({ name: "json", alias: ["jsonc"], support: json() }),
  LanguageDescription.of({ name: "cpp", alias: ["c", "c++", "h", "hpp", "objc"], support: cpp() }),
  LanguageDescription.of({ name: "go", alias: ["golang"], support: go() }),
  LanguageDescription.of({ name: "sql", alias: ["mysql", "postgres", "postgresql", "sqlite"], support: sql() }),
  LanguageDescription.of({ name: "yaml", alias: ["yml"], support: yaml() }),
  LanguageDescription.of({
    name: "shell",
    alias: ["sh", "bash", "zsh", "fish"],
    support: legacy(shell),
  }),
  LanguageDescription.of({ name: "toml", support: legacy(toml) }),
  LanguageDescription.of({ name: "ruby", alias: ["rb"], support: legacy(ruby) }),
  LanguageDescription.of({ name: "swift", support: legacy(swift) }),
  LanguageDescription.of({
    name: "dockerfile",
    alias: ["docker"],
    support: legacy(dockerFile),
  }),
  LanguageDescription.of({ name: "lua", support: legacy(lua) }),
  LanguageDescription.of({ name: "perl", alias: ["pl"], support: legacy(perl) }),
  LanguageDescription.of({ name: "haskell", alias: ["hs"], support: legacy(haskell) }),
  LanguageDescription.of({ name: "elm", support: legacy(elm) }),
  LanguageDescription.of({ name: "clojure", alias: ["clj", "cljs"], support: legacy(clojure) }),
  LanguageDescription.of({ name: "erlang", alias: ["erl"], support: legacy(erlang) }),
  LanguageDescription.of({ name: "diff", alias: ["patch"], support: legacy(diff) }),
  LanguageDescription.of({
    name: "ini",
    alias: ["conf", "properties"],
    support: legacy(properties),
  }),
];
