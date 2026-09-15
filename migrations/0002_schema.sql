-- Pro-Systems compras e vendas
create table if not exists profiles (
  user_id text primary key,
  name text not null,
  email text not null,
  role text not null check (role in ('administrador', 'vendedor', 'diretor')),
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on profiles (email);
create index if not exists profiles_role_idx on profiles (role);

create table if not exists suppliers (
  id serial primary key,
  name text not null,
  cnpj text not null,
  city text,
  state text,
  active boolean not null default true
);

create table if not exists products (
  id serial primary key,
  sku text not null unique,
  name text not null,
  category text not null default 'Autodesk',
  list_price_usd numeric(14,2) not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists clients (
  id serial primary key,
  csn text not null unique,
  name text not null,
  document text not null,
  email text,
  manager_name text,
  phone text,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_csn_idx on clients (csn);

create table if not exists document_counters (
  name text primary key,
  last_value integer not null default 0
);

create table if not exists purchase_orders (
  id serial primary key,
  number text not null unique,
  seq integer not null,
  order_date date not null,
  supplier_id integer not null references suppliers(id),
  client_type text not null check (client_type in ('governo', 'privado')),
  sale_kind text not null default 'nova' check (sale_kind in ('nova', 'renovacao')),
  status text not null default 'rascunho' check (status in ('rascunho', 'pendente_envio', 'enviado_pars', 'cancelado')),
  dollar_rate numeric(12,4) not null default 0,
  discount_pct numeric(8,4) not null default 0,
  hubgov_credit_pct numeric(8,4) not null default 0,
  license_delivery text not null default 'imediato' check (license_delivery in ('imediato', 'agendada')),
  activation_date date,
  payment_term_days integer not null default 30,
  credit_used numeric(14,2) not null default 0,
  credit_nf text,
  special_condition text,
  special_approved_by text,
  signature_data text,
  signed_at timestamptz,
  signed_name text,
  client_id integer references clients(id),
  client_csn text,
  client_name text,
  client_document text,
  client_email text,
  client_manager text,
  client_phone text,
  renewal_contracts text,
  notes text,
  list_total_usd numeric(14,2) not null default 0,
  list_total_brl numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  net_total_brl numeric(14,2) not null default 0,
  credit_generated numeric(14,2) not null default 0,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists purchase_orders_status_idx on purchase_orders (status);
create index if not exists purchase_orders_created_by_idx on purchase_orders (created_by);
create index if not exists purchase_orders_client_csn_idx on purchase_orders (client_csn);

create table if not exists purchase_order_items (
  id serial primary key,
  purchase_order_id integer not null references purchase_orders(id) on delete cascade,
  product_id integer references products(id),
  product_name text not null,
  sku text,
  qty numeric(12,2) not null default 1,
  list_price_usd numeric(14,2) not null,
  line_total_usd numeric(14,2) not null,
  line_total_brl numeric(14,2) not null
);
create index if not exists poi_order_idx on purchase_order_items (purchase_order_id);

create table if not exists sales_orders (
  id serial primary key,
  number text not null unique,
  seq integer not null,
  purchase_order_id integer not null references purchase_orders(id),
  order_date date not null,
  client_type text not null check (client_type in ('governo', 'privado')),
  contract_number text,
  proposal_number text,
  acceptance_date date,
  margin_pct numeric(8,4) not null default 0,
  seller_id text not null,
  seller_name text not null,
  finance_contact_name text,
  finance_contact text,
  payment_term_days integer,
  calculation_memo text,
  credit_used numeric(14,2) not null default 0,
  credit_generated numeric(14,2) not null default 0,
  sale_total_brl numeric(14,2) not null default 0,
  status text not null default 'aberto',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_orders_po_idx on sales_orders (purchase_order_id);
create index if not exists sales_orders_seller_idx on sales_orders (seller_id);

create table if not exists sales_order_items (
  id serial primary key,
  sales_order_id integer not null references sales_orders(id) on delete cascade,
  product_name text not null,
  sku text,
  qty numeric(12,2) not null,
  unit_price_brl numeric(14,2) not null,
  line_total_brl numeric(14,2) not null
);
create index if not exists soi_order_idx on sales_order_items (sales_order_id);

create table if not exists hubgov_ledger (
  id serial primary key,
  client_id integer,
  purchase_order_id integer,
  sales_order_id integer,
  kind text not null check (kind in ('generated', 'used')),
  amount numeric(14,2) not null,
  nf_number text,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists hubgov_nf_idx on hubgov_ledger (nf_number);
create index if not exists hubgov_kind_idx on hubgov_ledger (kind);

insert into document_counters (name, last_value) values ('odc', 0)
  on conflict (name) do nothing;
insert into document_counters (name, last_value) values ('pv', 0)
  on conflict (name) do nothing;

insert into suppliers (name, cnpj, city, state)
select 'PARS PRODUTOS DE PROCESSAMENTO DE DADOS LTDA', '27.626.290/0001-30', 'Rio de Janeiro', 'RJ'
where not exists (
  select 1 from suppliers where cnpj = '27.626.290/0001-30'
);
