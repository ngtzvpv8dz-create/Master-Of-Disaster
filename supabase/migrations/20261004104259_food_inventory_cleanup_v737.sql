-- V737: bestätigte Bestandskorrekturen und vereinheitlichte Katalog-Hierarchie.

update public.food_inventory_lots
set opened_remaining_quantity=150,
    opened_remaining_unit='g',
    updated_at=now(),
    note=trim(both ' ' from concat_ws(' ',nullif(note,''),'Korrektur 04.10.2026: HelloFresh-Bestand wiederhergestellt. Der Verbrauch am 03.10. gehörte zur REWE-Bio-Charge.'))
where id='68c1f3ca-9f73-4193-a0d5-744103460d08';

update public.food_inventory_lots
set opened_remaining_quantity=383,
    opened_remaining_unit='g',
    updated_at=now(),
    note=trim(both ' ' from concat_ws(' ',nullif(note,''),'Korrektur 04.10.2026: 130 g Verbrauch der Mahlzeit vom 03.10. aus dieser REWE-Bio-Charge berücksichtigt.'))
where id='1d7542b2-0895-44c5-96f1-a95fa114f771';

update public.food_inventory_lots
set package_quantity=17,
    package_unit='Stück',
    package_label='125 g · 17 Stück',
    updated_at=now(),
    note='Zwei ungeöffnete Packungen mit je 17 Stück / 125 g. MHD 01.05.2027.'
where id='e86c94fa-fe3c-44bc-b1bb-afab435e8046';

update public.food_inventory_lots
set package_label='125 g · 17 Stück',
    updated_at=now()
where id='30d69468-8c89-4032-93b4-e7b405857b4b';

update public.food_inventory
set catalog_family_name='Kaffee',catalog_group_label=null,catalog_variant_label='2in1 Kaffee-Sticks',updated_at=now()
where id='255acd2b-677b-4ca9-9ba5-a89be2d2c1e7';

update public.food_inventory
set catalog_family_name='Reis',catalog_group_label='Expressreis',
    catalog_variant_label=case name
      when 'Burrito-Bowl' then 'Burrito Bowl'
      when 'Express-Reis Asiatische Art' then 'Asiatische Art'
      when 'Express-Reis Mediterrane Art' then 'Mediterrane Art'
      when 'Express-Reis Sweet Chilli' then 'Sweet Chilli'
      else catalog_variant_label end,
    updated_at=now()
where name in ('Burrito-Bowl','Express-Reis Asiatische Art','Express-Reis Mediterrane Art','Express-Reis Sweet Chilli');

update public.food_inventory
set catalog_family_name='Reis',catalog_group_label='Kochbeutel',
    catalog_variant_label=case name
      when 'Langkornreis' then 'Langkorn'
      when 'Naturreis im Kochbeutel' then 'Naturreis'
      else catalog_variant_label end,
    updated_at=now()
where name in ('Langkornreis','Naturreis im Kochbeutel');

update public.food_inventory
set catalog_family_name='Nudeln',catalog_group_label='Lasagne',catalog_variant_label='Lasagneplatten',updated_at=now()
where name='Lasagneplatten';

update public.food_inventory
set catalog_family_name='Nudeln',catalog_group_label='Penne',catalog_variant_label='Rigate',updated_at=now()
where name='Penne Rigate';

update public.food_inventory
set catalog_family_name='Öl',catalog_group_label='Olivenöl',catalog_variant_label='Nativ extra',updated_at=now()
where name='Olivenöl';

update public.food_inventory
set catalog_family_name='Mehl',
    catalog_group_label=case name when 'Dinkelmehl Type 1050' then 'Dinkel' when 'Roggenmehl Type 1150' then 'Roggen' else catalog_group_label end,
    catalog_variant_label=case name when 'Dinkelmehl Type 1050' then 'Type 1050' when 'Roggenmehl Type 1150' then 'Type 1150' else catalog_variant_label end,
    updated_at=now()
where name in ('Dinkelmehl Type 1050','Roggenmehl Type 1150');

update public.food_inventory set catalog_family_name='Bohnen',catalog_group_label=null,catalog_variant_label='Schwarze Bohnen',updated_at=now()
where name='Schwarze Bohnen';

update public.food_inventory set catalog_family_name='Wraps',catalog_group_label='Tortilla',catalog_variant_label='Vollkorn',updated_at=now()
where name='Tortilla Wraps Vollkorn';

update public.food_inventory set catalog_family_name='Honig',catalog_group_label=null,catalog_variant_label='Waldhonig',updated_at=now()
where name='Waldhonig';

update public.food_inventory
set catalog_family_name='Brot',catalog_group_label=null,
    catalog_variant_label=case name when 'Roggen-Vollkornbrot' then 'Roggen-Vollkornbrot' when 'Vitalbrot' then 'Vitalbrot' else catalog_variant_label end,
    updated_at=now()
where name in ('Roggen-Vollkornbrot','Vitalbrot');
