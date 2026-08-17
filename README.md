# dsh-deepseek-balance

DeepSeek 账户余额实时显示插件（DeepSeek Harness / DSH）。

在 DSH Web 界面的输入框下方（`conversation.composer.dock`）常驻显示 DeepSeek 官方账户余额，每 15 秒自动刷新；同时按官网最新定价实时计算**本次会话消费金额**。数据来自官方接口 `GET https://api.deepseek.com/user/balance`，API Key 由 Host 端从 DSH 凭据库解析，**绝不会进入浏览器**。

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

- 余额条显示在会话输入框下方：`● DeepSeek 余额 ¥71.33 ｜ 本会话 ¥4.85`
  - 绿点 = 正常，黄点 = 加载中，红点 = 获取失败
  - 「本会话消费」按**官网最新定价**（deepseek-v4-flash / deepseek-v4-pro）计算，自动区分**高峰/空闲时段**（北京时间 9:00-12:00、14:00-18:00 为高峰，其余空闲），每 15 秒与余额一同刷新
- 悬停（hover）余额条可查看完整明细：
  - 各币种余额：总额 / 赠送 / 充值 / 账户可用状态
  - 本次会话 token 用量：输入（缓存命中率/读取/写入）、输出
  - 计价模型与当前时段、本次会话消费金额
- 说明：会话内切换过模型时按「当前模型」估算消费（token 投影不区分模型）；缓存写入按缓存未命中输入价计（官方价格表仅区分命中/未命中）

## 原理

| 端 | 职责 |
|---|---|
| Host | `credentials.resolve('DEEPSEEK_API_KEY')` → `subprocess` 调用 `curl` 请求官方余额接口 → 通过 `webServer` 暴露 `GET /api/deepseek-balance`（响应含当前默认模型） |
| Client | 浏览器 `fetch('/api/deepseek-balance')` 每 15s 轮询余额与模型 → `useProjection('tokenUsage')` 实时读取本会话累计 token → 按官网定价表 + 北京时间峰谷时段本地计价 |

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
