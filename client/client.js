window.__ModuleLoader__.load({
  id: "dsh-deepseek-balance",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");

    var POLL_MS = 15000;
    var ENDPOINT = "/api/deepseek-balance";

    /**
     * Official DeepSeek pricing (CNY per 1M tokens), as of 2026-08-17.
     * Array index: 0 = off-peak (空闲时段), 1 = peak (高峰时段).
     * Peak hours (Beijing time): 09:00-12:00, 14:00-18:00.
     * Cache-write tokens are billed at the cache-miss input price (the
     * official table only lists hit / miss; a write means the tokens were
     * not cached before).
     */
    var PRICES = {
      "deepseek-v4-flash": { hit: [0.05, 0.10], miss: [1.5, 3.0], out: [4.5, 9.0] },
      "deepseek-v4-pro": { hit: [0.15, 0.30], miss: [4.5, 9.0], out: [13.5, 27.0] },
    };

    function isPeakNow() {
      var hour;
      try {
        hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date()));
      } catch (e) {
        hour = new Date().getHours();
      }
      if (hour === 24) hour = 0;
      return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
    }

    function priceKeyFor(model) {
      return model && String(model).toLowerCase().indexOf("pro") !== -1 ? "deepseek-v4-pro" : "deepseek-v4-flash";
    }

    /** Session cost in CNY from the tokenUsage projection + current model. */
    function computeCost(usage, model) {
      if (!usage) return 0;
      var p = PRICES[priceKeyFor(model)];
      var peak = isPeakNow() ? 1 : 0;
      var missTokens = (usage.uncachedInputTokens || 0) + (usage.cacheWriteTokens || 0);
      var cost = missTokens * p.miss[peak] / 1e6;
      cost += (usage.cacheReadTokens || 0) * p.hit[peak] / 1e6;
      cost += (usage.outputTokens || 0) * p.out[peak] / 1e6;
      return cost;
    }

    function fmtCost(cost) {
      return cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2);
    }

    function fmtTokens(n) {
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function cacheHitPercent(usage) {
      var total = (usage.uncachedInputTokens || 0) + (usage.cacheReadTokens || 0) + (usage.cacheWriteTokens || 0);
      if (total <= 0) return null;
      return Math.round((usage.cacheReadTokens || 0) / total * 100);
    }

    function loadBalance() {
      return fetch(ENDPOINT, { headers: { accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) return { status: "ok", data: res.data, model: res.model || "", at: res.at || Date.now() };
          return { status: "error", message: (res && res.error) || "未知错误", at: Date.now() };
        })
        .catch(function (err) {
          return { status: "error", message: (err && err.message) || String(err), at: Date.now() };
        });
    }

    function DockView(props) {
      var useProjection = props && props.useProjection;
      var usage = useProjection ? useProjection("tokenUsage") : undefined;
      var pair = react.useState({ status: "loading", model: "" });
      var state = pair[0];
      var setState = pair[1];

      react.useEffect(function () {
        var alive = true;
        function tick() {
          loadBalance().then(function (next) {
            if (alive) setState(next);
          });
        }
        tick();
        var timer = setInterval(tick, POLL_MS);
        return function () {
          alive = false;
          clearInterval(timer);
        };
      }, []);

      var dotColor = state.status === "error" ? "#f87171" : state.status === "loading" ? "#fbbf24" : "#34d399";
      var text;
      var title;
      var cost = usage ? computeCost(usage, state.model) : 0;
      var peak = isPeakNow() ? "高峰时段" : "空闲时段";

      if (state.status === "error") {
        text = "DeepSeek 余额获取失败";
        title = state.message || "";
      } else if (state.status === "loading" || !state.data) {
        text = "DeepSeek 余额加载中…";
        title = "";
      } else {
        var infos = Array.isArray(state.data.balance_infos) ? state.data.balance_infos : [];
        if (infos.length === 0) {
          text = "DeepSeek 余额：无数据";
          title = "";
        } else {
          var balanceText = infos.map(function (b) {
            return (b.currency || "?") + " " + (b.total_balance != null ? b.total_balance : "?");
          }).join(" / ");
          text = "DeepSeek 余额 " + balanceText;
          if (usage && (usage.outputTokens > 0 || (usage.uncachedInputTokens || 0) > 0 || (usage.cacheReadTokens || 0) > 0)) {
            text += " ｜ 本会话 ¥" + fmtCost(cost);
          }
          var lines = infos.map(function (b) {
            return (b.currency || "?") +
              "：总额 " + (b.total_balance != null ? b.total_balance : "?") +
              "，赠送 " + (b.granted_balance != null ? b.granted_balance : "?") +
              "，充值 " + (b.topped_up_balance != null ? b.topped_up_balance : "?") +
              "，账户可用 " + (state.data.is_available === true ? "是" : state.data.is_available === false ? "否" : "?");
          });
          if (usage) {
            var hit = cacheHitPercent(usage);
            lines.push(
              "本会话 tokens：输入 " + fmtTokens((usage.uncachedInputTokens || 0) + (usage.cacheWriteTokens || 0) + (usage.cacheReadTokens || 0)) +
              "（缓存命中 " + (hit === null ? "—" : hit + "%" + "，读取 " + fmtTokens(usage.cacheReadTokens || 0) + "，写入 " + fmtTokens(usage.cacheWriteTokens || 0) + "）") +
              "，输出 " + fmtTokens(usage.outputTokens || 0)
            );
            lines.push("计价：按 " + (state.model || "deepseek-v4-flash") + "（" + peak + "）");
            lines.push("本次会话消费：¥" + fmtCost(cost));
          }
          title = lines.join("\n");
        }
      }

      return react.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          lineHeight: 1,
          padding: "2px 0",
          opacity: 0.85,
        },
        title: title || undefined,
      },
        react.createElement("span", { style: { width: 8, height: 8, borderRadius: "50%", background: dotColor, flex: "none" } }),
        react.createElement("span", null, text),
      );
    }

    function apply(ctx) {
      ctx.slots.inject("conversation.composer.dock", function () {
        return ctx.slots.register(
          { name: "conversation.composer.dock", id: "deepseek-balance", order: 1 },
          function (props) {
            return react.createElement(DockView, { useProjection: props && props.useProjection });
          },
        );
      });
    }

    exports.name = "dsh-deepseek-balance";
    exports.inject = ["slots"];
    exports.apply = apply;
    return module.exports;
  }
});
