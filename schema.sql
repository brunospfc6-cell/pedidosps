CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('administrador', 'vendedor', 'diretor')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  city TEXT,
  state TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Autodesk',
  sap_name TEXT NOT NULL DEFAULT '',
  product_line TEXT NOT NULL DEFAULT '',
  usage_type TEXT NOT NULL DEFAULT 'Commercial',
  license_type TEXT NOT NULL DEFAULT '',
  contract_term TEXT NOT NULL DEFAULT '',
  deployment TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  list_price_usd REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'price_list',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  csn TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  document TEXT NOT NULL,
  email TEXT,
  manager_name TEXT,
  phone TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_counters (
  name TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  seq INTEGER NOT NULL,
  order_date TEXT NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  client_type TEXT NOT NULL CHECK (client_type IN ('governo', 'privado')),
  sale_kind TEXT NOT NULL DEFAULT 'nova' CHECK (sale_kind IN ('nova', 'renovacao')),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'pendente_envio', 'enviado_pars', 'cancelado')),
  dollar_rate REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  hubgov_credit_pct REAL NOT NULL DEFAULT 0,
  license_delivery TEXT NOT NULL DEFAULT 'imediato',
  activation_date TEXT,
  payment_term_days INTEGER NOT NULL DEFAULT 30,
  credit_used REAL NOT NULL DEFAULT 0,
  credit_nf TEXT,
  special_condition TEXT,
  special_approved_by TEXT,
  client_id INTEGER REFERENCES clients(id),
  client_csn TEXT,
  client_name TEXT,
  client_document TEXT,
  client_email TEXT,
  client_manager TEXT,
  client_phone TEXT,
  renewal_contracts TEXT,
  notes TEXT,
  list_total_usd REAL NOT NULL DEFAULT 0,
  list_total_brl REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  net_total_brl REAL NOT NULL DEFAULT 0,
  credit_generated REAL NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  qty REAL NOT NULL DEFAULT 1,
  list_price_usd REAL NOT NULL,
  line_total_usd REAL NOT NULL,
  line_total_brl REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  seq INTEGER NOT NULL,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  order_date TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('governo', 'privado')),
  contract_number TEXT,
  proposal_number TEXT,
  acceptance_date TEXT,
  margin_pct REAL NOT NULL DEFAULT 0,
  seller_id INTEGER NOT NULL,
  seller_name TEXT NOT NULL,
  finance_contact_name TEXT,
  finance_contact TEXT,
  contact_origin TEXT,
  payment_term_days INTEGER,
  calculation_memo TEXT,
  credit_used REAL NOT NULL DEFAULT 0,
  credit_generated REAL NOT NULL DEFAULT 0,
  sale_total_brl REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'cancelado')),
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sku TEXT,
  qty REAL NOT NULL,
  unit_price_brl REAL NOT NULL,
  line_total_brl REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS hubgov_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  purchase_order_id INTEGER,
  sales_order_id INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('generated', 'used')),
  amount REAL NOT NULL,
  nf_number TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO document_counters (name, last_value) VALUES ('odc', 0);
INSERT OR IGNORE INTO document_counters (name, last_value) VALUES ('pv', 0);

CREATE TABLE IF NOT EXISTS catalog_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_list_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  label TEXT,
  sku_count INTEGER NOT NULL,
  imported_by INTEGER,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

