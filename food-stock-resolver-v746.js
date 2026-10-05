/* V746 · FOOD STOCK RESOLVER
   Gemeinsame Vorratsauflösung für FOOD und SHOPPING.
   Trennt semantisch austauschbare family_name-Gruppen von reinen Katalog-Hierarchien.
*/
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.__modFoodStockResolverV746=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const VERSION='V746';
  const FRESH=new Set(['frisch','frische','frischer','frisches','bio']);
  const FROZEN=new Set(['tk','tiefkühl','tiefgekühlt','tiefgefroren','gefroren']);

  const text=value=>String(value??'')
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/[·_]+/g,' ')
    .replace(/\s+/g,' ');

  const ingredientKey=value=>text(value)
    .replace(/[–—-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  const unique=values=>[...new Set(values.filter(Boolean))];

  function familyForms(value){
    const raw=String(value??'').trim();
    if(!raw)return [];
    const rawText=text(raw);
    const joined=text(raw.replace(/\s*[/|]\s*/g,' '));
    const parts=raw.split(/\s*[/|]\s*/).map(text).filter(Boolean);
    return unique([rawText,joined,...parts]);
  }

  function qualifierMode(value){
    const tokens=text(value).split(/\s+/).filter(Boolean);
    if(tokens.some(token=>FROZEN.has(token)))return 'frozen';
    if(tokens.some(token=>FRESH.has(token)))return 'fresh';
    return 'generic';
  }

  function qualifierOnly(value){
    const tokens=text(value).split(/\s+/).filter(Boolean);
    return tokens.length>0&&tokens.every(token=>FRESH.has(token)||FROZEN.has(token));
  }

  function familyNeedMatch(name,familyName){
    const needs=familyForms(name);
    const families=familyForms(familyName);
    if(!needs.length||!families.length)return null;

    for(const need of needs){
      for(const family of families){
        if(need===family)return {matched:true,mode:'generic',alias:family};
      }
    }

    for(const need of needs){
      for(const family of families){
        const prefix=need.startsWith(family+' ')?need.slice(family.length).trim():'';
        const suffix=need.endsWith(' '+family)?need.slice(0,need.length-family.length).trim():'';
        const remainder=prefix||suffix;
        if(!remainder||!qualifierOnly(remainder))continue;
        return {matched:true,mode:qualifierMode(remainder),alias:family};
      }
    }
    return null;
  }

  function rowMode(item){
    const value=text([
      item?.name,
      item?.variant_label,
      item?.catalog_variant_label,
      item?.catalog_group_label
    ].filter(Boolean).join(' '));
    if(/(?:^|\s)(?:tk|tiefkühl|tiefgekühlt|tiefgefroren|gefroren)(?:\s|$)/.test(value))return 'frozen';
    if(/(?:^|\s)(?:frisch|frische|frischer|frisches)(?:\s|$)/.test(value))return 'fresh';
    return 'neutral';
  }

  function quantityInUnit(stock,targetUnit){
    if(!stock)return {available:0,unitMismatch:false,converted:false};
    const quantity=Math.max(0,Number(stock.quantity)||0);
    const source=String(stock.unit||'').trim();
    const target=String(targetUnit||'').trim();
    if(!target||source===target)return {available:quantity,unitMismatch:false,converted:false};
    if(source==='kg'&&target==='g')return {available:quantity*1000,unitMismatch:false,converted:true};
    if(source==='g'&&target==='kg')return {available:quantity/1000,unitMismatch:false,converted:true};
    if(source==='l'&&target==='ml')return {available:quantity*1000,unitMismatch:false,converted:true};
    if(source==='ml'&&target==='l')return {available:quantity/1000,unitMismatch:false,converted:true};
    if(target==='g'&&/^(Päckchen|Packung)$/i.test(source)){
      const match=String(stock.note||'').match(/([0-9]+(?:[.,][0-9]+)?)\s*g\s+pro\s+(?:Päckchen|Packung)/i);
      if(match){
        const grams=Number(match[1].replace(',','.'));
        if(Number.isFinite(grams)&&grams>0)return {available:quantity*grams,unitMismatch:false,converted:true};
      }
    }
    return {available:0,unitMismatch:true,converted:false};
  }

  function sumRows(rows,targetUnit,mode='generic'){
    let matches=(rows||[]).filter(row=>row?.is_active!==false);
    if(mode==='fresh'){
      const explicit=matches.filter(row=>rowMode(row)==='fresh');
      matches=explicit.length?explicit:matches.filter(row=>rowMode(row)!=='frozen');
    }else if(mode==='frozen'){
      matches=matches.filter(row=>rowMode(row)==='frozen');
    }
    let available=0;
    let compatible=0;
    let converted=false;
    for(const row of matches){
      const info=quantityInUnit(row,targetUnit);
      if(info.unitMismatch)continue;
      available+=Math.max(0,info.available||0);
      compatible++;
      converted=converted||info.converted;
    }
    return {
      available,
      converted,
      unitMismatch:matches.length>0&&compatible===0,
      rows:matches
    };
  }

  function familyRows(familyName,inventoryRows,targetUnit,mode='generic'){
    const familyKey=text(familyName);
    const matches=(inventoryRows||[]).filter(row=>
      row?.is_active!==false&&row?.family_name&&text(row.family_name)===familyKey
    );
    return {
      ...sumRows(matches,targetUnit,mode),
      family:true,
      familyName,
      familyMode:mode,
      stock:null,
      resolution:'family'
    };
  }

  function exactRow(row,targetUnit,resolution='exact'){
    const info=quantityInUnit(row,targetUnit);
    return {
      ...info,
      family:false,
      rows:row?[row]:[],
      stock:row||null,
      resolution
    };
  }

  function semanticFamily(name,inventoryRows,targetUnit){
    const families=new Map();
    for(const row of inventoryRows||[]){
      if(row?.is_active===false||!row?.family_name)continue;
      const key=text(row.family_name);
      if(!families.has(key))families.set(key,row.family_name);
    }
    for(const familyName of families.values()){
      const match=familyNeedMatch(name,familyName);
      if(match)return familyRows(familyName,inventoryRows,targetUnit,match.mode);
    }
    return null;
  }

  function aliasRow(name,inventoryRows,inventoryAliases,targetUnit){
    const need=text(name);
    if(!need)return null;
    const byId=new Map((inventoryRows||[]).filter(row=>row?.is_active!==false).map(row=>[String(row.id),row]));
    const matches=unique((inventoryAliases||[])
      .filter(alias=>text(alias?.alias)===need)
      .map(alias=>String(alias.inventory_id||'')))
      .map(id=>byId.get(id))
      .filter(Boolean);
    if(matches.length!==1)return null;
    const row=matches[0];
    if(row.family_name){
      const familyMatch=familyNeedMatch(name,row.family_name);
      if(familyMatch)return familyRows(row.family_name,inventoryRows,targetUnit,familyMatch.mode);
    }
    return exactRow(row,targetUnit,'alias');
  }

  function catalogForms(row){
    const family=text(row?.catalog_family_name);
    const group=text(row?.catalog_group_label);
    const variant=text(row?.catalog_variant_label);
    return unique([
      [family,group,variant].filter(Boolean).join(' '),
      [family,variant].filter(Boolean).join(' '),
      [group,variant].filter(Boolean).join(' '),
      [variant,group,family].filter(Boolean).join(' ')
    ]);
  }

  function catalogRow(name,inventoryRows,targetUnit){
    const need=ingredientKey(name);
    if(!need)return null;
    const matches=(inventoryRows||[]).filter(row=>
      row?.is_active!==false&&catalogForms(row).some(form=>ingredientKey(form)===need)
    );
    if(matches.length!==1)return null;
    return exactRow(matches[0],targetUnit,'catalog');
  }

  function resolve({item={},inventoryRows=[],inventoryAliases=[]}={}){
    const rows=(inventoryRows||[]).filter(row=>row?.is_active!==false);
    const name=String(item?.name||item?.label||'').trim();
    const unit=String(item?.unit||'').trim();
    const byId=new Map(rows.map(row=>[String(row.id),row]));

    if(item?.inventory_id){
      const row=byId.get(String(item.inventory_id))||null;
      if(row?.family_name){
        const match=familyNeedMatch(name,row.family_name);
        if(match)return familyRows(row.family_name,rows,unit,match.mode);
      }
      return exactRow(row,unit,'inventory_id');
    }

    const family=semanticFamily(name,rows,unit);
    if(family)return family;

    const exact=rows.filter(row=>ingredientKey(row?.name)===ingredientKey(name));
    if(exact.length===1){
      const row=exact[0];
      if(row.family_name){
        const match=familyNeedMatch(name,row.family_name);
        if(match)return familyRows(row.family_name,rows,unit,match.mode);
      }
      return exactRow(row,unit,'exact');
    }

    const alias=aliasRow(name,rows,inventoryAliases,unit);
    if(alias)return alias;

    const catalog=catalogRow(name,rows,unit);
    if(catalog)return catalog;

    return {
      available:0,converted:false,unitMismatch:false,family:false,
      familyName:null,familyMode:'generic',rows:[],stock:null,resolution:'none'
    };
  }

  return {
    version:VERSION,
    resolve,
    familyNeedMatch,
    familyForms,
    quantityInUnit,
    rowMode
  };
});
