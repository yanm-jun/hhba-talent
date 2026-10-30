import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEngagement,validOrigin} from '../engagement-core.mjs';
test('accepts only explicit event types',()=>{
 assert.equal(normalizeEngagement({type:'page_view',path:'/'}).type,'page_view');
 assert.equal(normalizeEngagement({type:'unknown',path:'/'}),null);
});
test('scrubs IDs and rejects query strings and unsafe paths',()=>{
 assert.deepEqual(normalizeEngagement({type:'job_view',path:'/candidate/jobs/greenhouse-openai-123'}),{type:'job_view',path:'/candidate/jobs/:job'});
 assert.equal(normalizeEngagement({type:'page_view',path:'/candidate/jobs?q=private'}),null);
 assert.equal(normalizeEngagement({type:'page_view',path:'https://site/page'}),null);
 assert.equal(normalizeEngagement({type:'page_view',path:'//evil'}),null);
 assert.deepEqual(normalizeEngagement({type:'page_view',path:'/public/me'}),{type:'page_view',path:'/public/:profile'});
});
test('events require exact same origin',()=>{
 assert.equal(validOrigin('https://test.example','https://test.example/api/engagement/event'),true);
 assert.equal(validOrigin('https://evil.example','https://test.example/api/engagement/event'),false);
 assert.equal(validOrigin(null,'https://test.example/api/engagement/event'),false);
});

test('Railway canonical HTTPS hostname permits same-site form and tracker behind an internal HTTP proxy',()=>{
 const trusted='hhba-web-production-024c.up.railway.app';
 const internal='http://127.0.0.1:3000/api/engagement/event';
 assert.equal(validOrigin('https://'+trusted,internal,trusted),true);
 assert.equal(validOrigin('http://'+trusted,internal,trusted),false);
 assert.equal(validOrigin('https://malicious.example',internal,trusted),false);
 assert.equal(validOrigin('null',internal,trusted),false);
 assert.equal(validOrigin(null,internal,trusted),false);
 assert.equal(validOrigin('https://'+trusted,internal,'evil.com:443'),false);
});
