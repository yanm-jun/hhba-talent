# dashboard.js 渲染 users 段 —— 合并补丁（增补片段）

目标文件: `ops/legacy-marketplace/admin-ui/dashboard.js`、`ops/legacy-marketplace/admin-ui/index.html`
前置: 先套用 admin-growth-users.replacement.md（后端 /api/admin/growth 已返回 users 段）。
现状: dashboard.js 已有 users 视图骨架（users-chart / users-interval / users-data-quality），
但指标卡只有流量口径，exportCSV 里「真实注册账户」一行写死「未接入」。本补丁只增补渲染，不动既有流量/收藏渲染。

## 1. index.html：在 #view-users 视图内增补指标卡（放在 users-chart 之前）

```html
<div class="metric-grid" id="users-metrics">
  <div class="metric"><span>真实注册账户</span><strong id="users-registered">—</strong><small>注册入口建号 · 仅统计真实账户</small></div>
  <div class="metric"><span>今日新增</span><strong id="users-new-today">—</strong><small>UTC 日</small></div>
  <div class="metric"><span>近 7 日新增</span><strong id="users-new-7d">—</strong><small>按注册时间</small></div>
  <div class="metric"><span>近 30 日新增</span><strong id="users-new-30d">—</strong><small>按注册时间</small></div>
  <div class="metric"><span>近 7 日登录活跃</span><strong id="users-active-7d">—</strong><small>跨日去重账户数 · 非 DAU/MAU</small></div>
</div>
<p class="muted" id="users-scope-note">数据源未接入时显示「—」；演示账户与设备访客不计入。</p>
```

（class 名按现有 styles.css 的实际类名对齐；若无 metric-grid/metric 类，套用时沿用
growth 视图里指标卡的既有结构与类名，只换 id 与文案。）

## 2. dashboard.js：新增 renderUsersSection()（加在 updateGrowth() 之前）

```js
function renderUsersSection(){
 const u=growth?.users;
 const ready=u?.quality==='collected';
 for(const [id,value] of [['users-registered',u?.registeredUsers],['users-new-today',u?.newToday],
  ['users-new-7d',u?.new7d],['users-new-30d',u?.new30d],['users-active-7d',u?.loginActive7d]])
  displayMetric(id,ready?value:null,ready);
 const q=byId('users-data-quality');
 if(q)q.textContent=ready?'真实账户库 · 已对账口径':'数据源未接入';
 const note=byId('users-scope-note');
 if(note)note.textContent=ready
  ? '口径：注册数仅含经注册入口创建的账户；登录活跃为近 7 日有成功登录的去重账户数。'
  : '数据源未接入时显示「—」；演示账户与设备访客不计入。';
}
```

注: displayMetric(id, value, available) 是 dashboard.js 既有函数（available=false 或非整数显示「—」），
复用它即可保证「未接入显示 —、真实 0 显示 0」的既有纪律；不要在本函数里写任何默认值填充。

## 3. dashboard.js：在 updateGrowth() 末尾挂接（锚点为既有两行）

原有结尾附近:

```js
 renderDailyPV('trend-chart',t?.series,readyT);
 renderDailyPV('users-chart',t?.series,readyT);
```

其后加一行:

```js
 renderUsersSection();
```

users-chart 继续画流量 series 不变；如后续要叠加注册趋势，用 u.series 的 newUsers 单独画一条，
不得把 PV 曲线改名为用户增长（口径纪律）。

## 4. dashboard.js：exportCSV 的「真实注册账户」行改为动态（替换写死行）

原写死行（exportCSV 内）:

```js
 rows.push(['真实注册账户','未接入','模拟账户不计入真实注册数',''],
```

替换为:

```js
 if(growth?.users?.quality==='collected'){
  rows.push(['真实注册账户',String(growth.users.registeredUsers),'仅注册入口创建的真实账户',growth.asOf],
   ['今日新增注册',String(growth.users.newToday),'UTC 日',growth.asOf],
   ['近 7 日新增注册',String(growth.users.new7d),'按注册时间',growth.asOf],
   ['近 30 日新增注册',String(growth.users.new30d),'按注册时间',growth.asOf],
   ['近 7 日登录活跃',String(growth.users.loginActive7d),'跨日去重账户数，不是 DAU/MAU',growth.asOf]);
 }else{
  rows.push(['真实注册账户','未接入','模拟账户不计入真实注册数','']);
 }
```

其后既有的「真正 DAU/MAU / 营收」两行「未接入」保持不动（loginActive7d 不冒充 DAU/MAU）。

## 5. 验收（合并后）

1. 后端未接入 users 段时: 5 张卡全显示「—」，users-data-quality 显示「数据源未接入」，与改前行为无回归。
2. 接入后: 后台逐项与数据库对账——registeredUsers = `SELECT COUNT(*) FROM users WHERE status<>'deleted'`
   的结果原样呈现；真实 0 时显示 0 而不是「—」。
3. 切换日期筛选（1/7/30/90 天与自定义区间）: newToday/new7d/new30d 与 series 汇总一致，
   loginActive7d 始终是近 7 日窗口的跨日去重值，不随所选区间被每日相加放大。
