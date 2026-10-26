import { chromium } from '/Users/cactai/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
const js = new Set();
p.on('response', r => { const u=r.url(); if(u.endsWith('.js') && u.includes('frenchheritage')) js.add(u.split('/').pop()); });
await p.goto('https://www.frenchheritageequestrian.com/login', { waitUntil:'networkidle', timeout:60000 });
await p.waitForTimeout(1500);
console.log([...js].sort().join(','));
await b.close();
