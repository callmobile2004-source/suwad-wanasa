import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const ORIGINS = new Set(["https://callmobile2004-source.github.io","https://suwad-wanasa.pages.dev"]);
const HEADERS = {"Access-Control-Allow-Origin":"https://callmobile2004-source.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400","Cache-Control":"no-store","Vary":"Origin"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(body:Record<string,unknown>,status=200,origin?:string){return Response.json(body,{status,headers:{...HEADERS,"Access-Control-Allow-Origin":origin??HEADERS["Access-Control-Allow-Origin"]}});}
function defaultKey(raw:string|undefined){if(!raw)return null;try{const v=JSON.parse(raw);return typeof v?.default==="string"?v.default:null;}catch{return null;}}
function message(code?:string){switch(code){case"42501":return[403,"ما عندك صلاحية لتنفيذ هالعملية."];case"22023":return[400,"تحقق من المبلغ والإعدادات وحاول مرة ثانية."];case"40001":return[409,"تغيّرت حالة المزاد؛ حدّث الشاشة وحاول من جديد."];case"55000":return[409,"حالة المزاد ما تسمح بهالعملية حالياً."];case"P0002":return[404,"الغرفة أو القطعة غير موجودة."];case"23505":return[409,"هذا الرمز مستخدم؛ جرّب مرة ثانية."];default:return[500,"تعذّر تنفيذ العملية على خادم المزاد."];}}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")??undefined;
 if(origin&&!ORIGINS.has(origin))return reply({error:"مصدر الطلب غير مسموح."},403,origin);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{...HEADERS,"Access-Control-Allow-Origin":origin??HEADERS["Access-Control-Allow-Origin"]}});
 if(req.method!=="POST")return reply({error:"طريقة الطلب غير مدعومة."},405,origin);
 const bearer=/^Bearer\s+(.+)$/i.exec(req.headers.get("authorization")??"")?.[1]?.trim();
 if(!bearer||bearer.length>8192)return reply({error:"سجّل الدخول أولاً."},401,origin);
 const url=Deno.env.get("SUPABASE_URL");
 const pub=defaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"))??Deno.env.get("SUPABASE_ANON_KEY");
 const secret=defaultKey(Deno.env.get("SUPABASE_SECRET_KEYS"))??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!pub||!secret)return reply({error:"إعداد محرك المزاد غير مكتمل على الخادم."},503,origin);
 let input:Record<string,unknown>;
 try{const raw=await req.text();if(!raw||raw.length>6000)return reply({error:"حجم الطلب غير صالح."},413,origin);const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return reply({error:"صيغة الطلب غير صالحة."},400,origin);input=parsed;}
 catch{return reply({error:"تعذّر قراءة الطلب."},400,origin);}
 const user=createClient(url,pub,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
 const {data:auth,error:authError}=await user.auth.getUser(bearer);
 if(authError||!auth.user||!UUID.test(auth.user.id))return reply({error:"جلسة الدخول غير صالحة."},401,origin);
 const actor=auth.user.id;
 const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
 const action=typeof input.action==="string"?input.action:"";
 const payload=input.payload&&typeof input.payload==="object"&&!Array.isArray(input.payload)?input.payload as Record<string,unknown>:{};
 async function snapshot(roomId:string){
  const {data:room,error:re}=await admin.from("auction_rooms").select("*").eq("id",roomId).maybeSingle();
  if(re||!room)throw Object.assign(new Error("room"),{code:re?.code??"P0002"});
  const {data:players,error:pe}=await admin.from("auction_room_players").select("user_id,display_name,seat,balance,spent,total_wins").eq("room_id",roomId).order("seat");
  if(pe)throw Object.assign(new Error("players"),{code:pe.code});
  if(!(players??[]).some(p=>p.user_id===actor))throw Object.assign(new Error("member"),{code:"42501"});
  const [{data:item},{data:media},{data:lots}]=await Promise.all([
   room.current_item_id?admin.from("auction_items").select("id,category_id,title_ar,subtitle_ar,description_ar,facts,estimated_value,opening_price,min_increment,currency_code,rarity,condition_label,source_name,source_url,source_license").eq("id",room.current_item_id).maybeSingle():Promise.resolve({data:null}),
   room.current_item_id?admin.from("auction_item_media").select("id,media_kind,storage_path,external_url,alt_ar,attribution,license,sort_order,is_primary").eq("item_id",room.current_item_id).eq("is_active",true).order("sort_order"):Promise.resolve({data:[]}),
   admin.from("auction_room_lots").select("round_number,item_id,opening_price,final_price,winner_id,status,started_at,ended_at").eq("room_id",roomId).order("round_number")
  ]);
  let bidsQuery=admin.from("auction_bids").select("id,item_id,bidder_id,amount,created_at").eq("room_id",roomId).order("created_at",{ascending:false}).limit(30);
  if(room.bid_mode==="secret")bidsQuery=bidsQuery.eq("bidder_id",actor);
  const {data:bids,error:be}=await bidsQuery;
  if(be)throw Object.assign(new Error("bids"),{code:be.code});
  const safeRoom=room.bid_mode==="secret"?{...room,current_price:null,highest_bidder_id:null}:room;
  return {room:safeRoom,players:players??[],item:item?{...item,media:media??[]}:null,lots:lots??[],bids:bids??[],myPlayer:(players??[]).find(p=>p.user_id===actor)??null};
 }
 try{
  if(action==="create"){
   const categoryId=String(payload.categoryId??"");
   const displayName=String(payload.displayName??"").trim();
   const maxPlayers=Number(payload.maxPlayers??8),budget=Number(payload.budget??100000);
   const bidMode=payload.bidMode==="secret"?"secret":"open";
   const seconds=Number(payload.roundTimeSeconds??45),rounds=Number(payload.roundsTotal??5);
   if(!/^[a-z0-9-]{2,40}$/.test(categoryId)||displayName.length<2||displayName.length>24||!Number.isInteger(maxPlayers)||!Number.isInteger(budget)||!Number.isInteger(seconds)||!Number.isInteger(rounds))return reply({error:"بيانات إنشاء الغرفة غير صالحة."},400,origin);
   const {data,error}=await admin.rpc("auction_create_room",{p_actor_id:actor,p_category_id:categoryId,p_display_name:displayName,p_max_players:maxPlayers,p_budget:budget,p_bid_mode:bidMode,p_round_time_seconds:seconds,p_rounds_total:rounds});
   if(error){const [status,msg]=message(error.code);return reply({error:msg,code:error.code},status,origin);}
   return reply({room:data, ...(await snapshot(data.id))},200,origin);
  }
  if(action==="join"){
   const code=String(payload.roomCode??"").trim().toUpperCase(),displayName=String(payload.displayName??"").trim();
   const {data,error}=await admin.rpc("auction_join_room",{p_actor_id:actor,p_room_code:code,p_display_name:displayName});
   if(error){const [status,msg]=message(error.code);return reply({error:msg,code:error.code},status,origin);}
   return reply(await snapshot(data.id),200,origin);
  }
  const roomId=typeof input.roomId==="string"?input.roomId:"";
  if(!UUID.test(roomId))return reply({error:"معرّف غرفة المزاد غير صالح."},400,origin);
  if(action==="snapshot")return reply(await snapshot(roomId),200,origin);
  if(action==="start"||action==="close"){
   const rpc=action==="start"?"auction_start_room":"auction_close_lot";
   const {error}=await admin.rpc(rpc,{p_room_id:roomId,p_actor_id:actor});
   if(error){const [status,msg]=message(error.code);return reply({error:msg,code:error.code},status,origin);}
   return reply(await snapshot(roomId),200,origin);
  }
  if(action==="bid"){
   const amount=Number(payload.amount),expected=typeof payload.expectedUpdatedAt==="string"?payload.expectedUpdatedAt:null;
   if(!Number.isSafeInteger(amount)||amount<1||!expected||!Number.isFinite(Date.parse(expected)))return reply({error:"أدخل عرضاً صحيحاً وحدّث حالة المزاد."},400,origin);
   const {error}=await admin.rpc("auction_place_bid",{p_room_id:roomId,p_actor_id:actor,p_amount:amount,p_expected_updated_at:expected});
   if(error){const [status,msg]=message(error.code);return reply({error:msg,code:error.code},status,origin);}
   return reply(await snapshot(roomId),200,origin);
  }
  return reply({error:"عملية المزاد غير معروفة."},400,origin);
 }catch(error){
  const code=(error as {code?:string})?.code;const [status,msg]=message(code);
  console.error("[auction-engine] request failed",{action,code:code??"unknown"});
  return reply({error:msg,code:code??"unknown"},status,origin);
 }
});