import { mount } from "svelte";
import App from "./routes/App.svelte";
import { applyAppearance } from "$lib/theme/theme";

applyAppearance("system");

const target = document.getElementById("app");
if (!target) throw new Error("missing #app");
mount(App, { target });
