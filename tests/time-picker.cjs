const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../time-picker.js'),'utf8');
const functions=source.split('\n').filter(line=>/^function (hour24FromClock|clockFromHour24)\(/.test(line)).join('\n');const c=vm.createContext({});vm.runInContext(functions,c);
assert.equal(c.hour24FromClock('am',12),0);assert.equal(c.hour24FromClock('pm',12),12);assert.equal(c.hour24FromClock('pm',1),13);
for(let hour=0;hour<24;hour++)assert.equal(c.hour24FromClock(hour<12?'am':'pm',c.clockFromHour24(hour)),hour);
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert.match(html,/id="schedule-activity" maxlength=/);assert.doesNotMatch(html,/id="schedule-activity" required/);
console.log('All 24 hour conversions including midnight/noon passed; activity is optional');
