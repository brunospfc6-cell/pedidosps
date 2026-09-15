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
function dateBR(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
function today() {
  return new Date().toISOString().slice(0, 10);
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
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    me = null;
    if (!location.hash.startsWith("#/login")) location.hash = "#/login";
    throw new Error("Faça login.");
  }
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : await res.blob();
  if (!res.ok) throw new Error(data.detail || "Erro na requisição");
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
    ["#/creditos", "HubGov"],
  ];
  if (me.role === "administrador") {
    items.push(["#/produtos", "Produtos e Preços"], ["#/usuarios", "Usuários"]);
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
        <p class="muted" style="color:#8b959e;margin-top:12px">Ordens de Compra, Pedidos de Venda, créditos HubGov e gestão comercial.</p>
      </div>
      <p style="font-size:12px;color:#8b959e">Pro-Systems Informatica LTDA · CNPJ 03.620.200/0001-35 · Brasília/DF</p>
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
    ${head("Painel", "Acompanhe ordens de compra, envios à PARS e o saldo HubGov.", `<a class="btn primary" href="#/odc/nova">Nova Ordem de Compra</a>`)}
    <div class="grid g4">
      <div class="card stat"><small>Ordens de Compra</small><strong>${d.odc_count}</strong></div>
      <div class="card stat"><small>Pendente PARS</small><strong>${d.pending_pars}</strong></div>
      <div class="card stat"><small>Vendas</small><strong>${brl(d.sales_total)}</strong></div>
      <div class="card stat"><small>Saldo HubGov</small><strong>${brl(d.credits.remaining)}</strong></div>
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
          wrap.dataset.price = p.list_price_usd;
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
      ${head("Nova Ordem de Compra", "Antes de começar, informe o tipo de cliente. Somente pedidos de governo geram créditos HubGov.")}
      <div class="grid g2" style="max-width:720px">
        <button class="choice" id="gov"><h2>Governo</h2><p class="muted">Gera crédito HubGov (≥ 8% sobre lista).</p></button>
        <button class="choice" id="priv"><h2>Privado</h2><p class="muted">Não gera crédito HubGov.</p></button>
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
    <p class="muted">${gov ? "Cliente Governo · HubGov Ativo" : "Cliente Privado · Sem Geração HubGov"}</p>
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
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>2. Produtos Autodesk</h3><p class="muted">Tabela vigente Setembro 2026. Busque pelo SKU ou nome.</p></div>
      <div class="bd">
        <table class="data" id="items"><thead><tr><th>Produto</th><th>Qtd</th><th>Lista USD</th><th></th></tr></thead>
        <tbody>${items.map((it, i) => itemRow(it, i)).join("")}</tbody></table>
        ${locked ? "" : `<button type="button" class="btn outline" id="add">Adicionar Produto</button>`}
        <div class="grid g3" style="margin-top:16px">
          <div class="field"><label>Dólar do Dia (R$)</label><input name="dollar_rate" type="number" step="0.0001" value="${o.dollar_rate || ""}"></div>
          <div class="field"><label>Prazo de Pagamento (Dias)</label><input name="payment_term_days" type="number" value="${o.payment_term_days || 30}"></div>
          <div class="field"><label>Entrega das Licenças</label><select name="license_delivery">
            <option value="imediato">Imediato</option>
            <option value="agendada" ${o.license_delivery === "agendada" ? "selected" : ""}>Escolher Data de Ativação</option>
          </select></div>
          <div class="field" id="actWrap" style="${o.license_delivery === "agendada" ? "" : "display:none"}"><label>Data de Ativação</label><input name="activation_date" type="date" value="${esc(o.activation_date || "")}"></div>
          <div class="field"><label>Percentual de Desconto</label><input name="discount_pct" type="number" step="0.01" value="${o.discount_pct || 0}"></div>
          ${
            gov
              ? `<div class="field"><label>Percentual de Crédito HubGov Gerado</label><input name="hubgov_credit_pct" type="number" step="0.01" value="${o.hubgov_credit_pct || 8}"></div>
                 <div class="field"><label>Valor do Crédito Utilizado (R$)</label><input name="credit_used" type="number" step="0.01" value="${o.credit_used || 0}"></div>
                 <div class="field"><label>NF que Gerou Este Crédito</label><input name="credit_nf" value="${esc(o.credit_nf || "")}"></div>`
              : `<input type="hidden" name="hubgov_credit_pct" value="0"><input type="hidden" name="credit_used" value="0">`
          }
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
        <div class="bd muted"><p style="color:var(--fg);font-weight:600;margin:0">Pro-Systems Informatica LTDA</p>
        <p>SRTV/Sul Quadra 701, Palácio do Rádio I, S/N SL 209<br>CEP 70.340-901 — Brasília/DF<br>CNPJ: 03.620.200/0001-35 · IE: 0731060800113 · Fone: 61-3202.2666</p></div></div>`
          : ""
      }
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Assinatura</h3></div>
        <div class="bd"><div class="sig"><div class="line"></div><div class="id">Diretor<br>Pro-Systems Informática Ltda.<br>CNPJ n° 03.620.200/0001-35</div></div></div></div>
    </form>
    </fieldset>
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
    const i = tb.children.length;
    tb.insertAdjacentHTML("beforeend", itemRow({}, i));
    attachPickers(tb.lastElementChild, products, form.sale_kind.value);
  });
  form.addEventListener("picked", (e) => {
    const wrap = e.target.closest(".picker");
    const tr = wrap.closest("tr");
    $(".usd", tr).textContent = usd(wrap.dataset.price);
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
        list_price_usd: Number(p.dataset.price || 0),
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
      payment_term_days: Number(form.payment_term_days.value || 30),
      credit_used: Number(form.credit_used?.value || 0),
      credit_nf: form.credit_nf?.value,
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
  async function refreshTotals() {
    const items = $$("#items tbody tr").map((tr) => ({
      qty: Number($(".qty", tr)?.value || 1),
      list_price_usd: Number($(".picker", tr)?.dataset.price || 0),
    }));
    try {
      const t = await api("/api/odc/calc", {
        method: "POST",
        body: {
          items,
          dollar_rate: Number(form.dollar_rate.value || 0),
          discount_pct: Number(form.discount_pct.value || 0),
          client_type: o.client_type,
          hubgov_credit_pct: Number(form.hubgov_credit_pct?.value || 0),
          credit_used: Number(form.credit_used?.value || 0),
        },
      });
      $("#totais").innerHTML = `<p>Lista: ${usd(t.list_total_usd)} → ${brl(t.list_total_brl)}</p>
        <p>Desconto: − ${brl(t.discount_amount)}</p>
        ${gov ? `<p>Crédito HubGov gerado: ${brl(t.credit_generated)}</p>` : ""}
        <p>Crédito utilizado: ${brl(form.credit_used?.value || 0)}</p>
        <p><strong>Líquido: ${brl(t.net_total_brl)}</strong></p>`;
    } catch {}
  }
}

function itemRow(it = {}, i) {
  return `<tr>
    <td><div class="picker" data-sku="${esc(it.sku || "")}" data-name="${esc(it.product_name || "")}" data-price="${it.list_price_usd || 0}">
      <input class="pq" placeholder="Buscar SKU, produto ou linha…" autocomplete="off" value="${esc(it.product_name || it.sku || "")}">
      <input type="hidden" class="pid" value="${it.product_id || ""}">
      ${it.sku ? `<p class="mono muted">${esc(it.sku)} · ${usd(it.list_price_usd)}</p>` : ""}
    </div></td>
    <td style="width:90px"><input class="qty" type="number" min="1" value="${it.qty || 1}"></td>
    <td class="usd">${it.list_price_usd ? usd(it.list_price_usd) : "—"}</td>
    <td></td>
  </tr>`;
}

async function renderSalesList() {
  const rows = await api("/api/vendas");
  const body = rows.length
    ? `<table class="data"><thead><tr><th>Número</th><th>ODC</th><th>Cliente</th><th>Tipo</th><th>Data</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>
      ${rows
        .map(
          (o) => `<tr>
          <td class="mono"><a href="#/vendas/${o.id}">${esc(o.number)}</a></td>
          <td class="mono">${esc(o.purchase_order_number)}</td>
          <td>${esc(o.client_name)}</td>
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
  const items = (existing?.items || odc.items || []).map((it) => ({
    sku: it.sku,
    product_name: it.product_name,
    qty: it.qty,
    unit_price_brl: it.unit_price_brl || (it.qty ? (it.line_total_brl || 0) / it.qty : 0),
  }));
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
        <div class="bd"><pre style="white-space:pre-wrap;font-family:inherit;margin:0">${esc(
          existing?.calculation_memo ||
            `Lista USD ${usd(odc.list_total_usd)}\nCâmbio R$ ${Number(odc.dollar_rate).toFixed(4)}\nLíquido ${brl(odc.net_total_brl)}`,
        )}</pre></div></div>
      <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Dados da Venda</h3></div><div class="bd grid g2">
        <div class="field"><label>Tipo de Cliente</label><select name="client_type">
          <option value="governo" ${odc.client_type === "governo" ? "selected" : ""}>Governo</option>
          <option value="privado" ${odc.client_type === "privado" ? "selected" : ""}>Privado</option>
        </select></div>
        <div class="field"><label>Data</label><input type="date" name="order_date" value="${esc(existing?.order_date || today())}"></div>
        <div class="field" id="govf"><label>Nº do Contrato Administrativo</label><input name="contract_number" value="${esc(existing?.contract_number || "")}"></div>
        <div class="field" id="privf"><label>Nº da Proposta</label><input name="proposal_number" value="${esc(existing?.proposal_number || "")}"></div>
        <div class="field" id="aceite"><label>Data do Aceite</label><input type="date" name="acceptance_date" value="${esc(existing?.acceptance_date || "")}"></div>
        <div class="field"><label>Margem Utilizada (%)</label><input name="margin_pct" type="number" step="0.01" value="${existing?.margin_pct || 0}"></div>
        <div class="field"><label>Vendedor</label><input name="seller_name" value="${esc(existing?.seller_name || me.name)}"></div>
        <div class="field"><label>Prazo de Pagamento (Dias)</label><input name="payment_term_days" type="number" value="${existing?.payment_term_days || odc.payment_term_days || 30}"></div>
        <div class="field"><label>Nome de Contato (Interno)</label><input name="finance_contact_name" value="${esc(existing?.finance_contact_name || "")}"></div>
        <div class="field"><label>Telefone / E-mail de Contato (Interno)</label><input name="finance_contact" value="${esc(existing?.finance_contact || "")}"></div>
      </div>
      <div class="bd" style="padding-top:0">
        <table class="data"><thead><tr><th>Produto</th><th>Qtd</th><th>Valor Unitário (R$)</th><th>Total</th></tr></thead>
        <tbody id="sit">${items
          .map(
            (it, i) => `<tr>
            <td>${esc(it.product_name)}<br><span class="mono muted">${esc(it.sku)}</span>
              <input type="hidden" class="pname" value="${esc(it.product_name)}"><input type="hidden" class="sku" value="${esc(it.sku)}"></td>
            <td><input class="qty" type="number" value="${it.qty}"></td>
            <td><input class="unit" type="number" step="0.01" value="${it.unit_price_brl || ""}"></td>
            <td class="line">${brl((it.qty || 0) * (it.unit_price_brl || 0))}</td>
          </tr>`,
          )
          .join("")}</tbody></table>
        <p style="margin-top:12px">Crédito utilizado: ${brl(odc.credit_used)} · Crédito gerado: ${brl(odc.credit_generated)}</p>
        <p><strong>Total da Venda: <span id="stotal">${brl(existing?.sale_total_brl || 0)}</span></strong></p>
      </div></div>
      <div class="card"><div class="hd"><h3>Assinatura</h3></div>
        <div class="bd"><div class="sig"><div class="line"></div><div class="id">Diretor<br>Pro-Systems Informática Ltda.<br>CNPJ n° 03.620.200/0001-35</div></div></div></div>
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
      $(".line", tr).textContent = brl(q * u);
    });
    $("#stotal").textContent = brl(tot);
  });
  $("#save")?.addEventListener("click", async () => {
    try {
      const body = {
        id: existing?.id,
        purchase_order_id: odc.id,
        order_date: form.order_date.value,
        client_type: form.client_type.value,
        contract_number: form.contract_number.value,
        proposal_number: form.proposal_number.value,
        acceptance_date: form.acceptance_date.value,
        margin_pct: Number(form.margin_pct.value || 0),
        seller_name: form.seller_name.value,
        finance_contact_name: form.finance_contact_name.value,
        finance_contact: form.finance_contact.value,
        payment_term_days: Number(form.payment_term_days.value || 0),
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
  app.innerHTML = shell(`${head("Créditos HubGov", "Pedidos de governo geram crédito a partir de 8% sobre o valor de lista.")}
    <div class="grid g3" style="margin-bottom:16px">
      <div class="card stat"><small>Gerado</small><strong>${brl(d.summary.generated)}</strong></div>
      <div class="card stat"><small>Utilizado</small><strong>${brl(d.summary.used)}</strong></div>
      <div class="card stat"><small>Saldo</small><strong>${brl(d.summary.remaining)}</strong></div>
    </div>
    <div class="card"><div class="bd" style="padding:0">
      <table class="data"><thead><tr><th>Data</th><th>Tipo</th><th>NF</th><th>Cliente</th><th class="num">Valor</th></tr></thead>
      <tbody>${(d.ledger || [])
        .map(
          (r) => `<tr><td>${dateBR(r.created_at)}</td><td>${r.kind === "generated" ? "Gerado" : "Utilizado"}</td>
          <td class="mono">${esc(r.nf_number || "—")}</td><td>${esc(r.client_name || "—")}</td><td class="num">${brl(r.amount)}</td></tr>`,
        )
        .join("")}</tbody></table>
    </div></div>`);
  bindShell();
}

async function renderProducts() {
  if (me.role !== "administrador") return (app.innerHTML = shell("<p>Acesso restrito.</p>"));
  const rows = await api("/api/products/all");
  app.innerHTML = shell(`${head("Produtos e Preços", "Planilha Autodesk Setembro 2026 — preço reseller USD + IVA.")}
    <div class="card" style="margin-bottom:14px"><div class="bd"><input id="pqall" placeholder="Buscar SKU, produto, linha ou tipo…"></div></div>
    <div class="card"><div class="bd" style="padding:0;max-height:70vh;overflow:auto">
      <table class="data" id="ptable"><thead><tr><th>SKU</th><th>Produto</th><th>Prazo</th><th>Tipo</th><th class="num">Lista USD</th></tr></thead>
      <tbody>${rows
        .map(
          (p) => `<tr><td class="mono">${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.contract_term)}</td><td>${esc(p.license_type)}</td><td class="num">${usd(p.list_price_usd)}</td></tr>`,
        )
        .join("")}</tbody></table>
    </div></div>
    <p class="muted" id="pcnt">${rows.length} SKUs na tabela vigente.</p>`);
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
