"use client";

import { useEffect, useMemo, useState } from "react";
import { activities, getActivity } from "@/lib/activities";
import { money, type Product } from "@/lib/catalog";
import { interviewFor } from "@/lib/interview";

type Answers=Record<string,string>;
type Stage="home"|"questions"|"review"|"running"|"results"|"cart";
type Proposal={items:Product[];reasons:Record<string,string>;validation:{totalCents:number;availableCents:number|null;budgetVerified:boolean;unresolved:string[]}};
const labels:Record<string,string>={context:"Trip context",ownership:"Already own or can borrow",budget:"Total gear budget",reserve:"Reserve for other costs",zip:"Fulfillment ZIP",method:"How you will get gear",priority:"Priority",fit:"Fit confidence",backpack:"Pack",shelter:"Shelter",bag:"Sleeping bag",pad:"Sleeping pad",stove:"Stove","water-treatment":"Water treatment",headlamp:"Headlamp","first-aid":"First-aid kit","running-shoes":"Running shoes",hydration:"Hydration"};
const cents=(value?:string)=>{const amount=Number(value);return value?.trim()&&Number.isFinite(amount)&&amount>0?Math.round(amount*100):null;};
const safeError=(message:string)=>message.startsWith("[")||message.includes("Expected number")?"We couldn’t read that amount. Please edit your answer and try again.":message;

export default function RetailAssistant(){
 const [stage,setStage]=useState<Stage>("home");
 const [activityId,setActivityId]=useState("");
 const [answers,setAnswers]=useState<Answers>({});
 const [index,setIndex]=useState(0);
 const [owned,setOwned]=useState<string[]>([]);
 const [proposal,setProposal]=useState<Proposal|null>(null);
 const [error,setError]=useState("");
 const [cart,setCart]=useState<Product[]>([]);
 const [researchStep,setResearchStep]=useState(0);
 const activity=getActivity(activityId);
 const questions=useMemo(()=>{
  if(!activity)return [];
  const interview=interviewFor(activity.id);
  return [
   {id:"context",heading:`What kind of ${activity.name.toLowerCase()} are you planning?`,options:activity.subactivities},
   {id:"ownership",heading:`What ${activity.name.toLowerCase()} gear do you already own or can borrow?`,options:interview.ownership.map(option=>option.label)},
   ...interview.questions(answers.context).map(question=>({id:question.id,heading:question.heading,options:question.options||[]}))
  ];
 },[activity,answers.context]);
 const current=questions[index];

 // Every visit begins a separate trip plan instead of reviving a prior journey.
 useEffect(()=>{void fetch("/api/session",{method:"POST"}).catch(()=>undefined);},[]);
 useEffect(()=>{if(stage!=="running")return;setResearchStep(0);const timer=window.setInterval(()=>setResearchStep(step=>Math.min(step+1,3)),900);return()=>window.clearInterval(timer);},[stage]);

 const start=(id:string)=>{setActivityId(id);setAnswers({});setOwned([]);setIndex(0);setProposal(null);setError("");setStage("questions");};
 const restart=()=>{setActivityId("");setAnswers({});setOwned([]);setIndex(0);setProposal(null);setCart([]);setError("");setResearchStep(0);setStage("home");void fetch("/api/session",{method:"POST"}).catch(()=>undefined);};
 const answer=(value:string)=>{
  if(!current)return;
  if(current.id==="ownership"){
   const option=interviewFor(activityId as never).ownership.find(item=>item.label===value);
   if(option)setOwned(items=>items.includes(option.id)?items.filter(item=>item!==option.id):[...items,option.id]);
   return;
  }
  setAnswers(items=>({...items,[current.id]:value}));
  window.setTimeout(()=>setIndex(step=>step===questions.length-1?(setStage("review"),step):step+1),130);
 };
 const continueQuestion=()=>{
  if(!current)return;
  const value=current.id==="ownership"?owned.join(","):answers[current.id];
  if(current.id==="budget"&&value&&!Number(value)){setError("Enter a valid amount or skip this question.");return;}
  if(current.id==="reserve"&&Number(value)<0){setError("Enter zero or a positive amount.");return;}
  if(current.id==="zip"&&value&&!/^\d{5}$/.test(value)){setError("Enter a five-digit ZIP or skip this question.");return;}
  setError("");
  if(current.id==="ownership")setAnswers(items=>({...items,ownership:value}));
  if(index===questions.length-1)setStage("review");else setIndex(step=>step+1);
 };
 const run=async()=>{
  if(!activity)return;
  setStage("running");setError("");
  const requirements={version:Date.now(),activityId,answers,budgetCents:cents(answers.budget),reserveCents:answers.reserve?.trim()?cents(answers.reserve):0,coveredSlots:owned,priority:answers.priority||"Balanced"};
  try{
   const response=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:crypto.randomUUID(),requirements})});
   const data=await response.json();if(!response.ok)throw Error(data.error||"We couldn’t find matching gear.");setProposal(data.proposal);setStage("results");
  }catch(cause){setError(safeError(cause instanceof Error?cause.message:"We couldn’t find matching gear."));setStage("review");}
 };

 return <Shell cartCount={cart.length} onRestart={restart}><main>
  {stage==="home"&&<section className="retail-hero"><div><p className="eyebrow">OUTDOOR GEAR, MADE CLEAR</p><h1>Your first trip starts with the right gear.</h1><p>Build a practical gear list for your next adventure.</p><button onClick={()=>setStage("questions")}>Build my first setup</button><button className="linkbtn" onClick={()=>start("backpacking")}>Try an example</button></div><div className="hero-image">A steadier start<br/><small>One decision at a time.</small></div></section>}
  {stage==="questions"&&!activity&&<section className="question"><h1>What are you getting outside to do?</h1><div className="activity-list">{activities.map(item=><button key={item.id} className="activity" onClick={()=>start(item.id)}><b><span>{item.icon}</span>{item.name}</b></button>)}</div></section>}
  {stage==="questions"&&activity&&current&&<section className="question"><h1>{current.heading}</h1>
   {current.id==="ownership"?<><div className="checklist">{interviewFor(activity.id).ownership.map(option=><label key={option.id}><input type="checkbox" checked={owned.includes(option.id)} onChange={()=>answer(option.label)}/>{option.label}</label>)}</div><button onClick={continueQuestion}>Continue</button></>:current.id==="budget"||current.id==="reserve"||current.id==="zip"?<><input aria-label={current.heading} className="question-input" placeholder={current.id==="zip"?"ZIP code (optional)":current.id==="budget"?"Budget (optional)":"Reserve (optional)"} type={current.id==="zip"?"text":"number"} inputMode={current.id==="zip"?"numeric":undefined} min={current.id==="zip"?undefined:"0"} autoFocus value={answers[current.id]||""} onChange={event=>setAnswers(items=>({...items,[current.id]:event.target.value}))}/><button onClick={continueQuestion}>{current.id==="budget"&&!answers.budget?.trim()?"Skip":"Continue"}</button></>:<div className="options">{current.options.map(option=><button key={option} className={answers[current.id]===option?"selected":""} onClick={()=>answer(option)}>{answers[current.id]===option?"✓ ":""}{option}</button>)}</div>}
   {error&&<p className="error">{error}</p>}<button className="back" onClick={()=>index?setIndex(step=>step-1):(setActivityId(""),setStage("questions"))}>← Back</button>
  </section>}
  {stage==="review"&&activity&&<section className="retail"><h1>Ready to find your gear?</h1><div className="tags">{Object.entries(answers).map(([key,value])=><span key={key}><b>{labels[key]||key}: </b>{value||"Not sure"}</span>)}<span><b>Already have: </b>{owned.length?owned.map(id=>labels[id]||id).join(", "):"Nothing yet"}</span></div>{error&&<p className="error">{error}</p>}<button onClick={run}>Find matching gear</button><button className="back" onClick={()=>setStage("questions")}>← Edit answers</button></section>}
  {stage==="running"&&<section className="retail"><h1>Finding your gear.</h1><div className="research" aria-live="polite"><div className="research-bar"><span style={{width:`${25+(researchStep*25)}%`}}/></div>{["Reviewing your trip","Looking for gear","Checking options","Building your list"].map((label,step)=><p className={step<=researchStep?"active":""} key={label}>{step<researchStep?"✓":step===researchStep?"●":"○"} {label}</p>)}</div><button className="outline" onClick={()=>setStage("review")}>Cancel</button></section>}
  {stage==="results"&&proposal&&activity&&<Results activity={activity.name} proposal={proposal} answers={answers} cart={cart} onAdd={product=>setCart(items=>items.some(item=>item.id===product.id)?items:[...items,product])} onCart={()=>setStage("cart")}/>}
  {stage==="cart"&&<Cart cart={cart} onBack={()=>setStage(proposal?"results":"review")}/>}
 </main></Shell>;
}

function Results({activity,proposal,answers,cart,onAdd,onCart}:{activity:string;proposal:Proposal;answers:Answers;cart:Product[];onAdd:(product:Product)=>void;onCart:()=>void}){return <section className="results"><div><p className="stage">{activity.toUpperCase()} GEAR LIST</p><h1>{proposal.items.length?"Your first-trip setup.":"No new gear is needed."}</h1><p className="sub">Prices are recorded snapshots. Check availability on REI before you buy.</p>{proposal.items.map(item=><article className="retail-card" key={item.id}>{item.imageUrl?<img src={item.imageUrl} alt={`${item.brand} ${item.name}`} className="product-image"/>:<div className="image-placeholder">Official product photo unavailable</div>}<div><p className="category">{labels[item.slot]}</p><h2>{item.brand} {item.name}</h2><b>{money(item.priceCents)}</b><div className="specs">{item.facts.map(fact=><span key={fact}>{fact}</span>)}</div><p><b>Why it matches: </b>{proposal.reasons[item.id]||"Selected from a direct product source."}</p><p className="source">{item.evidence} · checked {item.verifiedAt}</p><a href={item.sourceUrl} target="_blank">View product source ↗</a><br/><a href={item.searchUrl} target="_blank">Search on REI ↗</a></div><div><button onClick={()=>onAdd(item)}>{cart.some(product=>product.id===item.id)?"Added":"Add to demo cart"}</button></div></article>)}</div><aside><p>Gear budget <b>{cents(answers.budget)===null?"Not entered":money(cents(answers.budget))}</b></p><p>Selected subtotal <b>{money(proposal.validation.totalCents)}</b></p>{proposal.validation.availableCents!==null&&<p>Remaining <b>{money(proposal.validation.availableCents-proposal.validation.totalCents)}</b></p>}<button onClick={onCart}>Review demo cart</button></aside></section>;}
function Cart({cart,onBack}:{cart:Product[];onBack:()=>void}){return <section className="cart"><p className="stage">DEMO CART</p><h1>Shopping summary</h1>{cart.length?cart.map(product=><div className="cartrow" key={product.id}>{product.imageUrl&&<img src={product.imageUrl} alt={`${product.brand} ${product.name}`} className="cart-image"/>}<span>{product.brand} {product.name}</span><b>{money(product.priceCents)}</b><a href={product.searchUrl} target="_blank">Search on REI</a></div>):<p>Your demo cart is empty.</p>}<button className="back" onClick={onBack}>← Back</button></section>;}
function Shell({children,cartCount,onRestart}:{children:React.ReactNode;cartCount:number;onRestart:()=>void}){return <><div className="utility"><div>Independent concept prototype. Not affiliated with or endorsed by REI.</div></div><header className="reihead"><a href="/" className="project-logo" aria-label="Start a new First Trip plan" onClick={event=>{event.preventDefault();onRestart();}}><img src="/first-trip-assistant-logo.png" alt="First Trip Assistant" width={245} height={82}/></a><nav><a href="https://www.rei.com/learn/expert-advice" target="_blank">Expert Advice</a><span>Gear list {cartCount>0&&<>({cartCount})</>}</span></nav></header><div className="crumbbar">Outdoor activities / <b>First Trip Assistant</b></div>{children}<footer>First Trip Assistant · Gear list only; no retailer cart transfer · <a href="https://www.rei.com/learn/expert-advice" target="_blank">Expert Advice</a></footer></>}
