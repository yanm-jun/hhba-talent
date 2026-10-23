# HHBA · 首批 50 家企业图片投放区

这里接受**普通照片、网页截图、手机截图、PNG、JPG/JPEG、WebP、GIF**，不要求 SVG、透明背景或高清原始文件。

## 放置方式

在当前目录下建立与 `src/data/domesticComplete50Target.json` **完全相同企业名称**的文件夹。例如：

```text
apps/web/media-inbox/
├── 华域汽车/
│   ├── logo.jpg
│   ├── headquarters.jpg
│   ├── office-1.png
│   └── screenshot-1.jpeg
├── 宁德时代/
│   ├── logo.png
│   └── factory-1.jpg
└── 京东方Ａ/
    ├── logo.webp
    └── office-1.jpg
```

**文件名前缀**：`logo`（企业品牌图）、`headquarters`（总部/大楼）、`office`（办公环境）、`factory`（工厂）、`product`（产品）、`screenshot`（其他真实企业页面/场景截图）。同一类型可加 `-1`、`-2` 等编号；每家最多读取 13 张图片。**不需要手工把 JPEG 改成 SVG**。

可从 GitHub 网页向对应公司目录上传这些文件，也可把文件放进本仓库再提交。网页截图若是办公环境，请命名 `office-1.png`；普通官网页面截图可使用 `screenshot-1.jpg`，前端会显示“网页或场景截图”，不会虚称“总部大楼”。

## 来源不是必填项

直接放图片就可以。系统自动压缩、保留宽高比、关联准确的企业档案、展示预览，并在验收表里显示“用户提交”，不再因缺少公开 HTTPS 图片链接卡住导入。

如果希望增加来源说明或表示自己已核对图片归属，可在公司文件夹里放 `sources.json`：

```json
{
  "confirmedCompany": "宁德时代",
  "files": {
    "logo.png": {"source": "https://www.catl.com/", "label": "宁德时代企业标志"},
    "factory-1.jpg": {"label": "宁德时代工厂实景截图"}
  }
}
```

`confirmedCompany` **必须与目录名称相同**，才会在验收中认定为用户确认过对应公司；不填也能显示图片，但会标记为“待确认企业归属”。填写来源链接纯属可选，网页截图可以没有公开图片原始链接。

## 自动化与安全边界

- 预览 GitHub Actions 会执行 `node scripts/import-domestic-company-media.mjs`，自动将图片规范化为适合页面显示的 PNG/WebP，并写入 `public/domestic-media` 与 `src/data/domesticMediaBundle.json`。
- 用户图片和企业官网图片都能展示；大图会被压缩，**不会裁切 Logo 或普通截图**。
- 依然不允许把其他企业或子品牌 Logo 冒充公司主体，也不允许借图片状态伪造岗位、招聘系统或与企业的合作关系。
- 拿不准图片权利时，先保留来源以便审查；截图并不自动意味着拥有公开商用授权。
- 此功能只更新开发分支与独立预览，不自动上线 Railway 生产环境。
