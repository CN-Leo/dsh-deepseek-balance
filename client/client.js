window.__ModuleLoader__.load({
  id: "dsh-deepseek-balance",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");

    var POLL_MS = 15000;
    var ENDPOINT = "/api/deepseek-balance";

    function loadBalance() {
      return fetch(ENDPOINT, { headers: { accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) return { status: "ok", data: res.data, at: res.at || Date.now() };
          return { status: "error", message: (res && res.error) || "未知错误", at: Date.now() };
        })
        .catch(function (err) {
          return { status: "error", message: (err && err.message) || String(err), at: Date.now() };
        });
    }

    function DockView() {
      var pair = react.useState({ status: "loading" });
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
          text = "DeepSeek 余额 " + infos.map(function (b) {
            return (b.currency || "?") + " " + (b.total_balance != null ? b.total_balance : "?");
          }).join(" / ");
          title = infos.map(function (b) {
            return (b.currency || "?") +
              "：总额 " + (b.total_balance != null ? b.total_balance : "?") +
              "，赠送 " + (b.granted_balance != null ? b.granted_balance : "?") +
              "，充值 " + (b.topped_up_balance != null ? b.topped_up_balance : "?") +
              "，账户可用 " + (state.data.is_available === true ? "是" : state.data.is_available === false ? "否" : "?");
          }).join("\n");
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
          function () { return react.createElement(DockView); },
        );
      });
    }

    exports.name = "dsh-deepseek-balance";
    exports.inject = ["slots"];
    exports.apply = apply;
    return module.exports;
  }
});
