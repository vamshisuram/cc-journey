const view = document.getElementById("view");
const crumbs = document.getElementById("crumbs");
const sseDot = document.getElementById("sse-dot");

const state = {
  goalId: null,
  tab: "mindmap",
  selectedNodeId: null,
  cy: null,
};

const KIND_COLOR = {
  root: "#bb9af7",
  continuation: "#7aa2f7",
  pivot: "#e0af68",
  deadend: "#f7768e",
  return: "#9ece6a",
};
const KIND_MARK = {
  root: "●",
  continuation: "◇",
  pivot: "↳",
  deadend: "✗",
  return: "↩",
};

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}

function fmtTs(ts) {
  return ts ? ts.replace("T", " ").slice(0, 19) : "";
}

function shortSummary(node) {
  if (node.summary) return node.summary;
  const t = (node.raw_meta?.user_prompt_preview || "").trim();
  const words = t.split(/\s+/);
  return words.length > 15 ? words.slice(0, 15).join(" ") + "…" : t || "(empty)";
}

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

// --- router

function parseHash() {
  const h = location.hash || "#/";
  const m = h.match(/^#\/goal\/([^/?]+)/);
  if (m) return { name: "goal", goalId: m[1] };
  return { name: "home" };
}

async function route() {
  const r = parseHash();
  if (r.name === "home") {
    crumbs.innerHTML = "";
    return renderHome();
  }
  if (r.name === "goal") {
    state.goalId = r.goalId;
    crumbs.innerHTML = '<a href="#/">goals</a> / <span></span>';
    return renderGoal();
  }
}
window.addEventListener("hashchange", route);

// --- home

async function renderHome() {
  view.innerHTML = "";
  const wrap = el("div", { class: "goals-page" });
  wrap.appendChild(el("h1", {}, "Goals"));
  let data;
  try {
    data = await fetchJson("/api/goals");
  } catch (e) {
    view.appendChild(el("div", { class: "empty" }, `error: ${e.message}`));
    return;
  }
  if (!data.goals.length) {
    wrap.appendChild(el("div", { class: "empty" }, "no goals yet — start a conversation in Claude Code with the journey plugin installed"));
    view.appendChild(wrap);
    return;
  }
  const sorted = [...data.goals].sort((a, b) =>
    b.last_active_at.localeCompare(a.last_active_at),
  );
  const activeId = sorted[0].id;
  const list = el("div", { class: "goals-list" });
  for (const g of sorted) {
    const card = el(
      "a",
      {
        class: "goal-card" + (g.id === activeId ? " active" : ""),
        href: `#/goal/${g.id}`,
      },
      [
        el("div", { class: "title" }, [
          g.title,
          el("div", { class: "stats" }, `${g.id} · ${fmtTs(g.last_active_at)}`),
        ]),
        el(
          "div",
          { class: "stats" },
          `${g.node_count} nodes · ${g.branch_count} pivots · ${g.deadend_count} dead-ends`,
        ),
        el("span", { class: "badge" }, g.id === activeId ? "active" : g.status),
      ],
    );
    list.appendChild(card);
  }
  wrap.appendChild(list);
  view.appendChild(wrap);

  for (const g of sorted) {
    if (g.title === "(untitled goal)" && g.node_count > 0) {
      fetch(`/api/goals/${g.id}/title`, { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.title) return;
          const card = list.querySelector(`a[href="#/goal/${g.id}"] .title`);
          if (card) {
            card.firstChild.textContent = d.title;
          }
        })
        .catch(() => {});
    }
  }
}

// --- goal view

async function renderGoal() {
  view.innerHTML = "";
  let meta, tree;
  try {
    [meta, tree] = await Promise.all([
      fetchJson(`/api/goals/${state.goalId}/meta`),
      fetchJson(`/api/goals/${state.goalId}/tree`),
    ]);
  } catch (e) {
    view.appendChild(el("div", { class: "empty" }, `error: ${e.message}`));
    return;
  }
  crumbs.querySelector("span").textContent = meta.title;

  const page = el("div", { class: "goal-page" });
  const toolbar = el("div", { class: "toolbar" }, [
    el("h2", {}, meta.title),
    el(
      "span",
      { class: "stats" },
      `${tree.nodes.length} nodes · ${meta.branch_count} pivots · ${meta.deadend_count} dead-ends`,
    ),
    el("div", { class: "tabs" }, [
      tabBtn("mindmap", "Mindmap"),
      tabBtn("timeline", "Timeline"),
    ]),
  ]);
  page.appendChild(toolbar);

  const body = el("div", { class: "canvas-wrap" + (state.selectedNodeId ? "" : " no-detail") });
  page.appendChild(body);
  view.appendChild(page);

  if (state.tab === "mindmap") {
    const cyHost = el("div", { id: "cy" });
    body.appendChild(cyHost);
    renderMindmap(cyHost, tree);
  } else {
    const tl = renderTimeline(tree);
    body.appendChild(tl);
  }

  if (state.selectedNodeId) {
    const node = tree.nodes.find((n) => n.id === state.selectedNodeId);
    if (node) body.appendChild(renderDetail(node));
  }

  fillSummariesLazy(tree);
}

const summaryInflight = new Set();
async function fillSummariesLazy(tree) {
  const need = tree.nodes.filter((n) => !n.summary);
  const concurrency = 3;
  const queue = [...need];
  async function worker() {
    while (queue.length) {
      const n = queue.shift();
      const key = `${state.goalId}:${n.id}`;
      if (summaryInflight.has(key)) continue;
      summaryInflight.add(key);
      try {
        const r = await fetch(`/api/nodes/${n.id}/summary`, {
          method: "POST",
          headers: { "x-goal-id": state.goalId },
        });
        if (!r.ok) continue;
        const { summary } = await r.json();
        if (!summary) continue;
        n.summary = summary;
        if (state.cy) {
          const el = state.cy.getElementById(n.id);
          if (el && el.length) el.data("label", summary);
        }
        const tlText = document.querySelector(`.timeline-row[data-node="${n.id}"] .text-label`);
        if (tlText) tlText.textContent = summary;
      } catch {} finally {
        summaryInflight.delete(key);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

function tabBtn(name, label) {
  return el(
    "button",
    {
      class: "tab" + (state.tab === name ? " active" : ""),
      onclick: () => {
        state.tab = name;
        renderGoal();
      },
    },
    label,
  );
}

function frontierId(nodes) {
  const live = nodes.filter((n) => n.kind !== "deadend");
  return live[live.length - 1]?.id;
}

function renderMindmap(host, tree) {
  const front = frontierId(tree.nodes);
  const elements = [];
  for (const n of tree.nodes) {
    elements.push({
      data: {
        id: n.id,
        label: shortSummary(n),
        kind: n.kind,
        frontier: n.id === front,
      },
    });
    if (n.parent_id) {
      elements.push({ data: { source: n.parent_id, target: n.id } });
    }
  }
  state.cy = cytoscape({
    container: host,
    elements,
    wheelSensitivity: 0.2,
    style: [
      {
        selector: "node",
        style: {
          "background-color": (e) => KIND_COLOR[e.data("kind")] || "#7aa2f7",
          label: "data(label)",
          color: "#e6e8ee",
          "font-size": "11px",
          "font-family": "ui-sans-serif, system-ui, sans-serif",
          "text-valign": "center",
          "text-halign": "right",
          "text-margin-x": 8,
          "text-wrap": "wrap",
          "text-max-width": 220,
          width: 14,
          height: 14,
          "border-width": 0,
        },
      },
      {
        selector: 'node[kind = "root"]',
        style: { width: 22, height: 22, "font-weight": 600 },
      },
      {
        selector: 'node[kind = "deadend"]',
        style: {
          "background-color": "#f7768e",
          shape: "diamond",
          opacity: 0.5,
          color: "#8b91a0",
        },
      },
      {
        selector: 'node[kind = "pivot"]',
        style: { shape: "triangle", "background-color": "#e0af68" },
      },
      {
        selector: "node[?frontier]",
        style: {
          "border-width": 3,
          "border-color": "#9ece6a",
          "border-opacity": 1,
        },
      },
      {
        selector: "edge",
        style: {
          width: 1.5,
          "line-color": "#2a2e38",
          "curve-style": "bezier",
          "target-arrow-shape": "none",
        },
      },
      {
        selector: ":selected",
        style: {
          "border-width": 3,
          "border-color": "#7aa2f7",
        },
      },
    ],
    layout: {
      name: "breadthfirst",
      directed: true,
      spacingFactor: 1.4,
      padding: 30,
    },
  });

  state.cy.on("tap", "node", (evt) => {
    state.selectedNodeId = evt.target.id();
    renderGoal();
  });
  state.cy.on("tap", (evt) => {
    if (evt.target === state.cy) {
      state.selectedNodeId = null;
      renderGoal();
    }
  });
}

function renderTimeline(tree) {
  const wrap = el("div", { class: "timeline" });
  const sorted = [...tree.nodes].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  for (const n of sorted) {
    const row = el(
      "div",
      {
        class: "timeline-row" + (n.kind === "deadend" ? " deadend" : ""),
        "data-node": n.id,
      },
      [
        el("div", { class: "ts" }, fmtTs(n.timestamp)),
        el(
          "div",
          {
            class: "mark",
            style: `color:${KIND_COLOR[n.kind] || "#7aa2f7"}`,
          },
          KIND_MARK[n.kind] || "·",
        ),
        el(
          "div",
          {
            class: "text",
            onclick: () => {
              state.selectedNodeId = n.id;
              renderGoal();
            },
          },
          [
            el("span", { class: "text-label" }, shortSummary(n)),
            n.deadend_reason
              ? el("span", { class: "reason" }, "reason: " + n.deadend_reason)
              : null,
          ],
        ),
      ],
    );
    wrap.appendChild(row);
  }
  return wrap;
}

function renderDetail(node) {
  const d = el("div", { class: "detail" });
  d.appendChild(
    el(
      "button",
      {
        class: "close",
        onclick: () => {
          state.selectedNodeId = null;
          renderGoal();
        },
      },
      "×",
    ),
  );
  d.appendChild(el("h3", {}, "Node"));
  d.appendChild(
    el("div", { class: "kv" }, [el("b", {}, "kind: "), node.kind]),
  );
  d.appendChild(
    el("div", { class: "kv" }, [el("b", {}, "id: "), node.id]),
  );
  d.appendChild(
    el("div", { class: "kv" }, [
      el("b", {}, "time: "),
      fmtTs(node.timestamp),
    ]),
  );
  d.appendChild(
    el("div", { class: "kv" }, [
      el("b", {}, "conv: "),
      node.conversation_id || "—",
    ]),
  );
  if (node.pivot_signal)
    d.appendChild(
      el("div", { class: "kv" }, [
        el("b", {}, "signal: "),
        node.pivot_signal,
      ]),
    );
  if (node.deadend_reason)
    d.appendChild(el("div", { class: "reason" }, node.deadend_reason));
  d.appendChild(el("h3", { style: "margin-top:1rem" }, "Prompt"));
  d.appendChild(
    el("div", { class: "preview" }, node.raw_meta?.user_prompt_preview || "(none)"),
  );
  return d;
}

// --- SSE

function subscribe() {
  const es = new EventSource("/api/events");
  es.addEventListener("hello", () => {
    sseDot.classList.add("live");
  });
  es.addEventListener("store_changed", () => {
    sseDot.classList.add("live");
    route();
  });
  es.onerror = () => {
    sseDot.classList.remove("live");
  };
}

route();
subscribe();
