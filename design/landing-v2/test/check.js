const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');
const css=h.slice(h.indexOf('<style>')+7,h.indexOf('</style>'));
const ok=(l,c)=>console.log((c?'  ok  ':'*FAIL*')+' '+l);
ok('comments balanced',(css.match(/\/\*/g)||[]).length===(css.match(/\*\//g)||[]).length);
ok('braces balanced',(css.match(/\{/g)||[]).length===(css.match(/\}/g)||[]).length);
let body=h.slice(h.indexOf('</style>')+8).replace(/<script[\s\S]*?<\/script>/g,'');
const VOID=new Set(['br','img','input','meta','link','hr','source','area','base','col','embed','track','wbr','circle','rect','path','use','stop']);
const stack=[];let err=0,m;const re=/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
while((m=re.exec(body))){const[,cl,tag,,self]=m;const t=tag.toLowerCase();
 if(t==='svg'||t==='g'){ if(cl)stack.pop(); else if(!self)stack.push(t); continue; }
 if(VOID.has(t)||self)continue;
 if(cl){const last=stack.pop();if(last!==t){console.log('  MISMATCH </'+t+'> vs <'+last+'>');err++;}}
 else stack.push(t);}
ok('tags balanced',stack.length===0&&err===0);
if(stack.length) console.log('   unclosed:',stack);
ok('4 fonts embedded',(h.match(/data:font\/woff2/g)||[]).length===4);
ok('both themes',h.includes('data-theme="dark"')&&h.includes('data-theme="light"'));
ok('reduced-motion',h.includes('prefers-reduced-motion'));
ok('focus-visible',h.includes('focus-visible'));
ok('no placeholders left',!/__[A-Z]+:?[a-z0-9-]*__/.test(h));
// banned-word self-audit on the rendered copy (exclude the banned list itself)
const vis=body.replace(/<div class="banned">[\s\S]*?<\/div>/,'').replace(/<[^>]+>/g,' ');
const banned=['seamless','effortless','robust','cutting-edge','revolutionise','empower','unlock','leverage','streamline','supercharge','game-changing','delightful','lightning fast'];
const hits=banned.filter(w=>new RegExp('\b'+w+'\b','i').test(vis));
ok('no banned words in copy',hits.length===0); if(hits.length)console.log('   hits:',hits);
