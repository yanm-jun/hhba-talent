import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {patchPdfWithOriginalCjkFont} from '../src/services/resumePdfCjkFont.mjs';

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
 await page.getByRole('button',{name:/优化简历，提高分值/}).click();
 await page.getByRole('region',{name:'正式简历排版与打印'}).waitFor();
 assert.equal(await page.locator('.targeted-resume-live-paper .hhba-print-sheet').count(),1,'one live resume paper, not two separate previews');
 const generate=page.getByRole('button',{name:'开始 AI 优化'});
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
 const pendingAiTextarea=tip.first().getByRole('textbox',{name:'修改 AI 建议'});
 assert.match(await pendingAiTextarea.evaluate(el=>getComputedStyle(el).backgroundImage),
  /linear-gradient/,'AI suggestion is rainbow in the editable field itself');
 await tip.first().locator('input[type=checkbox]').check();
 await page.getByRole('button',{name:'填充到此处'}).click();
 const liveText=page.locator('[data-resume-block-id="source-0"] .hhba-print-paragraph');
 assert.match(await liveText.textContent(),/合成测试项目/,'modified AI text must replace the exact source paragraph');
 assert.equal(await liveText.locator('.hhba-resume-siri-letters').count(),0,
  'accepted AI changes must immediately inherit the resume native typography');
 await page.screenshot({path:output+'/siri-confirmed-normal-typography.png',fullPage:true});
 await page.getByRole('button',{name:'撤销',exact:true}).click();
 assert.match(await liveText.textContent(),/测试门店的运营记录/,'undo must restore original paragraph');
 assert.equal(await liveText.locator('.hhba-resume-siri-letters').count(),0,'undo keeps original text normal');
 await page.locator('[data-resume-block-id="source-0"] .targeted-resume-ai-trigger').click();
 await page.getByRole('button',{name:'填充到此处'}).click();
 assert.match(await liveText.textContent(),/合成测试项目/);
 await page.locator('[data-resume-block-id="source-0"] button[aria-label="编辑当前简历段落"]').click();
 const edit=page.getByRole('textbox',{name:'编辑当前简历段落'});
 await edit.fill('真实参与合成测试门店运营记录整理与预约协调。');
 assert.match(await edit.evaluate(el=>getComputedStyle(el).animationName),
  /hhba-resume-siri-letters-flow/);
 assert.match(await edit.evaluate(el=>getComputedStyle(el).backgroundImage),
  /linear-gradient/);
 await page.screenshot({path:output+'/siri-pending-manual-edit.png',fullPage:true});
 await page.getByRole('button',{name:'保存本次修改'}).click();
 assert.match(await liveText.textContent(),/合成测试门店/);
 assert.equal(await liveText.locator('.hhba-resume-siri-letters').count(),0,
  'confirmed manual changes must inherit normal paragraph styling');
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
 await mobile.getByRole('button',{name:/优化简历，提高分值/}).click();
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
 await long.getByRole('button',{name:/优化简历，提高分值/}).click();
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
 await truncated.getByRole('button',{name:/优化简历，提高分值/}).click();
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
 await field.fill('修改后的简历');
 assert.equal(await source.getByRole('button',{name:'保存',exact:true}).isDisabled(),true);
 await source.locator('.hhba-original-resume-editbox input[type=checkbox]').check();
 assert.match(await field.evaluate(el=>getComputedStyle(el).animationName),
  /hhba-resume-siri-letters-flow/);
 const originalPdfDraft=source.locator('.hhba-original-resume-draft-patch');
 await originalPdfDraft.waitFor();
 const draftPdfSiri=originalPdfDraft.locator('.hhba-resume-siri-letters');
 assert.match(await draftPdfSiri.evaluate(el=>getComputedStyle(el).animationName),
  /hhba-resume-siri-letters-flow/);
 await source.screenshot({path:output+'/original-pdf-pending-siri-typography.png',fullPage:true});
 await source.getByRole('button',{name:'保存',exact:true}).click();
 await source.getByRole('button',{name:'继续修改这一段'}).waitFor();
 assert.equal(await originalPdfDraft.count(),0,
  'confirmed PDF changes must immediately remove provisional colored text');
 assert.equal(await source.locator('.hhba-resume-siri-letters').count(),0);
 assert.equal(await source.getByRole('button',{name:'下载 PDF'}).count(),0,
  'do not download an original-style PDF with guessed replacement fonts');
 await source.getByText('暂不能保持原样式生成修改版 PDF',{exact:false}).first().waitFor();
 await source.screenshot({path:output+'/original-pdf-confirmed-source-style.png',fullPage:true});
 const edited=source.getByRole('button',{name:'继续修改这一段'});
 await edited.waitFor({timeout:10000});
 await edited.click();
 const tooLong='This longer fictional paragraph is intentionally much too long to fit on the original line.';
 await source.getByRole('textbox',{name:'修改这段内容'}).fill(tooLong);
 await source.locator('.hhba-original-resume-editbox input[type=checkbox]').check();
 await source.getByRole('button',{name:'保存',exact:true}).click();
 assert.equal(await originalPdfDraft.count(),0,
  'long confirmed PDF change must not overlay in a fallback font');
 await source.getByRole('button',{name:'继续修改这一段'}).click();
 await source.getByRole('button',{name:'撤销',exact:true}).click();
 await source.getByRole('button',{name:'修改这段简历'}).waitFor({timeout:10000});
 assert.equal(await originalPdfDraft.count(),0,'undo restores the unchanged native PDF page');
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
 const mobileRainbow=smallSource.getByRole('textbox',{name:'修改这段内容'});
 assert.match(await mobileRainbow.evaluate(el=>getComputedStyle(el).backgroundImage),
  /linear-gradient/);
 await smallSource.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await mobileRainbow.evaluate(el=>getComputedStyle(el).animationName),'none');
 await smallSource.emulateMedia({reducedMotion:'no-preference'});
 await smallSource.screenshot({path:output+'/original-pdf-mobile-pending-siri.png',
  fullPage:true});
 await smallSource.getByRole('button',{name:'保存',exact:true}).click();
 await smallSource.getByRole('button',{name:'继续修改这一段'}).waitFor();
 assert.equal(await smallSource.locator('.hhba-original-resume-draft-patch').count(),0);
 assert.equal(await smallSource.locator('.hhba-resume-siri-letters').count(),0);
 await smallSource.screenshot({path:output+'/original-pdf-mobile-confirmed-normal.png',
  fullPage:true});
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

 // Actual Chromium PDF.js re-parsing plus pixel-diff proof of same PDF font.
 // This is deliberately a tiny original-font subset, not general PDF editing.
 const native=await browser.newPage({viewport:{width:1100,height:900},locale:'zh-CN'});
 const nativeErrors=[];native.on('pageerror',e=>nativeErrors.push(e.message));
 await native.goto('http://127.0.0.1:3000/qa/native-pdf-font.html',
  {waitUntil:'networkidle',timeout:45000});
 await native.waitForFunction(()=>{
  const status=document.querySelector('#native-pdf-test')?.getAttribute('data-status');
  return status==='passed'||status==='failed';
 },{timeout:15000});
 const nativeProof=await native.locator('#native-pdf-test').evaluate(node=>({
  status:node.dataset.status,font:node.dataset.font,
  changedPixels:Number(node.dataset.changedPixels),text:node.textContent
 }));
 assert.equal(nativeProof.status,'passed','native-font PDF patch must pass renderer proof: '+
  JSON.stringify(nativeProof));
 assert.equal(nativeProof.font,'Helvetica');
 assert.ok(nativeProof.changedPixels>8);
 assert.deepEqual(nativeErrors,[],'native-font PDF should render in Chromium');
 await native.screenshot({path:output+'/native-pdf-original-font-compared.png',fullPage:true});
 await native.close();
 // The original PDF uses a real EMBEDDED Chinese TrueType subset, an
 // explicit CID ToUnicode mapping and original vector glyph resources.
 // There is no fallback-font/white-box reconstruction in this test.
 for(const viewport of [{width:1100,height:900,name:'desktop'},
                       {width:390,height:844,name:'mobile'}]){
  const cjk=await browser.newPage({viewport:{width:viewport.width,
   height:viewport.height},locale:'zh-CN'});
  const errors=[];cjk.on('pageerror',e=>errors.push(e.message));
  await cjk.goto('http://127.0.0.1:3000/qa/native-cjk-font.html',
   {waitUntil:'networkidle',timeout:45000});
  await cjk.waitForFunction(()=>{
   const status=document.querySelector('#native-cjk-test')?.getAttribute('data-status');
   return status==='passed'||status==='failed';
  },{timeout:30000});
  const details=await cjk.locator('#native-cjk-test').evaluate(node=>({
   status:node.dataset.status,font:node.dataset.font,
   pixels:Number(node.dataset.changedPixels),
   text:node.textContent
  }));
  assert.equal(details.status,'passed',
   'embedded Chinese font must pass actual PDF renderer and pixel proof '+JSON.stringify(details));
  assert.equal(details.font,'HHBAChineseFontQA');
  assert.ok(details.pixels>8);
  assert.deepEqual(errors,[]);
  await cjk.screenshot({path:output+'/native-cjk-font-'+viewport.name+'-compared.png',
   fullPage:true});
  await cjk.close();
 }
 // Real UI integration: original source PDF Type1 font bytes are retained
 // throughout confirmation; native font proof is required before downloading.
 const authentic=await browser.newPage({viewport:{width:1100,height:900},
  locale:'zh-CN',acceptDownloads:true});
 const authenticErrors=[];authentic.on('pageerror',e=>authenticErrors.push(e.message));
 await authentic.goto('http://127.0.0.1:3000/qa/original-resume-viewer.html',
  {waitUntil:'networkidle',timeout:45000});
 const startNative=authentic.getByRole('button',{name:'开始修改'});
 await startNative.waitFor();
 await authentic.locator('.hhba-original-resume-start input[type=checkbox]').check();
 await startNative.click();
 await authentic.getByRole('button',{name:'修改这段简历'}).click();
 const pendingOriginal=authentic.getByRole('textbox',{name:'修改这段内容'});
 await pendingOriginal.fill('ORIGINAL RESUME TEST');
 assert.match(await pendingOriginal.evaluate(el=>getComputedStyle(el).animationName),
  /hhba-resume-siri-letters-flow/);
 await authentic.locator('.hhba-original-resume-editbox input[type=checkbox]').check();
 await authentic.getByRole('button',{name:'保存',exact:true}).click();
 const nativeDownload=authentic.getByRole('button',{name:'下载 PDF'});
 await nativeDownload.waitFor({timeout:20000});
 assert.equal(await authentic.locator('.hhba-resume-siri-letters').count(),0,
  'confirmed native PDF text must remove all Siri editing effects');
 assert.equal(await authentic.locator('.hhba-original-resume-siri-stage.hhba-siri-edge-active').count(),0,
  'confirmed native PDF no longer has Siri perimeter glow');
 await authentic.screenshot({path:output+'/original-pdf-native-font-confirmed.png',
  fullPage:true});
 const nativeDownloadEvent=authentic.waitForEvent('download');
 await nativeDownload.click();
 const nativeFile=await nativeDownloadEvent;
 await nativeFile.saveAs(output+'/original-pdf-native-font-edited.pdf');
 const nativeData=await readFile(output+'/original-pdf-native-font-edited.pdf');
 const nativePages=await pdfText(nativeData);
 assert.equal(nativePages.length,1);
 assert.ok(nativePages.join(' ').includes('ORIGINAL RESUME TEST'));
 assert.ok(!nativePages.join(' ').includes('ORIGINAL RESUME VIEW'));
 assert.ok(nativeData.toString('latin1').includes('/BaseFont /Helvetica'),
  'source Type1 Helvetica resource must survive unmodified');
 assert.deepEqual(authenticErrors,[]);
 await authentic.close();

 // Complete candidate UI path using a real embedded Chinese-font source:
 // open original, edit in Siri rainbow, confirm, display native font, download.
 // Run on desktop and mobile with only synthetic credentials and fixture data.
 for(const view of [{width:1100,height:900,name:'desktop'},
                    {width:390,height:844,name:'mobile'}]){
  const cjkUI=await browser.newPage({viewport:{width:view.width,height:view.height},
   locale:'zh-CN',acceptDownloads:true});
  const issues=[];cjkUI.on('pageerror',e=>issues.push(e.message));
  await cjkUI.goto('http://127.0.0.1:3000/qa/original-cjk-resume-viewer.html',
   {waitUntil:'networkidle',timeout:45000});
  const begin=cjkUI.getByRole('button',{name:'开始修改'});
  await begin.waitFor({timeout:15000});
  await cjkUI.locator('.hhba-original-resume-start input[type=checkbox]').check();
  await begin.click();
  await cjkUI.getByRole('button',{name:'修改这段简历'}).waitFor({timeout:18000});
  await cjkUI.getByRole('button',{name:'修改这段简历'}).click();
  const input=cjkUI.getByRole('textbox',{name:'修改这段内容'});
  await input.fill('工作经历中国测试');
  assert.match(await input.evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/);
  await cjkUI.screenshot({path:output+'/original-cjk-'+view.name+'-pending-siri.png',
   fullPage:true});
  await cjkUI.locator('.hhba-original-resume-editbox input[type=checkbox]').check();
  await cjkUI.getByRole('button',{name:'保存',exact:true}).click();
  const download=cjkUI.getByRole('button',{name:'下载 PDF'});
  await download.waitFor({timeout:20000});
  assert.equal(await cjkUI.locator('.hhba-original-resume-siri-stage.hhba-siri-edge-active').count(),0,
   'saved Chinese edits should immediately remove Siri page glow');
  assert.equal(await cjkUI.locator('.hhba-siri-typing').count(),0,
   'real Chinese glyphs, not rainbow draft fonts, must render after confirmation');
  await cjkUI.screenshot({path:output+'/original-cjk-'+view.name+'-native-font-confirmed.png',
   fullPage:true});
  const event=cjkUI.waitForEvent('download');
  await download.click();
  const downloaded=await event;
  const file=output+'/original-cjk-'+view.name+'-native-font-edited.pdf';
  await downloaded.saveAs(file);
  const edited=await readFile(file);
  const source=await readFile('qa/generated-cjk-original.pdf');
  const native=patchPdfWithOriginalCjkFont(new Uint8Array(source),
   '中国测试工作经历','工作经历中国测试');
  assert.deepEqual(new Uint8Array(edited),native.bytes,
   'all original font bytes, CMap, style, positions, and xref must remain unchanged');
  const texts=await pdfText(edited);
  assert.equal(texts.length,1);
  assert.ok(texts.join(' ').includes('工作经历中国测试'));
  assert.ok(!texts.join(' ').includes('中国测试工作经历'));
  assert.deepEqual(issues,[],'Chinese native PDF browser should not crash');
  await cjkUI.close();
 }
 // True original Word page preview (no HHBA re-template), in-place edit and
 // verified Word download. Fixture uses only synthetic data and fake endpoints.
 for(const view of [{width:1100,height:900,name:'desktop'},
                    {width:390,height:844,name:'mobile'}]){
  const word=await browser.newPage({viewport:{width:view.width,height:view.height},
   acceptDownloads:true,locale:'zh-CN'});
  const issues=[];word.on('pageerror',err=>issues.push(err.message));
  await word.goto('http://127.0.0.1:3000/qa/original-word-viewer.html',
   {waitUntil:'networkidle',timeout:45000});
  await word.getByRole('img',{name:'Word 原始页面第 1 页'}).waitFor({timeout:18000});
  const editWord=word.getByRole('button',{name:'修改这段 Word'});
  await editWord.waitFor({timeout:15000});
  await editWord.click();
  assert.equal(await word.locator('.hhba-original-resume-edit-glow').count(),0,
   'Word edit controls must not float over the original paper');
  await word.locator('.hhba-word-standalone-edit-panel .hhba-original-resume-editbox')
   .waitFor();
  const input=word.getByRole('textbox',{name:'修改 Word 文字'});
  assert.equal(await input.inputValue(),'EDITED WORD RESUME',
   'a confirmed exact AI suggestion should prefill only the clicked native Word anchor');
  assert.equal(await word.getByRole('button',{name:'确认保存',exact:true}).isDisabled(),true,
   'pre-filled AI text must never be saved before the user confirms');
  await input.fill('EDITED WORD RESUME');
  assert.equal(await word.getByRole('button',{name:'确认保存',exact:true}).isDisabled(),
   true,'Word change must require confirmation');
  const wordDraftGlow=word.getByRole('textbox',{name:'修改 Word 文字'});
  assert.equal(await word.locator('.hhba-resume-pending-text').count(),0,
   'the editable Siri text should not be repeated in a second preview card');
  assert.match(await wordDraftGlow.evaluate(el=>getComputedStyle(el).backgroundImage),
   /linear-gradient/);
  await word.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await wordDraftGlow.evaluate(el=>getComputedStyle(el).animationName),'none');
  await word.emulateMedia({reducedMotion:'no-preference'});
  await word.locator('.hhba-original-resume-editbox input[type=checkbox]').check();
  await word.screenshot({path:output+'/original-word-'+view.name+'-editing.png',
   fullPage:true});
  await word.getByRole('button',{name:'确认保存',exact:true}).click();
  await word.locator('.hhba-original-resume-export-menu summary').click();
  await word.locator('.hhba-original-resume-export-menu').getByRole('button',{name:'下载 Word'}).waitFor({timeout:20000});
  await word.locator('.hhba-original-resume-export-menu').getByRole('button',{name:'下载 PDF'}).waitFor({timeout:20000});
  assert.equal(await word.locator('.hhba-original-resume-siri-ink').count(),0,
   'confirmed Word must reveal real native-font pixels, not animated color');
  assert.equal(await word.locator('.hhba-resume-siri-letters').count(),0,
   'Siri is removed immediately on Word confirmation');
  await word.screenshot({path:output+'/original-word-'+view.name+'-native-font-saved.png',
   fullPage:true});
  const downloadEvent=word.waitForEvent('download');
  await word.locator('.hhba-original-resume-export-menu').getByRole('button',{name:'下载 Word'}).click();
  const downloaded=await downloadEvent;
  assert.match(downloaded.suggestedFilename(),/\.docx$/);
  const pdfEvent=word.waitForEvent('download');
  await word.locator('.hhba-original-resume-export-menu').getByRole('button',{name:'下载 PDF'}).click();
  const exportedPdf=await pdfEvent;
  assert.match(exportedPdf.suggestedFilename(),/\.pdf$/);
  const savedPdf=output+'/original-word-'+view.name+'-converted.pdf';
  await exportedPdf.saveAs(savedPdf);
  const convertedPages=await pdfText(await readFile(savedPdf));
  assert.equal(convertedPages.length,1);
  assert.ok(convertedPages[0].includes('EDITED WORD RESUME'),
   'PDF must render the verified saved Word content, not the original');
  await word.screenshot({path:output+'/original-word-'+view.name+'-saved.png',
   fullPage:true});
  // Another native Word revision must remain editable without re-uploading.
  await word.getByRole('button',{name:'修改这段 Word'}).first().click();
  const nextInput=word.getByRole('textbox',{name:'修改 Word 文字'});
  assert.equal(await nextInput.inputValue(),'EDITED WORD RESUME');
  await nextInput.fill('FINAL WORD RESUME');
  await word.locator('.hhba-original-resume-editbox input[type=checkbox]').check();
  await word.getByRole('button',{name:'确认保存',exact:true}).click();
  await word.getByText('当前修改进度：2 / 2',{exact:false}).waitFor();
  assert.equal(await word.getByRole('button',{name:'重做'}).isDisabled(),true);
  await word.getByRole('button',{name:'撤销'}).click();
  await word.getByText('当前修改进度：1 / 2',{exact:false}).waitFor();
  // Revision status updates immediately; the PDF.js source page must finish
  // reopening before its editing/undo toolbar is enabled again.
  await word.waitForFunction(()=>[...document.querySelectorAll('button')]
   .some(button=>button.textContent?.includes('重做')&&!button.disabled));
  assert.equal(await word.getByRole('button',{name:'重做'}).isEnabled(),true);
  await word.getByRole('button',{name:'重做'}).click();
  await word.getByText('当前修改进度：2 / 2',{exact:false}).waitFor();
  const finalPdfEvent=word.waitForEvent('download');
  await word.locator('.hhba-original-resume-export-menu').getByRole('button',{name:'下载 PDF'}).click();
  const finalPdf=await finalPdfEvent;
  const finalFile=output+'/original-word-'+view.name+'-after-redo.pdf';
  await finalPdf.saveAs(finalFile);
  assert.ok((await pdfText(await readFile(finalFile)))[0].includes('FINAL WORD RESUME'),
   'redo must deliver the latest Word-derived PDF, not the previous revision');
  const geom=await word.evaluate(()=>({
   client:document.documentElement.clientWidth,
   scroll:document.documentElement.scrollWidth
  }));
  assert.ok(geom.scroll<=geom.client+3,
   'Word page must not horizontally overflow viewport '+JSON.stringify(geom));
  assert.deepEqual(issues,[],'original Word editor must not crash on '+view.name);
  await word.close();
 }




 // Word-first product QA: job optimization is a separate workspace with one
 // authentic DOCX canvas. AI suggestions are a side rail / mobile drawer.
 for(const view of [{width:1200,height:900,name:'desktop'},
                    {width:390,height:844,name:'mobile'}]){
  const first=await browser.newPage({viewport:{width:view.width,height:view.height},
   locale:'zh-CN'});
  const errors=[];first.on('pageerror',e=>errors.push(e.message));
  await first.goto('http://127.0.0.1:3000/qa/resume-flow.html?word',
   {waitUntil:'networkidle',timeout:45000});
  await first.getByRole('button',{name:/优化简历，提高分值/}).click();
  await first.getByRole('region',{name:'独立简历优化工作区'}).waitFor();
  assert.equal(await first.locator('.targeted-resume-word-workspace').count(),1,
   'saved DOCX should open one Word-first editor');
  assert.equal(await first.locator('.targeted-resume-live-paper').count(),0,
   'do not show re-templated editor beside true native DOCX');
  assert.equal(await first.locator('.targeted-resume-document-fields').count(),0,
   'native Word editor must not ask user to retype their identity fields');
  await first.locator('.hhba-word-native-preview .hhba-original-resume-anchor').first()
   .waitFor({timeout:20000});
  await first.getByRole('button',{name:'放大 Word'}).click();
  assert.match(await first.locator('.hhba-original-resume-word-tools output').textContent(),/125%/);
  await first.getByRole('button',{name:'适合宽度'}).click();
  // The immersive entrance uses a *real* four-sided Siri edge on the original
  // Word canvas; once the entrance ends, the edge pauses until AI work begins.
  await first.locator('.hhba-word-stage-ready').waitFor({timeout:5000});
  assert.equal(await first.locator('.hhba-original-resume-siri-stage.hhba-siri-edge-active').count(),0,
   'Word idle mode should release the Siri perimeter after entrance');
  const assistant=first.locator('.targeted-resume-word-assistant');
  assert.equal(await assistant.locator('.targeted-resume-ai-settings')
   .evaluate(el=>el.open),false,'the optional privacy and draft controls must start folded');
  await first.screenshot({path:output+'/word-first-'+view.name+'-read-mode.png',fullPage:true});
  if(view.name==='mobile'){
   const wordPosition=await first.locator('.targeted-resume-word-main').boundingBox();
   assert.ok(wordPosition&&wordPosition.y<330,
    'mobile must show the Word document near the top, not below AI permissions and settings');
   assert.equal(await assistant.isVisible(),false,'suggestions must not cover mobile Word');
   await first.getByRole('button',{name:'AI 建议',exact:true}).click();
   await assistant.waitFor({state:'visible'});
  }
  await assistant.locator('.targeted-resume-ai-settings summary').click();
  await first.locator('.targeted-resume-draft-recovery input[type=checkbox]').check();
  await first.locator('.targeted-resume-consent input[type=checkbox]').check();
  await first.getByRole('button',{name:'开始 AI 优化'}).click();
  await assistant.locator('.targeted-resume-word-suggestion-title').first().waitFor();
  assert.equal(await first.locator('.hhba-original-resume-siri-stage.hhba-siri-edge-active').count(),1,
   'real AI suggestions must illuminate the Word perimeter');
  await first.locator('.hhba-word-native-preview .hhba-word-ai-preview-text').first().waitFor();
  assert.match(await first.locator('.hhba-word-native-preview .hhba-word-ai-preview-text').first()
   .evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/,
   'the suggestion must appear on the original Word line with Siri colors');
  assert.equal(await assistant.locator('.targeted-resume-word-suggestion').count(),1,
   'AI draft has one navigable original paragraph location');
  await assistant.locator('.targeted-resume-confirm input[type=checkbox]').check();
  await assistant.getByRole('button',{name:'填充到此处'}).click();
  await first.getByText('1 条建议已准备就绪',{exact:false}).waitFor();
  await first.waitForFunction(()=>Object.keys(sessionStorage)
   .some(k=>k.startsWith('hhba:word-draft-v1:')));
  if(view.name==='mobile'){
   await first.getByRole('button',{name:'返回 Word'}).click();
   assert.equal(await assistant.isVisible(),false);
  }
  await first.locator('.hhba-original-resume-anchor').first().click();
  const nativePane=first.locator('.targeted-resume-word-edit-host .hhba-original-resume-editbox');
  await nativePane.waitFor();
  if(view.name==='desktop'){
   const sheet=await first.locator('.hhba-word-native-preview').boundingBox();
   const edit=await nativePane.boundingBox();
   assert.ok(sheet&&edit&&edit.x>=sheet.x+sheet.width-6,
    'desktop edit pane must be to the RIGHT of Word, not on top of the document');
  }else{
   const edit=await nativePane.boundingBox();
   assert.ok(edit&&edit.y>=view.height*.35,
    'phone editor must open as a bottom sheet instead of a popup on Word');
  }
  assert.equal(await first.locator('.hhba-original-resume-edit-glow').count(),0,
   'the Word paper must not be obscured by an edit popup');
  const nativeText=first.getByRole('textbox',{name:'修改 Word 文字'});
  assert.match(await nativeText.inputValue(),/同步整理每日服务记录/,
   'confirmed text can be prefilled only at the exact Word anchor');
  assert.equal(await first.getByRole('button',{name:'确认保存',exact:true}).isDisabled(),true,
   'native source must still require explicit confirmation');
  await first.screenshot({path:output+'/word-first-'+view.name+'-workspace.png',fullPage:true});
  // An unsaved native Word edit must survive an explicitly opted-in reload,
  // but it must NEVER come back as already fact-checked or auto-saved.
  await nativeText.fill('PENDING USER WORD DRAFT');
  await first.waitForFunction(()=>Object.keys(sessionStorage).some(key=>{
   if(!key.startsWith('hhba:word-draft-v1:'))return false;
   try{
    const saved=JSON.parse(sessionStorage.getItem(key)||'{}');
    return saved.schema==='HHBA_WORD_DRAFT_V2'&&
     saved.native_word_draft?.text==='PENDING USER WORD DRAFT'&&
     saved.native_word_draft?.revision===0;
   }catch{return false;}
  }));
  const firstExpiry=await first.evaluate(()=>{
   const key=Object.keys(sessionStorage).find(k=>k.startsWith('hhba:word-draft-v1:'));
   if(!key)throw Error('missing session draft key');
   return JSON.parse(sessionStorage.getItem(key)||'{}').expires_at;
  });
  await nativeText.fill('PENDING USER WORD DRAFT UPDATED');
  await first.waitForFunction(()=>Object.keys(sessionStorage).some(key=>{
   if(!key.startsWith('hhba:word-draft-v1:'))return false;
   try{return JSON.parse(sessionStorage.getItem(key)||'{}').native_word_draft?.text===
    'PENDING USER WORD DRAFT UPDATED'}catch{return false}
  }));
  const expiryAfterEdit=await first.evaluate(()=>{
   const key=Object.keys(sessionStorage).find(k=>k.startsWith('hhba:word-draft-v1:'));
   if(!key)throw Error('missing session draft key');
   return JSON.parse(sessionStorage.getItem(key)||'{}').expires_at;
  });
  assert.equal(expiryAfterEdit,firstExpiry,
   'editing repeatedly must not silently extend the six-hour private draft consent');
  first.on('dialog',dialog=>{void dialog.accept()});
  await first.reload({waitUntil:'networkidle',timeout:45000});
  await first.getByRole('button',{name:/优化简历，提高分值/}).click();
  await first.getByRole('region',{name:'独立简历优化工作区'}).waitFor();
  const recoveredAssistant=first.locator('.targeted-resume-word-assistant');
  if(view.name==='mobile'){
   await first.getByRole('button',{name:'AI 建议',exact:true}).click();
   await recoveredAssistant.waitFor({state:'visible'});
  }
  await recoveredAssistant.locator('.targeted-resume-ai-settings summary').click();
  await recoveredAssistant.getByRole('button',{name:'恢复草稿'}).waitFor();
  await recoveredAssistant.getByRole('button',{name:'恢复草稿'}).click();
  if(view.name==='mobile')await first.getByRole('button',{name:'返回 Word'}).click();
  await first.locator('.hhba-original-resume-anchor').first().waitFor();
  await first.locator('.hhba-original-resume-anchor').first().click();
  const pendingText=first.getByRole('textbox',{name:'修改 Word 文字'});
  assert.equal(await pendingText.inputValue(),'PENDING USER WORD DRAFT UPDATED',
   'opted-in native Word text must be restored only to the same source anchor and revision');
  assert.equal(await first.getByRole('button',{name:'确认保存',exact:true}).isDisabled(),true,
   'restored Word text must still require a fresh factual confirmation');
  await first.screenshot({path:output+'/word-first-'+view.name+'-recovered-draft.png',fullPage:true});
  const geom=await first.evaluate(()=>({
   client:document.documentElement.clientWidth,
   scroll:document.documentElement.scrollWidth
  }));
  assert.ok(geom.scroll<=geom.client+3,
   'Word-first workspace overflows viewport '+view.name+' '+JSON.stringify(geom));
  assert.deepEqual(errors,[],'Word-first workspace should not crash on '+view.name);
  await first.close();
 }


 // A genuine score comparison may be displayed ONLY after saving an original
 // DOCX and feeding its versioned text through the same audited-JD scorer.
 // These 68/70 numbers are explicitly synthetic and never shipped.
 {
  const scorePage=await browser.newPage({viewport:{width:1200,height:900},
   locale:'zh-CN'});
  const errors=[];scorePage.on('pageerror',error=>errors.push(error.message));
  await scorePage.goto('http://127.0.0.1:3000/qa/resume-flow.html?word&score',
   {waitUntil:'networkidle',timeout:45000});
  const entranceCTA=scorePage.getByRole('button',{name:/优化简历，提高分值/}).first();
  await entranceCTA.waitFor();
  assert.match(await scorePage.locator('.hhba-native-score').first().textContent(),/68/);
  await entranceCTA.click();
  await scorePage.getByRole('region',{name:'原版式 Word 沉浸式 AI 优化舞台'}).waitFor();
  await scorePage.locator('.hhba-original-resume-anchor').first().waitFor();
  await scorePage.getByRole('button',{name:'修改这段 Word'}).first().click();
  const nativeEditor=scorePage.getByRole('textbox',{name:'修改 Word 文字'});
  await nativeEditor.fill('VERIFIED WORD RESUME');
  await scorePage.locator('.hhba-original-resume-edit-confirm input[type=checkbox]').check();
  await scorePage.getByRole('button',{name:'确认保存'}).click();
  await scorePage.getByText('已检查版式并保存第 1 次修改',{exact:false}).waitFor();
  await scorePage.getByText('已保存第 1 版 Word，可以按原岗位规则复评。').waitFor();
  assert.equal(await scorePage.locator('.hhba-original-resume-siri-stage.hhba-siri-edge-active').count(),0,
   'confirmed native Word must return to the original font without pending Siri edge');
  await scorePage.locator('.hhba-word-match-confirm input[type=checkbox]').check();
  await scorePage.getByRole('button',{name:'重新计算匹配分'}).click();
  await scorePage.getByText('已保存 Word · 优化后').waitFor();
  assert.match(await scorePage.locator('.hhba-word-match-after').textContent(),/70/);
  assert.match(await scorePage.locator('.hhba-word-match-score').textContent(),/68/);
  assert.deepEqual(errors,[]);
  await scorePage.screenshot({path:output+'/word-first-score-before-after.png',fullPage:true});
  await scorePage.close();
 }

 console.log(JSON.stringify({result:'PASSED',desktop_pdf_pages:pages.length,
  long_pdf_pages:longPages.length,mobile:metrics,qa_output:output}));
}finally{await browser.close()}
