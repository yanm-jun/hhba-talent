import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
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
// Real computed style checks: the rainbow must surround all four edges,
 // not be a decorative purple left rail or an image in a screenshot.
async function assertSiriEdge(page,selector,name){
 const el=page.locator(selector).first();
 await el.waitFor({timeout:10000});
 const values=await el.evaluate(node=>{
  const outer=getComputedStyle(node,'::before');
  const rim=getComputedStyle(node,'::after');
  return {
   animation:rim.animationName,
   background:rim.backgroundImage,
   mask:rim.getPropertyValue('mask-composite')||rim.getPropertyValue('-webkit-mask-composite'),
   glow:outer.filter,
   position:getComputedStyle(node).position,
   borderLeftColor:getComputedStyle(node).borderLeftColor
  };
 });
 assert.match(values.animation,/hhba-siri-edge-flow/,name+' should animate');
 assert.match(values.background,/conic-gradient/,name+' needs all-around rainbow light');
 assert.match(values.glow,/blur/,name+' needs diffuse outer glow');
 assert.match(values.mask,/exclude|xor/,name+' must mask the center and retain four edges');
 return values;
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
 await page.getByRole('region',{name:'正式简历排版与打印'}).waitFor();
 assert.equal(await page.locator('.targeted-resume-live-paper .hhba-print-sheet').count(),1,'one live resume paper, not two separate previews');
 const generate=page.getByRole('button',{name:'生成 AI 建议'});
 assert.equal(await generate.isDisabled(),true,'user consent is mandatory');
 await page.locator('.targeted-resume-consent input[type=checkbox]').check();
 await generate.click();
 const tip=page.locator('.targeted-resume-suggestion');
 await tip.first().waitFor();
 await assertSiriEdge(page,'.targeted-resume-popover-shell','Siri AI suggestion');
 await assertSiriEdge(page,'.targeted-resume-live-paper.hhba-siri-edge-active','Siri resume paper');
 assert.equal(await page.locator('.targeted-resume-inline-region[data-resume-block-id="source-0"] .targeted-resume-suggestion').count(),1,'Siri popover must be inside the actual resume paragraph');
 const siriText=tip.first().locator('.targeted-resume-gradient');
 await siriText.waitFor();
 await page.emulateMedia({reducedMotion:'no-preference'});
 const animated=await siriText.evaluate(el=>({
  name:getComputedStyle(el).animationName,
  image:getComputedStyle(el).backgroundImage,
  text:getComputedStyle(el).getPropertyValue('-webkit-text-fill-color')
 }));
 assert.match(animated.name,/hhba-siri-text-flow/,'AI draft should animate gently');
 assert.match(animated.image,/linear-gradient/,'AI draft should use text gradient');
 assert.equal(animated.text,'rgba(0, 0, 0, 0)','gradient should be clipped to AI text');
 await tip.first().scrollIntoViewIfNeeded();
 await tip.first().screenshot({path:output+'/siri-ai-suggestion.png',animations:'disabled'});
 await page.screenshot({path:output+'/siri-ai-context.png',animations:'disabled'});
 await page.emulateMedia({reducedMotion:'reduce'});
 const still=await siriText.evaluate(el=>getComputedStyle(el).animationName);
 const calmEdge=await page.locator('.targeted-resume-popover-shell')
  .evaluate(el=>getComputedStyle(el,'::after').animationName);
 assert.equal(calmEdge,'none','reduced motion must stop rainbow rim animation');
 assert.equal(still,'none','reduced-motion readers get a static accessible suggestion');
 assert.match(await siriText.textContent(),/同步整理每日服务记录/,'motion setting must not alter draft content');
 await page.emulateMedia({reducedMotion:'no-preference'});
 assert.equal(await page.getByRole('button',{name:'填充到此处'}).isDisabled(),true,
  'AI suggestion must not auto-fill without truthful confirmation');
 await tip.first().getByRole('button',{name:'修改建议'}).click();
 await tip.first().getByRole('textbox',{name:'修改 AI 建议'}).fill('真实参与合成测试项目的记录整理与预约沟通。');
 await tip.first().locator('input[type=checkbox]').check();
 await page.getByRole('button',{name:'填充到此处'}).click();
 const liveText=page.locator('[data-resume-block-id="source-0"] .hhba-print-paragraph');
 assert.match(await liveText.textContent(),/合成测试项目/,'modified AI text must replace the exact source paragraph');
 await page.getByRole('button',{name:'撤销',exact:true}).click();
 assert.match(await liveText.textContent(),/测试门店的运营记录/,'undo must restore original paragraph');
 await page.locator('[data-resume-block-id="source-0"] .targeted-resume-ai-trigger').click();
 await page.getByRole('button',{name:'填充到此处'}).click();
 assert.match(await liveText.textContent(),/合成测试项目/);
 await page.locator('[data-resume-block-id="source-0"] button[aria-label="编辑当前简历段落"]').click();
 const edit=page.getByRole('textbox',{name:'编辑当前简历段落'});
 await edit.fill('真实参与合成测试门店运营记录整理与预约协调。');
 await page.getByRole('button',{name:'保存本次修改'}).click();
 assert.match(await liveText.textContent(),/合成测试门店/);
 await page.getByPlaceholder('请填写本人真实姓名').fill('验收用虚拟姓名');
 await page.getByPlaceholder('例如：区域运营督导').fill('运营助理');
 assert.equal(await page.locator('.targeted-resume-live-paper .hhba-print-sheet').count(),1);
 assert.equal(await page.getByRole('button',{name:'导出 PDF'}).isEnabled(),true);
 assert.equal(await page.getByRole('button',{name:'导出 Word'}).isEnabled(),true);
 const downloadEvent=page.waitForEvent('download');
 await page.getByRole('button',{name:'导出 Word'}).click();
 const download=await downloadEvent;
 assert.match(download.suggestedFilename(),/\.docx$/);
 await download.saveAs(output+'/optimized-resume.docx');
 const docx=await readFile(output+'/optimized-resume.docx');
 assert.equal(docx.readUInt32LE(0),0x04034b50,'Word download must be a ZIP-based DOCX');
 assert.ok(docx.includes(Buffer.from('合成测试门店')),'Word must contain the same edited resume paragraph');
 assert.ok(!docx.includes(Buffer.from('AI 建议')),'Word must not contain AI editing controls');
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
 assert.equal(await mobile.locator('.targeted-resume-live-paper .hhba-print-sheet').count(),1);
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

 const truncated=await browser.newPage({viewport:{width:1365,height:900},locale:'zh-CN'});
 await truncated.goto(url+'?truncated=1',{waitUntil:'networkidle',timeout:45000});
 await truncated.getByRole('button',{name:'针对这个岗位优化简历'}).click();
 await truncated.getByRole('alert').filter({hasText:'这份简历有部分内容未显示'}).waitFor();
 await truncated.getByPlaceholder('请填写本人真实姓名').fill('截断测试姓名');
 assert.equal(await truncated.getByRole('button',{name:'导出 PDF'}).isDisabled(),true,
  'a visibly incomplete source resume must not be exported as a complete PDF');
 assert.equal(await truncated.getByRole('button',{name:'导出 Word'}).isDisabled(),true,
  'a visibly incomplete source resume must not be exported as a complete PDF');
 await truncated.locator('.targeted-resume-save-confirm input[type=checkbox]').check();
 assert.equal(await truncated.getByRole('button',{name:'保存当前版本'}).isDisabled(),true,
  'a truncated source must never be silently persisted as a complete cloud version');
 await truncated.close();

 // Original-file preview must render the actual source PDF via bundled PDF.js,
 // rather than retyping the content into the HHBA standardized resume sheet.
 const source=await browser.newPage({viewport:{width:1100,height:900},locale:'zh-CN'});
 const sourceErrors=[];source.on('pageerror',e=>sourceErrors.push(e.message));
 await source.goto('http://127.0.0.1:3000/qa/original-resume-viewer.html',
  {waitUntil:'networkidle',timeout:45000});
 await source.getByRole('img',{name:'原始 PDF 第 1 页'}).waitFor({timeout:15000});
 await source.getByText('第 1 / 1 页').waitFor({timeout:15000});
 await source.waitForFunction(()=>{
  const c=document.querySelector('.hhba-original-resume-canvas');
  return c instanceof HTMLCanvasElement&&c.width>400&&c.height>500;
 },{timeout:15000});
 const originalMetrics=await source.locator('.hhba-original-resume-canvas')
  .evaluate(c=>({width:c.width,height:c.height}));
 assert.ok(originalMetrics.width>400&&originalMetrics.height>500,
  'original source PDF should render as a full page');
 await source.screenshot({path:output+'/original-pdf-preview.png',fullPage:true});
 const editStart=source.getByRole('button',{name:'开始修改'});
 await editStart.waitFor({timeout:10000});
 assert.equal(await editStart.isDisabled(),true,'must separately consent before visual analysis');
 await source.locator('.hhba-original-resume-start input[type=checkbox]').check();
 await editStart.click();
 const marker=source.getByRole('button',{name:'修改这段简历'});
 await marker.waitFor({timeout:10000});
 await marker.click();
 await assertSiriEdge(source,'.hhba-original-resume-siri-stage.hhba-siri-edge-active','original PDF perimeter');
 await assertSiriEdge(source,'.hhba-original-resume-edit-glow','original PDF edit popup');
 const popupPlacement=await source.locator('.hhba-original-resume-edit-glow').evaluate(el=>{
  const rect=el.getBoundingClientRect();
  const page=el.closest('.hhba-original-resume-page-frame')?.getBoundingClientRect();
  const marker=el.parentElement?.querySelector('.hhba-original-resume-anchor')?.getBoundingClientRect();
  return {
   position:getComputedStyle(el).position,
   top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,
   pageTop:page?.top,pageBottom:page?.bottom,
   markerBottom:marker?.bottom
  };
 });
 assert.equal(popupPlacement.position,'absolute','editing popup must overlay the PDF, not flow below it');
 assert.ok(popupPlacement.top>=popupPlacement.pageTop&&
  popupPlacement.top<popupPlacement.pageBottom,
  'popup must appear within the source page: '+JSON.stringify(popupPlacement));
 assert.ok(popupPlacement.top<popupPlacement.markerBottom+120,
  'popup must appear near the clicked text: '+JSON.stringify(popupPlacement));
 const field=source.getByRole('textbox',{name:'修改这段内容'});
 await field.fill('EDITED RESUME VIEW');
 assert.equal(await source.getByRole('button',{name:'保存',exact:true}).isDisabled(),true);
 await source.locator('.hhba-original-resume-editbox input[type=checkbox]').check();
 await source.screenshot({path:output+'/original-pdf-inline-editor.png',fullPage:true});
 await source.getByRole('button',{name:'保存',exact:true}).click();
 const livePatch=source.locator('.hhba-original-resume-edit-patch');
 await livePatch.waitFor({timeout:10000});
 assert.match(await livePatch.textContent(),/EDITED RESUME VIEW/,
  'saved short text must be visible directly in the ORIGINAL PDF page');
 const verifiedPatch=await livePatch.evaluate(el=>{
  const bounds=el.getBoundingClientRect();
  const canvas=el.parentElement?.querySelector('canvas')?.getBoundingClientRect();
  const overflow=getComputedStyle(el).overflow;
  return {top:bounds.top,left:bounds.left,bottom:bounds.bottom,right:bounds.right,
   pageTop:canvas?.top,pageBottom:canvas?.bottom,overflow};
 });
 assert.ok(verifiedPatch.top>=verifiedPatch.pageTop&&
  verifiedPatch.bottom<=verifiedPatch.pageBottom,
  'safe replacement must be inside original source page: '+JSON.stringify(verifiedPatch));
 await source.screenshot({path:output+'/original-pdf-edited-preview.png',fullPage:true});
 const edited=source.getByRole('button',{name:'继续修改这一段'});
 await edited.waitFor({timeout:10000});
 await edited.click();
 const tooLong='This longer fictional paragraph is intentionally much too long to fit on the original line.';
 await source.getByRole('textbox',{name:'修改这段内容'}).fill(tooLong);
 await source.locator('.hhba-original-resume-editbox input[type=checkbox]').check();
 await source.getByRole('button',{name:'保存',exact:true}).click();
 await livePatch.waitFor({state:'detached',timeout:10000});
 await source.getByText('其余文字暂时放不下',{exact:false}).waitFor({timeout:10000});
 await source.getByRole('button',{name:'继续修改这一段'}).click();
 await source.getByRole('button',{name:'撤销',exact:true}).click();
 await source.getByRole('button',{name:'修改这段简历'}).waitFor({timeout:10000});
 assert.equal(await livePatch.count(),0,'undo must restore underlying original PDF text');
 assert.ok((await source.locator('.hhba-original-resume-anchor').count())>=1,
  'verified editable hotspot remains after undo');
 assert.deepEqual(sourceErrors,[],'original PDF must not cause JS runtime exceptions');
 await source.close();

 const smallSource=await browser.newPage({viewport:{width:390,height:844},locale:'zh-CN'});
 const smallSourceErrors=[];smallSource.on('pageerror',e=>smallSourceErrors.push(e.message));
 await smallSource.goto('http://127.0.0.1:3000/qa/original-resume-viewer.html',
  {waitUntil:'networkidle',timeout:45000});
 await smallSource.getByRole('button',{name:'开始修改'}).waitFor();
 await smallSource.locator('.hhba-original-resume-start input[type=checkbox]').check();
 await smallSource.getByRole('button',{name:'开始修改'}).click();
 await smallSource.getByRole('button',{name:'修改这段简历'}).click();
 await assertSiriEdge(smallSource,'.hhba-original-resume-siri-stage.hhba-siri-edge-active','mobile PDF perimeter');
 await assertSiriEdge(smallSource,'.hhba-original-resume-edit-glow','mobile edit popup');
 const mobilePopup=await smallSource.locator('.hhba-original-resume-edit-glow')
  .evaluate(el=>{const rect=el.getBoundingClientRect();
   const page=el.closest('.hhba-original-resume-page-frame')?.getBoundingClientRect();
   return {position:getComputedStyle(el).position,top:rect.top,
    pageBottom:page?.bottom,left:rect.left,right:rect.right,viewport:document.documentElement.clientWidth};
  });
 assert.equal(mobilePopup.position,'absolute','mobile popup must be anchored to PDF text');
 assert.ok(mobilePopup.top<mobilePopup.pageBottom&&mobilePopup.left>=0&&
  mobilePopup.right<=mobilePopup.viewport+2,
  'mobile popup must be visible next to actual resume text: '+JSON.stringify(mobilePopup));
 await smallSource.emulateMedia({reducedMotion:'reduce'});
 const mobileStill=await smallSource.locator('.hhba-original-resume-edit-glow')
  .evaluate(el=>getComputedStyle(el,'::after').animationName);
 assert.equal(mobileStill,'none','mobile reduced-motion users must get static rainbow edges');
 await smallSource.emulateMedia({reducedMotion:'no-preference'});
 await smallSource.getByRole('textbox',{name:'修改这段内容'}).waitFor();
 await smallSource.getByRole('textbox',{name:'修改这段内容'}).fill('EDITED RESUME VIEW');
 await smallSource.locator('.hhba-original-resume-editbox input[type=checkbox]').check();
 await smallSource.getByRole('button',{name:'保存',exact:true}).click();
 await smallSource.locator('.hhba-original-resume-edit-patch').waitFor({timeout:10000});
 const mobilePatchBounds=await smallSource.locator('.hhba-original-resume-edit-patch').evaluate(el=>{
  const a=el.getBoundingClientRect();return {left:a.left,right:a.right,viewport:document.documentElement.clientWidth};
 });
 assert.ok(mobilePatchBounds.left>=0&&mobilePatchBounds.right<=mobilePatchBounds.viewport+2,
  'saved text must remain visible on mobile original PDF: '+JSON.stringify(mobilePatchBounds));
 await smallSource.screenshot({path:output+'/original-pdf-mobile-edited-preview.png',fullPage:true});
 // Saving closes the editor; reopen it before testing the editor's bounds.
 await smallSource.getByRole('button',{name:'继续修改这一段'}).click();
 const sourceMobileWidths=await smallSource.evaluate(()=>({
  client:document.documentElement.clientWidth,
  scroll:document.documentElement.scrollWidth,
  editor:document.querySelector('.hhba-original-resume-editbox')?.getBoundingClientRect().right
 }));
 assert.ok(sourceMobileWidths.scroll<=sourceMobileWidths.client+3,
  'original PDF editor must not overflow mobile viewport: '+JSON.stringify(sourceMobileWidths));
 assert.ok(sourceMobileWidths.editor<=sourceMobileWidths.client+2,
  'in-place editing popup must fit mobile width');
 await smallSource.screenshot({path:output+'/original-pdf-mobile-editor.png',fullPage:true});
 assert.deepEqual(smallSourceErrors,[],'no mobile original-PDF runtime errors');
 await smallSource.close();

 console.log(JSON.stringify({result:'PASSED',desktop_pdf_pages:pages.length,
  long_pdf_pages:longPages.length,mobile:metrics,qa_output:output}));
}finally{await browser.close()}
