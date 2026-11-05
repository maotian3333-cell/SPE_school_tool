(function(){
'use strict';
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s==null?'':s).replace(/\s+/g,'');
const DAYCH={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7};
const DAYN=['','一','二','三','四','五','六','日'];
const CNUM={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
const TIMES={0:['07:45','08:00'],1:['08:10','08:55'],2:['09:10','09:55'],3:['10:10','10:55'],4:['11:10','11:55'],5:['13:10','13:55'],6:['14:10','14:55'],7:['15:10','15:55'],8:['16:10','16:55']};
/* 課名簡化：去掉（兼），並可在這裡自訂縮短的課名（左：原課名，右：印在課表上的名稱） */
const SUBJECT_SHORT={'公民與社會':'公民','走跳世界面面觀':'走跳世界'};
function cleanSubject(n){n=String(n==null?'':n).replace(/[\(（]\s*兼\s*[\)）]/g,'').trim();return SUBJECT_SHORT[n]||n;}
const pName=p=>p===0?'早自習':'第'+p+'節';
const LS='kebiao-helper-v1';

/* =====================================================================
 * 學生清單（班級／座號／姓名）可自由擴充，兩種方式都保留：
 *  (A) 直接在網頁填：「約家長開會」區塊的「學生清單」→「新增一列」，或貼上多行「班級 座號 姓名」。
 *  (B) 由程式碼填入：在下面 EXTRA_STUDENTS 陣列加入物件，格式如下（一行一位，逗號結尾）：
 *        {cls:'901', seat:'28', name:'黃生'},
 *      也可以在別處呼叫 window.kebiao.addStudents([{cls:'901',seat:'28',name:'黃生'}]) 動態加入。
 *  匯入的學生名冊、手動新增、程式碼填入三者會自動合併、去除重複，供「學生」選單使用。
 * ===================================================================== */
const EXTRA_STUDENTS=[
  // {cls:'901', seat:'28', name:'黃生'},
  // {cls:'902', seat:'2',  name:'李生'},
];

/* ---------- pixel 小插圖（每個字母對應一個主題色，見 CSS 的 --px-*） ---------- */
const SPR_DEF={
  clock:["...kkkkk...","..kyyyyyk..",".kyyykyyyk.","kyyyykyyyyk","kyyyykyyyyk","kyyyykkkyyk","kyyyyyyyyyk","kyyyyyyyyyk",".kyyyyyyyk.","..kyyyyyk..","...kkkkk..."],
  pencil:["..........cc",".........ccc","........bbb.",".......bbb..","......bbb...",".....bbb....","....bbb.....","...yyy......","..yyy.......",".kyy........","kk.........."],
  apple:["....n....","...nggg..",".ccc.ccc.","cwccccccc","ccccccccc","ccccccccc","ccccccccc",".ccccccc.","..cc.cc.."],
  star:["....b....","....b....","...bbb...","bbbbbbbbb",".bbbbbbb.","..bbbbb..","..bbbbb..",".bbb.bbb.",".bb...bb."],
  book:["aaaaaaaaaa.","aaabbbbaaa.","aaaaaaaaaaw","aaaaaaaaaaw","aaaaaaaaaaw","aaaaaaaaaaw","kkkkkkkkkk."],
  build:[".......cc.......","......cccc......",".....cccccc.....","...cccccccccc...","..cccccccccccc..","..yyyyyyyyyyyy..","..yddyyddyyddy..","..yddyyddyyddy..","..yyyyynnyyyyy..","..yddyynnyyddy..",".kkkkkkkkkkkkkk."],
  tree:["..ggg..",".ggggg.","ggggggg","ggggggg",".ggggg.","...n...","...n...","...n..."],
  cloud:["...mmm...",".mmmmmmm.","mmmmmmmmm"],
  cloud2:["..mm..",".mmmm.","mmmmmm"]
};
function pix(rows,scale){
  const h=rows.length,w=Math.max.apply(null,rows.map(r=>r.length));let out='';
  rows.forEach((r,y)=>{let x=0;while(x<r.length){const c=r[x];if(c==='.'){x++;continue;}let e=x;while(e<r.length&&r[e]===c)e++;
    out+='<rect class="px-'+c+'" x="'+x+'" y="'+y+'" width="'+(e-x)+'" height="1"/>';x=e;}});
  return '<svg class="pxs" viewBox="0 0 '+w+' '+h+'" width="'+w*scale+'" height="'+h*scale+'" shape-rendering="crispEdges" aria-hidden="true" focusable="false">'+out+'</svg>';}
const SPR={};Object.keys(SPR_DEF).forEach(k=>{SPR[k]=pix(SPR_DEF[k],3);});
function sceneSVG(){
  const W=40,H=12,g=Array.from({length:H},()=>new Array(W).fill('.'));
  const stamp=(rows,x0,y0)=>rows.forEach((r,y)=>{for(let x=0;x<r.length;x++){const c=r[x];if(c!=='.'&&g[y0+y]&&x0+x<W)g[y0+y][x0+x]=c;}});
  stamp(SPR_DEF.cloud,3,1);stamp(SPR_DEF.cloud2,31,0);stamp(SPR_DEF.build,12,0);stamp(SPR_DEF.tree,31,3);stamp(SPR_DEF.tree,6,4);
  for(let x=0;x<W;x++)g[11][x]='g';
  return pix(g.map(r=>r.join('')),1);}
const emptyHTML=(text,k)=>'<div class="empty emp">'+(SPR[k]||'')+'<span>'+esc(text)+'</span></div>';

/* ---------- 辦公室座位表 ----------
 * 資料來源：「115 學年度 導師及專任教師辦公室座位圖」。
 * 寫法：'排-位置':'老師姓名'。排＝從下往上數；位置＝同一排從左往右數（沒人坐的空位也要算進去）。
 * 例：丹鼎樓四樓 409 的 '2-3':'鐘惠雅' → 通知單左上角會顯示「丹鼎樓四樓 409 2-3」。
 * 換學年、換座位時，只要改這一段就好（姓名要和課表上的老師姓名完全一樣）。 */
const SEAT_MAP=[
  ['迎曦樓三樓 312-313',{
    '1-1':'蔡志強', '1-2':'江美珠', '1-3':'林巧珮', '1-4':'吳明珊', '1-5':'陳麗玉', '1-6':'王意婷',
    '1-7':'王慧琴', '1-8':'阮昱臻', '1-9':'周宜融', '2-1':'陳燕如', '2-2':'鄭秀玲', '2-3':'劉芳婷',
    '2-4':'陳胤如', '2-5':'楊守民', '2-6':'李銘珠', '2-7':'吳娟瑜', '2-8':'楊惇貴', '2-9':'紀昕妤',
    '2-10':'陳靜薇', '3-1':'蔡峰菖', '3-3':'李淅湄', '3-4':'高惠娟', '3-5':'呂櫻玉', '3-6':'夏良業',
    '3-7':'王秀筠', '3-8':'陳彥樺', '3-9':'黃純慧', '3-10':'余季蓁', '4-1':'黃宇瑄', '4-2':'黃美智',
    '4-3':'趙麗雲', '4-4':'林佳瑩', '4-5':'王乃聖', '4-6':'周木財', '4-7':'吳亭蓉', '4-8':'林心宜',
    '4-9':'謝宜頡', '4-10':'官美霞',
  }],
  ['迎曦樓四樓 414-415',{
    '1-1':'陳彥旭', '1-2':'徐婉綺', '1-3':'江素滿', '1-4':'劉頌平', '1-5':'朱蕙苓', '1-6':'黃敏婷',
    '1-7':'林正順', '1-8':'洪媖雪', '1-9':'蔡嘉柔', '1-10':'陳孟君', '2-1':'連淑惠', '2-2':'鄭丹',
    '2-3':'莊宜家', '2-4':'周禹丞', '2-5':'賴玟玲', '2-6':'林佳慧', '2-7':'杜鳳清', '2-8':'李富川',
    '2-9':'林季諭', '2-10':'許升銓', '3-1':'劉詩捷', '3-2':'蔡秀芳', '3-3':'陳志文', '3-4':'林俊昌',
    '3-5':'黃琦璋', '3-7':'劉芷廷', '3-8':'吳韋寬', '3-9':'吳佳玲', '3-10':'邱雅琳', '4-1':'林靜芬',
    '4-2':'蘇郁雅', '4-3':'林旻秋', '4-4':'劉淑芬', '4-5':'吳佩蓉', '4-6':'何美倫', '4-7':'蔡睿詮',
    '4-8':'楊瑞蓮', '4-9':'許文萍',
  }],
  ['丹鼎樓四樓 409',{
    '1-1':'王一婷', '1-2':'林宜君', '1-3':'蔡宜諼', '1-4':'凃玉娟', '1-5':'伍智瑜', '1-6':'黃明宏',
    '1-7':'方健州', '1-8':'葉俊豪', '1-9':'李立儀', '1-10':'陳淑珍', '2-1':'林樹人', '2-3':'鐘惠雅',
    '2-4':'楊茜惠', '2-5':'林建宏', '2-6':'溫杰勳', '2-7':'陳昱蓁', '2-8':'蔣寶慧', '2-9':'郭國樑',
    '2-10':'張瑞顯', '3-1':'黃如瑋', '3-2':'張文俊', '3-3':'陳思穎', '3-4':'粘惠柔', '3-5':'許淑珍',
    '3-6':'張素連', '3-7':'梁雅映', '3-8':'李耿維', '3-9':'廖美蘭', '4-1':'李春淋', '4-2':'羅昊剛',
    '4-3':'劉梅娟', '4-4':'陳慧如', '4-5':'呂麗君', '4-6':'陳曉琪', '4-7':'溫素敏', '4-8':'林彥良',
    '4-9':'黃銘義', '4-10':'葉競賢',
  }],
  ['丹鼎樓四樓 410',{
    '1-3':'陳韋仲', '1-4':'馮蘭馨', '2-1':'徐碧姻', '2-3':'劉怡君', '2-4':'吳汶珊', '3-1':'林家卉',
    '3-2':'錢君銜', '3-3':'劉芷彤', '3-4':'吳銘彥', '4-1':'徐淳濃', '4-2':'周逸婷', '4-3':'江享貞',
    '4-4':'詹盛仁',
  }],
  ['丹鼎樓五樓 510',{
    '1-2':'林英哲', '1-3':'連雅蓉', '2-1':'周宛瑢', '2-2':'毛思文', '2-3':'劉宜純', '3-2':'劉懿慧',
    '3-3':'江秋蘭',
  }],
  ['朝陽樓四樓 412',{
    '1-1':'黃俊衛', '1-2':'葉步芳', '2-1':'柳心恬', '2-2':'莊文水', '3-1':'張詩宜', '3-2':'徐柏青',
    '4-1':'楊正仲', '4-2':'劉梅芳',
  }],
];
const SEATS={};SEAT_MAP.forEach(function(r){for(const k in r[1])SEATS[r[1][k]]=r[0]+' '+k;});

const S={schedules:{},roster:[],rosterSample:false,subjects:[],
  settings:{year:'',sem:'',clsFmt:'code',start:'',end:'',datesEdited:false,userSet:false},
  me:'',target:'',homeroom:{},alias:{},sel:new Set(),pv:'',pvMode:'res',tab:'overlap',
  pick:new Set(),pickDelay:{},people:[{role:'導師',key:''}],pickInit:false,svMsg:'',extra:[],mt:{title:'0',custom:'',stu:'',place:'0',placeCustom:'',date:'',t1:'',t2:'',host:'',ext:'131',off:[],extraRec:[]},mtPage:0,sv:{dur:20,delay:0,week:'',due:'',topic:'學生的學習與輔導事宜',stu:''}};

/* ---------- storage ---------- */
function save(){try{const sch={};for(const k in S.schedules)if(!S.schedules[k].sample)sch[k]=S.schedules[k];
  localStorage.setItem(LS,JSON.stringify({schedules:sch,settings:S.settings,me:S.me,people:S.people,homeroom:S.homeroom,alias:S.alias,extra:S.extra,sv:S.sv,mt:S.mt}));}catch(e){}}
function load(){try{const j=JSON.parse(localStorage.getItem(LS)||'null');if(!j)return false;
  Object.assign(S.schedules,j.schedules||{});for(const k in S.schedules){const s=S.schedules[k];if(s.cells){delete s.cells[6];delete s.cells[7];}s.errs=[];}/* 舊版存下來的星期六警告不再保留 */Object.assign(S.settings,j.settings||{});S.me=j.me||'';S.people=(j.people&&j.people.length)?j.people:[{role:'導師',key:j.target||''}];S.homeroom=j.homeroom||{};S.alias=j.alias||{};S.extra=j.extra||[];Object.assign(S.sv,j.sv||{});Object.assign(S.mt,j.mt||{});
  return Object.keys(S.schedules).length>0;}catch(e){return false;}}

/* ---------- delimited text ---------- */
function parseDelimited(text,delim){
  const rows=[];let row=[],f='',i=0,q=false;const n=text.length;
  while(i<n){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i+=2;continue;}q=false;i++;continue;}f+=c;i++;continue;}
    if(c==='"'&&f===''){q=true;i++;continue;}
    if(c===delim){row.push(f);f='';i++;continue;}
    if(c==='\r'){i++;continue;}
    if(c==='\n'){row.push(f);rows.push(row);row=[];f='';i++;continue;}
    f+=c;i++;}
  if(f!==''||row.length){row.push(f);rows.push(row);}
  return rows;}

/* ---------- 課表解析（教師課表／班級課表） ---------- */
const PLACE_RE=/(教室|專科|球場|操場|體育館|禮堂|圖書館|外師|視聽|會議室|工場|活動中心|[室館場廳棟樓]$)/;
const placeLike=t=>PLACE_RE.test(t);
const teacherLike=t=>(/^[一-鿿‧·]{2,4}$/.test(t)||/^[A-Za-z][A-Za-z .'-]{1,20}$/.test(t))&&!placeLike(t);
const classLike=t=>/^\d{2,4}[A-Za-z]?$/.test(t);
function groupScore(kind,g){const n=g.length;
  if(n===1)return -8;if(n>3)return -9;
  if(kind==='teacher'){
    if(n===2)return classLike(g[1])?4:-4;
    if(classLike(g[1])&&!classLike(g[2]))return placeLike(g[2])?3:1;
    if(classLike(g[1])&&classLike(g[2]))return -2;
    return -7;}
  if(n===2)return teacherLike(g[1])?3:(placeLike(g[1])?-5:-1);
  return (teacherLike(g[1])?2:-3)+(placeLike(g[2])?4:(teacherLike(g[2])?-3:0))-1;}
function tokenize(seg,tabEmpty){
  seg=seg.replace(/ /g,' ');const out=[];const tp=seg.split('\t');
  tp.forEach((part,i)=>{
    if(tabEmpty&&part===''&&i>0&&i<tp.length-1){out.push(null);return;}
    for(const l of part.split('\n')){if(l==='')continue;const t=l.trim();
      if(t===''){out.push(null);continue;}
      if(/^(上|下|午)$/.test(t))continue;
      out.push(t);}
  });return out;}
function partition(items,ncols,kind){
  const n=items.length,memo=new Map();
  function go(i,c){
    if(i===n)return c===ncols?{s:0,cells:[]}:null;
    if(c>=ncols)return null;
    const key=i*16+c;if(memo.has(key))return memo.get(key);
    let best=null;
    if(items[i]===null){const r=go(i+1,c+1);if(r)best={s:r.s,cells:[null].concat(r.cells)};}
    else for(let len=1;len<=4;len++){
      if(i+len>n)break;let ok=true;for(let k=0;k<len;k++)if(items[i+k]===null){ok=false;break;}
      if(!ok)break;
      const g=items.slice(i,i+len);const r=go(i+len,c+1);
      if(r){const s=r.s+groupScore(kind,g);if(!best||s>best.s)best={s:s,cells:[g].concat(r.cells)};}}
    memo.set(key,best);return best;}
  return go(0,0);}
const LABEL_RE=/(?:(\d{1,2}:\d{2})\s*)?[  ]*[︴|｜︱︳]?\s*(?:(\d{1,2}:\d{2})\s*)?(第\s*[一二三四五六七八九十]+\s*節|早\s*自\s*習)/g;
const TITLE_RE=/(\d{2,3})\s*學年(?:度)?\s*第\s*(\d)\s*學期[\s　]*([^\n\t]*?)\s*(老師|教師|班級)\s*課表/g;

function fitRow(seg,ncols,kind){
  let best=null;
  for(const te of [false,true]){
    const items=tokenize(seg,te);
    for(let x=0;x<=3;x++){const it=items.slice();let k=0;while(k<x&&it.length&&it[it.length-1]===null){it.pop();k++;}
      if(k!==x)break;const res=partition(it,ncols,kind);
      if(res){const sc=res.s-x*2-(te?1:0);if(!best||sc>best.sc)best={res:res,extra:x,sc:sc};}}
    /* 最後一欄（星期六）空白時，複製出來的文字常常少了結尾的空白格，補回 1～2 格再試 */
    for(let x=1;x<=2;x++){const it=items.slice();for(let k=0;k<x;k++)it.push(null);const res=partition(it,ncols,kind);
      if(res){const sc=res.s-x*2-(te?1:0);if(!best||sc>best.sc)best={res:res,extra:0,sc:sc};}}}
  return best;}
function parseSchedule(kind,idStr,year,sem,body){
  const hm=body.match(/^[\t  ]*(?:[一二三四五六日][\t  ]+){4,6}[一二三四五六日]?[\t  ]*$/m);
  if(!hm)throw new Error('找不到「一 二 三 四 五」的星期標題列');
  const dayOrder=hm[0].split(/[\t  ]+/).filter(Boolean).map(c=>DAYCH[c]);
  const ncols=dayOrder.length;
  body=body.slice(hm.index+hm[0].length);
  const labels=[];let m;const re=new RegExp(LABEL_RE.source,'g');
  while((m=re.exec(body))){
    const nm=norm(m[3]);const p=nm==='早自習'?0:CNUM[nm.replace(/[第節]/g,'')];
    if(p==null)continue;
    labels.push({start:m.index,end:m.index+m[0].length,p:p,t:(m[1]&&m[2])?[m[1],m[2]]:null});}
  if(!labels.length)throw new Error('找不到「第一節、第二節…」的節次標記');
  const segs=[body.slice(0,labels[0].start)];
  labels.forEach((l,i)=>segs.push(body.slice(l.end,i+1<labels.length?labels[i+1].start:body.length)));
  const before=tokenize(segs[0],false).length>0;
  const kindKey=kind==='teacher'?'teacher':'class';
  const cells={},times={},warns=[];
  labels.forEach((l,k)=>{
    const seg=segs[before?k:k+1];
    const fr=fitRow(seg,ncols,kindKey);
    if(!fr){const cnt=tokenize(seg,false).length;
      throw new Error(pName(l.p)+'那一列無法切成 '+ncols+' 格（讀到 '+cnt+' 個項目）。複製時請連空白格一起複製。');}
    const res=fr.res;/* 多出的空白格通常就是星期六那一欄（本校星期六沒有課），不必提醒 */
    if(l.t)times[l.p]=l.t;
    res.cells.forEach((g,j)=>{if(!g)return;const d=dayOrder[j];
      const c=kind==='teacher'?{subject:g[0],cls:g[1]||'',place:g[2]&&!classLike(g[2])?g[2]:''}:{subject:g[0],teacher:g[1]||'',place:g[2]||''};
      (cells[d]=cells[d]||{})[l.p]=c;});
  });
  const satN=Object.keys(cells[6]||{}).length+Object.keys(cells[7]||{}).length;
  delete cells[6];delete cells[7];
  const o=mkSchedObj(kind,idStr,year,sem,cells,times);o.warns=warns;
  o.errs=satN?['星期六出現 '+satN+' 堂課。本校星期六沒有課，通常表示貼上的內容錯位或不完整，請回到原系統重新複製這份課表。']:[];
  return o;}
function mkSchedObj(kind,idStr,year,sem,cells,times,sample){
  idStr=idStr.replace(/\s+/g,'');let code='',name=idStr;
  if(kind==='teacher'){const m=idStr.match(/^(\d+)?(.*)$/);code=m[1]||'';name=m[2]||idStr;}
  return {key:kind+'|'+year+'|'+sem+'|'+idStr,kind:kind,year:String(year),sem:String(sem),id:idStr,code:code,name:name,
    label:kind==='teacher'?((code?code+' ':'')+name):idStr,cells:cells,times:times||{},sample:!!sample};}

/* ---------- 學生名冊解析 ---------- */
function parseCell(v){
  const m=v.match(/^\s*([^\(（\n]*?)\s*[\(（]([^\)）]*)[\)）]\s*(\d+)?/);
  if(!m)return null;
  const rest=v.slice(m.index+m[0].length);const slots=[];const re=/(\d)\s*[-－–—]\s*(\d{1,2})/g;let x;
  while((x=re.exec(rest)))slots.push({d:+x[1],p:+x[2]});
  return {group:m[1].trim(),tch:m[2].trim(),n:m[3]?+m[3]:slots.length,slots:slots};}
const KNOWN2=/^(數學|國文|英文|英語|國語|社會|自然|理化|地理|歷史|公民|生物|體育|藝術|音樂|美術|輔導|家政|童軍|電腦|資訊|閱讀|作文|注音|語文|生活|職業)$/;
function parseRoster(text){
  const first=text.split('\n',1)[0];
  const delim=text.indexOf('\t')>=0?'\t':',';
  const rows=parseDelimited(text,delim);
  const hi=rows.findIndex(r=>r.some(c=>norm(c)==='姓名')&&r.some(c=>norm(c)==='座號'));
  if(hi<0)throw new Error('找不到含「年級、班級、座號、姓名」的標題列');
  const H=rows[hi].map(norm);
  const ci={grade:H.indexOf('年級'),cls:H.indexOf('班級'),seat:H.indexOf('座號'),name:H.indexOf('姓名')};
  const top=hi>0?rows[hi-1].map(c=>String(c).trim()):[];
  const hdrSet=new Set(H.filter(Boolean));
  const nameLike=s=>/^[一-鿿]{2,4}$/.test(s);
  let subj=[];
  for(let c=ci.name+1;c<H.length;c++){
    if(!H[c])continue;const t=top[c]||'';
    const lines=t.split('\n').map(s=>s.trim()).filter(Boolean);
    if(lines.length&&lines.every(nameLike)&&!hdrSet.has(norm(t)))subj.push({idx:c,name:H[c],fullNames:lines});}
  if(!subj.length){
    for(let c=ci.name+1;c<H.length;c++){if(H[c]&&(H[c].length>=3||KNOWN2.test(H[c])))subj.push({idx:c,name:H[c],fullNames:[]});}}
  subj.forEach((s,i)=>{s.end=i+1<subj.length?subj[i+1].idx:H.length;
    const lab=(top[s.idx+1]||'').trim();
    s.short=(s.idx+1<s.end&&lab&&lab.indexOf('\n')<0&&lab.length<=8)?lab.replace(/\s+/g,''):s.name;
    s.tcols=[];for(let c=s.idx+1;c<s.end;c++)if(H[c])s.tcols.push(H[c]);});
  const allNames=[...new Set(subj.flatMap(s=>s.fullNames))];
  function resolve(ch,s){
    if(!ch)return '';
    let n=s.fullNames.find(x=>x.includes(ch));if(n)return n;
    const h=s.tcols.find(c=>c.includes(ch));
    if(h){return allNames.find(x=>x.endsWith(h))||h;}
    return allNames.find(x=>x.includes(ch))||ch;}
  const out=[];
  for(let r=hi+1;r<rows.length;r++){
    const row=rows[r];const name=(row[ci.name]||'').trim();if(!name)continue;
    const grade=(row[ci.grade]||'').trim(),cn=(row[ci.cls]||'').trim(),seat=(row[ci.seat]||'').trim();
    const code=cn.length>=3?cn:(grade+(cn?cn.padStart(2,'0'):''));
    const entries=[];const warns=[];
    subj.forEach(s=>{const seen=new Set();
      for(let c=s.idx;c<s.end;c++){const v=(row[c]||'').trim();if(!v||seen.has(v))continue;seen.add(v);
        const e=parseCell(v);
        if(!e){warns.push(s.name+'：看不懂「'+v.replace(/\n/g,' ')+'」');continue;}
        e.subject=s;e.teacher=resolve(e.tch,s);
        if(e.slots.some(x=>x.d<1||x.d>5))warns.push(s.name+'：有時間落在星期六或日（本校沒有），請確認原始資料');
        if(e.slots.length!==e.n)warns.push(s.name+'：節數 '+e.n+' 與時間數 '+e.slots.length+' 不符');
        entries.push(e);}});
    const occ={};let conflict=false;
    entries.forEach(e=>e.slots.forEach(sl=>{const k=sl.d+'-'+sl.p;if(occ[k])conflict=true;occ[k]=1;}));
    out.push({id:code+'-'+seat+'-'+name,grade:grade,clsNo:cn,cls:code,seat:seat,name:name,entries:entries,warns:warns,conflict:conflict});}
  return {students:out,subjects:subj.map(s=>({name:s.name,short:s.short}))};}

/* ---------- 匯入 ---------- */
function log(type,text){const li=document.createElement('li');li.className=type;li.textContent=text;const ul=$('#msgs');ul.prepend(li);while(ul.children.length>7)ul.lastChild.remove();}
function purgeSamples(){for(const k in S.schedules)if(S.schedules[k].sample)delete S.schedules[k];
  if(S.rosterSample){S.roster=[];S.rosterSample=false;S.sel=new Set();S.pv='';}}
function ingestText(text,srcName){
  text=String(text).replace(/\r/g,'');
  const ms=[...text.matchAll(new RegExp(TITLE_RE.source,'g'))];
  let did=false;
  if(ms.length){
    ms.forEach((m,i)=>{
      const body=text.slice(m.index+m[0].length,i+1<ms.length?ms[i+1].index:text.length);
      const kind=/班級/.test(m[4])?'class':'teacher';
      try{const sc=parseSchedule(kind,m[3].trim(),m[1],m[2],body);
        purgeSamples();S.schedules[sc.key]=sc;did=true;
        if(S.settings.year!==sc.year||S.settings.sem!==sc.sem){S.settings.year=sc.year;S.settings.sem=sc.sem;log('info','已切換到 '+sc.year+' 學年第 '+sc.sem+' 學期，才看得到剛匯入的課表。');}
        log('ok','已加入'+(kind==='teacher'?'教師課表':'班級課表')+'：'+sc.label+'（'+sc.year+'-'+sc.sem+'）');
        if(sc.warns&&sc.warns.length)log('info',sc.label+'：'+sc.warns.join(' '));
        if(sc.errs&&sc.errs.length)log('err','⚠ '+sc.label+'：'+sc.errs.join(' '));
      }catch(e){log('err',(m[3].trim()||'某份課表')+'：'+e.message);}});
    return did;}
  if(/姓名/.test(text)&&/座號/.test(text)){
    try{const r=parseRoster(text);
      if(!r.students.length)throw new Error('標題列下面沒有學生資料');
      purgeSamples();S.roster=r.students;S.rosterSample=false;S.subjects=r.subjects;
      S.sel=new Set(r.students.filter(s=>s.entries.length).map(s=>s.id));S.pv=r.students[0].id;
      log('ok','已加入學生名冊：'+r.students.length+' 位學生，科目 '+r.subjects.map(s=>s.short).join('、'));
      const nw=r.students.filter(s=>s.warns.length).length;
      if(nw)log('err',nw+' 位學生的資料有疑問（名單中以黃色標示）');
      return true;
    }catch(e){log('err','學生名冊：'+e.message);return false;}}
  log('err',(srcName||'貼上的內容')+'：認不出是教師課表、班級課表或學生名冊。');
  return false;}
async function ingestFile(f){
  try{
    if(/\.xlsx?$/i.test(f.name)){
      if(!window.XLSX){log('err','Excel 讀取工具沒有載入，請改用貼上文字。');return;}
      const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});
      for(const n of wb.SheetNames){ingestText(XLSX.utils.sheet_to_csv(wb.Sheets[n],{FS:'\t',blankrows:true}),f.name+'／'+n);}
    }else ingestText(await f.text(),f.name);
  }catch(e){log('err',f.name+'：讀取失敗');}}
function afterIngest(){save();fixSelections();renderAll();}

/* ---------- 範例資料 ---------- */
function toTSV(rows){return rows.map(r=>r.map(c=>/[\t\n"]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c).join('\t')).join('\n');}
function sampleRows(kind,rowsP){const cells={};
  rowsP.forEach((r,p)=>r.forEach((v,j)=>{if(!v)return;const a=v.split('/');
    (cells[j+1]=cells[j+1]||{})[p]=kind==='teacher'?{subject:a[0],cls:a[1],place:''}:{subject:a[0],teacher:a[1]||'',place:a[2]||''};}));return cells;}
function loadSample(){
  for(const k in S.schedules)delete S.schedules[k];
  const T130=[[],
   ['數學/709','數學/701','數學/709','數學/707','',''],['','數學/709','數學/701','','',''],['數學/701','','','數學/717','數學/709',''],
   ['','數學/705','','數學/701','數學/707',''],['數學/705','','數學/717','','數學/705',''],['數學/707','','','','數學/717',''],
   ['數學/717','數學(兼)/707','數學(兼)/705','','','']];
  const C701=[[],
   ['童軍/毛思文','數學/詹盛仁','家政/劉宜純','音樂/林家卉','學校行事/蔡志強',''],
   ['食尚玩家/江享貞/外師','公民與社會(兼)/吳韋寬','數學/詹盛仁','英語/江享貞','社團活動(兼)/曾郁榛',''],
   ['數學/詹盛仁','國文/蔡志強','地理(兼)/林季諭','本土語/林巧珮','國文/蔡志強',''],
   ['國文/蔡志強','生物/林彥良','英語/江享貞','數學/詹盛仁','生物/林彥良',''],
   ['體育/鄭秀玲','輔導/王映喬','生物/林彥良','體育/鄭秀玲','英語/江享貞',''],
   ['走跳世界面面觀(兼)/林季諭','視覺藝術/李淅湄','國文/蔡志強','走跳世界面面觀(兼)/林季諭','生活科技/葉步芳/生科教室',''],
   ['資訊科技(兼)/翁靜宇/電腦教室','表演藝術(兼)/劉芷彤/表演教室','健康教育/李銘珠','國文/蔡志強','歷史(兼)/蔡睿詮','']];
  const tm={};for(let p=0;p<=8;p++)tm[p]=TIMES[p];
  const add=o=>{S.schedules[o.key]=o;};
  add(mkSchedObj('teacher','130詹盛仁',115,1,sampleRows('teacher',T130),tm,true));
  ['701','901','902'].forEach(id=>add(mkSchedObj('class',id,115,1,sampleRows('class',C701),tm,true)));
  const tc={};C701.forEach((r,p)=>r.forEach((v,j)=>{if(v&&v.split('/')[1]==='蔡志強')(tc[j+1]=tc[j+1]||{})[p]={subject:v.split('/')[0],cls:'701',place:''};}));
  add(mkSchedObj('teacher','210蔡志強',115,1,tc,tm,true));
  S.settings.year='115';S.settings.sem='1';S.settings.userSet=false;S.settings.datesEdited=false;
  const f=(len,pairs)=>{const r=new Array(len).fill('');pairs.forEach(([i,v])=>r[i]=v);return r;};
  const top=f(28,[[4,'李燕菁\n杜泱儒\n呂明芳'],[5,'國'],[8,'陳若懿\n鄭淑丹\n徐瑜霈\n陳韋伶'],[9,'英'],[13,'洪媺玲\n陳韋伶\n徐瑜霈'],[14,'數'],[18,'陳韋伶'],[19,'功能性動作訓練'],[20,'陳若懿\n徐瑜霈'],[21,'生活管理'],[23,'李燕菁\n鄭淑丹\n杜泱儒'],[24,'社會技巧'],[27,'洪媺玲\n呂明芳']]);
  const hdr=['年級','班級','座號','姓名','本國語言','明芳','泱儒','燕菁','英語文','若懿','韋伶','淑丹','瑜霈','數學','韋伶','媺玲','桂琪','瑜霈','功能性\n動作訓練','韋伶','生活管理','若懿','瑜霈','社會技巧','泱儒','淑丹','燕菁','職業教育'];
  const A='A(泱)2\n1-3\n4-7',B='A(懿)2\n1-4\n4-6',C='A(韋)3\n1-7\n2-3\n5-4';
  const s1=f(28,[[0,'9'],[1,'1'],[2,'28'],[3,'黃生'],[4,A],[6,A],[8,B],[9,B],[13,C],[14,C]]);
  const s2=f(28,[[0,'9'],[1,'2'],[2,'2'],[3,'李生'],[4,'C(菁)2\n1-3\n2-3'],[7,'C(菁)2\n1-3\n2-3'],[8,'B(丹)3\n1-4\n2-7\n4-5'],[11,'B(丹)3\n1-4\n2-7\n4-5'],[13,'D(媺)3\n1-1\n2-6\n4-1'],[15,'D(媺)3\n1-1\n2-6\n4-1'],[27,'A(媺)3\n3-2\n3-3\n3-4']]);
  const r=parseRoster(toTSV([top,hdr,s1,s2]));
  S.roster=r.students;S.subjects=r.subjects;S.rosterSample=true;S.sel=new Set(r.students.map(s=>s.id));S.pv=r.students[0].id;
  S.me='';S.people=[{role:'導師',key:''}];S.homeroom={};S.pick=new Set();S.pickDelay={};S.pickInit=false;}

/* ---------- 取資料 ---------- */
function active(){return Object.values(S.schedules).filter(s=>s.year===String(S.settings.year)&&s.sem===String(S.settings.sem));}
/* 沒有匯入教師課表的老師，可由已匯入的班級課表推算（只含已匯入的班級，可能不完整） */
function derivedTeachers(){
  const have=new Set(Object.values(S.schedules).filter(s=>s.kind==='teacher'&&s.year===String(S.settings.year)&&s.sem===String(S.settings.sem)).map(s=>s.name));
  const map={};
  classes().forEach(c=>{for(const d in c.cells)for(const p in c.cells[d]){const x=c.cells[d][p],n=(x.teacher||'').trim();if(!n||have.has(n))continue;
    const t=map[n]||(map[n]={key:'derived|'+S.settings.year+'|'+S.settings.sem+'|'+n,kind:'teacher',derived:true,year:String(S.settings.year),sem:String(S.settings.sem),id:n,code:'',name:n,label:n+'（由班級課表推算）',cells:{},times:{}});
    if(!t.cells[d])t.cells[d]={};if(!t.cells[d][p])t.cells[d][p]={subject:x.subject,cls:c.id,place:x.place||''};}});
  return map;}
function teachers(){
  const real=active().filter(s=>s.kind==='teacher').sort((a,b)=>a.label.localeCompare(b.label,'zh-Hant'));
  const der=Object.values(derivedTeachers()).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
  return real.concat(der);}
function getSched(key){if(S.schedules[key])return S.schedules[key];
  const k=String(key);return k.indexOf('derived|')===0?(derivedTeachers()[k.split('|')[3]]||null):null;}
function classes(){return active().filter(s=>s.kind==='class').sort((a,b)=>a.id.localeCompare(b.id));}
function getClass(id){return classes().find(c=>c.id===id)||null;}
function timeOf(p){for(const s of active())if(s.times&&s.times[p])return s.times[p];return TIMES[p]||null;}
function hrKey(cls){return S.settings.year+'-'+S.settings.sem+'-'+cls;}
function guessHomeroom(cls){const c=getClass(cls);if(!c)return '';const cnt={};
  for(const d in c.cells)for(const p in c.cells[d]){const t=c.cells[d][p].teacher;if(t&&!/(兼)/.test(c.cells[d][p].subject))cnt[t]=(cnt[t]||0)+1;}
  const e=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);return e.length?e[0][0]:'';}
/* 班級課表中「學校行事」的授課教師就是導師 */
function eventTeacher(cls){const c=getClass(cls);if(!c)return '';const cnt={};
  for(const d in c.cells)for(const p in c.cells[d]){const x=c.cells[d][p];if(/^學校行事/.test(x.subject)&&x.teacher)cnt[x.teacher]=(cnt[x.teacher]||0)+1;}
  const e=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);return e.length?e[0][0]:'';}
function homeroomOf(cls){return S.homeroom[hrKey(cls)]||eventTeacher(cls)||'';}
function slotExists(d,p){if(p>=1&&p<=6&&d<=5)return true;return active().some(s=>s.cells[d]&&s.cells[d][p]);}
function periodList(){const set=new Set([1,2,3,4,5,6,7]);active().forEach(s=>{for(const d in s.cells)for(const p in s.cells[d])set.add(+p);});return [...set].sort((a,b)=>a-b);}
/* 本校星期六沒有課：只顯示星期一到五 */
function dayList(){return [1,2,3,4,5];}
function fixSelections(){
  if(!active().length){const all=Object.values(S.schedules);
    if(all.length){const m=all.slice().sort((a,b)=>(b.year+'-'+b.sem).localeCompare(a.year+'-'+a.sem))[0];S.settings.year=m.year;S.settings.sem=m.sem;}}
  const t=teachers();
  if(!t.find(x=>x.key===S.me))S.me=((t.find(x=>!x.derived)||t[0])||{}).key||'';
  if(!Array.isArray(S.people)||!S.people.length)S.people=[{role:'導師',key:''}];
  S.people.forEach(p=>{if(p.key&&(!t.find(x=>x.key===p.key)||p.key===S.me))p.key='';});
  if(!S.people[0].key){const o=t.find(x=>x.key!==S.me&&!x.derived&&!S.people.some(q=>q.key===x.key));if(o)S.people[0].key=o.key;}
  if(!S.roster.find(s=>s.id===S.pv))S.pv=S.roster[0]?S.roster[0].id:'';}

/* ---------- 導師對照 ---------- */
function room(c){return c?(c.place||c.cls||''):'';}
const ROLES=['導師','輔導老師','其他'];
const ROLE_CH={'導師':'導','輔導老師':'輔','其他':'他'};
function peopleScheds(){return S.people.map(p=>({role:p.role,s:getSched(p.key)})).filter(x=>x.s);}
function renderOverlay(){
  const t=teachers();
  const meSel=$('#meSel'),cSel=$('#clsSel');
  const opt=(v,l,sel)=>'<option value="'+esc(v)+'"'+(sel?' selected':'')+'>'+esc(l)+'</option>';
  meSel.innerHTML=t.map(x=>opt(x.key,x.label,x.key===S.me)).join('')||'<option>（尚未匯入教師課表）</option>';
  const cls=[...new Set(S.roster.map(s=>s.cls).concat(classes().map(c=>c.id)))].sort();
  cSel.innerHTML='<option value="">（選擇班級）</option>'+cls.map(c=>{const n=homeroomOf(c);return opt(c,c+(n?'　'+n:''),false);}).join('');
  $('#people').innerHTML=S.people.map((p,i)=>'<div class="prow"><select class="prole" data-i="'+i+'" aria-label="身分">'+ROLES.map(r=>opt(r,r,r===p.role)).join('')+'</select>'
    +'<select class="psel" data-i="'+i+'" aria-label="老師">'+(p.key?'':'<option value="" selected>（請選擇老師）</option>')
    +t.filter(x=>x.key!==S.me&&!S.people.some((q,k)=>k!==i&&q.key===x.key)).map(x=>opt(x.key,x.label,x.key===p.key)).join('')+'</select>'
    +'<button class="btn sm prm" data-i="'+i+'" type="button" aria-label="移除這位老師">×</button></div>').join('');
  $$('#people .prole').forEach(el=>el.onchange=()=>{S.people[+el.dataset.i].role=el.value;save();renderOverlay();});
  $$('#people .psel').forEach(el=>el.onchange=()=>{S.people[+el.dataset.i].key=el.value;S.pick.clear();save();renderOverlay();});
  $$('#people .prm').forEach(el=>el.onclick=()=>{const i=+el.dataset.i;if(S.people.length>1)S.people.splice(i,1);else S.people[0].key='';S.pick.clear();save();renderOverlay();});
  const A=getSched(S.me),others=peopleScheds();
  const grid=$('#ovGrid'),side=$('#ovSide');
  if(!A||!others.length){
    grid.innerHTML=emptyHTML(t.filter(x=>!x.derived).length<2?'目前只匯入了 1 位老師的課表。請再貼上導師的教師課表（或匯入導師任教班級的班級課表，系統會自動推算），再從「一起對照的老師」選擇。':'請在「一起對照的老師」選一位老師，或用「班級找導師」。','clock');
    side.innerHTML='';renderSurvey();return;}
  const all=[{label:'我',s:A}].concat(others.map(o=>({label:ROLE_CH[o.role]||'他',s:o.s,role:o.role})));
  const days=dayList(),pers=periodList();
  const cellOf=(sc,d,p)=>(sc.cells[d]||{})[p];
  const common=[];
  pers.forEach(p=>days.forEach(d=>{if(slotExists(d,p)&&all.every(x=>!cellOf(x.s,d,p)))common.push({d:d,p:p});}));
  const ck=new Set(common.map(x=>x.d+'-'+x.p));
  S.pick=new Set([...S.pick].filter(k=>ck.has(k)||(/-L$/.test(k)&&days.includes(+k.split('-')[0]))));
  if(!S.pickInit){S.pickInit=true;if(Object.values(S.schedules).some(x=>x.sample)&&!S.pick.size)common.slice(0,3).forEach(x=>{S.pick.add(x.d+'-'+x.p);S.pickDelay[x.d+'-'+x.p]=+S.sv.delay||0;});}
  let h='<table class="ov"><thead><tr><th class="p"></th>'+days.map(d=>'<th>星期'+DAYN[d]+'</th>').join('')+'</tr></thead><tbody>';
  pers.forEach(p=>{const tm=timeOf(p);
    h+='<tr><th class="p">'+pName(p)+(tm?'<small>'+tm[0]+'–'+tm[1]+'</small>':'')+'</th>';
    days.forEach(d=>{
      if(!slotExists(d,p)){h+='<td><div class="slot s-none">—</div></td>';return;}
      const free=all.every(x=>!cellOf(x.s,d,p));
      const rows=all.map(x=>{const c=cellOf(x.s,d,p);
        return '<div class="who"><b>'+x.label+'</b><span>'+(c?esc(cleanSubject(c.subject))+' '+esc(room(c)):'<i class="star" aria-label="空堂">★</i>')+'</span></div>';}).join('');
      const key=d+'-'+p,on=S.pick.has(key);
      if(free)h+='<td><label class="slot s-both pickable'+(on?' picked':'')+'"><input type="checkbox" class="pk" data-pick="'+key+'"'+(on?' checked':'')+' aria-label="約星期'+DAYN[d]+pName(p)+'">'+rows+'</label></td>';
      else h+='<td><div class="slot s-busy">'+rows+'</div></td>';});
    h+='</tr>';
    if(p===4&&pers.includes(5)){
      h+='<tr><th class="p">午休<small>12:30–13:00</small></th>'+days.map(d=>{const key=d+'-L',on=S.pick.has(key);
        return '<td><label class="slot s-lunch pickable'+(on?' picked':'')+'"><input type="checkbox" class="pk" data-pick="'+key+'"'+(on?' checked':'')+' aria-label="約星期'+DAYN[d]+'午休"><div class="who"><span>午休時段（可約）</span></div></label></td>';}).join('')+'</tr>';}
  });
  h+='</tbody></table>';
  const sx=grid.scrollLeft;grid.innerHTML=h;grid.scrollLeft=sx;
  $$('#ovGrid input[data-pick]').forEach(i=>i.onchange=()=>togglePick(i.dataset.pick,i.checked));
  // 共同空堂（合併連續節次）
  const byDay={};common.forEach(x=>(byDay[x.d]=byDay[x.d]||[]).push(x.p));
  const lines=[];
  for(const d of Object.keys(byDay).sort()){const ps=byDay[d].sort((a,b)=>a-b);let i=0;
    while(i<ps.length){let j=i;while(j+1<ps.length&&ps[j+1]===ps[j]+1)j++;
      const t1=timeOf(ps[i]),t2=timeOf(ps[j]);
      lines.push({txt:'星期'+DAYN[d]+'　'+(i===j?pName(ps[i]):'第'+ps[i]+'–'+ps[j]+'節')+(t1&&t2?'　'+t1[0]+'–'+t2[1]:'')});i=j+1;}}
  let sd='';
  if(all.some(x=>x.s.derived))sd+='<p class="hint" style="margin:0 0 10px">※ '+esc(all.filter(x=>x.s.derived).map(x=>x.s.name).join('、'))+' 的課表是由已匯入的班級課表推算，只包含你已匯入的班級，可能不完整。若有該老師自己的教師課表，貼上後會自動改用。</p>';
  sd+='<h2>共同空堂（'+common.length+' 節）</h2>';
  sd+=lines.length?'<ul>'+lines.map(l=>'<li>'+esc(l.txt)+'</li>').join('')+'</ul><button class="btn sm" id="btnCopy" type="button" style="margin-bottom:14px">複製時段清單</button>':'<p class="empty" style="padding:0 0 12px">大家沒有重疊的空堂。</p>';
  // 想提早去找導師：我有空、導師正在上課、下一節兩人都有空
  const hp=others.find(o=>o.role==='導師')||others[0],meet=[];
  pers.forEach(p=>days.forEach(d=>{if(!slotExists(d,p)||!slotExists(d,p+1))return;
    const a=cellOf(A,d,p),b=cellOf(hp.s,d,p);
    if(!a&&b&&!cellOf(A,d,p+1)&&!cellOf(hp.s,d,p+1)){const tm=timeOf(p);meet.push({d:d,p:p,room:room(b),end:tm?tm[1]:''});}}));
  sd+='<h2>想提早找 '+esc(hp.s.name)+'</h2>';
  sd+=meet.length?'<ul>'+meet.map(m=>'<li>星期'+DAYN[m.d]+' '+pName(m.p)+'下課（'+esc(m.end)+'）<small>到 '+esc(m.room)+' 教室外等，下一節兩人都有空</small></li>').join('')+'</ul>':'<p class="empty" style="padding:0">沒有「我有空、對方剛下課、下節也有空」的時段。</p>';
  side.innerHTML=sd;
  const cb=$('#btnCopy');if(cb)cb.onclick=()=>copyText(lines.map(l=>l.txt).join('\n'),cb);
  renderSurvey();}
function togglePick(k,on){
  if(on){if(S.pick.size>=6)S.svMsg='最多選 6 個時段，請先取消其他時段。';else{S.pick.add(k);if(!/-L$/.test(k))S.pickDelay[k]=+S.sv.delay||0;S.svMsg='';}}
  else{S.pick.delete(k);delete S.pickDelay[k];S.svMsg='';}
  renderOverlay();}
function copyText(txt,btn){
  const done=()=>{const o=btn.textContent;btn.textContent='已複製';setTimeout(()=>btn.textContent=o,1400);};
  const fb=()=>{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){}ta.remove();};
  try{navigator.clipboard.writeText(txt).then(done,fb);}catch(e){fb();}}

/* ---------- 學生課表 ---------- */
/* 班級顯示：代碼 706，或 7年6班（跟著設定切換；學生課表、名單、調查單都套用） */
function clsOf(code){const c=String(code==null?'':code),m=c.match(/^(\d)(\d{2})$/);
  return (S.settings.clsFmt==='text'&&m)?m[1]+'年'+parseInt(m[2],10)+'班':c;}
function clsText(st){return clsOf(st.cls);}
function subjName(e){return S.alias[e.subject.name]||e.subject.short;}
function datesFor(){const y=parseInt(S.settings.year,10);
  if(isNaN(y))return {start:'____年 09 月 01 日',end:'____年 01 月 20 日'};
  return String(S.settings.sem)==='2'?{start:(y+1)+'年 02 月 11 日',end:(y+1)+'年 06 月 30 日'}:{start:y+'年 09 月 01 日',end:(y+1)+'年 01 月 20 日'};}
/* 資源班課程在課表上的寫法：科目＋年級＋班別，例如 英7J。
 * 四字以上科目（生活管理、職業教育、適應體育、社會技巧）兩字兩字換行，最後一行是年級＋班別。
 * 想讓四字科目的最後一行只顯示班別字母（不加年級），把下面改成 false。 */
const LONG_GRADE=false;
function gradeOf(st){const m=String(st.cls||'').match(/^(\\d)/);return m?m[1]:String(st.grade||'');}
function groupTxt(e,st){return gradeOf(st)+(e.group||'');}
function resLines(e,st){
  const nm=subjName(e),gt=groupTxt(e,st);
  if(nm.length<=3)return [nm+gt];
  const k=nm.length===4?2:Math.floor(nm.length/2);
  return [nm.slice(0,k),nm.slice(k),LONG_GRADE?gt:(e.group||'')];}
function sheetHTML(st,mode){
  const cs=getClass(st.cls),cm={};
  if(mode==='merged'&&cs)for(const d in cs.cells)for(const p in cs.cells[d])cm[d+'-'+p]={t:'o',c:cs.cells[d][p]};
  st.entries.forEach(e=>e.slots.forEach(s=>{cm[s.d+'-'+s.p]={t:'r',e:e};}));
  const pset=new Set([1,2,3,4,5,6,7]);
  Object.keys(cm).forEach(k=>{const p=+k.split('-')[1];if(p===0||p>7)pset.add(p);});
  const pers=[...pset].sort((a,b)=>a-b),days=[1,2,3,4,5];
  const dt=datesFor(),start=S.settings.datesEdited&&S.settings.start?S.settings.start:dt.start,end=S.settings.datesEdited&&S.settings.end?S.settings.end:dt.end;
  const hr=homeroomOf(st.cls);
  const rules=mode==='merged'
   ?['1.下方原班課表僅為參考,若原班課表有變動,請自行更正。若原班或學習中心臨時調課，應課前主動通知上課教師。','2.在學習中心上課同原班上課規定,務必準時,且攜帶上課用具。','3.聯絡簿為親師聯繫用,應每日給家長簽名。']
   :['1.請將此課表貼在班級點名板上。','2.學生在學習中心上課時原班請不要記曠課。','3.請任課老師協助提醒學生準時到學習中心上課。'];
  let g='<table class="grid"><thead><tr><th class="p"></th>'+days.map(d=>'<th class="d">'+DAYN[d]+'</th>').join('')+'</tr></thead><tbody>';
  pers.forEach(p=>{
    if(p===5&&pers.includes(4))g+='<tr class="lunch"><td colspan="'+(days.length+1)+'">午休</td></tr>';
    const tm=timeOf(p);g+='<tr><th class="p"><span>'+pName(p)+'</span>'+(tm?'<small>'+tm[0]+'–'+tm[1]+'</small>':'')+'</th>';
    days.forEach(d=>{const x=cm[d+'-'+p];let c='';
      if(x&&x.t==='r'){const ls=resLines(x.e,st);c='<div class="c-res n'+ls.length+'">'+ls.map(l=>'<b>'+esc(l)+'</b>').join('')+'</div>';}
      else if(x){const on=cleanSubject(x.c.subject);c='<div class="c-orig'+(on.length>5?' sm':'')+'"><b>'+esc(on)+'</b><span>'+esc(x.c.teacher)+'</span>'+(x.c.place?'<i>'+esc(x.c.place)+'</i>':'')+'</div>';}
      g+='<td>'+c+'</td>';});
    g+='</tr>';});
  g+='</tbody></table>';
  const seen=new Set(),leg=[];
  st.entries.forEach(e=>{const k=e.subject.name+'|'+e.group+'|'+e.teacher;if(seen.has(k))return;seen.add(k);leg.push(e);});
  const order=S.subjects.map(s=>s.name);leg.sort((a,b)=>order.indexOf(a.subject.name)-order.indexOf(b.subject.name));
  const lg=leg.length
   ?'<table class="lg"><tbody><tr><th>科目</th>'+leg.map(e=>'<td>'+esc(subjName(e))+'</td>').join('')+'</tr><tr><th>班別</th>'+leg.map(e=>'<td>'+esc(groupTxt(e,st))+'</td>').join('')+'</tr><tr><th>教師</th>'+leg.map(e=>'<td>'+esc(e.teacher)+'</td>').join('')+'</tr></tbody></table>'
   :'<table class="lg"><tbody><tr><td>（沒有學習中心課程）</td></tr></tbody></table>';
  return '<div class="sheet">'
   +'<div class="sh-title">新北市丹鳳高中 <span style="text-decoration:underline">&nbsp;'+esc(S.settings.year||'　')+'&nbsp;</span> 學年度第 <span style="text-decoration:underline">&nbsp;'+esc(S.settings.sem||'　')+'&nbsp;</span> 學期</div>'
   +'<div class="sh-sub">學習中心學生課表</div>'
   +'<div class="sh-info"><span>班級: <u>'+esc(clsText(st))+'</u></span><span>座號: <u>'+esc(st.seat)+'</u></span><span>學生姓名: <u>'+esc(st.name)+'</u></span></div>'
   +'<div class="sh-info"><span>導師: <u class="'+(hr?'':'blank')+'">'+esc(hr)+'</u>老師</span></div>'
   +'<div class="sh-rules">'+rules.map(r=>'<div>'+esc(r)+'</div>').join('')+'</div>'
   +g+(mode==='merged'?'<div class="sh-key">黑色粗體：學習中心課程　深灰色：原班課程</div>':'')
   +'<div class="sh-cap">學習中心科目、班別、教師對照</div>'+lg
   +'<div class="sh-date">◎ 本課表實施日期自 '+esc(start)+'起至 '+esc(end)+'。</div></div>';}
function fitSheet(el){for(let rh=70;rh>=30;rh-=3){el.style.setProperty('--rowh',rh+'px');if(el.scrollHeight<=1123)break;}}

function renderStudents(){
  const box=$('#stTable');
  if(!S.roster.length){box.innerHTML=emptyHTML('貼上學生資源班名冊（含「年級 班級 座號 姓名」標題列），這裡就會列出學生。','book');$('#pvBox').innerHTML='';$('#dlbar').hidden=true;return;}
  let h='<table class="st"><thead><tr><th><input type="checkbox" id="chkAll" aria-label="全選"></th><th>班級</th><th>座號</th><th>姓名</th><th>資源班課程</th><th>導師</th><th>狀態</th></tr></thead><tbody>';
  S.roster.forEach(st=>{
    const cs=getClass(st.cls),slots=st.entries.reduce((a,e)=>a+e.slots.length,0),hr=S.homeroom[hrKey(st.cls)]||'',ev=eventTeacher(st.cls),gs=ev?'':guessHomeroom(st.cls);
    h+='<tr data-id="'+esc(st.id)+'"'+(st.id===S.pv?' class="pv"':'')+'><td><input type="checkbox" class="chk" '+(S.sel.has(st.id)?'checked':'')+' aria-label="選取"></td>'
      +'<td class="nm">'+esc(clsText(st))+'</td><td class="nm">'+esc(st.seat)+'</td><td class="nm">'+esc(st.name)+'</td>'
      +'<td>'+(st.entries.length?st.entries.map(e=>esc(subjName(e))).join('、')+'<br><small style="color:var(--muted)">共 '+slots+' 節</small>':'<span class="tag i">沒有資源班課程</span>')+'</td>'
      +'<td><input type="text" class="hr" data-cls="'+esc(st.cls)+'" value="'+esc(hr)+'" placeholder="'+esc(ev||'導師姓名')+'">'+(ev&&!hr?'<span class="tag g" title="取自班級課表中「學校行事」的授課教師">學校行事</span>':'')
      +(gs?'<button class="sug" data-cls="'+esc(st.cls)+'" data-g="'+esc(gs)+'" type="button"'+(hr?' hidden':'')+'>用「'+esc(gs)+'」</button>':'')+'</td>'
      +'<td>'+(cs?'<span class="tag g">原班課表 ✓</span>':'<span class="tag i">缺 '+esc(st.cls)+' 班課表</span>')
      +(st.conflict?'<span class="tag w">資源班時間衝堂</span>':'')+(st.warns.length?'<span class="tag w" title="'+esc(st.warns.join('\n'))+'">資料有疑問</span>':'')+'</td></tr>';});
  h+='</tbody></table>';box.innerHTML=h;
  $('#chkAll').checked=S.roster.every(s=>S.sel.has(s.id));
  $('#chkAll').onchange=e=>{S.sel=e.target.checked?new Set(S.roster.map(s=>s.id)):new Set();renderStudents();};
  $$('#stTable tbody tr').forEach(tr=>{tr.onclick=e=>{if(e.target.closest('input,button'))return;S.pv=tr.dataset.id;renderStudents();};});
  $$('#stTable .chk').forEach(c=>c.onchange=e=>{const id=c.closest('tr').dataset.id;e.target.checked?S.sel.add(id):S.sel.delete(id);updateDl();$('#chkAll').checked=S.roster.every(s=>S.sel.has(s.id));});
  $$('#stTable input.hr').forEach(inp=>inp.oninput=()=>{const cls=inp.dataset.cls,v=inp.value.trim();
    if(v)S.homeroom[hrKey(cls)]=v;else delete S.homeroom[hrKey(cls)];save();
    $$('#stTable input.hr').forEach(o=>{if(o!==inp&&o.dataset.cls===cls)o.value=inp.value;});
    $$('#stTable .sug').forEach(b=>{if(b.dataset.cls===cls)b.hidden=!!v;});
    clearTimeout(renderStudents._t);renderStudents._t=setTimeout(()=>{renderPreview();},250);});
  $$('#stTable .sug').forEach(b=>b.onclick=e=>{e.stopPropagation();S.homeroom[hrKey(b.dataset.cls)]=b.dataset.g;save();renderStudents();});
  renderPreview();updateDl();}
function mountPreview(box,html){
  const w=Math.max(260,box.clientWidth-20),sc=Math.min(1,w/794);
  box.innerHTML='<div class="pw" style="width:'+794*sc+'px;height:'+1123*sc+'px"><div style="width:794px;height:1123px;transform:scale('+sc+');transform-origin:0 0">'+html+'</div></div>';
  fitSheet($('.sheet',box));}
function renderPreview(){
  const box=$('#pvBox');const st=S.roster.find(s=>s.id===S.pv);if(!st){box.innerHTML='';return;}
  $('#pvRes').setAttribute('aria-pressed',S.pvMode==='res');$('#pvMer').setAttribute('aria-pressed',S.pvMode==='merged');
  mountPreview(box,sheetHTML(st,S.pvMode));}
function updateDl(){
  const n=S.roster.filter(s=>S.sel.has(s.id)).length;
  $('#dlbar').hidden=!(S.tab==='students'&&S.roster.length);
  $('#dlInfo').textContent='已選 '+n+' 位學生 × 2 種版本 ＝ '+n*2+' 份 PDF';
  $('#btnDl').disabled=n===0;}
function renderSettings(){
  $('#setYear').value=S.settings.year||'';$('#setSem').value=S.settings.sem||'1';{const ex=(S.roster[0]&&S.roster[0].cls)||'706',m=String(ex).match(/^(\d)(\d{2})$/);
    $('#setCls').innerHTML='<option value="code">班級代碼（例：'+esc(ex)+'）</option><option value="text">年班（例：'+(m?m[1]+'年'+parseInt(m[2],10)+'班':'7年6班')+'）</option>';}
  $('#setCls').value=S.settings.clsFmt||'code';
  const dt=datesFor();$('#setStart').value=S.settings.datesEdited&&S.settings.start?S.settings.start:dt.start;$('#setEnd').value=S.settings.datesEdited&&S.settings.end?S.settings.end:dt.end;
  $('#aliasBox').innerHTML=S.subjects.map(s=>'<label>科目「'+esc(s.name)+'」顯示為<input type="text" data-sub="'+esc(s.name)+'" value="'+esc(S.alias[s.name]||s.short)+'"></label>').join('');
  $$('#aliasBox input').forEach(i=>i.oninput=()=>{const v=i.value.trim(),s=S.subjects.find(x=>x.name===i.dataset.sub);
    if(v&&v!==s.short)S.alias[s.name]=v;else delete S.alias[s.name];save();clearTimeout(renderSettings._t);renderSettings._t=setTimeout(renderStudents,250);});}

/* ---------- 學生清單 ---------- */
const stuKey=x=>[x.cls,x.seat,x.name].join('|');
function allStudents(){
  const m=new Map();
  const add=(x,src)=>{if(!x||!String(x.name||'').trim())return;const o={cls:String(x.cls||'').trim(),seat:String(x.seat||'').trim(),name:String(x.name).trim(),src:src};if(!m.has(stuKey(o)))m.set(stuKey(o),o);};
  S.roster.forEach(x=>add(x,'名冊'));EXTRA_STUDENTS.forEach(x=>add(x,'程式碼'));S.extra.forEach(x=>add(x,'手動'));
  return [...m.values()].sort((a,b)=>a.cls.localeCompare(b.cls)||(parseInt(a.seat,10)||0)-(parseInt(b.seat,10)||0));}
window.kebiao={addStudents:function(arr){(arr||[]).forEach(x=>S.extra.push({cls:x.cls||'',seat:x.seat||'',name:x.name||''}));save();renderStuEditor();renderSurvey();},S:S};
function renderStuEditor(){
  const box=$('#stuEdit');
  if(!S.extra.length){box.innerHTML='<p class="hint" style="margin:6px 0">目前沒有手動新增的學生。</p>';return;}
  box.innerHTML='<table class="st"><thead><tr><th>班級</th><th>座號</th><th>姓名</th><th></th></tr></thead><tbody>'
    +S.extra.map((x,i)=>'<tr style="cursor:default"><td><input type="text" data-i="'+i+'" data-f="cls" value="'+esc(x.cls)+'" style="width:84px"></td><td><input type="text" data-i="'+i+'" data-f="seat" value="'+esc(x.seat)+'" style="width:64px"></td><td><input type="text" data-i="'+i+'" data-f="name" value="'+esc(x.name)+'" style="width:120px"></td><td><button class="btn sm" data-del="'+i+'" type="button">刪除</button></td></tr>').join('')+'</tbody></table>';
  $$('#stuEdit input').forEach(inp=>inp.oninput=()=>{S.extra[+inp.dataset.i][inp.dataset.f]=inp.value;save();clearTimeout(renderStuEditor._t);renderStuEditor._t=setTimeout(()=>{renderSvSelect();renderSvPreview();},250);});
  $$('#stuEdit [data-del]').forEach(b=>b.onclick=()=>{S.extra.splice(+b.dataset.del,1);save();renderStuEditor();renderSurvey();});}
function renderSvSelect(){
  const list=allStudents(),sel=$('#svStu');
  let h='<option value="">空白（姓名由家長手寫）</option>'+list.map(x=>'<option value="'+esc(stuKey(x))+'">'+esc((x.cls?x.cls+' ':'')+(x.seat?x.seat+'號 ':'')+x.name)+'</option>').join('');
  if(list.length>1)h+='<option value="__ALL__">清單內全部 '+list.length+' 位（打包成 ZIP）</option>';
  sel.innerHTML=h;
  if(![...sel.options].some(o=>o.value===S.sv.stu))S.sv.stu='';
  sel.value=S.sv.stu;}

/* ---------- 會議日期調查單 ---------- */
const toMin=t=>{const x=t.split(':').map(Number);return x[0]*60+x[1];};
const fm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
function pickOpts(){
  const dur=+S.sv.dur||20;
  return [...S.pick].map(k=>{const x=k.split('-');return {k:k,d:+x[0],p:x[1]==='L'?'L':+x[1]};})
    .sort((a,b)=>a.d-b.d||(a.p==='L'?4.5:a.p)-(b.p==='L'?4.5:b.p))
    .map(o=>{if(o.p==='L')return Object.assign(o,{s:'12:30',e:'13:00',lunch:true,over:false,delay:0});
      const t=timeOf(o.p);if(!t)return null;const delay=S.pickDelay[o.k]!=null?+S.pickDelay[o.k]:(+S.sv.delay||0),st=toMin(t[0])+delay,en=st+dur;
      return Object.assign(o,{s:fm(st),e:fm(en),over:en>toMin(t[1]),delay:delay});}).filter(Boolean);}
function dateOf(d){if(!S.sv.week)return '';const dt=new Date(S.sv.week+'T00:00:00');if(isNaN(dt.getTime()))return '';dt.setDate(dt.getDate()+d-1);return (dt.getMonth()+1)+'/'+dt.getDate();}
function surveyHTML(stu,opts){
  const me=getSched(S.me),others=peopleScheds();
  const u=v=>'<u class="'+(v?'':'blank')+'">'+esc(v||'')+'</u>';
  const nm=stu&&stu.name?stu.name+'同學':'孩子';
  const roleTxt=o=>o.role==='其他'?o.s.name+'老師':o.role+'（'+o.s.name+'老師）';
  const who=others.map(roleTxt).concat(me?['特教老師（'+me.name+'老師）']:[]);
  const rows=opts.map(o=>'<tr><td class="bx"><span class="sv-box"></span></td><td>星期'+DAYN[o.d]+(dateOf(o.d)?'（'+dateOf(o.d)+'）':'')+'</td><td>'+(o.lunch?'中午 ':'')+o.s+' – '+o.e+'</td></tr>').join('');
  const sign=others.map(o=>(o.role==='其他'?'':o.role+' ')+o.s.name+' 老師').concat(me?['特教老師 '+me.name+' 老師']:[]);
  return '<div class="sheet">'
   +'<div class="sh-title">新北市丹鳳高中 <span style="text-decoration:underline">&nbsp;'+esc(S.settings.year||'　')+'&nbsp;</span> 學年度第 <span style="text-decoration:underline">&nbsp;'+esc(S.settings.sem||'　')+'&nbsp;</span> 學期</div>'
   +'<div class="sh-sub">家長會議時間調查單</div>'
   +'<div class="sh-info"><span>班級: '+u(stu&&clsOf(stu.cls))+'</span><span>座號: '+u(stu&&stu.seat)+'</span><span>學生姓名: '+u(stu&&stu.name)+'</span></div>'
   +'<div class="sh-letter"><p>親愛的家長您好：</p>'
   +'<p>為了討論'+esc(nm)+'的'+esc(S.sv.topic||'學習與輔導事宜')+'，誠摯邀請您與'+(who.length?esc(who.join('、')):'相關老師')+'一同開會，每次約 '+esc(S.sv.dur)+' 分鐘。</p>'
   +'<p>請在下列時段中<b>盡量多勾選</b>您方便的時間，讓我們有更多安排的彈性。若邀約成功，會再另行通知您確認開會時間。</p></div>'
   +'<table class="sv"><thead><tr><th>方便請打 ✓</th><th>日期</th><th>時間</th></tr></thead><tbody>'+rows
   +'<tr><td class="bx"><span class="sv-box"></span></td><td colspan="2" class="no">以上時間都不方便，我方便的時間是：＿＿＿＿＿＿＿＿＿＿＿＿</td></tr></tbody></table>'
   +'<div class="sv-sign"><span>家長簽名：<u></u></span><span>聯絡電話：<u></u></span></div>'
   +'<div class="sv-sign"><span>敬請於 '+(S.sv.due?'<b>'+esc(S.sv.due)+'</b>':'＿＿＿＿＿＿')+' 前交回（可請孩子帶回或拍照傳送）。</span></div>'
   +'<div class="sv-from">'+esc(sign.join('　'))+'　敬上</div></div>';}
function renderSvPicks(){
  const opts=pickOpts(),n=opts.length;
  $('#svPicks').innerHTML=opts.map(o=>'<span class="chip pick">星期'+DAYN[o.d]+(dateOf(o.d)?'（'+dateOf(o.d)+'）':'')+' <b>'+o.s+'–'+o.e+'</b>'
    +(o.lunch?'<small>午休固定</small>':'<select class="pdel" data-k="'+o.k+'" aria-label="這個時段延後幾分鐘">'+[0,10,20,30].map(m=>'<option value="'+m+'"'+(o.delay===m?' selected':'')+'>'+(m?'延後 '+m+' 分':'不延後')+'</option>').join('')+'</select>')
    +'<button type="button" data-rm="'+o.k+'" aria-label="取消這個時段">×</button></span>').join('');
  $$('#svPicks [data-rm]').forEach(b=>b.onclick=()=>togglePick(b.dataset.rm,false));
  $$('#svPicks .pdel').forEach(sel=>sel.onchange=()=>{S.pickDelay[sel.dataset.k]=+sel.value;renderSvPicks();renderSvPreview();});
  const over=opts.some(o=>o.over);let msg,cls='';
  if(S.svMsg){msg=S.svMsg;cls='warn';}
  else if(n<3){msg='已選 '+n+' 個，還要再選 '+(3-n)+' 個（需要 3 到 6 個）。';}
  else if(over){msg='已選 '+n+' 個。有時段的會議會超過下課時間，請縮短會議長度或減少延後分鐘。';cls='warn';}
  else{msg='已選 '+n+' 個，可以下載調查單。';cls='ok';}
  const m=$('#svMsg');m.textContent=msg;m.className='sv-msg '+cls;
  $('#btnSv').disabled=n<3||n>6;}
function curSvStudent(){const all=allStudents();const k=S.sv.stu;if(k==='__ALL__')return all[0]||null;return all.find(x=>stuKey(x)===k)||null;}
function renderSvPreview(){
  const box=$('#svBox'),opts=pickOpts();
  if(opts.length<3){box.innerHTML=emptyHTML('勾選 3 到 6 個時段後，這裡會出現調查單預覽。','pencil');return;}
  mountPreview(box,surveyHTML(curSvStudent(),opts));}
function renderSurvey(){
  if(!$('#svDur'))return;
  $('#svDur').value=String(S.sv.dur);$('#svDelay').value=String(S.sv.delay);$('#svWeek').value=S.sv.week||'';$('#svDue').value=S.sv.due||'';$('#svTopic').value=S.sv.topic||'';
  renderSvSelect();renderSvPicks();renderSvPreview();}

/* ---------- PDF ---------- */
async function waitFonts(el){try{const t=el.textContent;await Promise.race([Promise.all([document.fonts.load('400 14px "Noto Sans TC"',t),document.fonts.load('700 14px "Noto Sans TC"',t),document.fonts.load('500 14px "Noto Sans TC"',t)]),new Promise(r=>setTimeout(r,4000))]);await document.fonts.ready;}catch(e){}}
const safe=s=>String(s).replace(/[\\/:*?"<>|]/g,'_');
function needLibs(info){if(!window.html2canvas||!window.jspdf||!window.JSZip){info.textContent='PDF 工具沒有載入成功，請檢查網路後重新整理。';return false;}return true;}
/* 下載檔案：用瀏覽器原生下載（GitHub Pages 上可直接使用） */
async function saveFile(filename,blob){
  try{const dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;
    if(dl){await dl.save({filename:filename,data:blob});return;}}catch(e){if(e&&e.code==='declined')throw e;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),15000);}
async function renderImg(html){
  const host=$('#pdfhost');host.innerHTML=html;const el=host.firstElementChild;fitSheet(el);await waitFonts(el);
  await new Promise(r=>requestAnimationFrame(()=>r()));
  const canvas=await html2canvas(el,{scale:3,backgroundColor:'#ffffff',logging:false,useCORS:true});
  const img=canvas.toDataURL('image/png');canvas.width=canvas.height=0;host.innerHTML='';return img;}
function imgToPdf(img){const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait'});pdf.addImage(img,'PNG',0,0,210,297,undefined,'FAST');return pdf;}
async function downloadAll(){
  const btn=$('#btnDl'),info=$('#dlInfo');
  if(!needLibs(info))return;
  const list=S.roster.filter(s=>S.sel.has(s.id));if(!list.length)return;
  btn.disabled=true;
  const {jsPDF}=window.jspdf,zip=new JSZip(),all=$('#optAll').checked;
  const modes=[['res','純資源班課表'],['merged','原班+資源班課表']];
  const comb={res:null,merged:null};let done=0;const total=list.length*2;
  try{
    for(const st of list){
      for(const [mode,folder] of modes){
        info.textContent='產生中 '+(++done)+' / '+total+'：'+clsText(st)+' '+st.seat+'號 '+st.name;
        const img=await renderImg(sheetHTML(st,mode));
        zip.file(folder+'/'+safe(clsText(st)+'_'+st.seat+'號_'+st.name)+'.pdf',imgToPdf(img).output('arraybuffer'));
        if(all){if(!comb[mode])comb[mode]=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'});else comb[mode].addPage();
          comb[mode].addImage(img,'PNG',0,0,210,297,undefined,'FAST');}}}
    if(all)modes.forEach(([mode,folder])=>{if(comb[mode])zip.file('全部學生_'+folder+'.pdf',comb[mode].output('arraybuffer'));});
    info.textContent='打包中…';
    const blob=await zip.generateAsync({type:'blob'});
    await saveFile('學生課表_'+S.settings.year+'-'+S.settings.sem+'_'+list.length+'人.zip',blob);
    info.textContent='已完成：'+list.length+' 位學生，每人兩種版本。';
  }catch(e){info.textContent=(e&&e.code==='declined')?'已取消下載。':'產生失敗：'+((e&&e.message)||e);}
  $('#pdfhost').innerHTML='';btn.disabled=false;setTimeout(updateDl,4000);}
async function downloadSurvey(){
  const btn=$('#btnSv'),info=$('#svInfo'),opts=pickOpts();
  if(opts.length<3||opts.length>6)return;
  if(!needLibs(info))return;
  const all=allStudents();let list;
  if(S.sv.stu==='__ALL__')list=all;else if(!S.sv.stu)list=[null];else list=[all.find(x=>stuKey(x)===S.sv.stu)||null];
  btn.disabled=true;
  try{
    const nameOf=x=>x?safe((x.cls||'')+'_'+(x.seat?x.seat+'號_':'')+x.name):'空白';
    if(list.length===1){
      info.textContent='產生中…';const img=await renderImg(surveyHTML(list[0],opts));
      await saveFile('會議日期調查單_'+nameOf(list[0])+'.pdf',imgToPdf(img).output('blob'));
    }else{
      const zip=new JSZip();let i=0;
      for(const x of list){info.textContent='產生中 '+(++i)+' / '+list.length;const img=await renderImg(surveyHTML(x,opts));zip.file('會議日期調查單_'+nameOf(x)+'.pdf',imgToPdf(img).output('arraybuffer'));}
      info.textContent='打包中…';await saveFile('會議日期調查單_'+list.length+'位.zip',await zip.generateAsync({type:'blob'}));}
    info.textContent='已完成。';
  }catch(e){info.textContent=(e&&e.code==='declined')?'已取消下載。':'產生失敗：'+((e&&e.message)||e);}
  $('#pdfhost').innerHTML='';btn.disabled=false;renderSvPicks();}

/* ---------- 會議通知單 ---------- */
/* 會議名稱（前面會自動加上「丹鳳高中 ○○○ 學年度」）。想新增選項就加在這裡。 */
const MT_TITLES=['特殊生個別化教育計畫擬定會議','特殊生個別化教育計畫檢討暨擬定會議','特殊生個別化教育計畫檢討暨轉銜會議','特殊生個案會議'];
/* 會議地點選項。想新增或修改就改這裡。 */
const MT_PLACES=['星光樓二樓 高輔中心','星光樓二樓 團輔室','星光樓三樓 星光會議室','星光樓三樓 雲水軒','鳳翔樓二樓 學習中心 A教室','鳳翔樓二樓 學習中心 B教室','鳳翔樓二樓 學習中心 C教室','鳳翔樓二樓 學習中心 D教室','鳳翔樓二樓 學習中心 E教室','鳳翔樓二樓 學習中心 F教室','鳳翔樓二樓 學習中心 G教室'];
/* 通知單上的固定文字（第 1 點的班級與學生姓名會自動帶入）。 */
const MT_CONTENT=['本學年特教服務說明,教育目標及輔導方式討論。','課程內容、作業調整和成績評量協調。','臨時動議。'];
const MT_ATTEND=['個案導師與各科任課教師。','特教組長、特教個管教師。','學生、家長。'];
const MT_NOTE='該生為鑑輔會通過之特教需求學生,會中將討論學生的能力、特質、作業和評量調整';
/* 姓名第二個字用 O 遮蔽：王大明 → 王O明、黃生 → 黃O */
function maskName(n){n=String(n||'');return n.length<2?n:n[0]+'O'+n.slice(2);}
function mtStudent(){return allStudents().find(x=>stuKey(x)===S.mt.stu)||null;}
/* 這個班的所有授課老師：科目、是否導師（班級課表裡有「學校行事」的老師，或自行指定的導師） */
function mtTeachers(cls){
  const c=getClass(cls),map=new Map();
  if(c)for(const d of Object.keys(c.cells).sort())for(const p of Object.keys(c.cells[d]).sort((a,b)=>a-b)){
    const x=c.cells[d][p],nm=String(x.teacher||'').trim();if(!nm)continue;
    const r=map.get(nm)||{name:nm,subs:[],home:false};
    if(/學校行事/.test(x.subject))r.home=true;else{const s=cleanSubject(x.subject);if(s&&!r.subs.includes(s))r.subs.push(s);}
    map.set(nm,r);}
  const hn=homeroomOf(cls);
  if(hn){const r=map.get(hn)||{name:hn,subs:[],home:false};r.home=true;map.set(hn,r);}
  const arr=[...map.values()].map(r=>({name:r.name,suffix:r.home?'導師':'教師',sub:r.subs.join('、')}));
  return arr.filter(r=>r.suffix==='導師').concat(arr.filter(r=>r.suffix!=='導師'));}
function mtAllRecs(){
  const st=mtStudent();
  const base=st?mtTeachers(st.cls):[];
  return base.concat(S.mt.extraRec.map(r=>({name:r.name,suffix:r.suffix||'教師',sub:r.sub||'',extra:true})));}
function mtRecs(){return mtAllRecs().filter(r=>!S.mt.off.includes(r.name));}
function mtTitleText(){const m=S.mt;if(m.title==='custom')return m.custom||'（請輸入會議名稱）';
  return '丹鳳高中 '+(S.settings.year||'＿＿＿')+' 學年度'+MT_TITLES[+m.title||0];}
function mtPlaceText(){const m=S.mt;return m.place==='custom'?(m.placeCustom||'＿＿＿＿＿＿'):MT_PLACES[+m.place||0];}
function mtWhen(){const m=S.mt;let d='＿月＿日　星期＿';
  if(m.date){const dt=new Date(m.date+'T00:00:00');if(!isNaN(dt.getTime()))d=(dt.getMonth()+1)+'月'+dt.getDate()+'日　星期'+DAYN[dt.getDay()||7];}
  return d+'　'+(m.t1||'＿＿:＿＿')+'–'+(m.t2||'＿＿:＿＿');}
function mtHost(){return S.mt.host||(getSched(S.me)||{}).name||'';}
function mtNoticeHTML(rec){
  if(!rec)return '<div class="mt-half"></div>';
  const st=mtStudent(),host=mtHost(),h=host?esc(host)+'教師':'＿＿＿教師';
  const seat=SEATS[rec.name]||'';
  const first=(st?esc(clsOf(st.cls)):'＿＿＿')+' 個案'+esc(st?maskName(st.name):'＿O＿')+'能力現況描述。';
  const ol=a=>'<ol>'+a.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol>';
  return '<div class="mt-half">'
   +'<div class="mt-seat">'+(seat?esc(seat):'&nbsp;')+'</div>'
   +'<div class="mt-title">'+esc(mtTitleText())+'</div>'
   +'<table class="mt"><colgroup><col style="width:104px"><col><col style="width:84px"><col style="width:250px"></colgroup><tbody>'
   +'<tr><th>受文者</th><td colspan="3"><span class="mt-name">'+esc(rec.name)+esc(rec.suffix)+'</span>'+(rec.sub?'<small>'+esc(rec.sub)+'</small>':'')+'</td></tr>'
   +'<tr><th>會議內容</th><td colspan="3"><ol><li>'+first+'</li>'+MT_CONTENT.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></td></tr>'
   +'<tr><th>會議地點</th><td colspan="3">'+esc(mtPlaceText())+'</td></tr>'
   +'<tr><th>會議時間</th><td colspan="3">'+esc(mtWhen())+'</td></tr>'
   +'<tr><th>主持人</th><td>'+h+'</td><th>連絡人</th><td>'+h+'　分機 '+esc(S.mt.ext||'')+'</td></tr>'
   +'<tr><th>出席人員</th><td colspan="3">'+ol(MT_ATTEND)+'</td></tr>'
   +'<tr><th>備註</th><td colspan="3">'+esc(MT_NOTE)+'</td></tr>'
   +'</tbody></table></div>';}
/* 一張 A4 放兩份通知單（上下各一，中間虛線可裁開），第 i 張放第 2i、2i+1 位老師 */
function mtSheetHTML(recs,i){return '<div class="sheet mtp">'+mtNoticeHTML(recs[2*i])+mtNoticeHTML(recs[2*i+1])+'</div>';}
function mtSheets(){return Math.ceil(mtRecs().length/2);}
function renderMeeting(){
  if(!$('#mtTitle'))return;
  const m=S.mt,st=allStudents();
  $('#mtTitle').innerHTML=MT_TITLES.map((t,i)=>'<option value="'+i+'">'+esc(t)+'</option>').join('')+'<option value="custom">自訂會議名稱…</option>';
  $('#mtTitle').value=String(m.title);$('#mtCustomWrap').hidden=m.title!=='custom';$('#mtCustom').value=m.custom||'';
  $('#mtStu').innerHTML='<option value="">（請選擇個案學生）</option>'+st.map(x=>'<option value="'+esc(stuKey(x))+'">'+esc((x.cls?x.cls+' ':'')+(x.seat?x.seat+'號 ':'')+x.name)+'</option>').join('');
  if(![...$('#mtStu').options].some(o=>o.value===m.stu))m.stu='';
  $('#mtStu').value=m.stu;
  $('#mtPlace').innerHTML=MT_PLACES.map((t,i)=>'<option value="'+i+'">'+esc(t)+'</option>').join('')+'<option value="custom">其他地點…</option>';
  $('#mtPlace').value=String(m.place);$('#mtPlaceWrap').hidden=m.place!=='custom';$('#mtPlaceCustom').value=m.placeCustom||'';
  $('#mtDate').value=m.date||'';$('#mtT1').value=m.t1||'';$('#mtT2').value=m.t2||'';
  $('#mtHost').value=m.host||'';$('#mtHost').placeholder=(getSched(S.me)||{}).name||'特教老師姓名';$('#mtExt').value=m.ext||'';
  renderMtRecs();renderMtPreview();}
function renderMtRecs(){
  const box=$('#mtRecs'),all=mtAllRecs(),st=mtStudent();
  if(!st){box.innerHTML='<p class="hint" style="margin:6px 0">先在上方選擇個案學生，這裡就會列出該班所有授課老師。</p>';return;}
  const hasCls=!!getClass(st.cls);
  let h=hasCls?'':'<p class="hint warn" style="margin:6px 0">還沒有匯入 '+esc(st.cls)+' 班的班級課表，無法自動列出授課老師。可以匯入課表，或用下方「手動加入」。</p>';
  h+=all.map((r,i)=>{const on=!S.mt.off.includes(r.name),seat=SEATS[r.name];
    return '<label class="mt-rec"><input type="checkbox" data-n="'+esc(r.name)+'"'+(on?' checked':'')+'><span class="nm">'+esc(r.name)+esc(r.suffix)+'</span><small>'+esc(r.sub)+'</small>'
      +(seat?'<em>'+esc(seat)+'</em>':'<span class="tag w">查無座位</span>')+(r.extra?'<button type="button" class="btn sm" data-del="'+esc(r.name)+'" aria-label="移除">×</button>':'')+'</label>';}).join('');
  h+='<div class="row" style="margin:8px 0 2px"><button class="btn sm" id="mtAll" type="button">全選</button><button class="btn sm" id="mtNone" type="button">全不選</button></div>';
  box.innerHTML=h;
  $$('#mtRecs input[data-n]').forEach(c=>c.onchange=()=>{const n=c.dataset.n;S.mt.off=S.mt.off.filter(x=>x!==n);if(!c.checked)S.mt.off.push(n);save();S.mtPage=0;renderMtPreview();});
  $$('#mtRecs [data-del]').forEach(b=>b.onclick=e=>{e.preventDefault();S.mt.extraRec=S.mt.extraRec.filter(x=>x.name!==b.dataset.del);save();renderMtRecs();renderMtPreview();});
  $('#mtAll').onclick=()=>{S.mt.off=[];save();renderMtRecs();renderMtPreview();};
  $('#mtNone').onclick=()=>{S.mt.off=all.map(r=>r.name);save();renderMtRecs();renderMtPreview();};}
function renderMtPreview(){
  const box=$('#mtBox'),recs=mtRecs(),n=mtSheets();
  if(S.mtPage>=n)S.mtPage=Math.max(0,n-1);
  $('#mtInfo').textContent=recs.length?'共 '+recs.length+' 位受文者 → '+n+' 張 A4（每張兩份）':'';
  $('#mtPrev').disabled=S.mtPage<=0;$('#mtNext').disabled=S.mtPage>=n-1;$('#mtPg').textContent=n?('第 '+(S.mtPage+1)+' / '+n+' 張'):'';
  $('#btnMt').disabled=!recs.length;
  if(!recs.length){box.innerHTML=emptyHTML('選好個案學生與受文者，這裡會出現通知單預覽。','book');return;}
  mountPreview(box,mtSheetHTML(recs,S.mtPage));}
async function downloadMeeting(){
  const btn=$('#btnMt'),info=$('#mtDl'),recs=mtRecs(),n=mtSheets();
  if(!recs.length||!needLibs(info))return;
  btn.disabled=true;
  try{
    let pdf=null;
    for(let i=0;i<n;i++){info.textContent='產生中 '+(i+1)+' / '+n;const img=await renderImg(mtSheetHTML(recs,i));
      if(!pdf)pdf=imgToPdf(img);else{pdf.addPage('a4','portrait');pdf.addImage(img,'PNG',0,0,210,297,undefined,'FAST');}}
    const st=mtStudent();
    await saveFile('會議通知單_'+safe((st?st.cls+'_'+maskName(st.name):'空白'))+'.pdf',pdf.output('blob'));
    info.textContent='已完成。';
  }catch(e){info.textContent=(e&&e.code==='declined')?'已取消下載。':'產生失敗：'+((e&&e.message)||e);}
  $('#pdfhost').innerHTML='';btn.disabled=false;renderMtPreview();}
function initMeeting(){
  const m=S.mt,upd=(f,full)=>e=>{m[f]=e.target.value;save();if(full)renderMeeting();else renderMtPreview();};
  $('#mtTitle').onchange=upd('title',true);$('#mtCustom').oninput=upd('custom');
  $('#mtStu').onchange=e=>{m.stu=e.target.value;m.off=[];S.mtPage=0;save();renderMeeting();};
  $('#mtPlace').onchange=upd('place',true);$('#mtPlaceCustom').oninput=upd('placeCustom');
  $('#mtDate').oninput=upd('date');$('#mtT1').oninput=upd('t1');$('#mtT2').oninput=upd('t2');
  $('#mtHost').oninput=upd('host');$('#mtExt').oninput=upd('ext');
  $('#mtPrev').onclick=()=>{S.mtPage--;renderMtPreview();};$('#mtNext').onclick=()=>{S.mtPage++;renderMtPreview();};
  $('#mtAdd').onclick=()=>{const n=$('#mtAddName').value.trim();if(!n)return;
    S.mt.extraRec=S.mt.extraRec.filter(x=>x.name!==n);S.mt.extraRec.push({name:n,suffix:$('#mtAddSuf').value,sub:$('#mtAddSub').value.trim()});
    $('#mtAddName').value='';$('#mtAddSub').value='';save();renderMtRecs();renderMtPreview();};
  $('#btnMt').onclick=downloadMeeting;
  window.addEventListener('resize',()=>{if(S.tab==='meeting')renderMtPreview();});}

/* ---------- 畫面 ---------- */
function renderChips(){
  const arr=Object.values(S.schedules).sort((a,b)=>(a.kind+a.label).localeCompare(b.kind+b.label,'zh-Hant'));
  const sems=[...new Set(arr.map(s=>s.year+'-'+s.sem))].sort().reverse(),curSem=S.settings.year+'-'+S.settings.sem;
  const semHTML=sems.length?'<label class="semsel">目前使用的學期<select id="semSel">'+sems.map(x=>{const p=x.split('-');return '<option value="'+x+'"'+(x===curSem?' selected':'')+'>'+p[0]+' 學年第 '+p[1]+' 學期</option>';}).join('')+'</select></label>':'';
  let h=arr.map(s=>'<span class="chip '+(s.kind==='class'?'cls':'')+(s.errs&&s.errs.length?' bad':'')+(s.sample?' sample':'')+((s.year+'-'+s.sem)===curSem?'':' off')+'">'+(s.kind==='teacher'?'老師 ':'班級 ')+esc(s.label)+(s.errs&&s.errs.length?'<span title="'+esc(s.errs.join(' '))+'"> ⚠資料有誤</span>':'')+'<small style="opacity:.7">'+esc(s.year)+'-'+esc(s.sem)+'</small><button data-k="'+esc(s.key)+'" aria-label="移除" type="button">×</button></span>').join('');
  if(S.roster.length)h+='<span class="chip'+(S.rosterSample?' sample':'')+'">學生名冊 '+S.roster.length+' 人<button data-k="__roster" aria-label="移除" type="button">×</button></span>';
  $('#chips').innerHTML=semHTML+h;
  const ss=$('#semSel');if(ss)ss.onchange=e=>{const p=e.target.value.split('-');S.settings.year=p[0];S.settings.sem=p[1];S.settings.userSet=true;save();fixSelections();renderAll();};
  $$('#chips button').forEach(b=>b.onclick=()=>{if(b.dataset.k==='__roster'){S.roster=[];S.rosterSample=false;S.sel=new Set();}else delete S.schedules[b.dataset.k];afterIngest();});
  const hasSample=Object.values(S.schedules).some(s=>s.sample)||S.rosterSample;
  $('#banner').innerHTML=hasSample?'<div class="banner" style="margin-top:10px">目前顯示的是範例資料。貼上你自己的課表後，範例會自動被取代。</div>':'';}
function setTab(t){S.tab=t;
  $$('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));
  $('#tab-overlap').hidden=t!=='overlap';$('#tab-students').hidden=t!=='students';$('#tab-meeting').hidden=t!=='meeting';
  if(t==='students'){renderSettings();renderStudents();}if(t==='meeting')renderMeeting();updateDl();}
function renderAll(){renderChips();renderOverlay();if(S.tab==='students'){renderSettings();renderStudents();}else updateDl();if(S.tab==='meeting')renderMeeting();}

function init(){
  $$('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  $('#meSel').onchange=e=>{S.pick.clear();S.me=e.target.value;S.people.forEach(p=>{if(p.key===S.me)p.key='';});save();renderOverlay();};
  $('#btnAddPerson').onclick=()=>{S.people.push({role:S.people.some(p=>p.role==='導師')?'輔導老師':'導師',key:''});save();renderOverlay();};
  $('#clsSel').onchange=e=>{const c=e.target.value;if(!c)return;const nm=homeroomOf(c)||guessHomeroom(c);
    const t=teachers().find(x=>x.name===nm&&x.key!==S.me);
    if(t){S.pick.clear();let hp=S.people.find(p=>p.role==='導師');if(!hp){hp=S.people.find(p=>!p.key);if(hp)hp.role='導師';else{hp={role:'導師',key:''};S.people.push(hp);}}hp.key=t.key;S.people.forEach(p=>{if(p!==hp&&p.key===t.key)p.key='';});save();renderOverlay();}else{log('info',c+' 班的導師「'+(nm||'未填')+'」沒有對應的教師課表。請先匯入該老師的課表，或在「學生課表」分頁填入導師姓名。');e.target.value='';}};
  const paste=$('#paste');
  const run=()=>{const v=paste.value;if(!v.trim())return;const ok=ingestText(v,'貼上的內容');paste.value='';if(ok)afterIngest();else renderChips();};
  paste.addEventListener('paste',()=>setTimeout(run,30));
  $('#btnAdd').onclick=run;
  $('#file').onchange=async e=>{for(const f of e.target.files)await ingestFile(f);e.target.value='';afterIngest();};
  const drop=$('#drop');
  ['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){e.preventDefault();drop.classList.add('over');}}));
  ['dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{if(ev==='drop'||e.target===document.documentElement||!e.relatedTarget)drop.classList.remove('over');}));
  document.addEventListener('drop',async e=>{if(!e.dataTransfer||!e.dataTransfer.files.length)return;e.preventDefault();for(const f of e.dataTransfer.files)await ingestFile(f);afterIngest();});
  $('#btnSample').onclick=()=>{loadSample();afterIngest();};
  $('#btnClear').onclick=()=>{S.schedules={};S.roster=[];S.rosterSample=false;S.sel=new Set();S.homeroom={};S.alias={};S.me='';S.people=[{role:'導師',key:''}];S.pick=new Set();S.pickDelay={};try{localStorage.removeItem(LS);}catch(e){}afterIngest();};
  $('#pvRes').onclick=()=>{S.pvMode='res';renderPreview();};$('#pvMer').onclick=()=>{S.pvMode='merged';renderPreview();};
  $('#btnDl').onclick=downloadAll;
  $('#setYear').oninput=e=>{S.settings.year=e.target.value.trim();S.settings.userSet=true;save();renderAll();renderSettings();};
  $('#setSem').onchange=e=>{S.settings.sem=e.target.value;S.settings.userSet=true;save();fixSelections();renderAll();renderSettings();};
  $('#setCls').onchange=e=>{S.settings.clsFmt=e.target.value;save();renderStudents();};
  $('#setStart').oninput=e=>{S.settings.start=e.target.value;S.settings.datesEdited=true;save();renderPreview();};
  $('#setEnd').oninput=e=>{S.settings.end=e.target.value;S.settings.datesEdited=true;save();renderPreview();};
  window.addEventListener('resize',()=>{if(S.tab==='students')renderPreview();});
  if(!load())loadSample();
  fixSelections();renderAll();
  $('#scene').innerHTML=sceneSVG();$('#pxPencil').innerHTML=pix(SPR_DEF.pencil,2);
  $('#footPx').innerHTML=['apple','book','star','pencil','clock'].map(k=>SPR[k]).join('');
  const svChanged=(full)=>{save();if(full)renderSvPicks();clearTimeout(svChanged._t);svChanged._t=setTimeout(renderSvPreview,200);};
  $('#svDur').onchange=e=>{S.sv.dur=+e.target.value;svChanged(true);};
  $('#svDelay').onchange=e=>{S.sv.delay=+e.target.value;[...S.pick].forEach(k=>{if(!/-L$/.test(k))S.pickDelay[k]=S.sv.delay;});svChanged(true);};
  $('#svWeek').oninput=e=>{S.sv.week=e.target.value;svChanged(true);};
  $('#svDue').oninput=e=>{S.sv.due=e.target.value;svChanged(false);};
  $('#svTopic').oninput=e=>{S.sv.topic=e.target.value;svChanged(false);};
  $('#svStu').onchange=e=>{S.sv.stu=e.target.value;save();renderSvPreview();};
  $('#btnSv').onclick=downloadSurvey;
  $('#btnStuAdd').onclick=()=>{S.extra.push({cls:'',seat:'',name:''});save();renderStuEditor();const ins=$$('#stuEdit input');if(ins.length)ins[ins.length-3].focus();};
  $('#btnStuBulk').onclick=()=>{const ta=$('#stuBulk');ta.value.split(/\n/).forEach(l=>{const p=l.trim().split(/[\t,，\s]+/).filter(Boolean);if(p.length>=3)S.extra.push({cls:p[0],seat:p[1],name:p.slice(2).join('')});else if(p.length===2)S.extra.push({cls:'',seat:p[0],name:p[1]});});ta.value='';save();renderStuEditor();renderSurvey();};
  window.addEventListener('resize',()=>{renderSvPreview();});
  renderStuEditor();initMeeting();
  window.__app={S:S,pickOpts:pickOpts,surveyHTML:surveyHTML,allStudents:allStudents,eventTeacher:eventTeacher,parseSchedule:parseSchedule,parseRoster:parseRoster,ingestText:ingestText,sheetHTML:sheetHTML,renderAll:renderAll,setTab:setTab,mtRecs:mtRecs,mtSheetHTML:mtSheetHTML,mtTeachers:mtTeachers,SEATS:SEATS};
}
init();
})();
