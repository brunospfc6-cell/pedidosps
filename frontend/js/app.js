const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const app = $("#app");

let me = null;
let toastT;

function toast(msg, err = false) {
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 3200);
}

function brl(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function usd(v) {
  return Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function moneyBR(v) {
  const n = Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<span class="money"><span class="sym">R$</span><span class="amt">${n}</span></span>`;
}
function moneyUSD(v) {
  const n = Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<span class="money"><span class="sym">US$</span><span class="amt">${n}</span></span>`;
}
function dateBR(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
const CONTACT_ORIGINS = [
  "Fale Conosco (site)",
  "Contato(e-mail)",
  "Lig. Cliente",
  "Evento Físico",
  "Indic. Clientes",
  "Indic. Parceiros",
  "LC",
  "Mailing RD MKT",
  "Linkedln",
  "Google Ads",
  "Instagram",
  "Facebook",
  "TLMKT",
  "Visitas",
  "Webinar",
  "Grupo WhastsAPP",
];
function paymentTermsOf(o) {
  if (o?.payment_terms) return o.payment_terms;
  if (o?.payment_term_days) return `${o.payment_term_days} dias`;
  return "";
}
function isProrata(o) {
  return o?.prorata === 1 || o?.prorata === true || o?.prorata === "1";
}
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&#39;");
}

async function api(path, opts = {}) {
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const headers = isForm ? { ...(opts.headers || {}) } : { "Content-Type": "application/json", ...(opts.headers || {}) };
  const res = await fetch(path, {
    credentials: "include",
    headers,
    ...opts,
    body: opts.body ? (isForm ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  if (res.status === 401) {
    me = null;
    if (!location.hash.startsWith("#/login")) location.hash = "#/login";
    throw new Error("Faça login.");
  }
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : await res.blob();
  if (!res.ok) {
    const detail = data && data.detail;
    const msg = typeof detail === "string" ? detail : detail?.[0]?.msg || "Erro na requisição";
    throw new Error(msg);
  }
  return data;
}

function badge(status) {
  const map = {
    rascunho: ["Rascunho", ""],
    pendente_envio: ["Pendente Envio à PARS", "warn"],
    enviado_pars: ["Enviado à PARS", "ok"],
    cancelado: ["Cancelado", "danger"],
    aberto: ["Aberto", "ok"],
    governo: ["Governo", ""],
    privado: ["Privado", ""],
  };
  const [label, cls] = map[status] || [status, ""];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function nav() {
  const items = [
    ["#/", "Início"],
    ["#/odc", "Ordens de Compra"],
    ["#/vendas", "Pedidos de Venda"],
    ["#/clientes", "Clientes"],
    ["#/creditos", "Crédito Pars"],
  ];
  if (me.role === "administrador") {
    items.push(["#/produtos", "Produtos e Preços"], ["#/atualizacoes", "Atualizações"], ["#/usuarios", "Usuários"]);
  }
  if (me.role === "administrador" || me.role === "diretor") items.push(["#/gestao", "Gestão e Análise"]);
  const hash = location.hash || "#/";
  return items
    .map(([href, label]) => {
      const active = href === "#/" ? hash === "#/" : hash.startsWith(href);
      return `<a href="${href}" class="${active ? "active" : ""}">${label}</a>`;
    })
    .join("");
}

function shell(html) {
  return `<div class="shell">
    <div class="nav-scrim" id="scrim"></div>
    <aside class="sidebar">
      <div class="brand"><div class="logo-wrap"><img src="/static/img/logo-prosystems.png" alt="Pro-Systems"></div></div>
      <nav class="nav">${nav()}</nav>
      <div class="side-user">${esc(me.name)}<br><small>${esc(me.role_label)}</small></div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="row-actions">
          <button class="btn ghost sm menu-btn" id="menu" type="button">Menu</button>
          <img class="top-logo" src="/static/img/logo-prosystems.png" alt="Pro-Systems">
          <span class="muted hide-sm">Controle de Compras e Vendas</span>
        </div>
        <div class="row-actions">
          <span class="badge">${esc(me.role_label)}</span>
          ${me.role === "administrador" ? `<a class="btn outline sm" href="#/atualizacoes">Atualizar Sistema</a>` : ""}
          <button class="btn ghost sm" id="logout">Sair</button>
        </div>
      </header>
      <div class="content">${html}</div>
    </div>
  </div>`;
}

function head(title, desc, actions = "") {
  return `<div class="page-head"><div><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ""}</div><div class="row-actions">${actions}</div></div>`;
}

async function route() {
  try {
    if (!me) {
      try {
        me = await api("/api/auth/me");
      } catch {
        me = null;
      }
    }
    const hash = location.hash || "#/";
    if (!me && hash !== "#/login") {
      location.hash = "#/login";
      return;
    }
    if (hash === "#/login") return renderLogin();
    if (hash === "#/" || hash === "") return renderHome();
    if (hash === "#/odc") return renderOdcList();
    if (hash === "#/odc/nova") return renderOdcForm();
    if (hash.startsWith("#/odc/")) return renderOdcForm(hash.split("/")[2]);
    if (hash === "#/vendas") return renderSalesList();
    if (hash.startsWith("#/vendas/nova")) return renderSalesForm();
    if (hash.startsWith("#/vendas/")) return renderSalesForm(null, hash.split("/")[2]);
    if (hash === "#/clientes") return renderClients();
    if (hash === "#/creditos") return renderCredits();
    if (hash === "#/produtos") return renderProducts();
    if (hash === "#/atualizacoes") return renderUpdates();
    if (hash === "#/usuarios") return renderUsers();
    if (hash === "#/gestao") return renderGestao();
    app.innerHTML = shell("<p>Página não encontrada.</p>");
  } catch (err) {
    toast(err.message, true);
  }
}

function bindShell() {
  $("#logout")?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: {} });
    me = null;
    location.hash = "#/login";
  });
  $("#menu")?.addEventListener("click", () => document.body.classList.toggle("nav-open"));
  $("#scrim")?.addEventListener("click", () => document.body.classList.remove("nav-open"));
  $$(".nav a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("nav-open")));
}

function renderLogin() {
  app.innerHTML = `<div class="login">
    <section class="login-art">
      <div class="logo-wrap" style="background:#fff;padding:8px 10px;border-radius:8px;width:fit-content">
        <img src="/static/img/logo-prosystems.png" alt="Pro-Systems" style="height:44px">
      </div>
      <div>
        <h2>Controle de Compras<br>e Vendas Autodesk.</h2>
        <p class="muted" style="color:#8b959e;margin-top:12px">Ordens de Compra, Pedidos de Venda, créditos Pars e gestão comercial.</p>
      </div>
      <p style="font-size:12px;color:#8b959e">Pro-Systems Informática LTDA · CNPJ 03.620.200/0001-35 · Brasília/DF</p>
    </section>
    <section class="login-form">
      <form class="login-box" id="f">
        <p class="muted">Acesso</p>
        <h1 style="font-size:32px;margin:4px 0 8px">Entrar</h1>
        <p class="muted" style="margin-bottom:18px">Use o login definido pelo administrador.</p>
        <div class="field" style="margin-bottom:10px"><label>E-mail / Login</label><input name="email" type="email" required value="olivia.t@example.org"></div>
        <div class="field" style="margin-bottom:14px"><label>Senha</label><input name="password" type="password" required value="Admin@123"></div>
        <button class="btn primary" style="width:100%">Entrar</button>
        <p class="muted" style="margin-top:16px">Acesso de teste: olivia.t@example.org / Admin@123</p>
      </form>
    </section>
  </div>`;
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      me = await api("/api/auth/login", { method: "POST", body: { email: fd.get("email"), password: fd.get("password") } });
      location.hash = "#/";
    } catch (err) {
      toast(err.message, true);
    }
  };
}

async function renderHome() {
  const d = await api("/api/dashboard");
  const rows = (d.recent || [])
    .map(
      (o) => `<tr>
        <td class="mono"><a href="#/odc/${o.id}">${esc(o.number)}</a></td>
        <td>${esc(o.client_name || "—")}</td>
        <td>${dateBR(o.order_date)}</td>
        <td>${badge(o.status)}</td>
        <td class="num">${brl(o.net_total_brl)}</td>
      </tr>`,
    )
    .join("");
  app.innerHTML = shell(`
    ${head("Painel", "Acompanhe ordens de compra, envios à PARS e o saldo de Crédito Pars.", `<a class="btn primary" href="#/odc/nova">Nova Ordem de Compra</a>`)}
    <div class="grid g4">
      <div class="card stat"><small>Ordens de Compra</small><strong>${d.odc_count}</strong></div>
      <div class="card stat"><small>Pendente PARS</small><strong>${d.pending_pars}</strong></div>
      <div class="card stat"><small>Vendas</small><strong>${brl(d.sales_total)}</strong></div>
      <div class="card stat"><small>Saldo Crédito Pars</small><strong>${brl(d.credits.remaining)}</strong></div>
    </div>
    <h2 style="margin:28px 0 12px;font-size:22px">Pedidos Recentes</h2>
    <div class="card"><div class="bd" style="padding:0">
      ${
        rows
          ? `<table class="data"><thead><tr><th>Número</th><th>Cliente</th><th>Data</th><th>Status</th><th class="num">Líquido</th></tr></thead><tbody>${rows}</tbody></table>`
          : `<p class="empty">Nenhuma ordem ainda. Crie a primeira ODC.</p>`
      }
    </div></div>
  `);
  bindShell();
}

async function renderOdcList() {
  const rows = await api("/api/odc");
  const body = rows.length
    ? `<table class="data"><thead><tr><th>Número</th><th>Cliente</th><th>Tipo</th><th>Data</th><th>Status</th><th class="num">Líquido</th><th>Ação</th></tr></thead><tbody>
      ${rows
        .map(
          (o) => `<tr>
            <td class="mono"><a href="#/odc/${o.id}">${esc(o.number)}</a></td>
            <td>${esc(o.client_name || "—")}</td>
            <td>${o.client_type === "governo" ? "Governo" : "Privado"}</td>
            <td>${dateBR(o.order_date)}</td>
            <td>${badge(o.status)}</td>
            <td class="num">${brl(o.net_total_brl)}</td>
            <td><a class="btn outline sm" href="#/odc/${o.id}">Abrir</a></td>
          </tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="empty">Nenhuma ordem cadastrada.</p>`;
  app.innerHTML = shell(`
    ${head("Ordens de Compra", "Após finalizar, confirme o envio à PARS. Depois de confirmado, o pedido não pode mais ser alterado.", `<a class="btn primary" href="#/odc/nova">Nova ODC</a>`)}
    <div class="card"><div class="bd" style="padding:0">${body}</div></div>
  `);
  bindShell();
}

function productPicker(id, products) {
  return `<div class="picker" data-picker="${id}">
    <input class="pq" placeholder="Buscar SKU, produto ou linha…" autocomplete="off">
    <input type="hidden" class="pid">
  </div>`;
}

function attachPickers(root, products, saleKind) {
  $$(".picker", root).forEach((wrap) => {
    const input = $(".pq", wrap);
    const hid = $(".pid", wrap);
    let list;
    function close() {
      list?.remove();
      list = null;
    }
    function open() {
      close();
      const q = input.value.trim().toLowerCase();
      const nfr = q.includes("nfr") || q.includes("resale");
      let rows = products.filter((p) => p.active);
      if (!nfr) rows = rows.filter((p) => p.usage_type !== "Not For Resale");
      if (!q) {
        const lic = (p) => (p.license_type || "").toLowerCase();
        if (saleKind === "renovacao") rows = rows.filter((p) => lic(p).includes("renewal"));
        else if (saleKind === "nova") rows = rows.filter((p) => lic(p).includes("new") || lic(p).includes("switch"));
      } else {
        rows = rows.filter((p) =>
          `${p.name} ${p.sku} ${p.product_line} ${p.sap_name} ${p.license_type}`.toLowerCase().includes(q),
        );
      }
      rows = rows.slice(0, 80);
      list = document.createElement("div");
      list.className = "picker-list";
      const r = input.getBoundingClientRect();
      list.style.left = r.left + "px";
      list.style.top = r.bottom + 4 + "px";
      list.style.width = Math.max(r.width, 360) + "px";
      list.innerHTML = rows.length
        ? rows
            .map(
              (p) =>
                `<button type="button" data-id="${p.id}"><strong>${esc(p.name)}</strong><br><span class="mono muted">${esc(p.sku)} · ${esc(p.product_line)} · ${usd(p.list_price_usd)}</span></button>`,
            )
            .join("")
        : `<p class="muted" style="padding:12px">Nenhum SKU encontrado na tabela vigente.</p>`;
      document.body.appendChild(list);
      $$("button", list).forEach((b) => {
        b.onmousedown = (e) => e.preventDefault();
        b.onclick = () => {
          const p = products.find((x) => String(x.id) === b.dataset.id);
          hid.value = p.id;
          input.value = p.product_line || p.name;
          wrap.dataset.sku = p.sku;
          wrap.dataset.name = p.name;
          wrap.dataset.catalogPrice = p.list_price_usd;
          wrap.dataset.price = p.list_price_usd;
          const tr = wrap.closest("tr");
          const priceInp = tr?.querySelector(".unit-usd");
          if (priceInp) priceInp.value = p.list_price_usd;
          let hint = wrap.querySelector("p.mono");
          if (!hint) {
            hint = document.createElement("p");
            hint.className = "mono muted";
            wrap.appendChild(hint);
          }
          hint.textContent = p.sku + " · " + usd(p.list_price_usd);
          wrap.dispatchEvent(new Event("picked", { bubbles: true }));
          close();
        };
      });
    }
    input.onfocus = () => {
      input.value = "";
      open();
    };
    input.oninput = open;
    document.addEventListener("mousedown", (e) => {
      if (!wrap.contains(e.target) && !list?.contains(e.target)) close();
    });
  });
}

async function renderOdcForm(id) {
  const [suppliers, products, credits, next] = await Promise.all([
    api("/api/suppliers"),
    api("/api/products"),
    api("/api/credits"),
    id ? null : api("/api/odc/next"),
  ]);
  const existing = id ? await api(`/api/odc/${id}`) : null;
  if (id && !existing) return toast("Ordem não encontrada", true);

  if (!existing) {
    app.innerHTML = shell(`
      ${head("Nova Ordem de Compra", "Informe o tipo de cliente. Governo gera crédito Pars; os dois tipos podem utilizar saldo já habilitado.")}
      <div class="grid g2" style="max-width:720px">
        <button class="choice" id="gov"><h2>Governo</h2><p class="muted">Gera crédito Pars (≥ 8% sobre lista) e pode utilizar saldo.</p></button>
        <button class="choice" id="priv"><h2>Privado</h2><p class="muted">Não gera crédito. Pode utilizar saldo Pars habilitado.</p></button>
      </div>`);
    bindShell();
    $("#gov").onclick = () => startOdc("governo");
    $("#priv").onclick = () => startOdc("privado");
    return;
  }
  drawOdc(existing, suppliers, products, credits);

  function startOdc(clientType) {
    drawOdc(
      {
        client_type: clientType,
        number: next.number,
        order_date: today(),
        supplier_id: suppliers[0]?.id,
        sale_kind: "nova",
        dollar_rate: "5.20",
        discount_pct: 0,
        hubgov_credit_pct: clientType === "governo" ? 8 : 0,
        license_delivery: "imediato",
        payment_term_days: 30,
        credit_used: 0,
        items: [{}],
        status: "rascunho",
      },
      suppliers,
      products,
      credits,
    );
  }
}

function drawOdc(o, suppliers, products, credits) {
  const locked = o.status === "enviado_pars" || o.status === "cancelado";
  const gov = o.client_type === "governo";
  const items = o.items?.length ? o.items : [{}];
  app.innerHTML = shell(`
    ${o.id ? badge(o.status) : ""}
    ${
      o.status === "pendente_envio"
        ? `<div class="banner warn"><div><strong>Ordem Finalizada — Confirme o Envio</strong><p class="muted">Depois de confirmar, o pedido não poderá mais ser alterado.</p>
           <div class="row-actions" style="margin-top:8px"><button class="btn primary" id="send">Confirmar Envio à PARS</button>
           <a class="btn secondary" href="#/vendas/nova?odc=${o.id}">Ir para Pedido de Venda</a></div></div></div>`
        : ""
    }
    ${o.status === "cancelado" ? `<div class="banner danger"><div><strong>Ordem de Compra Cancelada</strong><p class="muted">Este pedido não pode mais ser alterado.</p></div></div>` : ""}
    ${o.status === "enviado_pars" ? `<div class="banner"><div><strong>Envio à PARS Confirmado</strong><p class="muted">Esta ordem está bloqueada.</p>
      <div class="row-actions" style="margin-top:8px"><a class="btn secondary" href="#/vendas/nova?odc=${o.id}">Pedido de Venda</a>
      <a class="btn outline" href="/api/odc/${o.id}/word">Extrair Word</a></div></div></div>` : ""}
    <p class="muted">${gov ? "Cliente Governo · Gera e pode utilizar Crédito Pars" : "Cliente Privado · Não gera crédito · Pode utilizar Crédito Pars"}</p>
    <h1 style="margin:4px 0 18px">${o.id ? "Ordem de Compra " + esc(o.number) : "Nova Ordem de Compra"}</h1>
    <fieldset ${locked ? "disabled" : ""}>
    <form id="odc">
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>1. Dados Básicos</h3></div><div class="bd grid g3">
        <div class="field"><label>Número do Pedido</label><input value="${esc(o.number || "")}" disabled></div>
        <div class="field"><label>Data do Pedido</label><input name="order_date" type="date" value="${esc(o.order_date || today())}"></div>
        <div class="field"><label>Fornecedor</label><select name="supplier_id">${suppliers
          .map((s) => `<option value="${s.id}" ${s.id == o.supplier_id ? "selected" : ""}>${esc(s.name)}</option>`)
          .join("")}</select></div>
        <div class="field"><label>Tipo da Venda</label><select name="sale_kind">
          <option value="nova" ${o.sale_kind === "nova" ? "selected" : ""}>Novas Licenças</option>
          <option value="renovacao" ${o.sale_kind === "renovacao" ? "selected" : ""}>Renovação de Licenças</option>
        </select></div>
      </div></div>
      <div class="card" style="margin-bottom:16px"><div class="hd" style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
        <div><h3>2. Produtos Autodesk</h3><p class="muted">Tabela vigente Setembro 2026. Busque pelo SKU ou nome.</p></div>
        <label class="btn outline sm" style="cursor:pointer"><input type="checkbox" name="prorata" id="prorata" ${isProrata(o) ? "checked" : ""} style="width:auto;margin:0"> Pro-rata</label>
      </div>
      <div class="bd">
        <table class="data" id="items"><thead><tr><th>Produto</th><th>Qtd</th><th class="money-h">Unit. USD</th><th class="money-h">Unit. R$</th><th></th></tr></thead>
        <tbody>${items.map((it) => itemRow(it, isProrata(o), Number(o.dollar_rate || 0), !locked)).join("")}</tbody></table>
        ${locked ? "" : `<button type="button" class="btn outline" id="add">Adicionar Produto</button>`}
        <div class="grid g3" style="margin-top:16px">
          <div class="field"><label>Dólar do Dia (R$)</label><input name="dollar_rate" type="number" step="0.0001" value="${o.dollar_rate || ""}"></div>
          <div class="field"><label>Condição de Pagamento</label><input name="payment_terms" placeholder="Ex.: 30 dias, à vista, 15/30/45" value="${esc(paymentTermsOf(o) || "30 dias")}"></div>
          <div class="field"><label>Entrega das Licenças</label><select name="license_delivery">
            <option value="imediato">Imediato</option>
            <option value="agendada" ${o.license_delivery === "agendada" ? "selected" : ""}>Escolher Data de Ativação</option>
          </select></div>
          <div class="field" id="actWrap" style="${o.license_delivery === "agendada" ? "" : "display:none"}"><label>Data de Ativação</label><input name="activation_date" type="date" value="${esc(o.activation_date || "")}"></div>
          <div class="field"><label>Percentual de Desconto</label><input name="discount_pct" type="number" step="0.01" value="${o.discount_pct || 0}"></div>
          ${
            gov
              ? `<div class="field"><label>Percentual de Crédito Pars Gerado</label><input name="hubgov_credit_pct" type="number" step="0.01" value="${o.hubgov_credit_pct || 8}"></div>
                 <div class="field"><label>NF que gerou o crédito</label><input name="generated_nf" placeholder="Nota fiscal desta venda" value="${esc(o.generated_nf || o.hubgov?.nf_number || "")}"></div>`
              : `<input type="hidden" name="hubgov_credit_pct" value="0">`
          }
          <div class="field"><label>Valor do Crédito Utilizado (R$)</label><input name="credit_used" type="number" step="0.01" value="${o.credit_used || 0}"></div>
          <div class="field"><label>NF do crédito utilizado</label>
            <input name="credit_nf" list="nfs-disp" value="${esc(o.credit_nf || "")}">
            <datalist id="nfs-disp">${(credits.available || []).map((c) => `<option value="${esc(c.nf)}">${esc(c.nf)} · ${brl(c.remaining)}</option>`).join("")}</datalist>
            <p class="muted" style="margin:4px 0 0">Disponível para uso: ${brl(credits.summary?.remaining || 0)}${(credits.summary?.pending || 0) > 0 ? ` · Pendente de habilitação: ${brl(credits.summary.pending)}` : ""}</p>
          </div>
        </div>
        <div class="card" style="margin-top:14px;background:var(--accent)"><div class="bd" id="totais"></div></div>
      </div></div>
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>3. Dados do Cliente</h3></div><div class="bd grid g2">
        <div class="field"><label>CSN</label><input name="client_csn" value="${esc(o.client_csn || "")}"></div>
        <div class="field"><label>Nome</label><input name="client_name" value="${esc(o.client_name || "")}"></div>
        <div class="field"><label>CNPJ / CPF</label><input name="client_document" value="${esc(o.client_document || "")}"></div>
        <div class="field"><label>E-mail</label><input name="client_email" value="${esc(o.client_email || "")}"></div>
        <div class="field"><label>Nome do Gestor</label><input name="client_manager" value="${esc(o.client_manager || "")}"></div>
        <div class="field"><label>Telefone</label><input name="client_phone" value="${esc(o.client_phone || "")}"></div>
        <div class="field" id="renWrap" style="${o.sale_kind === "renovacao" ? "" : "display:none"}"><label>Contratos Renovados</label><input name="renewal_contracts" value="${esc(o.renewal_contracts || "")}"></div>
        <div class="field" style="grid-column:1/-1"><label>Observações</label><textarea name="notes">${esc(o.notes || "")}</textarea></div>
      </div></div>
      ${
        gov
          ? ""
          : ""
      }
      ${
        o.client_type
          ? `<div class="card" style="margin-bottom:16px"><div class="hd"><h3>Faturamento e Cobrança</h3></div>
        <div class="bd muted"><p style="color:var(--fg);font-weight:600;margin:0">Pro-Systems Informática LTDA</p>
        <p>SRTV/Sul Quadra 701, Palácio do Rádio I, N° 130 SL 209<br>CEP 70340-901 — Brasília/DF<br>CNPJ: 03.620.200/0001-35 · IE: 07.310.608/001-13 · Fone: 61-3202.2666</p></div></div>`
          : ""
      }
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Assinatura</h3></div>
        <div class="bd"><div class="sig"><div class="id">Diretor<br>Pro-Systems Informática Ltda.<br>CNPJ 03.620.200/0001-35</div></div></div></div>
    </form>
    </fieldset>
    ${
      me.role === "administrador" && gov && o.hubgov
        ? `<div class="card" style="margin:16px 0" id="hubgov-box">
            <div class="hd"><h3>Gestão do crédito gerado</h3>
              <p class="muted">${o.hubgov.enabled ? "Habilitado para uso." : "Pendente — não entra no saldo até o administrador habilitar."}</p>
            </div>
            <div class="bd grid g3">
              <div class="field"><label>NF que gerou o crédito</label><input id="hg-nf" value="${esc(o.hubgov.nf_number || o.generated_nf || "")}"></div>
              <div class="field"><label>Corrigir valor gerado (R$)</label><input id="hg-amt" type="number" step="0.01" value="${o.hubgov.amount || o.credit_generated || 0}"></div>
              <div style="display:flex;align-items:end;gap:8px;flex-wrap:wrap">
                ${o.hubgov.enabled ? "" : `<button type="button" class="btn primary" id="hg-enable">Habilitar para uso</button>`}
                <button type="button" class="btn outline" id="hg-correct">Corrigir crédito gerado</button>
              </div>
            </div>
          </div>`
        : ""
    }
    <div class="row-actions" style="padding-bottom:40px">
      ${locked ? (o.id ? `<a class="btn outline" href="/api/odc/${o.id}/word">Extrair Word</a>` : "") : `
        <button class="btn outline" id="draft">Salvar Rascunho</button>
        <button class="btn primary" id="fin">Finalizar</button>
      `}
      ${o.id && o.status !== "cancelado" ? `<button class="btn danger" id="cancel">Cancelar ODC</button>` : ""}
      ${o.id && o.status === "pendente_envio" ? `<a class="btn outline" href="/api/odc/${o.id}/word">Extrair Word</a>` : ""}
    </div>
  `);
  bindShell();
  $("#hg-enable")?.addEventListener("click", async () => {
    try {
      await api(`/api/credits/${o.hubgov.id}/enable`, { method: "POST", body: { nf_number: $("#hg-nf").value } });
      toast("Crédito habilitado para uso.");
      route();
    } catch (e) {
      toast(e.message, true);
    }
  });
  $("#hg-correct")?.addEventListener("click", async () => {
    try {
      await api(`/api/credits/${o.hubgov.id}/correct`, {
        method: "POST",
        body: { amount: Number($("#hg-amt").value), nf_number: $("#hg-nf").value },
      });
      toast("Crédito gerado corrigido.");
      route();
    } catch (e) {
      toast(e.message, true);
    }
  });
  attachPickers(app, products, o.sale_kind);
  const form = $("#odc");
  form.sale_kind.onchange = () => {
    $("#renWrap").style.display = form.sale_kind.value === "renovacao" ? "" : "none";
  };
  form.license_delivery.onchange = () => {
    $("#actWrap").style.display = form.license_delivery.value === "agendada" ? "" : "none";
  };
  $("#add")?.addEventListener("click", () => {
    const tb = $("#items tbody");
    tb.insertAdjacentHTML("beforeend", itemRow({}, $("#prorata")?.checked, Number(form.dollar_rate.value || 0), true));
    attachPickers(tb.lastElementChild, products, form.sale_kind.value);
  });
  $("#items")?.addEventListener("click", (e) => {
    const b = e.target.closest(".rm");
    if (!b) return;
    b.closest("tr")?.remove();
    refreshTotals();
  });
  form.addEventListener("picked", (e) => {
    const wrap = e.target.closest(".picker");
    const tr = wrap.closest("tr");
    const price = Number(wrap.dataset.price || 0);
    const inp = $(".unit-usd", tr);
    if (inp) inp.value = price;
    const rate = Number(form.dollar_rate.value || 0);
    const brlEl = $(".unit-brl", tr);
    if (brlEl) brlEl.innerHTML = moneyBR(price * rate);
    refreshTotals();
  });
  form.client_csn?.addEventListener("blur", async () => {
    const csn = form.client_csn.value.trim();
    if (!csn) return;
    try {
      const c = await api("/api/clients/csn/" + encodeURIComponent(csn));
      form.client_name.value = c.name;
      form.client_document.value = c.document;
      form.client_email.value = c.email || "";
      form.client_manager.value = c.manager_name || "";
      form.client_phone.value = c.phone || "";
    } catch {}
  });
  async function collect(finalize) {
    const items = $$("#items tbody tr").map((tr) => {
      const p = $(".picker", tr);
      return {
        product_id: Number($(".pid", p).value) || null,
        product_name: p.dataset.name || $(".pq", p).value,
        sku: p.dataset.sku || "",
        qty: Number($(".qty", tr).value || 1),
        list_price_usd: Number($(".unit-usd", tr)?.value || p.dataset.price || 0),
      };
    }).filter((it) => it.product_name);
    const body = {
      id: o.id,
      order_date: form.order_date.value,
      supplier_id: Number(form.supplier_id.value),
      client_type: o.client_type,
      sale_kind: form.sale_kind.value,
      dollar_rate: Number(form.dollar_rate.value),
      discount_pct: Number(form.discount_pct.value || 0),
      hubgov_credit_pct: Number(form.hubgov_credit_pct?.value || 0),
      license_delivery: form.license_delivery.value,
      activation_date: form.activation_date?.value || null,
      payment_terms: form.payment_terms.value,
      prorata: $("#prorata")?.checked ? 1 : 0,
      credit_used: Number(form.credit_used?.value || 0),
      credit_nf: form.credit_nf?.value,
      generated_nf: form.generated_nf?.value,
      client_csn: form.client_csn.value,
      client_name: form.client_name.value,
      client_document: form.client_document.value,
      client_email: form.client_email.value,
      client_manager: form.client_manager.value,
      client_phone: form.client_phone.value,
      renewal_contracts: form.renewal_contracts?.value,
      notes: form.notes.value,
      finalize,
      items,
    };
    const saved = await api("/api/odc", { method: "POST", body });
    toast(finalize ? "Ordem finalizada." : "Rascunho salvo.");
    location.hash = "#/odc/" + saved.id;
  }
  $("#draft")?.addEventListener("click", () => collect(false).catch((e) => toast(e.message, true)));
  $("#fin")?.addEventListener("click", () => collect(true).catch((e) => toast(e.message, true)));
  $("#send")?.addEventListener("click", async () => {
    if (!confirm("Confirmar envio à PARS? A ordem não poderá mais ser alterada.")) return;
    try {
      await api(`/api/odc/${o.id}/send`, { method: "POST", body: {} });
      toast("Envio à PARS confirmado.");
      route();
    } catch (e) {
      toast(e.message, true);
    }
  });
  $("#cancel")?.addEventListener("click", async () => {
    if (!confirm("Cancelar esta ordem de compra?")) return;
    try {
      await api(`/api/odc/${o.id}/cancel`, { method: "POST", body: {} });
      toast("Ordem cancelada.");
      route();
    } catch (e) {
      toast(e.message, true);
    }
  });
  refreshTotals();
  form.addEventListener("input", refreshTotals);
  function syncProrata() {
    const on = $("#prorata")?.checked;
    $$("#items .unit-usd").forEach((inp) => {
      inp.disabled = !on;
      if (!on) {
        const cat = inp.closest("tr")?.querySelector(".picker")?.dataset.catalogPrice;
        if (cat) {
          inp.value = cat;
          const p = inp.closest("tr").querySelector(".picker");
          if (p) p.dataset.price = cat;
        }
      }
    });
    refreshTotals();
  }
  $("#prorata")?.addEventListener("change", syncProrata);
  syncProrata();
  async function refreshTotals() {
    const rate = Number(form.dollar_rate.value || 0);
    $$("#items tbody tr").forEach((tr) => {
      const u = Number($(".unit-usd", tr)?.value || 0);
      const el = $(".unit-brl", tr);
      if (el) el.innerHTML = moneyBR(u * rate);
    });
    const items = $$("#items tbody tr").map((tr) => ({
      qty: Number($(".qty", tr)?.value || 1),
      list_price_usd: Number($(".unit-usd", tr)?.value || $(".picker", tr)?.dataset.price || 0),
    }));
    try {
      const t = await api("/api/odc/calc", {
        method: "POST",
        body: {
          items,
          dollar_rate: rate,
          discount_pct: Number(form.discount_pct.value || 0),
          client_type: o.client_type,
          hubgov_credit_pct: Number(form.hubgov_credit_pct?.value || 0),
          credit_used: Number(form.credit_used?.value || 0),
        },
      });
      $("#totais").innerHTML = `<p>Lista: ${moneyUSD(t.list_total_usd)} → ${moneyBR(t.list_total_brl)}</p>
        <p>Desconto: − ${moneyBR(t.discount_amount)}</p>
        ${gov ? `<p>Crédito Pars gerado: ${moneyBR(t.credit_generated)}</p>` : ""}
        <p>Crédito utilizado: ${moneyBR(form.credit_used?.value || 0)}</p>
        <p><strong>Valor Final: ${moneyBR(t.net_total_brl)}</strong></p>`;
    } catch {}
  }
}

function itemRow(it = {}, prorata = false, rate = 0, canRemove = true) {
  const price = Number(it.list_price_usd || 0);
  return `<tr>
    <td><div class="picker" data-sku="${esc(it.sku || "")}" data-name="${esc(it.product_name || "")}" data-price="${it.list_price_usd || 0}" data-catalog-price="${it.list_price_usd || 0}">
      <input class="pq" placeholder="Buscar SKU, produto ou linha…" autocomplete="off" value="${esc(it.product_name || it.sku || "")}">
      <input type="hidden" class="pid" value="${it.product_id || ""}">
      ${it.sku ? `<p class="mono muted">${esc(it.sku)}</p>` : ""}
    </div></td>
    <td style="width:90px"><input class="qty" type="number" min="1" value="${it.qty || 1}"></td>
    <td class="money-cell" style="width:160px"><div class="money-input"><span class="sym">US$</span><input class="unit-usd" type="number" step="0.01" min="0" value="${it.list_price_usd || ""}" ${prorata ? "" : "disabled"}></div></td>
    <td class="money-cell unit-brl">${moneyBR(price * Number(rate || 0))}</td>
    <td style="width:44px">${canRemove ? `<button type="button" class="btn ghost sm rm" title="Remover produto">×</button>` : ""}</td>
  </tr>`;
}

async function renderSalesList() {
  const rows = await api("/api/vendas");
  const body = rows.length
    ? `<table class="data"><thead><tr><th>Número</th><th>ODC</th><th>Cliente</th><th>Origem</th><th>Tipo</th><th>Data</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>
      ${rows
        .map(
          (o) => `<tr>
          <td class="mono"><a href="#/vendas/${o.id}">${esc(o.number)}</a></td>
          <td class="mono">${esc(o.purchase_order_number)}</td>
          <td>${esc(o.client_name)}</td>
          <td>${esc(o.contact_origin || "—")}</td>
          <td>${o.client_type === "governo" ? "Governo" : "Privado"}</td>
          <td>${dateBR(o.order_date)}</td>
          <td>${badge(o.status)}</td>
          <td class="num">${brl(o.sale_total_brl)}</td>
        </tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="empty">Nenhum Pedido de Venda. Finalize uma ODC para iniciar.</p>`;
  app.innerHTML = shell(`${head("Pedidos de Venda", "Gerados a partir de uma ordem de compra finalizada.", `<a class="btn primary" href="#/vendas/nova">Novo Pedido de Venda</a>`)}<div class="card"><div class="bd" style="padding:0">${body}</div></div>`);
  bindShell();
}

async function renderSalesForm(unused, id) {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const odcId = params.get("odc");
  let existing = null;
  let odc;
  if (id) {
    existing = await api(`/api/vendas/${id}`);
    odc = await api(`/api/odc/${existing.purchase_order_id}`);
  } else if (odcId) {
    odc = await api(`/api/odc/${odcId}`);
  } else {
    const list = await api("/api/odc");
    const ready = list.filter((o) => o.status !== "rascunho" && o.status !== "cancelado");
    app.innerHTML = shell(`${head("Pedido de Venda", "Escolha uma ordem de compra finalizada.")}
      <div class="card"><div class="bd">${
        ready.length
          ? ready.map((o) => `<p><a href="#/vendas/nova?odc=${o.id}">${esc(o.number)} — ${esc(o.client_name)}</a></p>`).join("")
          : `<p class="muted">Nenhuma ODC finalizada.</p>`
      }</div></div>`);
    bindShell();
    return;
  }
  const locked = existing?.status === "cancelado" || odc.status === "cancelado";
  const rate = Number(odc.dollar_rate || 0);
  const odcBySku = Object.fromEntries((odc.items || []).map((it) => [it.sku || it.product_name, it]));
  const items = (existing?.items || odc.items || []).map((it) => {
    const src = odcBySku[it.sku] || odcBySku[it.product_name];
    const fromOdc = src ? Number(src.list_price_usd || 0) * rate : 0;
    const stored = it.unit_price_brl || (it.qty ? (it.line_total_brl || 0) / it.qty : 0);
    return {
      sku: it.sku,
      product_name: it.product_name,
      qty: it.qty,
      unit_price_brl: existing ? stored || fromOdc : fromOdc || stored,
    };
  });
  const liveMemo =
    `Lista USD ${usd(odc.list_total_usd)}\nCâmbio R$ ${rate.toFixed(4)}\nLíquido ${brl(odc.net_total_brl)}` +
    (odc.credit_used ? `\nCrédito utilizado ${brl(odc.credit_used)}` : "") +
    (odc.credit_generated ? `\nCrédito Pars gerado ${brl(odc.credit_generated)}` : "");
  app.innerHTML = shell(`
    ${existing ? badge(existing.status) : ""}
    <p class="muted">A partir da ${esc(odc.number)}</p>
    <h1 style="margin:4px 0 18px">${existing ? "Pedido de Venda " + esc(existing.number) : "Novo Pedido de Venda"}</h1>
    ${odc.status === "cancelado" ? `<div class="banner danger"><strong>Ordem de Compra Cancelada</strong></div>` : ""}
    ${odc.status === "pendente_envio" ? `<div class="banner warn"><strong>A ODC ainda está pendente de envio à PARS.</strong></div>` : ""}
    <fieldset ${locked ? "disabled" : ""}>
    <form id="pv">
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Cliente</h3></div><div class="bd">
        <p>${esc(odc.client_name)} · CSN ${esc(odc.client_csn)}</p>
        <p class="muted">${esc(odc.client_document)}</p>
      </div></div>
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Memória de Cálculo</h3></div>
        <div class="bd"><pre style="white-space:pre-wrap;font-family:inherit;margin:0">${esc(liveMemo)}</pre></div></div>
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Dados da Venda</h3></div><div class="bd grid g2">
        <div class="field"><label>Tipo de Cliente</label><select name="client_type">
          <option value="governo" ${odc.client_type === "governo" ? "selected" : ""}>Governo</option>
          <option value="privado" ${odc.client_type === "privado" ? "selected" : ""}>Privado</option>
        </select></div>
        <div class="field"><label>Data</label><input type="date" name="order_date" value="${esc(existing?.order_date || today())}"></div>
        <div class="field"><label>Origem do Contato</label>
          <select name="contact_origin" required>
            <option value="">Selecione</option>
            ${CONTACT_ORIGINS.map((o) => `<option value="${esc(o)}" ${existing?.contact_origin === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
          </select>
        </div>
        <div class="field" id="govf"><label>Nº do Contrato Administrativo</label><input name="contract_number" value="${esc(existing?.contract_number || "")}"></div>
        <div class="field" id="privf"><label>Nº da Proposta</label><input name="proposal_number" value="${esc(existing?.proposal_number || "")}"></div>
        <div class="field" id="aceite"><label>Data do Aceite</label><input type="date" name="acceptance_date" value="${esc(existing?.acceptance_date || "")}"></div>
        <div class="field"><label>Margem Utilizada (%)</label><input name="margin_pct" type="number" step="0.01" value="${existing?.margin_pct || 0}"></div>
        <div class="field"><label>Vendedor</label><input name="seller_name" value="${esc(existing?.seller_name || me.name)}"></div>
        <div class="field"><label>Condição de Pagamento</label><input name="payment_terms" placeholder="Ex.: 30 dias, à vista, 15/30/45" value="${esc(paymentTermsOf(existing) || paymentTermsOf(odc) || "30 dias")}"></div>
        <div class="field"><label>Nome de Contato (Interno)</label><input name="finance_contact_name" value="${esc(existing?.finance_contact_name || "")}"></div>
        <div class="field"><label>Telefone / E-mail de Contato (Interno)</label><input name="finance_contact" value="${esc(existing?.finance_contact || "")}"></div>
      </div>
      <div class="bd" style="padding-top:0">
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
          <label class="btn outline sm" style="cursor:pointer"><input type="checkbox" name="prorata" id="pv-prorata" ${isProrata(existing) ? "checked" : ""} style="width:auto;margin:0"> Pro-rata</label>
        </div>
        <table class="data"><thead><tr><th>Produto</th><th>Qtd</th><th class="money-h">Valor Unitário (R$)</th><th class="money-h">Total</th></tr></thead>
        <tbody id="sit">${items
          .map(
            (it, i) => `<tr>
            <td>${esc(it.product_name)}<br><span class="mono muted">${esc(it.sku)}</span>
              <input type="hidden" class="pname" value="${esc(it.product_name)}"><input type="hidden" class="sku" value="${esc(it.sku)}">
              <input type="hidden" class="list-unit" value="${it.unit_price_brl || 0}"></td>
            <td><input class="qty" type="number" value="${it.qty}"></td>
            <td class="money-cell"><div class="money-input"><span class="sym">R$</span><input class="unit" type="number" step="0.01" min="0" value="${it.unit_price_brl || ""}"></div></td>
            <td class="money-cell line">${moneyBR((it.qty || 0) * (it.unit_price_brl || 0))}</td>
          </tr>`,
          )
          .join("")}</tbody></table>
        <p style="margin-top:12px">Crédito utilizado: ${moneyBR(odc.credit_used)} · Crédito gerado: ${moneyBR(odc.credit_generated)}</p>
        <p><strong>Total da Venda: <span id="stotal">${moneyBR(items.reduce((s, it) => s + (it.qty || 0) * (it.unit_price_brl || 0), 0))}</span></strong></p>
      </div></div>
      <div class="card"><div class="hd"><h3>Assinatura</h3></div>
        <div class="bd"><div class="sig"><div class="id">Diretor<br>Pro-Systems Informática Ltda.<br>CNPJ 03.620.200/0001-35</div></div></div></div>
    </form></fieldset>
    <div class="row-actions" style="margin-top:16px;padding-bottom:40px">
      ${locked ? "" : `<button class="btn primary" id="save">Salvar Pedido de Venda</button>`}
      ${existing && existing.status !== "cancelado" ? `<button class="btn danger" id="cancel">Cancelar Venda</button>` : ""}
      ${existing ? `<a class="btn outline" href="/api/vendas/${existing.id}/word">Extrair Word</a>` : ""}
    </div>
  `);
  bindShell();
  const form = $("#pv");
  function toggleType() {
    const g = form.client_type.value === "governo";
    $("#govf").style.display = g ? "" : "none";
    $("#privf").style.display = g ? "none" : "";
    $("#aceite").style.display = g ? "none" : "";
  }
  toggleType();
  form.client_type.onchange = toggleType;
  form.addEventListener("input", () => {
    let tot = 0;
    $$("#sit tr").forEach((tr) => {
      const q = Number($(".qty", tr).value || 0);
      const u = Number($(".unit", tr).value || 0);
      tot += q * u;
      const line = $(".line", tr);
      if (line) line.innerHTML = moneyBR(q * u);
    });
    const st = $("#stotal");
    if (st) st.innerHTML = moneyBR(tot);
  });
  function syncPvProrata() {
    form.dispatchEvent(new Event("input"));
  }
  $("#pv-prorata")?.addEventListener("change", syncPvProrata);
  $("#save")?.addEventListener("click", async () => {
    try {
      if (!form.contact_origin.value) {
        toast("Informe a origem do contato.", true);
        return;
      }
      const body = {
        id: existing?.id,
        purchase_order_id: odc.id,
        order_date: form.order_date.value,
        client_type: form.client_type.value,
        contact_origin: form.contact_origin.value,
        contract_number: form.contract_number.value,
        proposal_number: form.proposal_number.value,
        acceptance_date: form.acceptance_date.value,
        margin_pct: Number(form.margin_pct.value || 0),
        seller_name: form.seller_name.value,
        finance_contact_name: form.finance_contact_name.value,
        finance_contact: form.finance_contact.value,
        payment_terms: form.payment_terms.value,
        prorata: $("#pv-prorata")?.checked ? 1 : 0,
        items: $$("#sit tr").map((tr) => ({
          product_name: $(".pname", tr).value,
          sku: $(".sku", tr).value,
          qty: Number($(".qty", tr).value),
          unit_price_brl: Number($(".unit", tr).value || 0),
        })),
      };
      const saved = await api("/api/vendas", { method: "POST", body });
      toast("Pedido de Venda salvo.");
      location.hash = "#/vendas/" + saved.id;
    } catch (e) {
      toast(e.message, true);
    }
  });
  $("#cancel")?.addEventListener("click", async () => {
    if (!confirm("Cancelar este pedido de venda?")) return;
    await api(`/api/vendas/${existing.id}/cancel`, { method: "POST", body: {} });
    toast("Pedido cancelado.");
    route();
  });
}

async function renderClients() {
  const rows = await api("/api/clients");
  function fillForm(c = {}) {
    $("#formc").style.display = "";
    $("#cf").innerHTML = `
      <input type="hidden" id="cid" value="${c.id || ""}">
      <div class="field"><label>CSN</label><input id="csn" value="${esc(c.csn || "")}"></div>
      <div class="field"><label>Nome</label><input id="cname" value="${esc(c.name || "")}"></div>
      <div class="field"><label>CNPJ / CPF</label><input id="cdoc" value="${esc(c.document || "")}"></div>
      <div class="field"><label>E-mail</label><input id="cemail" value="${esc(c.email || "")}"></div>
      <div class="field"><label>Gestor</label><input id="cgest" value="${esc(c.manager_name || "")}"></div>
      <div class="field"><label>Telefone</label><input id="cphone" value="${esc(c.phone || "")}"></div>
      <div style="align-self:end"><button class="btn primary" id="savec">Salvar Cliente</button></div>`;
    $("#savec").onclick = async () => {
      try {
        await api("/api/clients", {
          method: "POST",
          body: {
            id: Number($("#cid").value) || undefined,
            csn: $("#csn").value,
            name: $("#cname").value,
            document: $("#cdoc").value,
            email: $("#cemail").value,
            manager_name: $("#cgest").value,
            phone: $("#cphone").value,
          },
        });
        toast("Cliente salvo.");
        route();
      } catch (e) {
        toast(e.message, true);
      }
    };
  }
  app.innerHTML = shell(`${head("Clientes", "Cadastro reutilizado nas ordens de compra. O CSN identifica o cliente.", `<button class="btn primary" id="novo">Novo Cliente</button>`)}
    <div class="card" id="formc" style="display:none;margin-bottom:16px"><div class="bd grid g2" id="cf"></div></div>
    <div class="card"><div class="bd" style="padding:0">
      <table class="data"><thead><tr><th>CSN</th><th>Nome</th><th>Documento</th><th>Gestor</th><th>Contato</th><th></th></tr></thead>
      <tbody>${rows.map((c) => `<tr><td class="mono">${esc(c.csn)}</td><td>${esc(c.name)}</td><td>${esc(c.document)}</td><td>${esc(c.manager_name || "—")}</td><td>${esc(c.phone || c.email || "—")}</td><td><button class="btn outline sm edc" data-id="${c.id}">Editar</button></td></tr>`).join("")}</tbody></table>
    </div></div>`);
  bindShell();
  $("#novo").onclick = () => fillForm();
  $$(".edc").forEach((b) => {
    b.onclick = () => fillForm(rows.find((r) => String(r.id) === b.dataset.id));
  });
}

async function renderCredits() {
  const d = await api("/api/credits");
  const admin = me.role === "administrador";
  app.innerHTML = shell(`${head("Créditos Pars", "Crédito gerado em pedido de governo só fica disponível depois que o administrador habilitar. O saldo inicial de R$ 194.372,95 já está habilitado.")}
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><small>Gerado</small><strong>${brl(d.summary.generated)}</strong></div>
      <div class="card stat"><small>Pendente</small><strong>${brl(d.summary.pending || 0)}</strong></div>
      <div class="card stat"><small>Utilizado</small><strong>${brl(d.summary.used)}</strong></div>
      <div class="card stat"><small>Disponível</small><strong>${brl(d.summary.remaining)}</strong></div>
    </div>
    <div class="card"><div class="bd" style="padding:0;overflow:auto">
      <table class="data"><thead><tr>
        <th>Data</th><th>Tipo</th><th>NF geradora</th><th>Pedido</th><th>Cliente</th><th class="num">Valor</th><th>Status</th>${admin ? "<th></th>" : ""}
      </tr></thead>
      <tbody>${(d.ledger || [])
        .map((r) => {
          const inicial = !r.purchase_order_id && r.kind === "generated";
          const enabled = r.kind !== "generated" || r.enabled === 1 || r.enabled === true || (r.enabled == null && inicial);
          const pending = r.kind === "generated" && !enabled;
          const tipo = inicial ? "Saldo inicial" : r.kind === "generated" ? "Gerado" : "Utilizado";
          const st = r.kind === "used" ? badge("enviado_pars").replace("Enviado à PARS", "Baixado") : pending
            ? `<span class="badge warn">Pendente</span>`
            : `<span class="badge ok">Habilitado</span>`;
          const acts = admin && r.kind === "generated"
            ? `<div class="row-actions">
                ${pending ? `<button class="btn primary sm hgen" data-id="${r.id}" data-nf="${esc(r.nf_number || r.generated_nf || "")}">Habilitar</button>` : ""}
                <button class="btn outline sm hgcor" data-id="${r.id}" data-amt="${r.amount}" data-nf="${esc(r.nf_number || r.generated_nf || "")}">Corrigir</button>
              </div>`
            : "";
          return `<tr>
            <td>${dateBR(r.created_at)}</td>
            <td>${tipo}</td>
            <td class="mono">${esc(r.nf_number || r.generated_nf || "—")}</td>
            <td class="mono">${r.purchase_order_id ? `<a href="#/odc/${r.purchase_order_id}">${esc(r.purchase_order_number || "")}</a>` : "—"}</td>
            <td>${esc(r.notes && inicial ? r.notes : r.client_name || "—")}</td>
            <td class="num">${brl(r.amount)}</td>
            <td>${st}</td>
            ${admin ? `<td>${acts}</td>` : ""}
          </tr>`;
        })
        .join("")}</tbody></table>
    </div></div>`);
  bindShell();
  $$(".hgen").forEach((b) => {
    b.onclick = async () => {
      const nf = prompt("Número da nota fiscal que gerou este crédito:", b.dataset.nf || "");
      if (nf == null) return;
      try {
        await api(`/api/credits/${b.dataset.id}/enable`, { method: "POST", body: { nf_number: nf } });
        toast("Crédito habilitado para uso.");
        route();
      } catch (e) {
        toast(e.message, true);
      }
    };
  });
  $$(".hgcor").forEach((b) => {
    b.onclick = async () => {
      const amt = prompt("Novo valor do crédito gerado (R$):", b.dataset.amt || "");
      if (amt == null) return;
      const nf = prompt("NF que gerou o crédito (opcional):", b.dataset.nf || "");
      if (nf == null) return;
      try {
        await api(`/api/credits/${b.dataset.id}/correct`, { method: "POST", body: { amount: Number(String(amt).replace(",", ".")), nf_number: nf } });
        toast("Crédito gerado corrigido.");
        route();
      } catch (e) {
        toast(e.message, true);
      }
    };
  });
}

async function renderProducts() {
  if (me.role !== "administrador") return (app.innerHTML = shell("<p>Acesso restrito.</p>"));
  const cat = await api("/api/catalog");
  const rows = await api("/api/products/all");
  const meta = cat.meta || {};
  app.innerHTML = shell(`
    ${head(
      "Produtos e Preços",
      `${esc(meta.label || "Tabela Autodesk")}${meta.effective ? " · Vigência " + esc(meta.effective) : ""}. Pedidos já emitidos mantêm o preço gravado.`,
      `<a class="btn outline" href="#/atualizacoes">Atualizar Tabela</a>`,
    )}
    <div class="card" style="margin-bottom:14px"><div class="bd"><input id="pqall" placeholder="Buscar SKU, produto, linha ou tipo…"></div></div>
    <div class="card"><div class="bd" style="padding:0;max-height:70vh;overflow:auto">
      <table class="data" id="ptable"><thead><tr><th>SKU</th><th>Produto</th><th>Prazo</th><th>Tipo</th><th class="num">Lista USD</th></tr></thead>
      <tbody>${rows
        .map(
          (p) => `<tr><td class="mono">${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.contract_term)}</td><td>${esc(p.license_type)}</td><td class="num">${usd(p.list_price_usd)}</td></tr>`,
        )
        .join("")}</tbody></table>
    </div></div>
    <p class="muted" id="pcnt">${rows.length} SKUs ativos na tabela vigente.</p>`);
  bindShell();
  $("#pqall").oninput = () => {
    const q = $("#pqall").value.trim().toLowerCase();
    let n = 0;
    $$("#ptable tbody tr").forEach((tr) => {
      const show = !q || tr.textContent.toLowerCase().includes(q);
      tr.style.display = show ? "" : "none";
      if (show) n++;
    });
    $("#pcnt").textContent = n + " SKUs na tabela vigente.";
  };
}

async function renderUpdates() {
  if (me.role !== "administrador") return (app.innerHTML = shell("<p>Acesso restrito ao administrador.</p>"));
  let info = {};
  try {
    info = await api("/api/system/update");
  } catch (e) {
    info = { error: e.message, catalog: {}, repo: "", branch: "main" };
  }
  const cat = info.catalog || {};
  const imports = (await api("/api/catalog")).imports || [];
  const hist = imports.length
    ? imports
        .map(
          (r) =>
            `<tr><td>${dateBR(r.imported_at)}</td><td>${esc(r.filename)}</td><td>${esc(r.label || "—")}</td><td>${r.sku_count}</td><td>${esc(r.imported_by_name || "—")}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="empty">Nenhuma substituição ainda. A tabela atual veio da instalação.</td></tr>`;

  app.innerHTML = shell(`
    ${head("Atualizações", "O administrador publica uma nova versão do sistema pelo GitHub e substitui a tabela de preços Autodesk.")}
    <div class="card" style="margin-bottom:16px">
      <div class="hd"><h3>1. Atualizar o Sistema (GitHub)</h3></div>
      <div class="bd">
        <p class="muted">Baixa o código publicado no repositório e substitui os arquivos do aplicativo. O banco de dados, as senhas e o .env não são alterados.</p>
        <div class="grid g2" style="margin:14px 0">
          <div class="field"><label>Repositório (usuario/projeto)</label><input id="grepo" value="${esc(info.repo || "")}" placeholder="brunospfc6-cell/pedidosps"></div>
          <div class="field"><label>Branch</label><input id="gbranch" value="${esc(info.branch || "main")}"></div>
          <div class="field"><label>Token GitHub (só se o repositório for privado)</label><input id="gtoken" type="password" placeholder="${info.has_token ? "Token já gravado — deixe em branco para manter" : "ghp_…"}"></div>
          <div class="field" style="align-self:end"><button class="btn outline" id="gsave">Salvar Repositório</button></div>
        </div>
        <div class="banner" id="gstatus">
          <div>${
            info.ok
              ? `<strong>${esc(info.repo)}</strong><p class="muted">${info.up_to_date ? "Já está na versão mais recente." : "Há uma versão no GitHub."}<br>${esc(info.sha || "")} · ${esc(info.message || "")}<br>${esc(info.date || "")}</p>`
              : `<strong>GitHub</strong><p class="muted">${esc(info.error || "Informe o repositório e, se for privado, o token.")}</p>`
          }</div>
        </div>
        <div class="row-actions" style="margin-top:12px">
          <button class="btn primary" id="gupd">Atualizar Sistema</button>
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="hd"><h3>2. Substituir Tabela de Preços</h3></div>
      <div class="bd">
        <p class="muted">Envie a planilha Autodesk (.xlsx), aba Price List. A lista anterior é desativada; os pedidos já emitidos não mudam.</p>
        <p style="margin:10px 0"><strong>${esc(cat.label || "Tabela vigente")}</strong><br>
        <span class="muted">${cat.active || 0} SKUs ativos${cat.effective ? " · " + esc(cat.effective) : ""}${cat.file ? " · " + esc(cat.file) : ""}</span></p>
        <div class="row-actions" style="align-items:center">
          <input type="file" id="xlsx" accept=".xlsx,.xlsm,.json">
          <button class="btn primary" id="imp">Substituir Tabela de Preços</button>
        </div>
      </div>
    </div>
    <div class="card"><div class="hd"><h3>Histórico de Tabelas</h3></div>
      <div class="bd" style="padding:0">
        <table class="data"><thead><tr><th>Data</th><th>Arquivo</th><th>Nome</th><th>SKUs</th><th>Quem</th></tr></thead>
        <tbody>${hist}</tbody></table>
      </div>
    </div>
  `);
  bindShell();
  $("#gsave").onclick = async () => {
    try {
      await api("/api/system/github", {
        method: "POST",
        body: { repo: $("#grepo").value, branch: $("#gbranch").value, token: $("#gtoken").value || undefined },
      });
      toast("Repositório salvo.");
      route();
    } catch (e) {
      toast(e.message, true);
    }
  };
  $("#gupd").onclick = async () => {
    if (!confirm("Atualizar o sistema com o código publicado no GitHub? O banco de pedidos não será apagado.")) return;
    const btn = $("#gupd");
    btn.disabled = true;
    btn.textContent = "Atualizando…";
    try {
      const r = await api("/api/system/update", { method: "POST", body: {} });
      toast("Sistema atualizado" + (r.sha ? " (" + r.sha + ")" : "") + ". Recarregue a página.");
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false;
      btn.textContent = "Atualizar Sistema";
    }
  };
  $("#imp").onclick = async () => {
    const f = $("#xlsx").files[0];
    if (!f) return toast("Escolha a planilha Autodesk (.xlsx).", true);
    if (!confirm("Substituir a tabela de preços atual por " + f.name + "? Pedidos já emitidos mantêm os valores gravados.")) return;
    const fd = new FormData();
    fd.append("file", f);
    const btn = $("#imp");
    btn.disabled = true;
    btn.textContent = "Importando…";
    try {
      const r = await api("/api/products/import", { method: "POST", body: fd });
      toast("Tabela substituída: " + (r.imported || r.active) + " SKUs.");
      route();
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false;
      btn.textContent = "Substituir Tabela de Preços";
    }
  };
}

async function renderUsers() {
  if (me.role !== "administrador") return (app.innerHTML = shell("<p>Acesso restrito ao administrador.</p>"));
  const rows = await api("/api/users");
  app.innerHTML = shell(`${head("Usuários", "Defina o login e a senha de cada vendedor, diretor ou administrador.")}
    <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Novo Usuário</h3></div><div class="bd grid g3">
      <div class="field"><label>Nome</label><input id="un"></div>
      <div class="field"><label>E-mail (Login)</label><input id="ue" type="email"></div>
      <div class="field"><label>Perfil</label><select id="ur"><option value="vendedor">Vendedor</option><option value="diretor">Diretor</option><option value="administrador">Administrador</option></select></div>
      <div class="field"><label>Senha</label><input id="up" type="password"></div>
      <div class="field"><label>Confirmar Senha</label><input id="upc" type="password"></div>
      <div style="align-self:end"><button class="btn primary" id="cu">Criar Usuário</button></div>
    </div></div>
    <div class="card"><div class="bd" style="padding:0">
      <table class="data"><thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (u) => `<tr>
          <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc({ administrador: "Administrador", vendedor: "Vendedor", diretor: "Diretor" }[u.role])}</td>
          <td>${u.active ? badge("aberto").replace("Aberto", "Ativo") : badge("cancelado").replace("Cancelado", "Inativo")}</td>
          <td class="row-actions">
            <button class="btn outline sm tog" data-id="${u.id}" data-active="${u.active ? "1" : "0"}" data-name="${esc(u.name)}" data-role="${u.role}">${u.active ? "Desativar" : "Ativar"}</button>
            <button class="btn ghost sm pw" data-id="${u.id}">Definir Senha</button>
          </td></tr>`,
        )
        .join("")}</tbody></table>
    </div></div>`);
  bindShell();
  $("#cu").onclick = async () => {
    if ($("#up").value !== $("#upc").value) return toast("A confirmação da senha não confere.", true);
    try {
      await api("/api/users", { method: "POST", body: { name: $("#un").value, email: $("#ue").value, password: $("#up").value, role: $("#ur").value } });
      toast("Usuário criado.");
      route();
    } catch (e) {
      toast(e.message, true);
    }
  };
  $$(".tog").forEach((b) => {
    b.onclick = async () => {
      await api(`/api/users/${b.dataset.id}`, {
        method: "POST",
        body: { name: b.dataset.name, role: b.dataset.role, active: b.dataset.active !== "1" },
      });
      route();
    };
  });
  $$(".pw").forEach((b) => {
    b.onclick = async () => {
      const p = prompt("Nova senha (mín. 6 caracteres):");
      if (!p) return;
      try {
        await api(`/api/users/${b.dataset.id}/password`, { method: "POST", body: { password: p } });
        toast("Senha atualizada.");
      } catch (e) {
        toast(e.message, true);
      }
    };
  });
}

async function renderGestao() {
  const d = await api("/api/gestao");
  app.innerHTML = shell(`${head("Gestão e Análise", "Volume de vendas, margem e extração de planilhas.",
    `<a class="btn outline" href="/api/export/csv?kind=odc">Extrair ODCs</a>
     <a class="btn outline" href="/api/export/csv?kind=vendas">Extrair Vendas</a>`)}
    <div class="grid g2">
      <div class="card"><div class="hd"><h3>Por Vendedor</h3></div><div class="bd" style="padding:0">
        <table class="data"><thead><tr><th>Vendedor</th><th>Pedidos</th><th class="num">Total</th></tr></thead>
        <tbody>${(d.by_seller || []).map((r) => `<tr><td>${esc(r.seller_name)}</td><td>${r.pedidos}</td><td class="num">${brl(r.total)}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">Sem dados.</td></tr>`}</tbody></table>
      </div></div>
      <div class="card"><div class="hd"><h3>Governo × Privado</h3></div><div class="bd" style="padding:0">
        <table class="data"><thead><tr><th>Tipo</th><th>Pedidos</th><th class="num">Total</th></tr></thead>
        <tbody>${(d.by_type || []).map((r) => `<tr><td>${r.type === "governo" ? "Governo" : "Privado"}</td><td>${r.pedidos}</td><td class="num">${brl(r.total)}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">Sem dados.</td></tr>`}</tbody></table>
      </div></div>
      <div class="card" style="grid-column:1/-1"><div class="hd"><h3>Produtos Mais Vendidos</h3></div><div class="bd" style="padding:0">
        <table class="data"><thead><tr><th>Produto</th><th>Qtd</th><th class="num">Total</th></tr></thead>
        <tbody>${(d.top_products || []).map((r) => `<tr><td>${esc(r.product_name)}</td><td>${r.qtd}</td><td class="num">${brl(r.total)}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">Sem dados.</td></tr>`}</tbody></table>
      </div></div>
    </div>`);
  bindShell();
}

window.addEventListener("hashchange", route);
route();
