#!/usr/bin/env node
"use strict";var g=Object.create;var u=Object.defineProperty;var m=Object.getOwnPropertyDescriptor;var f=Object.getOwnPropertyNames;var d=Object.getPrototypeOf,h=Object.prototype.hasOwnProperty;var v=(t,n,s,r)=>{if(n&&typeof n=="object"||typeof n=="function")for(let i of f(n))!h.call(t,i)&&i!==s&&u(t,i,{get:()=>n[i],enumerable:!(r=m(n,i))||r.enumerable});return t};var p=(t,n,s)=>(s=t!=null?g(d(t)):{},v(n||!t||!t.__esModule?u(s,"default",{value:t,enumerable:!0}):s,t));var l=p(require("fs")),e=p(require("path"));function C(){let t=process.argv.slice(2),n={pluginRoot:e.resolve(__dirname,"..")};for(let s=0;s<t.length;s++)switch(t[s]){case"--plugin-root":n.pluginRoot=e.resolve(t[++s]);break;case"--help":console.log(`
CodePlugin Help CLI

Lists every slash command in the plugin with its description, plus the
plugin name + version from .claude-plugin/plugin.json.

Usage: node cdx-help.js [options]

Options:
  --plugin-root <path>  Override the plugin root (default: dirname/..)
  --help                Show this help message

Output: JSON to stdout
`),process.exit(0)}return n}function O(t){let n={},s=t.split(/\r?\n/);if(s[0]?.trim()!=="---")return n;for(let r=1;r<s.length;r++){let i=s[r];if(i.trim()==="---")break;let a=i.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);if(!a)continue;let o=a[2].trim();o.length>=2&&(o.startsWith('"')&&o.endsWith('"')||o.startsWith("'")&&o.endsWith("'"))&&(o=o.slice(1,-1)),n[a[1]]=o}return n}function R(t){let n=e.join(t,".claude-plugin","plugin.json");if(!l.existsSync(n))return null;try{let s=l.readFileSync(n,"utf-8");return JSON.parse(s)}catch{return null}}function S(t){let n=e.join(t,"commands");return l.existsSync(n)?l.readdirSync(n).filter(i=>i.endsWith(".md")).map(i=>{let a=e.join(n,i),o=l.readFileSync(a,"utf-8"),c=O(o);return{name:e.basename(i,".md"),description:c.description??"(no description)",argumentHint:c["argument-hint"]||null,file:e.relative(t,a)}}).sort((i,a)=>i.name.localeCompare(a.name)):[]}function y(){let t=C(),n={success:!1},s=R(t.pluginRoot);s||(n.error=`Could not read plugin manifest at ${e.join(t.pluginRoot,".claude-plugin","plugin.json")}`,console.log(JSON.stringify(n,null,2)),process.exit(1)),n.plugin={name:s.name??"(unknown)",version:s.version??"(unknown)",description:s.description??""},n.commands=S(t.pluginRoot),n.success=!0,console.log(JSON.stringify(n,null,2)),process.exit(0)}y();
