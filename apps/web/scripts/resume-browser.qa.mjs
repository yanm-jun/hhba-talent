import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const url='http://127.0.0.1:3000/qa/resume-flow.html';
const output=process.env.QA_OUTPUT||'/tmp/hhba-resume-browser-qa';
await mkdir(output,{recursive:true});
function browserExecutable(){
 for(const cmd of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
  try{return execFileSync('which',[cmd],{encoding:'utf8'}).trim()}catch{}
 }
 throw new Error('Chromium/Chrome binary not available');
}
async function pdfText(buffer){
 const document=await getDocument({data:new Uint8Array(buffer),useSystemFonts:true,
  disableFontFace:true}).promise;
 const pages=[];
 for(let i=1;i<=document.numPages;i++){
  const page=await document.getPage(i);
  const text=await page.getTextContent();
  pages.push(text.items.map(item=>'str' in item?item.str:'').join(' '));
 }
 return pages;
}
const browser=await chromium.launch({executablePath:browserExecutable(),
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1365,height:900},locale:'zh-CN'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.confirm=()=>true});
 const response=await page.goto(url,{waitUntil:'networkidle',timeout:45000});
 assert.equal(response.status(),200);
 await page.getByRole('button',{name:'针对这个岗位优化简历'}).click();
 await page.getByRole('heading',{name:'岗位定向简历 · 证据预览'}).waitFor();
 const generate=page.getByRole('button',{name:'生成 AI 建议'});
 assert.equal(await generate.isDisabled(),true,'user consent is mandatory');
 await page.locator('.targeted-resume-consent input[type=checkbox]').check();
 await generate.click();
 const tip=page.locator('.targeted-resume-suggestion');
 await tip.first().waitFor();
 assert.equal(await page.getByRole('button',{name:'填充此建议'}).isDisabled(),true,
  'AI suggestion must not auto-fill without truthful confirmation');
 await tip.first().locator('input[type=checkbox]').check();
 await page.getByRole('button',{name:'填充此建议'}).click();
 assert.match(await page.locator('.targeted-resume-block p').first().textContent(),/同步整理每日服务记录/);
 await page.locator('.targeted-resume-block-label button').first().click();
 const edit=page.getByRole('textbox',{name:'编辑当前简历段落'});
 await edit.fill('真实参与合成测试门店运营记录整理与预约协调。');
 await page.getByRole('button',{name:'保存本次修改'}).click();
 assert.match(await page.locator('.targeted-resume-block p').first().textContent(),/合成测试门店/);
 await page.getByPlaceholder('请填写本人真实姓名').fill('验收用虚拟姓名');
 await page.getByPlaceholder('例如：区域运营督导').fill('运营助理');
 await page.getByRole('button',{name:'预览 A4'}).click();
 assert.equal(await page.locator('.targeted-resume-print-preview:not(.is-collapsed)').count(),1);
 assert.equal(await page.getByRole('button',{name:'打印 / 保存 PDF'}).isEnabled(),true);
 const pdf=await page.pdf({format:'A4',printBackground:true});
 await writeFile(output+'/desktop-resume.pdf',pdf);
 const pages=await pdfText(pdf);
 const fullText=pages.join(' ').normalize('NFKC').replace(/[\u2ed4]/g,'门').replace(/\s+/g,'');
 console.log('PRINT_DIAGNOSTIC',JSON.stringify({pdf_bytes:pdf.length,page_count:pages.length,
  extracted_chars:fullText.length,containsName:fullText.includes('验收用虚拟姓名'),
  containsEditedExperience:fullText.includes('合成测试门店'),
  contentPreview:fullText.slice(0,110)}));
 assert.ok(fullText.includes('验收用虚拟姓名'),'PDF must contain manually entered name');
 assert.ok(fullText.includes('合成测试门店'),'PDF must contain edited experience');
 assert.ok(!fullText.includes('生成AI建议'),'PDF must not include editor controls');
 await page.screenshot({path:output+'/desktop-editor.png',fullPage:true});
 const save=page.getByRole('button',{name:'保存当前版本'});
 assert.equal(await save.isDisabled(),true,'cloud save must require explicit confirmation');
 await page.locator('.targeted-resume-save-confirm input[type=checkbox]').check();
 await save.click();
 await page.getByRole('button',{name:'载入'}).first().waitFor();
 await page.getByRole('button',{name:'载入'}).first().click();
 await page.getByRole('button',{name:'删除'}).first().click();
 await page.getByRole('button',{name:'载入'}).first().waitFor({state:'detached',timeout:5000});
 assert.equal(await page.getByRole('button',{name:'载入'}).count(),0,'delete must update list');
 assert.deepEqual(errors,[],'no desktop runtime error');
 await page.close();

 const mobile=await browser.newPage({viewport:{width:390,height:844},locale:'zh-CN'});
 const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));
 await mobile.goto(url,{waitUntil:'networkidle',timeout:45000});
 await mobile.getByRole('button',{name:'针对这个岗位优化简历'}).click();
 await mobile.getByPlaceholder('请填写本人真实姓名').fill('移动端虚拟姓名');
 await mobile.getByRole('button',{name:'预览 A4'}).click();
 const metrics=await mobile.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  scroll:document.documentElement.scrollWidth,
  modalClient:document.querySelector('.hhba-match-modal')?.clientWidth,
  modalScroll:document.querySelector('.hhba-match-modal')?.scrollWidth
 }));
 assert.ok(metrics.scroll<=metrics.viewport+3,'mobile horizontal body overflow: '+JSON.stringify(metrics));
 assert.ok(metrics.modalScroll<=metrics.modalClient+3,'mobile dialog horizontal overflow');
 await mobile.screenshot({path:output+'/mobile-editor.png',fullPage:true});
 assert.deepEqual(mobileErrors,[]);
 await mobile.close();

 const long=await browser.newPage({viewport:{width:1365,height:900},locale:'zh-CN'});
 await long.goto(url+'?long=1',{waitUntil:'networkidle',timeout:45000});
 await long.getByRole('button',{name:'针对这个岗位优化简历'}).click();
 await long.getByPlaceholder('请填写本人真实姓名').fill('多页测试姓名');
 const longPdf=await long.pdf({format:'A4',printBackground:true});
 await writeFile(output+'/multipage-resume.pdf',longPdf);
 const longPages=await pdfText(longPdf);
 assert.ok(longPages.length>=2,'long resume must paginate across A4 pages; got '+longPages.length);
 assert.ok(longPages.join(' ').normalize('NFKC').replace(/[\u2ed4]/g,'门').replace(/\s+/g,'').includes('第12段'),
  'multi-page PDF must include final source paragraph; it must not clip content');
 await long.close();
 console.log(JSON.stringify({result:'PASSED',desktop_pdf_pages:pages.length,
  long_pdf_pages:longPages.length,mobile:metrics,qa_output:output}));
}finally{await browser.close()}
