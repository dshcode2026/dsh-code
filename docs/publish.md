# 发布清单（npm + DSH-Store）

目标：把这个插件发布到 npm，并提交到 DSH-Store 收录。商城只接受**公开 GitHub 仓库 + 固定 40 位 commit**，所以顺序是：先公开仓库 → 再发布 npm → 再提 Issue。

## 0. 先定名字

包名 = 插件 entry id = 用户在商城看到的身份，改了要三处同步：

| 位置 | 现在 |
|---|---|
| `package.json` → `name` | `dsh-what-to-eat` |
| `cordis.patch.yml` → `id` 与 `name` | 同为 `dsh-what-to-eat`（**必须相等**，且 id 行不能写行尾注释） |
| 客户端模块 id（`lib/client.js` 里 `__ModuleLoader__.load({ id })`） | `dsh-what-to-eat` |

改名时还要同步：`PANEL_ID` / `TAB_KIND`（侧栏 tab 身份，可保持不变）、README 里的包名、已安装 profile 的目录联接名。

> 已安装的用户改名会变成「另一个插件」：旧条目仍在 profile patch 里，需要先卸载旧的。发布前把名字定死，别在上架后再改。

候选名（npm 上目前都可用，2026-11-02 查过 404）：见聊天里给出的清单。

## 1. 公开仓库

```bash
# 在仓库根目录
git add plugins/dsh-what-to-eat docs .gitignore
git commit -m "feat(what-to-eat): 今日菜单插件 0.1.1"
git push
```

仓库已是公开状态（若是新建的私有仓库，先改成 public：Settings → Danger Zone → Change visibility），否则商城机器人读不到。

## 2. 发 npm

```bash
cd plugins/dsh-what-to-eat
npm test                                   # 18 / 15 / 9 全绿再发
npm pack --dry-run                         # 确认 13 个文件、没有 assets
npm version patch                          # 或 minor
npm publish --access public
```

`package.json` 里已经准备好：`files` 白名单、`exports`、`icon`、`locale`、`dsh.bundle.patch`、`dsh.client`、`dsh.compatibility`（声明 `0.2.1-rc.2` 兼容、范围 `>=0.2.0-rc.1 <0.3.0-0`）、`license: MIT`、**没有安装生命周期脚本**（商城自动策略最偏好这一类）。

## 3. 提交 DSH-Store

打开 [插件上架 Issue 模板](https://github.com/AI-Scarlett/DSH-Store/issues/new?template=plugin-submission.yml)，填公开仓库地址；如果仓库里只有一个插件，`Plugin path` 可留空。

机器人会检查：公开/归档状态、包名与版本、许可证、Bundle 声明、入口 ID、生命周期脚本、受保护命名空间、Catalog 冲突、兼容声明。结果写在同一 Issue 的评论里，并打 `submission-passed` / `submission-failed` 标签。

## 4. 上架前自查（都已完成，改名前重新过一遍）

- [x] 唯一入口 id，等于包名，不碰 `@deepseek-ai/*`
- [x] 无 `preinstall/install/postinstall/prepare`
- [x] 无运行时依赖（只用 node 内置；前端 react 由宿主提供）
- [x] 无出网请求（只有本机 `/dsh-what-to-eat/api` 路由）
- [x] README（中英）写明用途、启用方式、权限、外部依赖、已知边界
- [x] 兼容声明只写实测过的版本
- [x] 图标 SVG、locale 中英
- [x] 单测 18 / Host 集成 15 / 跨午夜 9
- [ ] 在一次性 profile 里走一遍「安装 → 看到面板 → 卸载」（需要人跑）
- [ ] 公开仓库固定 commit 的安装验收（同上）

## 5. 发布后在真实 profile 里复验

```bash
dsh plugin --profile desktop add <包名>
```

重启 DSH → 刷新页面 → 卡片出现、点「面板」能打开 → 卸载后数据目录可按 README 清理。
