# DSH-code

代码相关工作区，用 Git 管理历史，任何改动都能对比、回滚。

## 远端

| 名称 | 地址 | 用途 |
|---|---|---|
| `origin` | `ssh://git@ssh.github.com:443/dshcode2026/dsh-code.git` | GitHub 主远端（私有） |
| `mirror` | `D:\deepseek-harness\_git-remotes\dsh-code.git` | 本地镜像，断网时也能备份 |

## 这台机器的网络情况（2026-10-23 实测）

系统 DNS 把 `github.com` 解析到 `20.205.243.166`，**这个 IP 的 443 端口完全不通**（连接超时）：
`git push`（HTTPS）、`gh auth login`、浏览器打开 `github.com` 都会卡死或断连。

所以本仓库固定用 **SSH 走 443 端口**：

```
ssh.github.com:443    实测 133ms，稳定
```

- 密钥：`C:\Users\HUAWEI\.ssh\id_ed25519_dshcode`（公钥已加入账号 `dshcode2026` 的 Authentication keys）
- 仓库内已配置 `core.sshCommand` 指定这把密钥，换机器时记得重新配
- `git push` 时若弹出沙箱授权，点允许即可：沙箱禁止 git 创建 ssh 子进程的管道，这不是权限错误
- 官方备用端口：`ssh.github.com:443`；若换网络后又通了，可改回 `github.com:22`

> 注意：`/signup` 曾被 DataDome 按 IP 封禁（403），换 IP 或隔几小时恢复。

## 常用命令

```bash
git status              # 看当前改了什么
git add .               # 把改动放进待提交区
git commit -m "说明"    # 存档
git log --oneline       # 看历史存档
git diff                # 看未提交的具体改动
```

## 备份

```bash
git push                          # 推到 GitHub
git push mirror --all             # 推到本地镜像（断网可用）
```

## 回滚

```bash
git restore 文件名              # 丢弃某个文件未提交的改动
git revert <commit-id>          # 撤销某个已提交的改动（保留历史，推荐）
git reset --hard <commit-id>    # 回到某个存档点（会丢弃之后的改动）
```
