import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const names=["SEOUL_API_KEY","DATA_GO_KR_API_KEY","KMA_SERVICE_KEY","KAKAO_REST_API_KEY","NEXT_PUBLIC_KAKAO_MAP_KEY"];
const secrets=names.flatMap(name=>{
 const value=process.env[name]?.trim();if(!value)return [];
 const variants=new Set([value,encodeURIComponent(value)]);try{variants.add(decodeURIComponent(value));}catch{}
 return [...variants].filter(value=>value.length>=8).map(value=>({name,value}));
});
let candidates;
try{candidates=[...new Set(execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{encoding:"utf8"}).split("\0").filter(Boolean))];}
catch{console.error("Cannot read Git upload candidates. Check repository initialization, ownership and access permissions.");process.exit(1);}
let failures=0;
for(const file of candidates){
 if(/(^|\/)\.env(?:\.|$)/.test(file)&&!/(^|\/)\.env\.example$/.test(file)||/(^|\/)(?:node_modules|\.next|\.vercel|artifacts)\//.test(file)||/\.(pem|key|p12|pfx|log)$/i.test(file)){
  console.error(`FAIL: private/generated file would be uploaded: ${file}`);failures++;continue;
 }
 const content=await readFile(file,"utf8");
 for(const secret of secrets)if(content.includes(secret.value)){console.error(`FAIL: ${secret.name} literal found in ${file}`);failures++;}
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)&&!file.endsWith("check-repo-secrets.mjs")){console.error(`FAIL: private key material found in ${file}`);failures++;}
 if(file===".env.example")for(const name of names){if(new RegExp(`^${name}=.+$`,"m").test(content)){console.error(`FAIL: ${name} must be empty in template`);failures++;}}
}
if(failures)process.exit(1);
console.log(`PASS: ${candidates.length} upload candidates scanned; configured credentials and private/generated files excluded.`);

