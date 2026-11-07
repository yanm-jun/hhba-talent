"""HHBA Edge input hardening: synthetic browser tests, never real applicant sites."""
from __future__ import annotations

import functools
import http.server
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
EXT = HERE.parent


def main():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(HERE))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_default_timeout(10000)
            page.goto(f"http://127.0.0.1:{server.server_port}/ats-robustness-synthetic.html")
            page.evaluate("""() => {
              window.__hhbaHandler=null;
              window.chrome={runtime:{onMessage:{addListener(fn){window.__hhbaHandler=fn}}}};
            }""")
            page.add_script_tag(content=(EXT / "content.js").read_text("utf-8"))
            def send(command, **extra):
                return page.evaluate("""({command,extra}) => new Promise((resolve,reject) => {
                  const timeout=setTimeout(()=>reject(Error("Agent timed out")),8000);
                  window.__hhbaHandler({type:command,...extra},{},answer=>{
                    clearTimeout(timeout);resolve(answer);
                  });
                })""", {"command": command, "extra": extra})

            scan = send("HHBA_SCAN")
            assert scan["ok"], scan
            by_id={field["idAttribute"]:field for field in scan["fields"]}
            for safe in ["name","phone","email","education","date","month","summary",
                         "major-short","mutable","mutable-options","promoted"]:
                assert safe in by_id, (safe, list(by_id))
            for forbidden in ["password","age","salary","date-time","hidden-form",
                              "system-hidden","file","dynamic"]:
                assert forbidden not in by_id, (forbidden, list(by_id))
            assert by_id["verify"]["excluded"]
            assert by_id["otp-unlabeled"]["excluded"], "autocomplete one-time-code must be sensitive"
            assert by_id["identity"]["excluded"]
            assert by_id["existing"]["value"] == "已填写", "never expose existing applicant field value"
            assert not any("iframe-name" in str(x) for x in scan["fields"]), "never access iframe by default"
            assert scan["manualWidgets"], "framework combobox must be manual"

            # An SPA often repurposes the SAME input or select after scan.
            # Its previously cached field id must become invalid, not filled.
            page.locator('label[for="mutable"]').evaluate("(e)=>{e.textContent='身份证号码'}")
            page.locator("#mutable-options option[value='b']").evaluate("(e)=>{e.textContent='非全日制本科'}")
            page.locator("#promoted").evaluate("(e)=>{e.type='password'}")
            steps=[
                {"id":by_id["name"]["id"],"value":"合成申请人","optionValue":None},
                {"id":by_id["phone"]["id"],"value":"13900000000","optionValue":None},
                {"id":by_id["email"]["id"],"value":"test@example.invalid","optionValue":None},
                {"id":by_id["education"]["id"],"value":"本科","optionValue":"bachelor"},
                {"id":by_id["date"]["id"],"value":"2027-06-30","optionValue":None},
                {"id":by_id["month"]["id"],"value":"2023-09","optionValue":None},
                {"id":by_id["summary"]["id"],"value":"项目实践（仅合成测试）","optionValue":None},
                {"id":by_id["major-short"]["id"],"value":"一个超过限制的专业名称","optionValue":None},
                {"id":by_id["mutable"]["id"],"value":"伪造学院","optionValue":None},
                {"id":by_id["mutable-options"]["id"],"value":"本科","optionValue":"b"},
                {"id":by_id["promoted"]["id"],"value":"NEVER_WRITE_TO_PASSWORD","optionValue":None},
                {"id":by_id["verify"]["id"],"value":"765432","optionValue":None},
                {"id":by_id["otp-unlabeled"]["id"],"value":"999999","optionValue":None},
                {"id":by_id["identity"]["id"],"value":"SENSITIVE-DATA","optionValue":None},
                {"id":by_id["existing"]["id"],"value":"REPLACE_EXISTING","optionValue":None},
            ]
            res=send("HHBA_FILL",scanId=scan["scanId"],steps=steps)
            assert res["ok"],res
            actual={x["id"]:x for x in res["results"]}
            assert res["filled"]==7,res
            for field in ["mutable","mutable-options","promoted"]:
                assert actual[by_id[field]["id"]]["status"]=="skipped", (field,res)
            for field in ["major-short","verify","otp-unlabeled","identity","existing"]:
                assert actual[by_id[field]["id"]]["status"]=="skipped",(field,res)
            assert page.locator("#name").input_value()=="合成申请人"
            assert page.locator("#email").input_value()=="test@example.invalid"
            assert page.locator("#phone").input_value()=="13900000000"
            assert page.locator("#education").input_value()=="bachelor"
            assert page.locator("#date").input_value()=="2027-06-30"
            assert page.locator("#month").input_value()=="2023-09"
            assert page.locator("#summary").input_value()=="项目实践（仅合成测试）"
            assert page.locator("#major-short").input_value()==""
            assert page.locator("#mutable").input_value()==""
            assert page.locator("#mutable-options").input_value()==""
            assert page.locator("#promoted").input_value()==""
            assert page.locator("#verify").input_value()==""
            assert page.locator("#otp-unlabeled").input_value()==""
            assert page.locator("#identity").input_value()==""
            assert page.locator("#existing").input_value()=="existing@example.invalid"
            assert page.evaluate("window.submitCount")==0, "extension must NEVER auto submit"
            events=page.evaluate("window.formEvents")
            assert "input:name" in events and "change:education" in events
            assert "input:date" in events and "change:month" in events

            # User-changed values belong to user. Undo must leave them alone.
            page.locator("#name").fill("用户自己修改")
            undo=send("HHBA_UNDO")
            assert undo["ok"] and undo["restored"]==6,undo
            assert page.locator("#name").input_value()=="用户自己修改"
            for field in ["phone","email","education","date","month","summary"]:
                assert page.locator("#"+field).input_value()=="",(field,undo)

            # Date/month malformed values must be blocked BEFORE an attempt to write.
            scan2=send("HHBA_SCAN")
            current={x["idAttribute"]:x for x in scan2["fields"]}
            out=send("HHBA_FILL",scanId=scan2["scanId"],steps=[
                {"id":current["date"]["id"],"value":"2027-06","optionValue":None},
                {"id":current["month"]["id"],"value":"2023-09-01","optionValue":None},
            ])
            assert out["filled"]==0 and out["failures"]==0,out
            assert page.locator("#date").input_value()==""
            assert page.locator("#month").input_value()==""
            # No old scan is allowed to fill after SPA navigation.
            page.evaluate("history.pushState({},'', '/candidate/step-2')")
            stale=send("HHBA_FILL",scanId=scan2["scanId"],steps=[
                {"id":current["phone"]["id"],"value":"13900000000","optionValue":None}
            ])
            assert not stale["ok"] and "重新扫描" in stale["error"],stale
            assert page.locator("#phone").input_value()==""
            assert page.evaluate("window.submitCount")==0
            print("HHBA_ATS_COMPLEX_BROWSER_SAFETY_PASS",flush=True)
            browser.close()
    finally:
        server.shutdown()


if __name__=="__main__":
    main()
