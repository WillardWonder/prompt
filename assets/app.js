/* High-Impact Prompting with ChatGPT — site script. No dependencies. */
(function(){
"use strict";
var KEY="hip-nov10", S={};
try{S=JSON.parse(localStorage.getItem(KEY))||{}}catch(e){S={}}
S.stages=S.stages||[];S.ctx=S.ctx||{};S.ph=S.ph||{};S.tally=S.tally||{};
var subs=[];
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){} subs.forEach(function(f){f()})}
function on(f){subs.push(f);f()}
function $(s,r){return (r||document).querySelector(s)}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function esc(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function v(k){return (S[k]||"").trim()}
function nodot(t){return t.replace(/[.\s]+$/,"")}

/* ---------- copy + toast ---------- */
var toastT;
function toast(m){var t=$("#toast");if(!t)return;t.textContent=m;t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove("on")},2600)}
function copyText(text,btn,label){
  function ok(){if(btn){btn.textContent="Copied";btn.classList.add("ok");setTimeout(function(){btn.textContent=label;btn.classList.remove("ok")},1600)}}
  function fb(){var ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");ok()}catch(e){toast("Select the text and copy it")}document.body.removeChild(ta)}
  if(navigator.clipboard&&window.isSecureContext)return navigator.clipboard.writeText(text).then(ok,fb);
  fb();return Promise.resolve();
}

/* ---------- prompt blocks ----------
   data-mode="new"    -> Open in ChatGPT (new chat, prompt filled in) + Copy
   data-mode="same"   -> Copy only, paste into the chat you're already in
   data-mode="attach" -> Copy and open ChatGPT, attach files first          */
var CHAT="https://chatgpt.com/";
function url(t){return CHAT+"?q="+encodeURIComponent(t)}
var WHERE={new:"Starts a new chat",same:"Paste into the same chat",attach:"Attach the files, then paste"};
function build(el){
  if(el.dataset.built)return;el.dataset.built="1";
  var mode=el.getAttribute("data-mode")||"new",text=el.textContent.replace(/^\s*\n/,"").replace(/\s+$/,"");
  el.textContent="";el.classList.add(mode);
  var t=document.createElement("div");t.className="txt";t.textContent=text;el.appendChild(t);
  var bar=document.createElement("div");bar.className="pbar";bar.innerHTML='<span class="where">'+WHERE[mode]+'</span>';
  if(mode==="new"){var a=document.createElement("a");a.className="pbtn go";a.target="_blank";a.rel="noopener";a.textContent="Open in ChatGPT";a.href=url(text);bar.appendChild(a)}
  if(mode==="attach"){var b=document.createElement("button");b.type="button";b.className="pbtn go";b.textContent="Copy and open ChatGPT";
    b.addEventListener("click",function(){copyText(t.textContent,null,"");window.open(CHAT,"_blank","noopener");toast("Prompt copied. Attach the files in ChatGPT, then paste.")});bar.appendChild(b)}
  var c=document.createElement("button");c.type="button";c.className="pbtn";c.textContent="Copy";
  c.addEventListener("click",function(){copyText(t.textContent,c,"Copy")});bar.appendChild(c);
  el.appendChild(bar);
}
function setP(el,text){build(el);el.querySelector(".txt").textContent=text;var a=el.querySelector("a.go");if(a)a.href=url(text)}
$$(".prompt").forEach(build);
$$("[data-chip]").forEach(function(b){b.addEventListener("click",function(){copyText(b.getAttribute("data-chip"),null,"").then(function(){toast("Copied. Paste it into the same chat.")})})});

/* ---------- bound fields ---------- */
$$("[data-k]").forEach(function(el){var k=el.getAttribute("data-k");if(S[k]!=null)el.value=S[k];
  el.addEventListener("input",function(){S[k]=el.value;$$('[data-k="'+k+'"]').forEach(function(o){if(o!==el)o.value=el.value});save()})});

/* ---------- shared derived text ---------- */
function dest(){var w=v("who"),a=v("able");return (w||a)?"When this is finished, "+(w||"___")+" will be able to "+nodot(a||"___")+".":""}
var CTX=[
  ["goal","Goal and success criteria","What finished looks like"],
  ["aud","Audience and purpose","Who it's for and what it should do for them"],
  ["src","Source documents and evidence","Notes, data, past versions, real numbers"],
  ["ex","Examples of good or bad output","Something to imitate or avoid"],
  ["con","Constraints and non-negotiables","Length, budget, deadline, must or must-not"],
  ["hist","History and previous decisions","What's already been decided and why"],
  ["tried","What has already been tried","So it doesn't suggest what already failed"],
  ["rules","Policies or rules","Organization rules, regulations, standards"],
  ["fmt","Tone, format, and where it will be used","Email, printed sheet, slide, text message"]
];
function ctxItems(){return CTX.filter(function(c){return S.ctx[c[0]]&&S.ctx[c[0]].on}).map(function(c){return {l:c[1],n:(S.ctx[c[0]].n||"").trim()}})}
function named(){return S.stages.filter(function(s){return (s.n||"").trim()})}
function startPrompt(){
  var L=["I'm working on: "+(v("task")||"[describe your task]")+"."];
  if(dest())L.push(dest());
  if(v("right"))L.push("I'll know it's right when "+nodot(v("right"))+".");
  if(v("keep"))L.push("\nDecisions I've already made (don't change these):\n"+v("keep"));
  var c=ctxItems().filter(function(x){return x.n});
  if(c.length)L.push("\nContext you need:\n"+c.map(function(x){return "- "+x.l+": "+x.n}).join("\n"));
  var st=named();
  if(st.length)L.push("\nI plan to work in stages:\n"+st.map(function(s,i){return (i+1)+". "+s.n.trim()+(s.ai?" (you: "+s.ai.trim()+")":"")+(s.me?" (me: "+s.me.trim()+")":"")}).join("\n")+"\n\nLet's start with stage 1.");
  L.push("\nBefore you begin, ask me any questions you need answered. Don't fill in important gaps on your own.");
  return L.join("\n");
}

/* ---------- bowl: decision tally ---------- */
var tally=$("#tally");
if(tally){
  var DEC=["The bowl","Which fruit","How much fruit","Lighting","Background and table","Camera angle","Style (photo, painting...)","Mood"];
  DEC.forEach(function(d,i){var r=document.createElement("div");r.className="row";
    r.innerHTML='<span>'+d+'</span><span class="seg" role="group" aria-label="Who decided: '+esc(d)+'"><button type="button" class="me" data-i="'+i+'" data-w="me">Me</button><button type="button" data-i="'+i+'" data-w="ai">The AI</button></span>';tally.appendChild(r)});
  tally.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;S.tally[b.dataset.i]=b.dataset.w;save()});
  on(function(){var me=0;$$("button",tally).forEach(function(b){b.setAttribute("aria-pressed",String((S.tally[b.dataset.i]||"ai")===b.dataset.w))});
    DEC.forEach(function(_,i){if(S.tally[i]==="me")me++});$("#tallyScore").innerHTML='You made <span>'+me+'</span> of '+DEC.length+' decisions.'});
}

/* ---------- bowl: purpose round ---------- */
var pc=$("#purposes");
if(pc){
  var PUR=[
    {id:"flyer",t:"Grocery store weekly flyer",d:"sells this week's sale fruit",ph:["Only the fruit on sale: peaches and plums","Bright, plain background that works behind price tags","Shot from straight above"]},
    {id:"paint",t:"Still-life painting class",d:"a reference beginners will paint from",ph:["Three fruits with simple shapes","One strong light from the left with clear shadows","Plain cloth background"]},
    {id:"color",t:"Coloring page for a child",d:"printed and colored with crayons",ph:["Black and white line art only","Big, simple shapes with thick outlines","No shading or tiny details"]},
    {id:"menu",t:"Restaurant dessert menu",d:"upscale, autumn season",ph:["Pears, figs, and grapes only","Dark, moody lighting","Shallow focus on a stoneware bowl"]}
  ];
  PUR.forEach(function(p){var b=document.createElement("button");b.type="button";b.className="choice";b.dataset.id=p.id;b.innerHTML="<b>"+p.t+"</b><small>"+p.d.charAt(0).toUpperCase()+p.d.slice(1)+"</small>";pc.appendChild(b)});
  pc.addEventListener("click",function(e){var b=e.target.closest(".choice");if(!b)return;S.purpose=b.dataset.id;save()});
  on(function(){var p=PUR.filter(function(x){return x.id===S.purpose})[0];
    $$(".choice",pc).forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.id===S.purpose))});
    ["pd1","pd2","pd3"].forEach(function(k,i){$("#"+k).placeholder=p?p.ph[i]:"Pick a purpose first"});
    var ds=["pd1","pd2","pd3"].map(v).filter(Boolean);
    setP($("#purposePrompt"),p?"Make a new image of this bowl of fruit for a "+p.t.toLowerCase()+" ("+p.d+")."+(ds.length?" "+ds.map(function(d){return nodot(d)+"."}).join(" "):""):"Pick a purpose above, then add your decisions.")});
}

/* ---------- drift log ---------- */
var dr=$("#driftRows");
if(dr){for(var i=1;i<=5;i++){var tr=document.createElement("tr");tr.innerHTML='<td>'+i+'</td><td><input type="text" data-d="d'+i+'a" aria-label="Edit '+i+': what I asked"></td><td><input type="text" data-d="d'+i+'b" aria-label="Edit '+i+': what else changed"></td>';dr.appendChild(tr)}
  $$("[data-d]",dr).forEach(function(el){var k=el.dataset.d;if(S[k])el.value=S[k];el.addEventListener("input",function(){S[k]=el.value;save()})})}

/* ---------- destination ---------- */
var ds=$("#destSentence");
if(ds)on(function(){var w=v("who"),a=v("able"),r=v("right");
  ds.innerHTML='When this is finished, <span class="blank">'+esc(w||"someone")+'</span> will be able to <span class="blank">'+esc(nodot(a||"do something"))+'</span>.'+(r?'<span class="sub">I\'ll know it\'s right when '+esc(nodot(r))+'.</span>':'')});

/* ---------- context: audience prompt ---------- */
var aud=$("#audSeg");
if(aud){
  var AUD={staff:{a:"Our customer support staff",p:"Make sure they know exactly what changes, what they must do, and by when",t:"Direct and practical. Short paragraphs."},
           cust:{a:"Our customers",p:"Explain what changes for them and why it helps them",t:"Warm, short, and plain. No internal terms like \"reason codes.\""}};
  S.aud=S.aud||"staff";
  var memo=$$("#memo p").map(function(p){return p.textContent}).join("\n");
  aud.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;S.aud=b.dataset.aud;save()});
  on(function(){$$("button",aud).forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.aud===S.aud))});var a=AUD[S.aud];
    setP($("#ctxPrompt"),"Write an announcement about a policy change.\n\nAudience: "+a.a+"\nPurpose: "+a.p+"\nTone: "+a.t+"\nUse only the facts in the memo below. Don't add anything it doesn't say.\n\nMemo:\n"+memo)});
}
var cl=$("#ctxList");
if(cl)CTX.forEach(function(c){var d=document.createElement("div");d.className="ctx";
  d.innerHTML='<label><input type="checkbox"><span>'+c[1]+'<small>'+c[2]+'</small></span></label><textarea aria-label="Notes: '+esc(c[1])+'" placeholder="What the AI needs to know"></textarea>';
  var cb=$("input",d),ta=$("textarea",d),st=S.ctx[c[0]]||{};cb.checked=!!st.on;ta.value=st.n||"";d.classList.toggle("on",cb.checked);
  cb.addEventListener("change",function(){S.ctx[c[0]]=S.ctx[c[0]]||{};S.ctx[c[0]].on=cb.checked;d.classList.toggle("on",cb.checked);save();if(cb.checked)ta.focus()});
  ta.addEventListener("input",function(){S.ctx[c[0]]=S.ctx[c[0]]||{};S.ctx[c[0]].n=ta.value;save()});cl.appendChild(d)});
var qf=$("#qfPrompt");
if(qf)on(function(){setP(qf,"I need help with this: "+(v("task")||"[your task]")+".\n"+(dest()?dest()+"\n":"")+"Before you write anything, ask me the five questions whose answers would most change the result. Ask one at a time and wait for my answer.")});

var wp=$("#webPrompt");
if(wp)on(function(){setP(wp,"Search the web for current, reliable information that would help me with this: "+(v("task")||"[your task]")+".\nGive me three sources with links, when each was published or last updated, and one sentence on what each one actually says.")});

/* ---------- cascade example ---------- */
var chat=$("#chat");
if(chat){
  var CH=[
    {w:"you",t:"I need help onboarding new hires.",m:["Start loose","You don't need a perfect first prompt."]},
    {w:"ai",t:"Here's a comprehensive 90-day onboarding program. Pre-boarding: send a welcome packet, set up HR system access, assign learning modules. Week 1: mission and values orientation, benefits enrollment, team introductions. 30/60/90-day check-ins with performance goals…",m:["Every blank got filled","Nothing here is wrong. None of it is about this business.",1]},
    {w:"you",t:"That's way bigger than we are. Before you go any further, ask me the questions you need answered.",m:["Ask me questions","Hand the AI the job of finding what's missing."]},
    {w:"ai",t:"Happy to narrow it down. 1. What kind of business is this, and how many people? 2. What does a new hire do on day one? 3. Who runs onboarding, and how much time do they have? 4. What usually goes wrong with new people? 5. What should a new hire be able to do by the end of week one?"},
    {w:"you",t:"12-person machine shop. New hires are on the floor Monday morning. Our shift lead runs it and has maybe 20 minutes a day. What goes wrong: people skip the safety stuff and nobody knows who to ask. By Friday they should run the saw and the deburr station safely and know who to go to.",m:["Add context, name the destination","\"By Friday they should…\" is the destination. Now there's something to steer toward."]},
    {w:"ai",t:"Here's a first-week plan. Monday: safety walk (PPE, e-stops, lockout points) and assign a buddy. Tuesday: shadow at the saw. Wednesday: run the saw with the buddy. Thursday: deburr station. Friday: sign-off with the shift lead. I've also outlined a 14-page employee handbook to go with it…"},
    {w:"you",t:"Keep the safety walk and the buddy. Drop the handbook. Nobody here reads a binder. Make the rest fit on one page.",m:["Keep this, change that","Protect what's working before you fix what isn't."]},
    {w:"ai",t:"Here's the one-page version. And to make this scalable as you grow, I'd recommend moving onboarding into a learning platform with short video modules and quizzes. Here's a rollout plan for choosing a vendor, recording videos, and tracking completion…",m:["Drift","The destination just changed from one page a shift lead runs to a software project, and it sounds perfectly reasonable.",1]},
    {w:"you",t:"We're drifting. Go back to what we decided: one page the shift lead can run in 20 minutes a day.",m:["We're drifting","Name it, and restate the destination."]},
    {w:"ai",t:"You're right, that went beyond what you need. One page, five days. Each day has one 15-minute activity and one \"show me\" check the shift lead initials. Day 1: safety walk and meet your buddy…"},
    {w:"you",t:"Critique this against the goal we set. What would still make a new hire fail?",m:["Critique it against the goal","Not \"is this good?\" but \"does this get us there?\""]},
    {w:"ai",t:"Two gaps. \"Know who to ask\" only works if the buddy's name is written on the sheet. And Friday's sign-off has no clear standard for the deburr station. I'd add a buddy-name line at the top and a pass standard: three parts in spec, no help."},
    {w:"you",t:"Good. Add both. That's the final version.",m:["Lock it","Seven ordinary messages. The destination never moved, because the person kept checking it."]}
  ];
  var step=0;
  var draw=function(anim){chat.innerHTML="";
    for(var i=0;i<=step;i++){var t=CH[i],d=document.createElement("div");d.className="turn "+t.w+(t.m&&t.m[2]?" drifted":"")+(anim&&i===step?" new":"");d.innerHTML='<span class="who">'+(t.w==="you"?"You":"ChatGPT")+'</span>'+esc(t.t);chat.appendChild(d)}
    var m=CH[step].m;$("#moveNote").innerHTML=m?'<div class="move'+(m[2]?" warn":"")+'"><b>'+esc(m[0])+'</b>'+esc(m[1])+'</div>':"";
    $("#cCount").textContent="Turn "+(step+1)+" of "+CH.length;$("#cPrev").disabled=step===0;$("#cNext").disabled=step===CH.length-1};
  $("#cNext").addEventListener("click",function(){if(step<CH.length-1){step++;draw(true)}});
  $("#cPrev").addEventListener("click",function(){if(step>0){step--;draw(false)}});
  $("#cAll").addEventListener("click",function(){step=CH.length-1;draw(false)});
  draw(false);
}

/* ---------- steering phrases ---------- */
var PH=[
  ["That is not what I meant.","Reject a wrong turn early"],
  ["Keep this part and change the rest.","Protect what works"],
  ["What am I missing?","Find gaps you can't see"],
  ["Ask me the questions you need before continuing.","Let it pull context out of you"],
  ["We are drifting from the original goal.","Name the drift"],
  ["Give me three genuinely different approaches.","Escape the first default"],
  ["What assumptions are you making?","Surface hidden decisions"],
  ["Critique this against the goal we established.","Check the route against the destination"],
  ["Go back to what we decided earlier.","Restore the destination"]
];
var pl=$("#phrases");
if(pl)PH.forEach(function(p,i){var li=document.createElement("li");
  li.innerHTML='<input type="checkbox" aria-label="I used: '+esc(p[0])+'"'+(S.ph[i]?" checked":"")+'><span>'+esc(p[0])+'<small>'+esc(p[1])+'</small></span><button class="pbtn" type="button">Copy</button>';
  $("input",li).addEventListener("change",function(e){S.ph[i]=e.target.checked;save()});
  $(".pbtn",li).addEventListener("click",function(e){copyText(p[0],e.target,"Copy")});pl.appendChild(li)});

/* ---------- workflow: reverse-design ---------- */
var sb=$("#stageList");
if(sb){
  var addStage=function(n){S.stages.unshift({n:n||"",ai:"",me:""});save();drawStages(true)};
  $$("#stageIdeas .chip").forEach(function(b){b.addEventListener("click",function(){addStage(b.textContent)})});
  $("#addStage").addEventListener("click",function(){addStage("")});
  var drawStages=function(focus){sb.innerHTML="";
    S.stages.forEach(function(s,i){var d=document.createElement("div");d.className="stage";
      d.innerHTML='<div class="t"><span class="n">'+(i+1)+'</span><input type="text" data-f="n" placeholder="Stage name" aria-label="Stage '+(i+1)+' name"><button class="x" type="button" aria-label="Remove stage">×</button></div><div class="g2"><div><label>AI does</label><input type="text" data-f="ai"></div><div><label>I decide</label><input type="text" data-f="me"></div></div>';
      $$("[data-f]",d).forEach(function(el){var f=el.dataset.f;el.value=s[f]||"";el.addEventListener("input",function(){s[f]=el.value;save()})});
      $(".x",d).addEventListener("click",function(){S.stages.splice(i,1);save();drawStages()});sb.appendChild(d)});
    if(focus&&S.stages.length)$("input",sb.firstChild).focus()};
  drawStages();
}

/* ---------- build: starting prompt ---------- */
$$("[data-start]").forEach(function(el){on(function(){setP(el,startPrompt())})});
on(function(){$$('[data-show="task"]').forEach(function(e){e.textContent=v("task")||"your task"});
  $$('[data-show="dest"]').forEach(function(e){e.textContent=dest()||"(fill in section 4 first)"})});

/* ---------- my task drawer ---------- */
var drawer=$("#drawer"),scrim=$("#scrim");
function openD(e){if(e)e.preventDefault();drawer.classList.add("open");scrim.classList.add("on");drawer.setAttribute("aria-hidden","false");$("#closeTask").focus()}
function closeD(){drawer.classList.remove("open");scrim.classList.remove("on");drawer.setAttribute("aria-hidden","true")}
$$("[data-open-task]").forEach(function(b){b.addEventListener("click",openD)});
$("#closeTask").addEventListener("click",closeD);scrim.addEventListener("click",closeD);
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeD()});
$("#copyStart").addEventListener("click",function(e){copyText(startPrompt(),e.target,"Copy starting prompt")});
$("#clearAll").addEventListener("click",function(){if(confirm("Clear everything you've entered on this page?")){try{localStorage.removeItem(KEY)}catch(e){}location.reload()}});
function para(t){return t?"<p>"+esc(t)+"</p>":'<p class="empty">Not yet</p>'}
function list(a){return a.length?"<ul>"+a.join("")+"</ul>":'<p class="empty">Not yet</p>'}
function sections(H){
  return H("Task")+para(v("task"))+
    H("Destination")+para(dest()+(v("right")?" I'll know it's right when "+nodot(v("right"))+".":""))+
    H("Decisions I'm keeping")+para(v("keep"))+
    H("Context the AI needs")+list(ctxItems().map(function(x){return "<li><b>"+esc(x.l)+"</b>"+(x.n?": "+esc(x.n):"")+"</li>"}))+
    H("Workflow")+list(named().map(function(s){return "<li><b>"+esc(s.n)+"</b>"+(s.ai?". AI: "+esc(s.ai):"")+(s.me?". Me: "+esc(s.me):"")+"</li>"}))+
    H("Steering phrases I used")+list(PH.filter(function(_,i){return S.ph[i]}).map(function(p){return "<li>"+esc(p[0])+"</li>"}))+
    H("My high-impact prompt")+(v("tbPrompt")?'<div class="pp-prompt" style="white-space:pre-wrap">'+esc(v("tbPrompt"))+"</div>":para(""))+
    (v("tbResult")?H("When I tested it")+para(v("tbResult")):"");
}
on(function(){$("#summary").innerHTML=sections(function(h){return "<h4>"+h+"</h4>"});
  var n=0;["task","who","able","right","keep","tbPrompt"].forEach(function(k){if(v(k))n++});if(ctxItems().length)n++;if(named().length)n++;
  $("#meter").style.width=Math.round(n/8*100)+"%"});
function printPlan(){$("#printPlan").innerHTML='<h1>My plan</h1><p class="pp-meta">High-Impact Prompting with ChatGPT. WTPD, November 10, 2026.</p>'+sections(function(h){return "<h2>"+h+"</h2>"})+
  '<h2>Starting prompt</h2><div class="pp-prompt">'+esc(startPrompt())+'</div><h2>When a conversation feels off</h2><p>Summarize what we\'ve decided so far: the goal, the decisions we\'ve locked in, the context that matters, and what\'s still open. Write it so I can paste it into a brand-new conversation.</p>'}
window.addEventListener("beforeprint",printPlan);
$$("[data-print]").forEach(function(b){b.addEventListener("click",function(){printPlan();window.print()})});

/* ---------- rail scrollspy ---------- */
var links=$$(".navlist a"),secs=links.map(function(a){return $(a.getAttribute("href"))});
function spy(){var y=window.scrollY+window.innerHeight*.3,cur=0;secs.forEach(function(s,i){if(s&&s.getBoundingClientRect().top+window.scrollY<=y)cur=i});
  links.forEach(function(a,i){a.classList.toggle("active",i===cur)});
  var r=$(".navlist"),act=links[cur];if(r&&act){var l=act.offsetLeft-r.clientWidth/2+act.clientWidth/2;if(Math.abs(r.scrollLeft-l)>40)r.scrollLeft=l}}
window.addEventListener("scroll",spy,{passive:true});spy();
})();
