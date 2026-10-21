# /api/admin/jobs 改本地统计 —— 合并补丁

目标文件: `ops/legacy-marketplace/admin-console.ts`
依赖文件: `ops/legacy-marketplace/admin-jobs-local.ts`（本代码包已备好，含 computeAdminJobsLocal
纯函数与其单测 admin-local.test.ts；本补丁只负责把它装配进 admin-console.ts 并删除外部快照透传）

## 现状（要删的代码）

admin-console.ts 中 handlePrivateAdmin 内的整段（原件约第 163–172 行）:

```ts
 if(path==='/api/admin/jobs'&&req.method==='GET'){
  try{
   const upstream=await fetch('https://yanm-jun.github.io/hhba-talent/admin-preview/data/overview.json',{
    method:'GET',headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000),cache:'no-store'});
   if(!upstream.ok||Number(upstream.headers.get('content-length')||0)>30000)return bad('JOB_SNAPSHOT_UNAVAILABLE',503);
   const data=await upstream.json() as any;
   if(data?.kind!=='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2'||!['current','partial','stale','unavailable'].includes(data.quality)||!data.counts)return bad('JOB_SNAPSHOT_INVALID',503);
   return json(data);
  }catch{return bad('JOB_SNAPSHOT_UNAVAILABLE',503)}
 }
```

问题: 数据来自 GitHub Pages 静态快照而非本服务生产数据（Phase 0 审计已证），口径不可对账，
且阿里云内地访问 github.io 不稳定。替换后任何情况下都不再回退到该快照。

## 1. 顶部 import 增补（admin-console.ts 文件头 import 区）

```ts
import { readNativeIndex } from "./read-official-index.mjs";
import { openJobSyncStore } from "./jd-sync-store.mjs";
import { computeAdminJobsLocal, type OfficialIndexFile, type JdSyncStats } from "./admin-jobs-local.ts";
```

注: read-official-index.mjs 与 jd-sync-store.mjs 本就被主服务 server.ts 引用、Dockerfile 已 COPY；
admin-console.ts 与它们同目录（镜像内同为 /app），相对路径一致，无需改主服务。

## 2. 替换代码段（整段替换上面「现状」代码块，位置与鉴权顺序不变）

```ts
 if(path==='/api/admin/jobs'&&req.method==='GET'){
  // 本地统计版（Phase 3）：只读本服务岗位索引 + JD 同步库，绝不回退 GitHub Pages 快照。
  let index: OfficialIndexFile | null = null;
  try {
   const native = await readNativeIndex('/sync-state/public-index', 'jobs.json');
   if (native) index = JSON.parse(new TextDecoder().decode(native.bytes)) as OfficialIndexFile;
  } catch { index = null; }
  let sync: JdSyncStats = { available: false };
  try {
   const store = openJobSyncStore('/sync-state/overseas-jd.sqlite');
   const cov = store.coverage();
   const fail = store.db.query("SELECT COUNT(*) n FROM jobs WHERE state IN ('RETRY','NEEDS_REVIEW')").get() as any;
   const last = store.db.query('SELECT MAX(checked_ms) m FROM jobs').get() as any;
   sync = { available: true, states: cov.states, totalCurrent: cov.total_current,
            failureJobs: Number(fail?.n ?? 0),
            lastCheckedAt: last?.m ? new Date(Number(last.m)).toISOString() : null };
   store.close();
  } catch { sync = { available: false }; }
  return json(computeAdminJobsLocal(index, sync));
 }
```

注意:
- `openJobSyncStore` 打开时会 CREATE TABLE IF NOT EXISTS（幂等），只读巡检场景可接受；
  若要严格只读，改用 `new Database(path, { readonly: true })` 后手写等价聚合 SQL，
  coverage 的 states 口径不得变（细则在 admin-jobs-local.ts 文件尾装配注释）。
- 返回形状变为 `kind:'HHBA_ADMIN_JOBS_LOCAL_V1'` + `counts.{total,displayable,pendingVerification,
  closed,domestic,overseas,byRecruitmentType,companies,lastSyncAt,syncFailures}`，
  索引不可读时 `quality:'unavailable', counts:null`（前端显示「数据源未接入」，不回退快照）。

## 3. Dockerfile.hhba 补 COPY（镜像内要有新文件，否则运行时 import 失败）

在现有 `COPY ops/legacy-marketplace/admin-console.ts ./admin-console.ts` 后加一行:

```dockerfile
COPY ops/legacy-marketplace/admin-jobs-local.ts ./admin-jobs-local.ts
```

## 4. 前端 dashboard.js 适配（目标: ops/legacy-marketplace/admin-ui/dashboard.js）

现有 refresh()/updateOverview() 按旧快照形状校验（`kind==='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2'`、
`counts.displayableJobs`）。装配本地版后同步改这三处（只改字段映射，不改页面结构）:

```js
 // refresh() 内校验（原判定 HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2 处）:
 const valid = data?.kind === 'HHBA_ADMIN_JOBS_LOCAL_V1'
   && ['current', 'partial', 'unavailable'].includes(data.quality);
 // updateOverview() 内取数:
 const counts = valid ? data.counts : null;
 const displayable = counts ? counts.displayable : null; // 原 counts.displayableJobs 的对应值
 // counts 为 null（quality=unavailable）时沿用既有「真实索引暂不可用」文案分支，不显示任何数字。
 // 可顺带展示的新字段: counts.total / counts.companies / counts.lastSyncAt / counts.syncFailures，
 // 文案必须带 admin-jobs-local.ts 的 definitions 原文，禁止把 companies 说成「已入驻企业」、
 // 禁止把 displayable 说成「已确认在招」（pendingVerification 单独成项）。
```

## 5. 验收（合并后）

1. 登录后台请求 /api/admin/jobs: `total` 与同机 `/api/jobs/page?limit=1` 的 allJobs 完全一致。
2. 临时改名 /sync-state/public-index/jobs.json 后再请求: 返回 quality=unavailable、counts=null，
   且网络面板无任何对 yanm-jun.github.io 的请求。
3. bun test ops/legacy-marketplace/admin-local.test.ts 全绿（口径单测已覆盖 unavailable/partial/真实 0）。
