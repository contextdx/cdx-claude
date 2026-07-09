#!/usr/bin/env node
"use strict";var p=require("child_process");function g(){let e=process.argv.slice(2),t={host:"",pluginName:"",hostName:""};for(let n=0;n<e.length;n++)switch(e[n]){case"--host":t.host=e[++n];break;case"--plugin-name":t.pluginName=e[++n];break;case"--host-name":t.hostName=e[++n];break;case"--help":console.log(`
CodePlugin Update CLI

Updates this plugin via the host's own plugin manager (marketplace refresh +
scoped update), looking up the installed marketplace/scope instead of
guessing them.

Usage: node cdx-update.js --host <claude|codex|cursor> --plugin-name <name> --host-name <label>

Output: JSON to stdout with a \`display\` field of ready-to-show markdown.
`),process.exit(0)}return t}function a(e,t,n,s){e.success=!1,e.status="error",e.error=t,e.errorCode=n,e.display=s??`\u274C **Update failed** \u2014 ${t}`,console.log(JSON.stringify(e,null,2)),process.exit(n)}function c(e,t){let n=(0,p.spawnSync)(e,t,{encoding:"utf-8"});if(n.error)return{code:1,output:`Could not run \`${e}\`: ${n.error.message}`};let s=[n.stdout,n.stderr].filter(Boolean).join(`
`).trim();return{code:n.status??1,output:s}}function d(e,t,n){let s=c(e,["plugin","list","--json"]);s.code!==0&&a(n,`\`${e} plugin list --json\` failed: ${s.output}`,4);let r;try{r=JSON.parse(s.output)}catch{a(n,`\`${e} plugin list --json\` returned unparseable output: ${s.output}`,4)}let u=`${t}@`,i=r.find(o=>o.id?.startsWith(u));if(!i){let o=r.map(l=>l.id).join(", ")||"(none)";a(n,`"${t}" is not currently installed under any scope.`,2,`\u274C **"${t}" isn't installed** \u2014 checked \`${e} plugin list\` across every scope and found no match.

Currently installed: ${o}

If it's installed under a different name/marketplace, update it directly with that host's plugin manager. Otherwise install it first: \`/plugin install ${t}@<marketplace>\`.`)}return i}function f(e,t){return{success:!0,status:"manual",display:`**${t} has no marketplace or update command** \u2014 there's nothing to run automatically.

Rebuild the plugin from source (\`yarn build\` in cdx-plugins) or pull the latest release, then re-copy it over the local install:

\`\`\`bash
cp -r ${e} ~/.cursor/plugins/local/${e}
\`\`\`

Then restart ${t}.`}}function h(){let{host:e,pluginName:t,hostName:n}=g(),s={success:!1};(!e||!t||!n)&&a(s,"Missing required --host, --plugin-name, or --host-name.",4),e==="cursor"&&(console.log(JSON.stringify(f(t,n),null,2)),process.exit(0));let r=d(e,t,s),u=r.id.split("@")[1];s.oldVersion=r.version;let i=c(e,["plugin","marketplace","update",u]);i.code!==0&&a(s,`marketplace refresh failed: ${i.output}`,1,`\u274C **Marketplace refresh failed** for \`${u}\`:

\`\`\`
${i.output}
\`\`\``);let o=c(e,["plugin","update",r.id,"--scope",r.scope]);o.code!==0&&a(s,`plugin update failed: ${o.output}`,3,`\u274C **Update failed** for \`${t}\` (scope: ${r.scope}):

\`\`\`
${o.output}
\`\`\``);let l=d(e,t,s);s.newVersion=l.version,s.success=!0,l.version!==r.version?(s.status="updated",s.display=`\u2705 **Updated \`${t}\`: ${r.version} \u2192 ${l.version}.**

Restart ${n} to load it.`):(s.status="already-latest",s.display=`\u2705 **\`${t}\` is already on the latest version (${r.version}).**`),console.log(JSON.stringify(s,null,2)),process.exit(0)}h();
