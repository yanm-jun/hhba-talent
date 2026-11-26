# Retired Gemini integration

Gemini is retired from HHBA production and preview configuration. V4 job research and resume operations use the same OpenAI Responses provider. Do not provision Gemini credentials, routes, or environment settings. Historical implementation and synthetic regression fixtures are not deployment instructions.

The optional OpenAI operator probe is disabled unless a dedicated short-lived OpenAI probe secret is deliberately provisioned; it does not reuse a retired credential.
