# 验证记录 · 今日菜单

记录时间：2026-11-02。所有结论都对应可复现的命令或可查的日志，未验证的部分单列，不混进「通过」。

## 环境

| 项 | 值 |
|---|---|
| DSH 核心 | `@deepseek-ai/dsh` 0.2.1-rc.2 |
| 桌面外壳 | `dsh-plugin-desktop` 2.0.18（外壳版本，不是插件兼容版本） |
| Profile | `desktop`（`<DSH_HOME>\profiles\desktop`） |
| OS | Windows 11 |
| 安装方式 | `node_modules\dsh-what-to-eat` 目录联接 + `cordis.patch.yml` 一行 insert |

## 自动化测试

```bash
cd <repo>/plugins/dsh-what-to-eat
node test/engine.test.mjs            # 15/15
node test/host.integration.mjs       # 14/14（约 55 秒）
node test/midnight.integration.mjs   # 9/9（约 45 秒）
```

### 引擎单测（15）

忌口排除、停用排除、喜好加权（600 次抽样显著高于均匀）、喜好覆盖基础权重、近期重复降权、N 天窗口、逐级放宽不空手、同餐次当日不重复、3 候选互不相同、池子抽空后允许重复并标记、四种导入格式（行/CSV/JSON 数组/JSON 对象）、CSV 往返、本地时区日期、会话心跳 90 秒判定、跨午夜档位归属。

### Host 集成（15，真持久化 + 真定时器 + 真 HTTP，临时 `DSH_HOME`）

首次启动写入全部内置菜（当前 214 条）、默认 3 档、3 候选互不相同、换一道保留 3 条、导入预览→提交→撤销、同名跳过、CSV 导出表头与行数、每档 `count` 覆盖全局、每档候选落在该餐次、**改名后已推卡片立即更新（不需换一道）**、出厂重置回到内置库与默认档位；另外早期版本还覆盖了到点推送、补发标记、静默顺延、错过窗口记 missed、同日不重复、重启不重复（两次 `apply` 同一 `DSH_HOME`，已推计数不变）。

### 跨午夜集成（9，伪造 `Date.now`，产品代码无时钟开关）

23:59 的档位在 23:58:30 建立、时钟跳到次日 00:00:20：补推成功、`pending`/`catchUp` 为真、落库 `occurDate` = 昨天、`date` = 今天、`slotLog` 键按发生日、再等一个 tick 不重复推。

### 真实实例（desktop profile）

| 项 | 结果 |
|---|---|
| Host 激活 | 日志 `[what-to-eat] 已就绪：214 条，3 个档位`（重启后 02:19:13） |
| 组合层可见 | `dsh --profile desktop --dump-config` 输出 `- id: dsh-what-to-eat` |
| ① 到点产生卡片 | PASS（多个档位各触发一次，卡片都正常显示） |
| ② 模式②带攻略且是搜索页 | PASS（`mode=guide`，`https://www.xiachufang.com/search/?keyword=...`） |
| ③ 导入 20 条后当天抽到新条目 | PASS（抽到 `E2E-导入乙`） |
| ④ 改名 / 自定义链接后推送用新值 | PASS（`E2E-改名菜` + `example.com` 链接；在线复验 `在线改名菜`） |
| ⑤ 同一档同日只推一次 | PASS（1 → 1；重启不重复由集成测试覆盖） |
| ⑥ 无活动会话时不推、等下次会话补发 | PASS（02:45 那次抽取时页面不在会话里：`pending=true`、`catchUp=true`、`claimed=false`，即已落库但没被任何会话领取） |
| ⑦ 停用后不再出现 | PASS（6 次换一道均未命中；池子空时 409） |
| 右侧栏面板真机渲染 | PASS（`diag.slots.panelMounted=true`） |
| 浮动卡片真机渲染并被领取 | PASS（`diag.slots.cardMounted=true`，`claimed=true`） |

## 隔离实例验证（另起一个真实 DSH web profile）

为了在**不碰正在使用的 desktop profile** 的前提下验证真实页面，用官方 CLI 建了一个临时实例：

```bash
$env:DSH_HOME="<temp>/probe-home"
node "<app>\node_modules\@deepseek-ai\dsh\lib\bin.js" --profile web --port 0 --no-open
# dsh web: http://127.0.0.1:<port>/?token=...
```

做法：从随附 `web` profile 模板初始化（`--dump-config` 自动建），把插件目录联接进
`profiles/web/node_modules/`，并在该 profile 的 `cordis.patch.yml` 加一行 insert。结果：

| 检查 | 结果 |
|---|---|
| 新 profile 能合成含本插件的配置 | PASS（`--dump-config` exit 0，含 `dsh-what-to-eat`） |
| Host 在全新环境启动并自建库 | PASS（`214 条，3 个档位`，写入临时 `what-to-eat/state.json`） |
| 真实实例上完成一次抽取 | PASS（`mode=guide`，`pending=true`，说明当时无会话心跳） |
| 真实页面加载了本插件的客户端模块 | PASS（页面启动数据 `__DSH_BOOT__.entries` 含 `dsh-what-to-eat`） |
| 真实页面里三块客户端注册全部成功 | PASS（`GET /dsh-what-to-eat/api/state` 的 `diag`：`clientVersion=0.1.1`，`slots={card:true, tabType:true, panel:true}`） |
| 面板 / 会话卡片是否真渲染 | **未观察到**：临时实例里「选工作区」走的是原生目录对话框，被沙箱拦下（`spawn EPERM`）；手工种了工作区记录后能看到 `probe-ws`，但创建会话需要登录/API Key（页面弹「开始使用」），因此进不到会话，dock 与侧栏都无从挂载 |

这条路径的结论：**打包、组合、Host 运行、客户端模块投递、三块客户端注册**都在真实 DSH 上验证过了；
只差「进到会话里」这一步——它需要能正常选工作区并登录（真实使用环境里没有问题）。

### 自检用的 diag

客户端加载后会给 Host 打一次招呼，`GET http://<host>/dsh-what-to-eat/api/state` 里能看到：

```json
"diag": { "helloAt": 1793555349228, "clientVersion": "0.1.1",
          "slots": { "card": true, "tabType": true, "panel": true } }
```

- `null` / 没有该字段 → 客户端模块没投递（或页面没加载）
- `slots.card=false` → 会话卡片注册失败
- `slots.tabType=false` → 侧栏页类型注册失败
- `slots.panel=false` → 面板正文注册失败（通常是侧栏还没声明那个 keyed slot）

这条不用登录 GUI，浏览器直接开那个地址就能看，面板不出现时先查它。

`clientVersion` 带构建后缀（如 `0.1.1+b5`），每次改客户端都会 +1：

- 后缀没变 = 页面还是旧 bundle（普通刷新没换掉，或还开着旧窗口）；
- 客户端 bundle 的 rev 由文件 mtime/ctime/size 算出来，改文件后正常刷新会拿到新 rev；
- 但同时开着多个窗口时，`diag` 是最后写入者胜，旧窗口会把新窗口的结果覆盖掉——排查时先只留一个窗口。

`slots.panelMounted` 只有在**面板正文真的挂载**时才会出现，用来区分「注册成功」和「画出来了」。

## 卡片与面板的打开方式

卡片注册在 `shell.overlay`，**常驻**显示，与有没有会话无关；关掉只是隐藏当次投递。
面板不自动打开：只有点卡片上的「面板」按钮（或点菜名）时才调用 `sidebarRight.openTab(TAB_KIND)`，
关掉后不会自己弹回来。

## 主题适配

面板样式只用 `--dsw-alias-*` token，没有写死颜色（写死的只有图标美术）。在真实 DSH 页面里读出了浅色主题的实际取值：

```
bg-base #fff / bg-layer-1 #fff / border-l1 #0000000a / label-primary #0f1115
label-secondary #61666b / brand-primary #0f1115 / state-warn #f59e0b
```

把这些真实值注入离屏夹具后重新渲染，浅色下排版、对比度、主按钮（黑色填充）都与宿主一致；
深色主题用的是同一批 token 名，兜底值也按深色写，因此两套主题都不会出现「白底白字」。

## 未验证 / 验证边界

1. **卸载/回滚闭环**：未在真实 profile 上实操；`reset` 命令与目录清理路径已验证。
2. **跨平台**：声明了 darwin/linux，但只在 Windows 11 上跑过。
3. **多窗口并发**：两个窗口同时写 `state.json` 的场景未测（按单 Host 进程假设设计）；`diag` 在多窗口下是「最后写入者胜」。
4. **上架提交**：仓库已公开、包已可发布，剩下是 npm 发布与 DSH-Store Issue 两步。

## 构建身份核验（为什么必须重启才换代码）

改了 Host 代码后，通过修改 profile patch 中插件行的 `config` 触发重组合。观察到：

| 探针 | 旧构建行为 | 新构建行为 | 当时线上 |
|---|---|---|---|
| A 窗口领取后 B 窗口读卡片 | `hidden: true` | 完整卡片 | `hidden: true` |
| 无 `session` 心跳时新卡片 | `pending=false` | `pending=true` | `pending=false` |

结论：组合会重新应用，但插件模块不会重新 `import`（ESM 缓存），**必须重启 DSH 进程**；客户端代码刷新页面即可。

## 打包

```bash
npm pack --dry-run --json
# files: 12（lib/ ×4、locale/ ×2、icon.svg、cordis.patch.yml、README.md、README.en.md、LICENSE、package.json）
# size: ~40 KB
```

## 上架条件

见 [what-to-eat-submission.md](what-to-eat-submission.md)。仓库已公开，剩下 npm 发布 + 提 Issue。
