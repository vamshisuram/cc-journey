async function loadGoals() {
  const res = await fetch("/api/goals");
  const data = await res.json();
  document.getElementById("goals").textContent = JSON.stringify(data, null, 2);
}

function subscribe() {
  const es = new EventSource("/api/events");
  const log = document.getElementById("events");
  let lines = [];
  es.addEventListener("hello", (e) => {
    lines.unshift(`[hello] ${e.data}`);
    log.textContent = lines.join("\n");
  });
  es.addEventListener("store_changed", (e) => {
    lines.unshift(`[${new Date().toISOString().slice(11, 19)}] ${e.data}`);
    if (lines.length > 50) lines = lines.slice(0, 50);
    log.textContent = lines.join("\n");
    loadGoals();
  });
  es.onerror = () => {
    lines.unshift("[error] connection lost — retrying…");
    log.textContent = lines.join("\n");
  };
}

loadGoals();
subscribe();
