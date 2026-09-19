(() => {
 const map={
  sport:['SPORT','#6f8b72'],kistology:['KISTOLOGY','#a9805e'],food:['FOOD','#789276'],
  shopping:['EINKAUFSLISTE','#c49a68'],finance:['FINANZEN','#72919b'],progress:['PROGRESS','#8aa6a1'],backstage:['BACKSTAGE','#88848f']
 };
 const area=new URL(location.href).searchParams.get('area')||'bereich';
 const info=map[area]||['BEREICH','#c9a36d'];
 document.getElementById('placeholderKicker').textContent=info[0];
 document.getElementById('placeholderTitle').textContent=info[0]+' 2.0';
 const icon=document.getElementById('placeholderIcon');
 if(map[area]){
   icon.style.backgroundImage='url(./assets/icons/'+area+'.webp)';
   icon.style.backgroundSize='cover';
   icon.style.backgroundPosition='center';
 }
})();