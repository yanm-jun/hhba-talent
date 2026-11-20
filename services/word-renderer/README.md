# HHBA private Word renderer

Private Python service for exact Word original-page preview and strict edit verification. It is **not a public file-sharing endpoint**.

Build from repository root:

```bash
docker build -f services/word-renderer/Dockerfile -t hhba-word-private .
```

Run with a private, HTTPS-reverse-proxied service and a secret at least 32 characters. Deploy an isolated Preview instance first; **do not use the production candidate bucket for tests**. Send authenticated server-to-server POST requests only:

- `POST /v1/render` JSON `{"original_b64":"<base64 DOCX>"}` → PDF bytes
- `POST /v1/verify` JSON `{"original_b64":"...","edited_b64":"...","old_text":"...","new_text":"..."}` → `{"verified":true,"report":...}` only after full render comparison

Requires `Authorization: Bearer <HHBA_WORD_RENDER_SHARED_SECRET>`. Never expose this value to browsers or in commit logs.

The Cloudflare Pages adapter must be configured with:
- `HHBA_WORD_RENDER_ENABLED=1` (off by default)
- `HHBA_WORD_RENDER_ENDPOINT=https://<private-renderer-host>`
- `HHBA_WORD_RENDER_SHARED_SECRET` (Cloudflare encrypted secret matching renderer)

Recommended deployment: HTTPS service with inbound requests restricted at edge to HHBA origins, no public document URL, no persistent volume, no external Word template links, strong memory/time limits, no file-content logging. Requests use temporary directories which are removed after processing. The renderer rejects embedded active content and external relationships.

**Limitations:** No arbitrary OOXML/Word can be promised pixel-identical after rewriting. This first iteration accepts only exactly matched short run text, and the verifier rejects page reflow or visual shifts outside the changed text area. On Pages the feature must remain disabled until this service is provisioned and verified. Do not place user resumes in GitHub Actions artifacts or public logs.
