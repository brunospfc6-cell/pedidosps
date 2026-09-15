alter table purchase_orders drop constraint if exists purchase_orders_status_check;
alter table purchase_orders add constraint purchase_orders_status_check
  check (status in ('rascunho', 'pendente_envio', 'enviado_pars', 'cancelado'));
