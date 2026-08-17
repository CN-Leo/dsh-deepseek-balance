# dsh-deepseek-balance

DeepSeek 账户余额实时显示插件（DeepSeek Harness / DSH）。

在 DSH Web 界面的输入框下方（`conversation.composer.dock`）常驻显示 DeepSeek 官方账户余额，每 15 秒自动刷新。数据来自官方接口 `GET https://api.deepseek.com/user/balance`，API Key 由 Host 端从 DSH 凭据库解析，**绝不会进入浏览器**。

## 安装

```bash
# 从 Git 仓库（发布后）
dsh plugin add https://github.com/<你的用户名>/dsh-deepseek-balance

# 或从本地目录
dsh plugin add /path/to/dsh-deepseek-balance
```

安装后**重启 dsh web**（当前进程不会热加载新插件）。

## 配置（必需）

插件通过 `credentials` 服务解析 `DEEPSEEK_API_KEY`，按以下顺序查找（任选其一）：

1. 环境变量 `DEEPSEEK_API_KEY`
2. `$DSH_HOME/.credentials.yaml`：

   ```yaml
   DEEPSEEK_API_KEY: sk-xxxxxxxxxxxxxxxx
   ```

配置后无需重启插件：每次请求都会重新解析凭据。

## 使用

- 余额条显示在会话输入框下方，绿点 = 正常，黄点 = 加载中，红点 = 获取失败
- 悬停（hover）余额条可查看各币种明细：总额 / 赠送 / 充值 / 账户可用状态
- 每 15 秒自动刷新一次

## 原理

| 端 | 职责 |
|---|---|
| Host | `credentials.resolve('DEEPSEEK_API_KEY')` → `subprocess` 调用 `curl` 请求官方余额接口 → 通过 `webServer` 暴露 `GET /api/deepseek-balance` |
| Client | 浏览器 `fetch('/api/deepseek-balance')` 每 15s 轮询 → `slots` 注册常驻 UI |

API Key 只存在于 Host 进程的 curl 子进程参数中，浏览器端只能拿到余额 JSON。

## 卸载

```bash
dsh plugin remove dsh-deepseek-balance
```

## 依赖

- Host：`credentials`、`subprocess`、`sandboxPolicy`、`webServer`（DSH 基础服务，Web 模式均有）
- Client：`slots` 服务，`react`（由 DSH Web 模块表提供）
- 系统：`curl`（Windows 自带 `curl.exe`；其他平台需 PATH 中有 curl）

## License

MIT
