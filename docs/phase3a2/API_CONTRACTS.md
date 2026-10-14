# API 契约（当前实现）

- `POST /api/v1/auth/register`：接受 `account_type: candidate|recruiter`；公开注册固定创建 `role=user`。
- `POST /api/v1/organizations`：仅 recruiter 身份可创建企业法律主体。
- `GET/PUT /api/v1/recruiter/organizations/{id}/verification`：组织 owner 查看/保存认证草稿。
- `POST .../verification/documents?document_type=business_license|authorization_letter`：私有凭证上传。
- `POST .../verification/submit`：提交人工审核。
- `POST /api/v1/admin/verification/organizations/{id}/review`：内部管理员复核；禁止审核本人。
- `PUT /api/v1/admin/platform-service-gates/network-recruitment`：独立运营门控。

所有写入端点复用会话与 CSRF 校验。错误响应不包含文件内容、信用代码或凭证存储路径。
