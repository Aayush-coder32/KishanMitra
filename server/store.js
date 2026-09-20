import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
export const collections=['users','farmers','districts','states','procurementCentres','slots','queueTokens','procurements','payments','notifications','documents','crops','reports','auditLogs','sessions','challenges'];
const fields={users:{name:String,email:String,mobile:String,passwordHash:String,role:String,district:String,state:String},farmers:{userId:String,farmerId:String,aadhaarEncrypted:String,panEncrypted:String},slots:{farmerId:String,centreId:String,date:String,timeSlot:String,status:String},payments:{farmerId:String,procurementId:String,amount:Number,status:String}};
export const models=Object.fromEntries(collections.map(name=>[name,mongoose.model(name,new mongoose.Schema({_id:{type:String,default:()=>crypto.randomUUID()},...fields[name]},{strict:false,versionKey:false,collection:name}))]));
const Revision=mongoose.model('revision',new mongoose.Schema({_id:String,version:Number}));
let state=Object.fromEntries(collections.map(k=>[k,[]]));let tail=Promise.resolve();let mongo=false;
export const id=()=>crypto.randomUUID();
export async function initStore(uri){if(uri){await mongoose.connect(uri);mongo=true;await Revision.updateOne({_id:'lock'},{$setOnInsert:{version:0}},{upsert:true});}else{await fs.mkdir('.data',{recursive:true});try{state={...state,...JSON.parse(await fs.readFile('.data/db.json','utf8'))};}catch(e){if(e.code!=='ENOENT')throw e;}}}
export async function read(){return mongo?Object.fromEntries(await Promise.all(collections.map(async k=>[k,await models[k].find().lean()]))):structuredClone(state);}
export function mutate(fn){const task=tail.then(async()=>{if(mongo){let result;await mongoose.connection.transaction(async session=>{await Revision.updateOne({_id:'lock'},{$inc:{version:1}},{session});const db={};for(const k of collections)db[k]=await models[k].find().session(session).lean();result=await fn(db);for(const k of collections){await models[k].deleteMany({},{session});if(db[k].length)await models[k].insertMany(db[k],{session});}});return result;}const draft=structuredClone(state);const result=await fn(draft);await fs.writeFile('.data/db.tmp',JSON.stringify(draft));await fs.rename('.data/db.tmp','.data/db.json');state=draft;return result;});tail=task.catch(()=>{});return task;}
