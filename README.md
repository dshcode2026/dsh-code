# DSH-code

代码相关工作区。

- 与 `D:\DSH-work`（日常任务、文档、非代码内容）分开，互不干扰。
- 这里用 Git 管理历史：每次改动都可以存档、对比、回滚。
- 新建会话时把工作区选为 `D:\DSH-code` 即可。

## 常用命令

```bash
git status              # 看当前改了什么
git add .               # 把改动放进待提交区
git commit -m "说明"    # 存档
git log --oneline       # 看历史存档
git diff                # 看未提交的具体改动
```

## 回滚

```bash
git restore 文件名              # 丢弃某个文件未提交的改动
git reset --hard <commit-id>    # 回到某个存档点（会丢弃之后的改动）
```
