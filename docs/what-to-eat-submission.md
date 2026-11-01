# 上架「今日菜单」到 DSH-Store 前的核对清单

依据：[DSH-Store README 的「上架必要条件」与「GitHub 自动检查」](https://github.com/ysr666/DSH-Store)（2026-11-02 读取）。
本文只记录**已核实**的要求；没核实的部分标「未知」，不猜。

## 0. 一个硬前提：仓库必须公开

DSH-Store 的安装源固定到 **40 位 Git Commit**，机器人只读公开仓库；npm-only、本地路径、浮动分支都不接受。

本插件的仓库已经公开，包里就一个插件（`plugins/dsh-what-to-eat`）。
按 DSH-Store 的规则属于「monorepo 但能唯一定位」，提交时补一个 `Plugin path` 即可；
也可以另开一个只放这个包的公开仓库，两种都行，公开是硬要求。

## 1. 逐条对照

| 要求 | 本插件现状 |
|---|---|
| 公开 GitHub 仓库、固定 40 位 Commit | ❌ 待解决（见第 0 节） |
| `package.json` 有合法 SemVer 与可解析的 `dsh.bundle.patch` | ✅ `0.1.1`、`./cordis.patch.yml` |
| Bundle Patch 声明唯一入口 ID，且不碰 `@deepseek-ai/*` | ✅ `id: dsh-what-to-eat` = 包名，无行尾注释，只 insert 自己 |
| 包名/版本/许可证/生命周期脚本与固定 Commit 一致 | ✅ MIT；**无任何安装生命周期脚本**（商城自动策略最偏好这一类） |
| 不使用 `@deepseek-ai` 命名空间 | ✅ `dsh-what-to-eat` |
| README 说明用途、启用方式、外部依赖、风险 | ✅ 中英双语，含「权限与外部依赖」表 |
| 声明 DSH / Node / 平台 / Profile 兼容范围 | ✅ `dsh.compatibility.dsh = ">=0.2.0-rc.1 <0.3.0-0"`、`dshReleases: 0.2.1-rc.2`、`engines.node >=22.12.0`、`os: [darwin, linux, win32]` |
| 声明文件/网络/命令/凭据权限 | ✅ README 表格：无 outgoing 网络、只读写 `$DSH_HOME/what-to-eat`、不执行命令、不碰凭据 |
| 收录价值 | ✅ 生活/饮食场景，本机离线，无需模型与密钥 |
| 安装后真实验收（安装→合成→可见→卸载） | ⏳ 已在 desktop profile 实测（组合层可见、Host 已激活、接口可用）；卸载回滚未实测 |

## 2. 上架前还要做的事

1. **定公开仓库**，把 `plugins/dsh-what-to-eat` 提上去；记下完整 40 位 commit。
2. `npm test` 全绿（当前 15 + 12 + 9 条断言）。
3. 用固定 commit 的地址在一个**一次性 Profile** 里走一遍：安装 → `--dump-config` 成功 → 刷新页面看到右侧栏 tab → 改一个档位到 2 分钟后收到卡片 → 停用 → 卸载。把截图与命令输出留档（商品详情页需要「运行验证」证据）。
4. 截图准备：面板四个 tab + 会话卡片（真实 DSH 页面，不是离屏渲染）。
5. 提交：打开 [插件上架 Issue 模板](https://github.com/AI-Scarlett/DSH-Store/issues/new?template=plugin-submission.yml)，填公开仓库地址；若仓库含多个插件，再补 `Plugin path`。
6. 机器人会检查：公开/归档状态、包名与版本、许可证、Bundle 声明、入口 ID、生命周期脚本、受保护命名空间、Catalog 冲突、兼容声明；结果写在同一条评论并打 `submission-passed` / `submission-failed` 标签。

## 3. 已知会被追问的点（提前写清）

- **会话卡片不写会话日志**：这是 DSH 的硬约束（未知事件类型会让 Session 无法重开；`appendPluginRecord` 只允许实验包），所以卡片是「视图」而不是 transcript 条目。README 已写明。
- **数据不会随卸载自动删除**：DSH 的 storage 不替插件清数据，面板提供「清空历史与去重状态」，README 给了目录路径。
- **没有 dshhub 元数据块**：`dsh-cost-meter` 用了 `dshhub`（categories / surfaces / permissions.network），但 `dsh-better-sidebar`、`dsh-image-gen` 都没有也能上架，属于可选增强；在没核对 schema 前不写，避免被预检判为非法字段。
- **兼容声明只写实测版本**：只声明 `0.2.1-rc.2` 为 compatible，其余不写；DSH-Store 要求「最近三版窗口内至少一个 compatible」，这条满足，但不伪造未验证的证据。

## 4. 另一种分发方式（不经过商城）

`npm publish` + 用户手动 `dsh plugin --profile <p> add dsh-what-to-eat` 也能装，但：

- 商城不收录 npm-only 来源；
- 手动安装不受商城的备份/回滚/健康检查保护；
- 仍建议先在公开仓库跑一遍固定 commit 的安装验收。

当前包已可 `npm pack` 发布：12 个文件、约 39 KB，`files` 白名单里只有运行所需文件。
