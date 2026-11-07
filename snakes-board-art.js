(function(root){"use strict";
function boardOrder(){const out=[];for(let row=9;row>=0;row--){const line=Array.from({length:10},(_,i)=>row*10+i+1);if(row%2===1)line.reverse();out.push(...line)}return out}
const order=boardOrder();
function center(n){const i=order.indexOf(Number(n));return i<0?null:{x:i%10*100+50,y:Math.floor(i/10)*100+50}}
function shuffled(a,random=Math.random){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function generateLayout(random=Math.random){
 const roll=n=>Math.floor(random()*n),columns=shuffled([0,1,2,3,4,5,6,7,8,9],random);
 const snakeCount=2+roll(4);
 let ladderCount=2+roll(4);
 if(snakeCount===ladderCount)ladderCount=ladderCount===5?2:ladderCount+1;
 if(snakeCount+ladderCount>9)ladderCount=9-snakeCount;
 const square=(row,col)=>row*10+(row%2===0?col:9-col)+1;
 const snakes=[],ladders=[];
 for(let i=0;i<snakeCount;i++){
  const col=columns[i],highRow=3+roll(6),lowRow=roll(highRow-1);
  snakes.push({from:square(highRow,col),to:square(lowRow,col)});
 }
 for(let i=0;i<ladderCount;i++){
  const col=columns[snakeCount+i],lowRow=roll(7),highRow=lowRow+2+roll(7-lowRow);
  ladders.push({from:square(lowRow,col),to:square(highRow,col)});
 }
 return {snakes,ladders};
}
function ladder(from,to){const a=center(from),b=center(to);if(!a||!b)return "";const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,px=-dy/len*11,py=dx/len*11,ax=a.x+px,ay=a.y+py,bx=b.x+px,by=b.y+py,cx=a.x-px,cy=a.y-py,ex=b.x-px,ey=b.y-py;let rungs="";const count=Math.max(4,Math.floor(len/42));for(let i=1;i<count;i++){const t=i/count,x=a.x+dx*t,y=a.y+dy*t;rungs+='<line x1="'+(x+px)+'" y1="'+(y+py)+'" x2="'+(x-px)+'" y2="'+(y-py)+'"/>'}return '<g class="snake-art-ladder" data-link-from="'+from+'" data-link-to="'+to+'"><path d="M '+ax+' '+ay+' L '+bx+' '+by+' M '+cx+' '+cy+' L '+ex+' '+ey+'"/>'+rungs+'<circle cx="'+a.x+'" cy="'+a.y+'" r="5"/><circle cx="'+b.x+'" cy="'+b.y+'" r="5"/></g>'}
function snake(from,to,index){const a=center(from),b=center(to);if(!a||!b)return "";const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len,bend=(index%2?1:-1)*(28+(index%3)*8),mx=(a.x+b.x)/2+px*bend,my=(a.y+b.y)/2+py*bend,mx2=(a.x+b.x)/2-px*bend*.65,my2=(a.y+b.y)/2-py*bend*.65,d='M '+a.x+' '+a.y+' C '+mx+' '+my+' '+mx2+' '+my2+' '+b.x+' '+b.y;return '<g class="snake-art-serpent" data-link-from="'+from+'" data-link-to="'+to+'"><path class="snake-art-shadow" d="'+d+'"/><path class="snake-art-body" d="'+d+'"/><circle class="snake-art-head" cx="'+a.x+'" cy="'+a.y+'" r="12"/><circle class="snake-art-eye" cx="'+(a.x-4)+'" cy="'+(a.y-3)+'" r="2.2"/><circle class="snake-art-eye" cx="'+(a.x+4)+'" cy="'+(a.y-3)+'" r="2.2"/><path class="snake-art-tongue" d="M '+a.x+' '+(a.y+9)+' l -3 6 m 3 -6 l 3 6"/></g>'}
function overlay(snakes,ladders){const s=(snakes||[]).map((x,i)=>snake(Number(x.from),Number(x.to),i)).join(""),l=(ladders||[]).map(x=>ladder(Number(x.from),Number(x.to))).join("");return '<svg class="snakes-art-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+l+s+'</svg>'}
const pips={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function face(v,cls){const dots=new Set(pips[v]||[]);return '<span class="snake-die-face '+cls+'" aria-label="'+v+'">'+Array.from({length:9},(_,i)=>'<i class="'+(dots.has(i)?"is-dot":"")+'"></i>').join("")+'</span>'}
function cube(id,value){const n=Math.min(6,Math.max(1,Number(value)||1));return '<div class="snake-dice-stage"><div class="snake-dice-cube" id="'+id+'" data-result="'+n+'" role="img" aria-label="نرد، النتيجة '+n+'">'+face(n,"face-front")+face(2,"face-back")+face(3,"face-right")+face(4,"face-left")+face(5,"face-top")+face(6,"face-bottom")+'</div></div>'}
function animateDice(el,value,duration){if(!el)return;const n=Math.min(6,Math.max(1,Number(value)||1));el.dataset.result=String(n);el.setAttribute("aria-label","نرد، النتيجة "+n);const front=el.querySelector(".face-front"),paint=v=>{if(front){const dots=new Set(pips[v]||[]);front.innerHTML=Array.from({length:9},(_,i)=>'<i class="'+(dots.has(i)?"is-dot":"")+'"></i>').join("")}};el.classList.remove("is-rolling","is-settled");void el.offsetWidth;el.classList.add("is-rolling");let spin=root.setInterval(()=>paint(1+Math.floor(Math.random()*6)),75);root.setTimeout(()=>{root.clearInterval(spin);paint(n);el.classList.remove("is-rolling");el.classList.add("is-settled")},Math.max(700,Number(duration)||1250))}
root.SuwadSnakesBoardArt={boardOrder,center,overlay,cube,animateDice,generateLayout};
})(typeof window!=="undefined"?window:globalThis);
