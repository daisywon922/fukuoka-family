const assert=require('node:assert/strict');
const tree=require('../checklist-tree.js'),{merge}=require('../shared-merge.js');
const old=[{id:'old',text:'여권',checked:false}];assert.equal(tree.validate(old),true);assert.equal(tree.validate([null]),false);
const items=[{id:'docs',text:'서류',checked:false,children:[{id:'passport',text:'여권',checked:false},{id:'voucher',text:'바우처',checked:false}]},{id:'medicine',text:'약',checked:false}];
assert.equal(tree.validate(items),true);assert.equal(tree.validate([{...items[0],children:[{id:'nested',text:'삼 단계',checked:false,children:[]}]}]),false);
assert.equal(tree.validate([{...items[0],children:[{id:'docs',text:'중복',checked:false}]}]),false);
const all=tree.toggle(items,'docs',true);assert.equal(all[0].checked,true);assert.equal(all[0].children.every(x=>x.checked),true);assert.deepEqual(tree.progress(all),{done:2,total:3});assert.equal(items[0].children[0].checked,false);
const partial=tree.toggle(all,'voucher',false);assert.equal(partial[0].checked,false);assert.equal(partial[0].children[0].checked,true);
const completed=tree.toggle(partial,'voucher',true);assert.equal(completed[0].checked,true);
const groupMoved=tree.move(items,0,1);assert.equal(groupMoved[1].children[0].id,'passport');assert.equal(items[0].id,'docs');
const childMoved=tree.move(items,0,1,'docs');assert.deepEqual(childMoved[0].children.map(x=>x.id),['voucher','passport']);
const base={personalLists:{'member-1':items}},a=structuredClone(base),b=structuredClone(base);a.personalLists['member-1'][0].children[0].checked=true;b.personalLists['member-1'][0].children[1].checked=true;
assert.equal(tree.normalize(merge(base,a,b).personalLists['member-1'])[0].checked,true);
const initial={personalLists:{'member-1':old}},c=structuredClone(initial),d=structuredClone(initial);c.personalLists['member-1'][0].children=[{id:'a',text:'A',checked:false}];d.personalLists['member-1'][0].children=[{id:'b',text:'B',checked:false}];assert.equal(merge(initial,c,d).personalLists['member-1'][0].children.length,2);
console.log('Two-level validation, old-data compatibility, group/child toggles, leaf totals, ordering and concurrent child edits passed');

const missing={personalLists:{}},newA={personalLists:{'member-1':[...items,{id:'custom-a',text:'A',checked:false}]}},newB={personalLists:{'member-1':items}};assert.equal(merge(missing,newB,newA).personalLists['member-1'].some(x=>x.id==='custom-a'),true);
