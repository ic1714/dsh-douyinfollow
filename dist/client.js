window.__ModuleLoader__.load({
  id: "douyinfollow",
  factory(require) {
    try {
    const module = { exports: {} };
    const exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var React = __toESM(require("react"), 1);

// src/types.ts
var OVERALL_LABEL = {
  verified: "\u5DF2\u6838\u5B9E",
  mixed: "\u90E8\u5206\u6838\u5B9E",
  contradicted: "\u4E0E\u6743\u5A01\u6765\u6E90\u4E0D\u7B26",
  unverified: "\u65E0\u6CD5\u6838\u5B9E"
};
var FACT_LABEL = {
  verified: "\u5DF2\u6838\u5B9E",
  contradicted: "\u4E0D\u7B26",
  unverified: "\u65E0\u6CD5\u6838\u5B9E"
};

// src/client/index.ts
var h = React.createElement;
var PKG = "douyinfollow";
var STATE = "/plugin-data/douyinfollow/state";
var ACTION = "/plugin-data/douyinfollow/action";
var BADGE_COLOR = {
  verified: "#2ea043",
  mixed: "#d29922",
  contradicted: "#f85149",
  unverified: "#8b949e"
};
var box = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 12,
  height: "100%",
  overflow: "auto",
  fontSize: 13,
  lineHeight: 1.5
};
var chip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "1px 8px",
  borderRadius: 999,
  fontSize: 11,
  background: "rgba(127,127,127,.16)",
  whiteSpace: "nowrap"
};
var btn = {
  padding: "4px 10px",
  borderRadius: 8,
  fontSize: 12,
  cursor: "pointer",
  border: "1px solid rgba(127,127,127,.35)",
  background: "transparent",
  color: "inherit"
};
var cardBox = {
  border: "1px solid rgba(127,127,127,.22)",
  borderRadius: 10,
  background: "rgba(127,127,127,.07)",
  padding: 10,
  textAlign: "left",
  color: "inherit",
  font: "inherit",
  width: "100%",
  cursor: "pointer"
};
var link = { color: "#58a6ff", textDecoration: "none", wordBreak: "break-all" };
var input = {
  padding: "4px 8px",
  borderRadius: 8,
  fontSize: 12,
  width: "100%",
  border: "1px solid rgba(127,127,127,.35)",
  background: "transparent",
  color: "inherit"
};
function fmtTime(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function Badge({ status }) {
  return h("span", {
    style: { ...chip, background: `${BADGE_COLOR[status]}22`, color: BADGE_COLOR[status], border: `1px solid ${BADGE_COLOR[status]}55` }
  }, OVERALL_LABEL[status]);
}
function CardView({ card, open, onToggle, onAct }) {
  const face = h(
    "button",
    {
      type: "button",
      style: cardBox,
      onClick: onToggle,
      "data-card-id": card.id
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
      h(Badge, { status: card.overall }),
      h("span", { style: chip }, card.keyword),
      !card.read && h("span", { style: { width: 7, height: 7, borderRadius: 999, background: "#58a6ff" } }),
      h("span", { style: { marginLeft: "auto", opacity: 0.6, fontSize: 11 } }, fmtTime(card.createdAt))
    ),
    h("div", { style: { fontWeight: 500, margin: "6px 0 2px" } }, card.headline),
    h("div", { style: { opacity: 0.6, fontSize: 11 } }, `${card.video.author || "\u672A\u77E5\u4F5C\u8005"} \xB7 ${card.video.publishText || ""} \xB7 \u70B9\u51FB${open ? "\u6536\u8D77" : "\u5C55\u5F00\u8BE6\u60C5"}`)
  );
  if (!open) return face;
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 8 } },
    face,
    h(
      "div",
      { style: { ...cardBox, cursor: "default", display: "flex", flexDirection: "column", gap: 8 } },
      card.summary && h("div", null, h("strong", null, "\u89C6\u9891\u6982\u8FF0\uFF1A"), card.summary),
      h(
        "div",
        null,
        h("strong", null, `\u4E8B\u5B9E\u70B9\uFF08${card.facts.length}\uFF09`),
        card.facts.length === 0 && h("div", { style: { opacity: 0.6 } }, "\u65E0\u53EF\u6838\u5B9E\u4E8B\u5B9E\u70B9"),
        ...card.facts.map((f, i) => h(
          "div",
          { key: i, style: { marginTop: 6, paddingLeft: 8, borderLeft: `2px solid ${BADGE_COLOR[f.status === "verified" ? "verified" : f.status === "contradicted" ? "contradicted" : "unverified"]}` } },
          h("div", null, h("span", { style: { ...chip, color: BADGE_COLOR[f.status === "verified" ? "verified" : f.status === "contradicted" ? "contradicted" : "unverified"] } }, FACT_LABEL[f.status]), " ", f.claim),
          f.sources.length > 0 && h(
            "div",
            { style: { fontSize: 12 } },
            "\u6765\u6E90\uFF1A",
            ...f.sources.map((s, j) => h(
              "span",
              { key: j },
              j > 0 && " \xB7 ",
              h("a", { style: link, href: s.url, target: "_blank", rel: "noreferrer" }, s.title || s.url)
            ))
          ),
          f.note && h("div", { style: { fontSize: 12, opacity: 0.7 } }, f.note)
        ))
      ),
      card.marketing && h(
        "div",
        { style: { fontSize: 12, opacity: 0.8 } },
        h("strong", null, "\u8425\u9500\u8BDD\u672F\uFF08\u672A\u7ECF\u8BC1\u5B9E\uFF09\uFF1A"),
        card.marketing
      ),
      h(
        "div",
        { style: { fontSize: 12 } },
        "\u539F\u89C6\u9891\uFF1A",
        h("a", { style: link, href: card.video.url, target: "_blank", rel: "noreferrer" }, card.video.title || card.video.url)
      ),
      h(
        "div",
        { style: { display: "flex", gap: 6 } },
        !card.read && h("button", { type: "button", style: btn, onClick: () => onAct("read", { cardId: card.id }) }, "\u6807\u8BB0\u5DF2\u8BFB"),
        h("button", { type: "button", style: btn, onClick: () => onAct(card.archived ? "unarchive" : "archive", { cardId: card.id }) }, card.archived ? "\u53D6\u6D88\u5F52\u6863" : "\u5F52\u6863")
      )
    )
  );
}
function FollowPanel() {
  const [snap, setSnap] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [open, setOpen] = React.useState({});
  const [showArchived, setShowArchived] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [showCfg, setShowCfg] = React.useState(false);
  const [kwText, setKwText] = React.useState("");
  const [intText, setIntText] = React.useState("60");
  const [enCfg, setEnCfg] = React.useState(true);
  React.useEffect(() => {
    if (showCfg && snap) {
      setKwText(snap.keywords.join("\uFF0C"));
      setIntText(String(snap.intervalMinutes));
      setEnCfg(snap.enabled);
    }
  }, [showCfg]);
  const load = React.useCallback(async () => {
    try {
      const r = await fetch(STATE, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSnap(await r.json());
      setErr(null);
    } catch (e) {
      setErr(String(e?.message ?? e));
    }
  }, []);
  React.useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4e3);
    return () => clearInterval(t);
  }, [load]);
  const act = React.useCallback(async (action, extra) => {
    setBusy(true);
    try {
      await fetch(ACTION, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra })
      });
      await load();
    } catch (e) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, [load]);
  if (!snap) {
    return h("div", { style: box }, h("div", { style: { opacity: 0.7 } }, err ? `\u65E0\u6CD5\u8FDE\u63A5\u5BBF\u4E3B\uFF1A${err}` : "\u52A0\u8F7D\u4E2D\u2026"));
  }
  const cards = snap.cards.filter((c) => showArchived || !c.archived);
  const unread = snap.cards.filter((c) => !c.read && !c.archived).length;
  return h(
    "div",
    { style: box },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8 } },
      h("strong", { style: { fontSize: 14 } }, "\u6296\u97F3\u8DDF\u8FDB"),
      unread > 0 && h("span", { style: { ...chip, background: "#58a6ff22", color: "#58a6ff" } }, `${unread} \u672A\u8BFB`),
      h("span", { style: { marginLeft: "auto", opacity: 0.6, fontSize: 11 } }, snap.patrol.running ? "\u5DE1\u67E5\u4E2D\u2026" : snap.idle.idle ? "\u7A7A\u95F2" : "\u5FD9")
    ),
    h(
      "div",
      { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
      h("button", { type: "button", style: btn, disabled: busy, onClick: () => void act("patrol") }, "\u7ACB\u5373\u8DDF\u8FDB"),
      !snap.login.loggedIn && h("button", { type: "button", style: btn, disabled: busy || snap.login.loggingIn, onClick: () => void act("login") }, snap.login.loggingIn ? "\u7B49\u5F85\u626B\u7801\u2026" : "\u626B\u7801\u767B\u5F55"),
      h("button", { type: "button", style: btn, disabled: busy || snap.human.checking, onClick: () => void act("human") }, snap.human.checking ? "\u9A8C\u8BC1\u4E2D\u2026" : "\u8FC7\u9A8C\u8BC1"),
      snap.human.checking && h("button", { type: "button", style: btn, disabled: busy, onClick: () => void act("humanDone") }, "\u6211\u5DF2\u5B8C\u6210\u9A8C\u8BC1"),
      h("button", { type: "button", style: btn, disabled: busy, onClick: () => void act("readAll") }, "\u5168\u90E8\u5DF2\u8BFB"),
      h("button", { type: "button", style: btn, onClick: () => setShowArchived((v) => !v) }, showArchived ? "\u9690\u85CF\u5F52\u6863" : "\u663E\u793A\u5F52\u6863"),
      h("button", { type: "button", style: btn, onClick: () => setShowCfg((v) => !v) }, showCfg ? "\u6536\u8D77\u8BBE\u7F6E" : "\u5173\u952E\u8BCD\u8BBE\u7F6E")
    ),
    h(
      "div",
      { style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" } },
      h("span", { style: { ...chip, color: snap.login.loggedIn ? "#2ea043" : "#d29922" } }, snap.login.loggedIn ? "\u6296\u97F3\u5DF2\u767B\u5F55" : "\u6296\u97F3\u672A\u767B\u5F55"),
      ...snap.keywords.map((k) => h("span", { key: k, style: chip }, k)),
      snap.keywords.length === 0 && h("span", { style: { opacity: 0.6, fontSize: 12 } }, "\u672A\u8BBE\u7F6E\u5173\u952E\u8BCD\uFF1A\u70B9\u4E0A\u65B9\u300C\u5173\u952E\u8BCD\u8BBE\u7F6E\u300D\u6DFB\u52A0\u8BDD\u9898")
    ),
    showCfg && h(
      "div",
      { style: { ...cardBox, cursor: "default", display: "flex", flexDirection: "column", gap: 8 } },
      h("div", { style: { fontSize: 12, opacity: 0.7 } }, "\u5173\u952E\u8BCD\uFF08\u9017\u53F7\u5206\u9694\uFF1B\u641C\u7D22\u6296\u97F3\u76F8\u5173\u89C6\u9891\uFF0C\u4E0D\u76EF\u8D26\u53F7\uFF09\uFF1A"),
      h("input", { style: input, value: kwText, placeholder: "\u4F8B\u5982\uFF1ADeepSeek\uFF0C\u5F00\u6E90\u5927\u6A21\u578B\uFF0CHarness", onChange: (e) => setKwText(e.target.value) }),
      h(
        "div",
        { style: { display: "flex", gap: 8, alignItems: "center", fontSize: 12, flexWrap: "wrap" } },
        h("span", null, "\u5DE1\u67E5\u6700\u5C0F\u95F4\u9694\uFF08\u5206\u949F\uFF09"),
        h("input", { style: { ...input, width: 70 }, type: "number", min: 5, max: 1440, value: intText, onChange: (e) => setIntText(e.target.value) }),
        h(
          "label",
          { style: { display: "flex", gap: 4, alignItems: "center" } },
          h("input", { type: "checkbox", checked: enCfg, onChange: (e) => setEnCfg(e.target.checked) }),
          "\u542F\u7528\u7A7A\u95F2\u81EA\u52A8\u5DE1\u67E5"
        )
      ),
      h("div", null, h("button", {
        type: "button",
        style: btn,
        disabled: busy,
        onClick: () => void act("setConfig", { keywords: kwText, intervalMinutes: Number(intText) || 60, enabled: enCfg })
      }, "\u4FDD\u5B58\u8BBE\u7F6E"))
    ),
    snap.login.error && h("div", { style: { color: "#f85149", fontSize: 12 } }, snap.login.error),
    snap.human.error && h("div", { style: { color: "#f85149", fontSize: 12 } }, snap.human.error),
    snap.human.checking && h("div", { style: { color: "#d29922", fontSize: 12 } }, "\u5DF2\u6253\u5F00\u9A8C\u8BC1\u7A97\u53E3\uFF1A\u5982\u51FA\u73B0\u6ED1\u5757/\u70B9\u9009\u8BF7\u5B8C\u6210\u4E00\u6B21\uFF1B\u5B8C\u6210\u540E\u81EA\u52A8\u5224\u5B9A\uFF0C\u4E5F\u53EF\u70B9\u300C\u6211\u5DF2\u5B8C\u6210\u9A8C\u8BC1\u300D\u7ACB\u5373\u590D\u6838\u3002\u5224\u5B9A\u901A\u8FC7\u540E\u7A97\u53E3\u81EA\u52A8\u7F29\u5230\u53F3\u4E0B\u89D2\u5E76\u4FDD\u7559\u4F1A\u8BDD\u4F9B\u5DE1\u67E5\u590D\u7528\u3002"),
    !snap.human.checking && /验证码/.test(snap.patrol.last?.error ?? "") && h("div", { style: { color: "#d29922", fontSize: 12 } }, "\u4E0A\u6B21\u5DE1\u67E5\u88AB\u6296\u97F3\u98CE\u63A7\u62E6\u622A\uFF1A\u70B9\u300C\u8FC7\u9A8C\u8BC1\u300D\u4EBA\u5DE5\u5B8C\u6210\u4E00\u6B21\uFF0C\u4E4B\u540E\u81EA\u52A8\u5DE1\u67E5\u901A\u5E38\u5373\u53EF\u6062\u590D\u3002"),
    err && h("div", { style: { color: "#f85149", fontSize: 12 } }, `\u8FDE\u63A5\u5F02\u5E38\uFF1A${err}`),
    snap.leadsPending > 0 && h("div", { style: { opacity: 0.7, fontSize: 12 } }, `${snap.leadsPending} \u6761\u7EBF\u7D22\u6B63\u5728\u6838\u5B9E\u7F16\u6392\u4E2D\u2026`),
    cards.length === 0 && h(
      "div",
      { style: { opacity: 0.6 } },
      "\u6682\u65E0\u8FDB\u5C55\u5361\u7247\u3002\u8BBE\u7F6E\u5173\u952E\u8BCD\u5E76\u767B\u5F55\u540E\uFF0CDSH \u7A7A\u95F2\u65F6\u4F1A\u81EA\u52A8\u5DE1\u67E5\u6296\u97F3\u76F8\u5173\u89C6\u9891\uFF0C\u6838\u5B9E\u540E\u63A8\u9001\u5230\u8FD9\u91CC\u3002"
    ),
    ...cards.map((card) => h(CardView, {
      key: card.id,
      card,
      open: !!open[card.id],
      onToggle: () => setOpen((o) => ({ ...o, [card.id]: !o[card.id] })),
      onAct: (action, extra) => void act(action, extra)
    })),
    snap.patrol.last && h(
      "div",
      { style: { opacity: 0.55, fontSize: 11, marginTop: 4 } },
      `\u4E0A\u6B21\u5DE1\u67E5 ${fmtTime(snap.patrol.last.startedAt)}\uFF1A\u53D1\u73B0 ${snap.patrol.last.found} / \u65B0\u589E ${snap.patrol.last.added}` + (snap.patrol.last.error ? ` \xB7 ${snap.patrol.last.error}` : "") + ` \xB7 \u4E0B\u6B21\u6700\u65E9 ${fmtTime(snap.patrol.nextEligibleAt ?? Date.now())}`
    )
  );
}
var inject = ["slots", "sidebarRightTabs"];
function apply(ctx) {
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: PKG,
    kind: "douyin-follow",
    title: () => "\u6296\u97F3\u8DDF\u8FDB",
    guide: [{
      id: PKG,
      kind: "douyin-follow",
      title: () => "\u6296\u97F3\u8DDF\u8FDB",
      description: () => "\u8DDF\u8FDB\u9009\u5B9A\u5185\u5BB9\u7684\u5B9E\u65F6\u8FDB\u5C55"
    }]
  }), "follow tab type");
  ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register(
    { name: "sidebar.right.pane.tab", key: PKG },
    FollowPanel
  )), "follow panel body");
}

    const plug = { inject: module.exports.inject, apply(ctx) { try { return module.exports.apply(ctx); } catch (e) { window.__FOLLOW_APPLY_ERR__ = String(e && e.stack || e); console.error("[follow-apply]", e && e.stack || e); throw e; } } };
    window.__FOLLOW_PLUGIN__ = plug;
    return plug;
    } catch (e) { window.__FOLLOW_FACTORY_ERR__ = String(e && e.stack || e); console.error("[follow-factory]", e && e.stack || e); throw e; }
  },
});
