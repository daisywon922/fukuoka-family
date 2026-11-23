const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../booking-attachments.js'),'utf8');
const functions=code.slice(code.indexOf(' function validate('),code.indexOf(' async function add('));
const c=vm.createContext({limit:10*1024*1024,Blob,URL,Image:class{async decode(){throw Error('unsupported')}},Uint8Array});
vm.runInContext(functions+';globalThis.api={validate,prepare}',c);
const file=(name,body,type='application/pdf')=>Object.assign(new Blob([body],{type}),{name});
(async()=>{
assert.equal(c.api.validate(file('voucher.pdf','%PDF-1.4')),'application/pdf');
assert.throws(()=>c.api.validate(file('x.svg','<svg>','image/svg+xml')),/JPG/);
assert.throws(()=>c.api.validate({name:'big.pdf',size:10485761,type:'application/pdf'}),/10MB/);
assert.throws(()=>c.api.validate(file('empty.pdf','')),/비어/);
await assert.rejects(()=>c.api.prepare(file('fake.pdf','not a pdf')),/올바른 PDF/);
assert.equal((await c.api.prepare(file('voucher.pdf','%PDF-1.4'))).name,'voucher.pdf');
const heic=file('photo.heic','sample','image/heic');assert.equal((await c.api.prepare(heic)).blob,heic);
const js=fs.readFileSync(require.resolve('../notifications.js'),'utf8');new vm.Script(js);
console.log('Attachment size/type/PDF validation, HEIC fallback and syntax passed');
})().catch(e=>{console.error(e);process.exitCode=1});
