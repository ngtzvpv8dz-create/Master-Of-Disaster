(() => {
 const map={
  sport:['SPORT','33.3333% 0%'],kistology:['KISTOLOGY','66.6667% 0%'],food:['FOOD','100% 0%'],
  shopping:['EINKAUFSLISTE','0% 100%'],finance:['FINANZEN','33.3333% 100%'],progress:['PROGRESS','66.6667% 100%'],backstage:['BACKSTAGE','100% 100%']
 };
 const area=new URL(location.href).searchParams.get('area')||'bereich';
 const info=map[area]||['BEREICH','50% 50%'];
 document.getElementById('placeholderKicker').textContent=info[0];
 document.getElementById('placeholderTitle').textContent=info[0]+' 2.0';
 const icon=document.getElementById('placeholderIcon');
 if(map[area]) icon.style.backgroundPosition=info[1];
})();