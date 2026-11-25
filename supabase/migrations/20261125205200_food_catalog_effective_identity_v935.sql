-- V935: read-only effective identity for new products; confirmed product links take precedence.
-- Unmatched new variants are review_required, never guessed from a broad family.
create or replace view public.food_catalog_product_identity_v1 with (security_invoker=true) as
select p.user_id,p.id as product_id,p.active,
coalesce(l.catalog_ingredient_id,case when l.product_id is null and x.n=1 then x.catalog_id end) as catalog_ingredient_id,
l.product_variant_id,
coalesce(c.name,v.variant_name,case when l.product_id is null and x.n=1 then x.canonical_name end,concat_ws(', ',p.product_name,nullif(btrim(p.variant),''))) as canonical_name,
coalesce(c.family_name,v.family_name,l.proposed_family_name,case when x.n=1 then x.family_name end,nullif(btrim(p.ingredient_family_name),''),case when p.category in ('Haushalt','Drogerie','Tierfutter') then p.category end) as family_name,
case when l.product_id is not null then l.review_status
when p.category in ('Haushalt','Drogerie','Tierfutter') then 'nonfood'
when x.n=1 then 'auto_exact'
else 'review_required' end as resolution
from public.shopping_products p
left join public.food_catalog_product_links l on l.product_id=p.id and l.user_id=p.user_id
left join public.food_catalog_ingredients c on c.id=l.catalog_ingredient_id and c.user_id=p.user_id
left join public.food_catalog_product_variants v on v.id=l.product_variant_id and v.user_id=p.user_id
left join lateral (
 select count(*) n,(array_agg(a.id))[1] catalog_id,min(a.name) canonical_name,min(a.family_name) family_name
 from public.food_catalog_ingredients a where a.user_id=p.user_id and a.catalog_role='Zutatenvariante'
 and lower(btrim(a.name))=lower(btrim(concat_ws(', ',p.product_name,nullif(btrim(p.variant),''))))
) x on l.product_id is null;
revoke all on public.food_catalog_product_identity_v1 from public, anon;
grant select on public.food_catalog_product_identity_v1 to authenticated;
comment on view public.food_catalog_product_identity_v1 is 'Current product identity; new exact catalogue names resolve automatically, other new products remain review_required.';

-- Persist the naming layer per recipe or meal ingredient, without altering the
-- original booking keys, amounts, historical product snapshots or lot IDs.
create or replace view public.food_catalog_recipe_positions_v1 with (security_invoker=true) as
select i.user_id,'recipe'::text as source_kind,i.recipe_id as parent_id,i.id as ingredient_id,
i.name as original_name,coalesce(v.canonical_name,i.name,i.label) as canonical_name,v.family_name,v.resolution
from public.food_recipe_ingredients i left join public.food_catalog_recipe_identity_v1 v
on v.user_id=i.user_id and v.inventory_id is not distinct from i.inventory_id
and v.source_name=coalesce(nullif(btrim(i.name),''),i.label)
union all
select i.user_id,'meal',i.meal_id,i.id,i.name,coalesce(v.canonical_name,i.name,i.label),v.family_name,v.resolution
from public.food_meal_ingredients i left join public.food_catalog_recipe_identity_v1 v
on v.user_id=i.user_id and v.inventory_id is not distinct from i.inventory_id
and v.source_name=coalesce(nullif(btrim(i.name),''),i.label);
revoke all on public.food_catalog_recipe_positions_v1 from public, anon;
grant select on public.food_catalog_recipe_positions_v1 to authenticated;
comment on view public.food_catalog_recipe_positions_v1 is 'Canonical designation per recipe/meal ingredient, including completed meals; does not modify booking records.';
