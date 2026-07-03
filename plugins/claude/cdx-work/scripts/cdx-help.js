#!/usr/bin/env node
"use strict";var m=Object.create;var u=Object.defineProperty;var d=Object.getOwnPropertyDescriptor;var g=Object.getOwnPropertyNames;var f=Object.getPrototypeOf,h=Object.prototype.hasOwnProperty;var v=(n,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of g(e))!h.call(n,s)&&s!==t&&u(n,s,{get:()=>e[s],enumerable:!(i=d(e,s))||i.enumerable});return n};var l=(n,e,t)=>(t=n!=null?m(f(n)):{},v(e||!n||!n.__esModule?u(t,"default",{value:n,enumerable:!0}):t,n));var a=l(require("fs")),r=l(require("path"));function C(){let n=process.argv.slice(2),e={pluginRoot:r.resolve(__dirname,"..")};for(let t=0;t<n.length;t++)switch(n[t]){case"--plugin-root":e.pluginRoot=r.resolve(n[++t]);break;case"--help":console.log(`
CodePlugin Help CLI

Lists every slash command in the plugin with its description, plus the
plugin name + version from .claude-plugin/plugin.json.

Usage: node cdx-help.js [options]

Options:
  --plugin-root <path>  Override the plugin root (default: dirname/..)
  --help                Show this help message

Output: ready-to-display markdown to stdout
`),process.exit(0)}return e}function y(n){let e={},t=n.split(/\r?\n/);if(t[0]?.trim()!=="---")return e;for(let i=1;i<t.length;i++){let s=t[i];if(s.trim()==="---")break;let c=s.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);if(!c)continue;let o=c[2].trim();o.length>=2&&(o.startsWith('"')&&o.endsWith('"')||o.startsWith("'")&&o.endsWith("'"))&&(o=o.slice(1,-1)),e[c[1]]=o}return e}var p=[".claude-plugin",".codex-plugin",".cursor-plugin"];function j(n){for(let e of p){let t=r.join(n,e,"plugin.json");if(a.existsSync(t))try{return JSON.parse(a.readFileSync(t,"utf-8"))}catch{return null}}return null}function I(n){let e=r.join(n,"commands");return a.existsSync(e)?a.readdirSync(e).filter(s=>s.endsWith(".md")).map(s=>{let c=a.readFileSync(r.join(e,s),"utf-8"),o=y(c);return{name:r.basename(s,".md"),description:o.description??"(no description)",argumentHint:o["argument-hint"]||null}}).sort((s,c)=>s.name.localeCompare(c.name)):[]}function R(n,e){let t=[`# ${n.name} v${n.version}`,""];n.description&&t.push(n.description,""),t.push("## Commands",""),t.push("| Command | Arguments | Description |"),t.push("| ------- | --------- | ----------- |");for(let i of e){let s=i.argumentHint?`\`${i.argumentHint}\``:"\u2014";t.push(`| \`/${n.name}:${i.name}\` | ${s} | ${i.description} |`)}return t.push(""),t.push('> **Opting out of source references:** synced nodes and edges include file-path source references (and links into your git host) by default. To omit them from what `/sync` pushes, set `"includeSourceReferences": false` in `.contextdx/config.json`.'),t.join(`
`)}function S(){let n=C(),e=j(n.pluginRoot);e||(console.log(`Could not read plugin manifest (${p.join("|")}/plugin.json) under ${n.pluginRoot}`),process.exit(1));let t={name:e.name??"(unknown)",version:e.version??"(unknown)",description:e.description??""};console.log(R(t,I(n.pluginRoot))),process.exit(0)}S();
