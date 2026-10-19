# HHBA 手机端定位推荐 V0.1（2026-10-17）

目标：用户点击“使用当前位置推荐”，浏览器授权后，自动填写招聘市场的 country/province/city 过滤条件，直接调用现有只读的真实岗位 API；同时在首页和候选岗位页复用。

## 完成范围
- 仅用户主动点击时请求浏览器 `navigator.geolocation.getCurrentPosition`。浏览器会控制和显示授权；拒绝或超时不会触发职位模拟数据。
- 位置转换使用可替换的逆地理编码端点。开发模式为单用户、小流量试点可使用 OSMF Nominatim；**生产构建未配置 `VITE_HHBA_REVERSE_GEOCODE_URL` 时拒绝解析**，并引导用户手选地区。不要在生产设置公共 Nominatim URL。
- 定位精度超过150km时拒绝假称同城。GPS坐标只保存在异步调用内存中，发送给解析端点前四舍五入至小数点后两位（约1km级），不传递精确坐标给 HHBA 招聘 API。
- 中国省市地区名必须在经审查的本地行政区目录匹配；无法确认城市时只筛选已确认国家/省份，不能猜。海外非拉丁语地名可能仅筛到国家层级。
- 默认不存位置。用户勾选“本设备保存城市24小时”后，仅保存国家、省份、城市、时间戳到 localStorage；再访问自动使用保存城市，显示其为**上次定位的城市**，不称实时定位。关闭选项或重置时清除。
- 用户可以自由覆盖和清除地区；地理位置失败不应影响其他岗位筛选或开放授权。
- 不进行持续GPS跟踪、不计距离、不发起自动投递。

## 发布前门禁
- 生产 HTTPS 安全上下文；正确的 `Permissions-Policy: geolocation=(self)`。
- 提供有服务协议和合理限速/缓存、可规模化部署的逆地理编码服务或自部署实例。配置 `VITE_HHBA_REVERSE_GEOCODE_URL` 后，端点接收 lat、lon、zoom、addressdetails 并返回 JSON {address:{country_code,state,city,...}}；如果是外域必须审查跨境数据传输、CORS、隐私提示、许可和内容使用范围。
- 对境内用户的位置信息处理、同意撤回、第三方服务及留存机制做合规复核。
- 测试只能模拟坐标与API，不代表取得实际访问用户GPS的权限；真实手机端还需用户现场授权验收。
- 外国城市的多语种名称需要后续位置标准化映射，以免中文名无法命中英文职位地点。

OSMF Nominatim 使用政策：https://operations.osmfoundation.org/policies/nominatim/ （应用总量每秒不超过1次，必须署名，禁止大规模自动调用）。此项目不应把公共 Nominatim 当作正式高并发服务。

设备定位API：https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
