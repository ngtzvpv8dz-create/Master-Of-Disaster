-- V645 · expose non-restockable flag to Food/Shopping
create or replace view public.food_inventory_overview as
select
  user_id,
  name,
  quantity_label,
  forecast_label,
  tone,
  note,
  sort_order,
  id,
  quantity,
  unit,
  is_active,
  opened,
  use_priority,
  pending_weighing,
  shopping_excluded
from public.food_inventory
where is_active=true;