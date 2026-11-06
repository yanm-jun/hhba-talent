"""HHBA 合成国内网申 DOM 真实浏览器回归。不是招聘官网兼容性证明。"""
from __future__ import annotations
import functools
import http.server
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
EXT = HERE.parent
def main():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(HERE))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_default_timeout(10000)
            page.goto(f"http://127.0.0.1:{server.server_port}/form-domestic.html")
            page.evaluate("""() => {
              window.__hhbaHandler = null;
              window.chrome = {runtime:{onMessage:{addListener(fn){window.__hhbaHandler=fn;}}}};
            }""")
            page.add_script_tag(content=(EXT / "content.js").read_text("utf-8"))
            def send(kind, **payload):
                return page.evaluate("""({kind,payload}) => new Promise((resolve,reject) => {
                  const timeout=setTimeout(()=>reject(Error("HHBA agent response timed out: "+kind)),8000);
                  if (!window.__hhbaHandler) {clearTimeout(timeout);return reject(Error("Agent missing"));}
                  window.__hhbaHandler({type:kind,...payload}, {}, answer=>{clearTimeout(timeout);resolve(answer);});
                })""", {"kind": kind, "payload": payload})
            print("BROWSER_STEP_SCAN",flush=True)
            scan=send("HHBA_SCAN")
            assert scan["ok"] and len(scan["fields"]) >= 7, scan
            field={f["label"].strip():f for f in scan["fields"]}
            for name in ["姓名","手机号","最高学历","所学专业","联系邮箱","身份证号码","诚信承诺"]:
                assert name in field, (name,list(field))
            assert field["身份证号码"]["excluded"]
            assert field["诚信承诺"]["excluded"]
            assert all(f["value"] != "already@example.com" for f in scan["fields"]), "Existing personal values must not leave the page via scan"
            steps=[
              {"id":field["姓名"]["id"],"value":"测试姓名","optionValue":None},
              {"id":field["手机号"]["id"],"value":"13800138000","optionValue":None},
              {"id":field["最高学历"]["id"],"value":"本科","optionValue":"undergraduate"},
              {"id":field["所学专业"]["id"],"value":"软件工程","optionValue":None},
              {"id":field["联系邮箱"]["id"],"value":"test@example.com","optionValue":None},
              {"id":field["身份证号码"]["id"],"value":"SHOULD-NOT-WRITE","optionValue":None},
            ]
            print("BROWSER_STEP_FILL",flush=True)
            filled=send("HHBA_FILL", scanId=scan["scanId"],steps=steps)
            assert filled["ok"] and filled["filled"]==4,filled
            assert page.locator("#candidate-name").input_value()=="测试姓名"
            assert page.locator("#mobile").input_value()=="13800138000"
            assert page.locator("#education").input_value()=="undergraduate"
            assert page.locator("#major").input_value()=="软件工程"
            assert page.locator("#email").input_value()=="already@example.com","existing must not be overwritten"
            assert page.locator("#documentid").input_value()=="","identity must not be filled"
            focused=send("HHBA_FOCUS",id=field["最高学历"]["id"])
            assert focused["ok"] and page.evaluate("document.activeElement.id")=="education"
            events=page.evaluate("window.formEvents")
            assert "change:education" in events and "input:candidate-name" in events,events
            page.screenshot(path="/tmp/hhba-domestic-apply-browser.png",full_page=True)
            # A new user edit after fill must not be undone.
            page.locator("#candidate-name").fill("用户自己修改的姓名")
            # Repeat after a second scan; previous pending undo snapshots remain.
            print("BROWSER_STEP_UNDO",flush=True)
            undo=send("HHBA_UNDO")
            assert undo["ok"] and undo["restored"]==3,undo
            assert page.locator("#candidate-name").input_value()=="用户自己修改的姓名"
            assert page.locator("#mobile").input_value()==""
            assert page.locator("#education").input_value()==""
            print("HHBA_DOMESTIC_SYNTHETIC_BROWSER_DOM_FILL_AND_UNDO_OK")
            browser.close()
    finally:
        server.shutdown()

if __name__=="__main__":
    main()
