#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const defaultsSource = fs.readFileSync("shared/estimate-defaults.js", "utf8");
const sandbox = { global: {}, window: {} };
sandbox.global = sandbox.window;
vm.runInNewContext(defaultsSource, sandbox);
const config = sandbox.window.EstimateDefaults.createDefaultEstimateConfig();
fs.writeFileSync("data/estimate-config.json", JSON.stringify(config, null, 2) + "\n");
