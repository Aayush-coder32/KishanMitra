import fs from 'node:fs';
function edit(file,changes){let s=fs.readFileSync(file,'utf8');for(const [from,to]of changes){if(!s.includes(from))throw Error(`Missing replacement in ${file}: ${from.slice(0,80)}`);s=s.replace(from,to);}fs.writeFileSync(file,s);}
edit('src/pages/Dashboard.jsx',[
 ["import {Brand} from './Landing';","import {Brand} from './Landing';\nimport CentreMap from '../components/CentreMap';"],
 ["async function logout(){await action(()=>api.post('/auth/logout'),'Signed out');onLogout();nav('/login');}","async function logout(){if(await action(()=>api.post('/auth/logout'),'Signed out')){onLogout();nav('/login');}}"],
 ["<Analytics data={data}/><Card title=\"Recent bookings\"","<Card title={user.role==='government'?'National procurement network':'Procurement centre activity'} subtitle=\"Select a centre marker to view capacity and activity.\"><CentreMap data={data} national={user.role==='government'}/></Card><Analytics data={data}/><Card title=\"Recent bookings\""],
 ["[crop,setCrop]=useState('Wheat');const c=", "[crop,setCrop]=useState('Wheat'),[availability,setAvailability]=useState([]);useEffect(()=>{if(centre)api.get('/availability',{params:{centreId:centre,date:day}}).then(r=>setAvailability(r.data)).catch(()=>setAvailability([]));},[centre,day,data]);const c="],
 ["className={time===t?'selected':''} onClick={()=>setTime(t)}", "className={time===t?'selected':''} disabled={availability.find(a=>a.timeSlot===t)?.available===0} onClick={()=>setTime(t)}"],
 ["<small>2-hour window</small>","<small>{availability.find(a=>a.timeSlot===t)?.available??'…'} places available</small>"],
 ["disabled={busy||!centre}","disabled={busy||!centre||availability.find(a=>a.timeSlot===time)?.available===0}"],
 ["function Centres({data,user,action}){const [selected,setSelected]=useState(null);return <><div", "function Centres({data,user,action}){const [selected,setSelected]=useState(null);return <><Card title=\"Centre locations\" subtitle=\"Select a marker for centre activity.\"><CentreMap data={data} national={user.role==='government'}/></Card><div"],
 ["{!page&&<Overview", "{!menu.some(m=>m[0]===page)&&!['help','settings'].includes(page)&&<Card title=\"Page unavailable\"><p>This page is not available for your role.</p><Link className=\"text-link\" to=\"/app\">Return to overview</Link></Card>}{!page&&<Overview"]
]);
edit('server/domain.js',[["centre.status==='Closed'","['Closed','Full'].includes(centre.status)"],["if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(input.date)","if(Number.isNaN(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date||!/^\\d{4}-\\d{2}-\\d{2}$/.test(input.date)"]]);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));pkg.overrides={uuid:'^11.1.1'};pkg.scripts['test:api']='node scripts/smoke.mjs';pkg.scripts['test:browser']='node scripts/browser-smoke.mjs';pkg.scripts['admin:create']='node scripts/create-admin.mjs';fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
