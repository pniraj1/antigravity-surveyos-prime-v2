const fs=require('fs');
const D='C:/Users/Manasi/OneDrive/Desktop/Antigravity Surveyor V6 fixed/SurveyOS-Prime-V2/design/landing-v2/';
const FS='node_modules/@fontsource/';
const FONTS={
 sans400:FS+'ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2',
 sans600:FS+'ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2',
 mono500:FS+'ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
 mono600:FS+'ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2',
};
const [,,tplPath,outPath]=process.argv;
let t=fs.readFileSync(tplPath,'utf8');
Object.entries(FONTS).forEach(([k,p])=>{
  t=t.split('__FONT:'+k+'__').join('data:font/woff2;base64,'+fs.readFileSync(p).toString('base64'));
});
t=t.replace('__TOKENS__',fs.readFileSync(D+'css/tokens.css','utf8'));
t=t.replace('__COMPONENTS__',fs.readFileSync(D+'css/components.css','utf8'));
fs.readdirSync(D+'logo').filter(f=>f.endsWith('.svg')).forEach(f=>{
  const n=f.replace('.svg','');
  let s=fs.readFileSync(D+'logo/'+f,'utf8').replace(/<!--[\s\S]*?-->/g,'').replace(/\n\s*/g,' ').trim();
  t=t.split('__SVG:'+n+'__').join(s);
});
const imgs=JSON.parse(fs.readFileSync('imgs.json','utf8'));
Object.entries(imgs).forEach(([k,v])=>{ t=t.split('__IMG:'+k+'__').join(v); });
const left=t.match(/__[A-Z]+:?[a-z0-9-]*__/g);
if(left) console.log('*** UNSUBSTITUTED:',[...new Set(left)]);
fs.writeFileSync(outPath,t);
console.log('built',outPath,(t.length/1024).toFixed(0)+'KB');
