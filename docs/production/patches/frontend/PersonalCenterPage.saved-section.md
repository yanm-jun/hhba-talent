# 个人中心收藏区改读账户级收藏 —— 合并补丁

目标文件: `apps/web/src/pages/PersonalCenterPage.tsx`
现状（原件副本）: 收藏走 `services/savedJobs`（设备 Cookie 级 `/api/saved`），页面文案自述
「当前收藏数据按本浏览器隔离，正式账号级跨设备同步仍在规划中」（原件约第 118、130 行）。
改后: **已登录（短信账户会话）时读账户级收藏 `/api/v1/saved`；未登录时仍显示本设备收藏并明确标注，
两套数据不混排、不互冒充。** 设备收藏并入账户只允许用户显式确认后逐条迁移（第 4 步），禁止自动合并。

前置: App 装配需把短信会话用户传进本页。原件 props 是 `{ user: User | null }`（旧 api.ts 的 User）；
合并时新增一个可选 prop `smsUser: SmsUser | null`（来自 services/smsAuth.ts），
由 App 用 `smsAuth.me()` 的结果填充；不改动旧 user 的既有用途，避免牵连企业端页面。

## 1. import 增补（原件第 6 行 savedJobs import 之后加一行）

```ts
import { smsAuth, type SmsUser } from '../services/smsAuth';
```

props 签名改为（原件第 25 行）:

```ts
export function PersonalCenterPage({ user, smsUser = null, onlySaved = false, section = 'overview' }:
  { user: User | null; smsUser?: SmsUser | null; onlySaved?: boolean; section?: Section }) {
 const accountMode = !!smsUser; // true=账户收藏，false=本设备收藏，渲染文案据此区分
```

## 2. 读取收藏的 useEffect 替换（原件约第 42–60 行整段替换）

```ts
 useEffect(() => {
  if (!['overview', 'saved'].includes(current)) return;
  let active = true;
  setLoading(true); setError('');
  // 账户模式只拿 jobId 列表，再沿用既有 getJob 逐个补详情；savedAt 账户接口暂不返回，置空串渲染时降级
  const loadIds: Promise<{ jobId: string; savedAt: string }[]> = accountMode
    ? smsAuth.listSavedJobIds().then((ids) => ids.map((jobId) => ({ jobId, savedAt: '' })))
    : listSavedJobs().then((records) => records.map((r) => ({ jobId: r.jobId, savedAt: r.savedAt })));
  loadIds.then(async (records) => {
   if (!active) return;
   setSavedCount(records.length);
   if (current === 'overview') { setRows([]); return; }
   const results: RecordRow[] = [];
   for (const record of records.slice(0, 40)) {
    if (!active) return;
    try { const detail = await getJob(record.jobId, new AbortController().signal); results.push({ record, job: detail.job }); }
    catch { results.push({ record, job: null }); }
   }
   if (active) setRows(results);
  }).catch((e) => { if (active) setError(e instanceof Error ? e.message : '收藏服务暂不可用'); })
   .finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [current, accountMode, smsUser?.id]);
```

说明: `RecordRow.record` 的类型是 savedJobs 的 SavedJob；账户记录缺 savedAt 时以空串填充，
第 5 步渲染处做降级显示。后端增强项（可选、非本补丁必需）: `/api/v1/saved` 返回
`items: { jobId, savedAt }[]` 后，把上面 map 改为透传即可。

## 3. 取消收藏分流（原件约第 64 行 cancel 函数替换函数体）

```ts
  async function cancel(id: string) {
   setBusy(id);
   try {
    if (accountMode) await smsAuth.setSavedJob(id, false);
    else await setSavedJob(id, false);
    setRows((all) => all.filter((item) => item.record.jobId !== id));
    setSavedCount((n) => Math.max(0, n - 1));
   } catch (e) { setError(e instanceof Error ? e.message : '取消收藏失败'); }
   finally { setBusy(''); }
  }
```

职位列表/详情页的收藏按钮同理分流（不在本文件内，合并时全局搜 `setSavedJob(` 逐处按同一规则改）:
已登录调 `smsAuth.setSavedJob(jobId, saved)`，未登录维持设备收藏。

## 4. 设备收藏 → 账户收藏的一次性迁移（用户显式确认，禁止自动并入）

在 saved 区块标题下、列表之前插入（state: `const [migrateOffer, setMigrateOffer] = useState(false)`，
在第 2 步的 loadIds 完成后若 `accountMode` 且设备收藏非空且 localStorage 无
`hhba.saved.migrated.v1` 标记则置 true）:

```tsx
{migrateOffer && (
  <div className="hhba-account-notice">
    <p>检测到本设备有收藏记录。可以把它们逐条加入你的账户收藏，之后跨设备可见；不迁移也不会删除本设备记录。</p>
    <button type="button" onClick={async () => {
      if (!confirm('把本设备收藏逐条加入账户收藏吗？')) return;
      const device = await listSavedJobs();
      for (const r of device) { try { await smsAuth.setSavedJob(r.jobId, true); } catch { /* 单条失败不阻断其余 */ } }
      localStorage.setItem('hhba.saved.migrated.v1', '1');
      setMigrateOffer(false);
      location.reload();
    }}>迁移到账户收藏</button>
    <button type="button" onClick={() => { localStorage.setItem('hhba.saved.migrated.v1', '1'); setMigrateOffer(false); }}>暂不迁移</button>
  </div>
)}
```

## 5. 文案与渲染降级（原件第 108、118、124、130 行附近）

- 概览卡片副标题: `accountMode ? '账户收藏 · 跨设备同步' : '本浏览器真实收藏记录'`（原件写死后者）。
- saved 区块说明: 账户模式显示「以下为账户收藏，退出登录后重新登录仍可查看」；
  设备模式保留原文案并加「登录后可迁移到账户」。
- `record.savedAt` 渲染处（原件第 126 行）改为:
  `{record.savedAt ? <small>收藏于 {record.savedAt.slice(0, 10)}</small> : <small>账户收藏</small>}`
- 删除/改写原件第 130 行「当前是本设备收藏」一句: 仅设备模式显示，账户模式不显示以免误导。

## 验证要点（合并后手测）

1. 用户 A 登录收藏岗位 → 退出 → 换浏览器/无痕窗口登录 A → 收藏仍在（账户级持久化成立）。
2. 用户 B 登录后看不到 A 的收藏；未登录状态只看到本设备收藏且标注清楚。
3. 迁移横幅只在显式点击并 confirm 后才发 PUT 请求；点「暂不迁移」后不再弹出（标记已写）。
4. 后台对账: saved_jobs_account 行数与页面账户收藏数一致；设备收藏仍在 hhba-saved.sqlite，两者不串。
