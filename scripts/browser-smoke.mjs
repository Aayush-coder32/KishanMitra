import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await fs.mkdir('artifacts',{recursive:true});
const executablePath=process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({executablePath,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:5173');await page.getByRole('heading',{name:'Your hard work.' ,exact:false}).waitFor();await page.screenshot({path:'artifacts/landing-desktop.png',fullPage:true});
 await page.getByRole('link',{name:'Farmer login',exact:true}).click();await page.getByRole('button',{name:'Sign in as farmer'}).click();await page.getByRole('heading',{name:'Good day, Rajesh'}).waitFor();await page.screenshot({path:'artifacts/farmer-desktop.png',fullPage:true});
 await page.getByRole('link',{name:'Book a slot',exact:true}).first().click();await page.getByLabel('Procurement centre').waitFor();await page.screenshot({path:'artifacts/booking-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5173/app');await page.getByRole('heading',{name:'Good day, Rajesh'}).waitFor();await page.screenshot({path:'artifacts/farmer-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile dashboard must not overflow horizontally');
 await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'district',exact:true}).click();await page.getByRole('button',{name:'Sign in as district'}).click();await page.getByRole('heading',{name:'District overview'}).waitFor();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'artifacts/district-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: landing, farmer login, booking form, mobile navigation, district login, screenshots and no browser runtime errors.');
}finally{await browser.close();}
