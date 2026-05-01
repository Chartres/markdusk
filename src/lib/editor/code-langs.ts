import { LanguageDescription } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { rust } from "@codemirror/lang-rust";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { cpp } from "@codemirror/lang-cpp";

export const codeLanguages: LanguageDescription[] = [
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "ts", "tsx", "jsx", "typescript"],
    support: javascript({ jsx: true, typescript: true }),
  }),
  LanguageDescription.of({ name: "html", alias: ["xml", "svg"], support: html() }),
  LanguageDescription.of({ name: "css", alias: ["scss", "sass"], support: css() }),
  LanguageDescription.of({ name: "rust", alias: ["rs"], support: rust() }),
  LanguageDescription.of({ name: "python", alias: ["py"], support: python() }),
  LanguageDescription.of({ name: "json", support: json() }),
  LanguageDescription.of({ name: "cpp", alias: ["c", "c++"], support: cpp() }),
];
