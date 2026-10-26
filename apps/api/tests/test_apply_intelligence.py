import asyncio
import json
import os
import unittest
from unittest.mock import patch
from apps.api.apply_intelligence import AIUnavailable, checked_output, metadata_only, suggest_mapping

async def grant(user, task):
    return user == "trusted" and task == "entitled"

async def deny(user, task):
    return False

class Response:
    def __init__(self, content): self.content = content
    def raise_for_status(self): pass
    def json(self): return self.content

class MockClient:
    def __init__(self, content): self.content, self.requests = content, []
    async def post(self, url, headers, json):
        self.requests.append((url, headers, json))
        return Response(self.content)

def call(client, verify=grant, fields=None):
    return asyncio.run(suggest_mapping(user_id="trusted", task_id="entitled",
        fields=fields if fields is not None else [
            {"id":"f1","kind":"text","label":"家庭住址"},
            {"id":"f2","kind":"text","label":"毕业学校","value":"SECRET_CV_CONTENT"}],
        allowed_keys=["school","fullName","invalid"], verify_entitlement=verify, client=client))

class ApplyGatewayTest(unittest.TestCase):
    @patch.dict(os.environ, {"HHBA_DEEPSEEK_API_KEY":"fake-secret","HHBA_DEEPSEEK_MODEL":"deepseek-flash"})
    def test_only_metadata_and_keys_leave_device(self):
        client=MockClient({"choices":[{"finish_reason":"stop","message":{"content":json.dumps({"mappings":[
            {"id":"f2","profile_key":"school","confidence":"high"}]})}}],"usage":{"prompt_tokens":12,"completion_tokens":6}})
        out=call(client)
        self.assertEqual(out["suggestions"],[{"id":"f2","profile_key":"school","confidence":"high"}])
        self.assertEqual(len(client.requests),1)
        url,headers,payload=client.requests[0]
        self.assertEqual(url,"https://api.deepseek.com/chat/completions")
        self.assertEqual(headers["Authorization"],"Bearer fake-secret")
        self.assertNotIn("fake-secret",json.dumps(payload))
        self.assertNotIn("SECRET_CV_CONTENT",json.dumps(payload))
        self.assertNotIn("家庭住址",json.dumps(payload,ensure_ascii=False))
    @patch.dict(os.environ, {"HHBA_DEEPSEEK_API_KEY":"fake-secret"})
    def test_unpaid_blocked_before_http(self):
        client=MockClient({})
        with self.assertRaises(AIUnavailable):call(client,verify=deny)
        self.assertEqual(client.requests,[])
    @patch.dict(os.environ, {}, clear=True)
    def test_not_configured_blocked_before_http(self):
        client=MockClient({})
        with self.assertRaises(AIUnavailable):call(client)
        self.assertEqual(client.requests,[])
    def test_sanitizer_deny_by_default(self):
        fields=[{"id":"f1","kind":"select","label":"最高学历","value":"DO_NOT_SEND","options":[
                {"text":"本科","value":"secret-id"},{"text":"身份证号码","value":"secret"}]},
                {"id":"f2","kind":"text","label":"政治面貌"},
                {"id":"f3","kind":"text","label":"联系微信 abc@example.com"},
                {"id":"f4","kind":"text","label":"联系电话 13800138000"}]
        safe,keys=metadata_only(fields,["education","junk"])
        self.assertEqual(keys,["education"])
        self.assertEqual(safe,[{"id":"f1","label":"最高学历","kind":"select","options":["本科"]}])
        self.assertEqual(checked_output({"mappings":[
            {"id":"f1","profile_key":"education","confidence":"low"},
            {"id":"f1","profile_key":"invalid","confidence":"high"}]},safe,keys),[])
        with self.assertRaises(ValueError): metadata_only(fields*16,["school"])

if __name__=="__main__":
    unittest.main()
