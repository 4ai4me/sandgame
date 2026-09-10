/* Root index.html is authoritative. Sites needs a self-contained dist entry. */
const fs=require('node:fs'),path=require('node:path'),root=__dirname;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="(dist\/[^"]+)"/g)){
 const file=match[1].split('?')[0];if(!fs.existsSync(path.join(root,file)))throw Error('Missing asset: '+file);
}
fs.writeFileSync(path.join(root,'dist/index.html'),html.replace(/((?:src|href)=")dist\//g,'$1'));
console.log('Validated root entry and generated Sites entry.');
