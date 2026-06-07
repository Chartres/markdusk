import { mount } from "svelte";
import App from "./routes/App.svelte";
import { applyAppearance, applyTheme } from "$lib/theme/theme";

applyTheme("smoke");
applyAppearance("system");

const target = document.getElementById("app");
if (!target) throw new Error("missing #app");
mount(App, { target });
