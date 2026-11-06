# PR #153 补录与去重审计（2026-11-06）
## 结论
旧 PR #153 有6条政策、5条住房记录，其中大部分现已由后续正式城市版本覆盖，不再追加同义 ID。**仅补录西安2026年英才计划历史申报批次1条**，无新增实时房源。
## 现有对应关系
- 贵阳3条人才租补、首次购房补贴、重点产业生活津贴：现有 `guizhouPolicyRecords.ts` 中的 `gz-guiyang-2026-rent-graduate`、`gz-guiyang-first-home-202503`、`gz-guiyang-2026-living-allowance`。
- 贵阳租补制度及筑巢鹿冲关公寓：现有 `guizhouHousingRecords.ts` 的 `gz-guiyang-rental-stipend-2026`、`gz-guiyang-zhuchao-luchongguan-202610`。政府10月9日的273套、首期100余套均非现在余房。
- 银川青年人才公寓、租房补助、经开区人才引育/安家及公寓租金优惠：现有 `ningxiaPolicyRecords.ts` 的 `nx-yinchuan-youth-apartment`、`nx-yinchuan-youth-rent`、`nx-yinchuan-dev-settle`、`nx-yinchuan-dev-spouse`、`nx-yinchuan-dev-rental`；住房分别由 `ningxiaHousingRecords.ts` 的人才公寓和租金优惠制度涵盖，仅对经开区符合条件企业适用。
- 西安2026年9月第92批人才安居审核28户：`shaanxiPolicyRecords.ts` 已有 `sn-xian-2026-abcd-housing-qualification`。28户只是资格审核通过，不是空房。
## 新增
- `sn-xian-english-plan-2026`：来源西安经开区2026年申报通知 https://xetdz.xa.gov.cn/xwzx/tzgg/2098318571781300225.html ，9月30日18:00已截止，仅供历史查阅、下一年度申报准备。不得作为即时申报入口，不自动推定补贴金额。
## 核验说明
本次仅对旧记录与现行代码的重复性和西安原始通知进行核查，不声称重新完成全部城市2026政策、申报链接及实时房源核验。保留原 PR #153 和分支供审计回溯，独立 PR 验收成功后再关闭历史项。
