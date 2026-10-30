import {useEffect,useState} from 'react';
import {employerApiReady} from './api';

// Frontend-only prototype. Never pass demo identity to authenticated API calls.
const KEY='hhba.demo.candidate.v1';
export const demoModeEnabled=!employerApiReady;
export type DemoAccount={
 version:1;loggedIn:boolean;nickname:string;alias:string;
 headline:string;city:string;preferredRole:string;preferredCity:string;
 workMode:'不限'|'远程'|'现场'|'混合办公';
 intro:string;skills:string;updatedAt:string;
};
const defaults:DemoAccount={version:1,loggedIn:false,nickname:'HHBA 体验用户',
 alias:'demo-member',headline:'探索下一份职业机会',city:'',preferredRole:'',
 preferredCity:'',workMode:'不限',intro:'',skills:'',updatedAt:''};
const clean=(v:unknown,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';
function valid(v:unknown):v is DemoAccount{
 if(!v||typeof v!=='object')return false;
 const a=v as Record<string,unknown>;
 return a.version===1&&typeof a.loggedIn==='boolean'&&
 typeof a.nickname==='string'&&a.nickname.length<=48&&
 typeof a.alias==='string'&&a.alias.length<=36&&
 ['不限','远程','现场','混合办公'].includes(String(a.workMode))&&
 ['headline','city','preferredRole','preferredCity','intro','skills','updatedAt']
 .every(key=>typeof a[key]==='string'&&(a[key] as string).length<=500);
}
export function readDemoProfile():DemoAccount|null{
 if(!demoModeEnabled)return null;
 try{
  const item=localStorage.getItem(KEY);if(!item)return null;
  const data:unknown=JSON.parse(item);
  return valid(data)?{...defaults,...data}:null;
 }catch{return null}
}
export function readDemoAccount():DemoAccount|null{
 const profile=readDemoProfile();return profile?.loggedIn?profile:null;
}
function store(profile:DemoAccount|null){
 if(!demoModeEnabled)return;
 try{if(profile)localStorage.setItem(KEY,JSON.stringify(profile));
     else localStorage.removeItem(KEY);}catch{}
 dispatchEvent(new Event('hhba:demo-account-change'));
}
export function createDemoAccount(values:{nickname:string;alias?:string;preferredRole?:string;preferredCity?:string}){
 const profile:DemoAccount={...defaults,loggedIn:true,
  nickname:clean(values.nickname,32)||defaults.nickname,
  alias:clean(values.alias,28)||defaults.alias,
  preferredRole:clean(values.preferredRole,70),
  preferredCity:clean(values.preferredCity,70),updatedAt:new Date().toISOString()};
 store(profile);return profile;
}
export function enterDemoAccount(){
 const previous=readDemoProfile();
 const profile={...(previous||defaults),loggedIn:true,updatedAt:new Date().toISOString()};
 store(profile);return profile;
}
export function exitDemoAccount(){
 const profile=readDemoProfile();if(profile)store({...profile,loggedIn:false,updatedAt:new Date().toISOString()});
}
export function updateDemoAccount(fields:Partial<Pick<DemoAccount,'nickname'|'headline'|'city'|'preferredRole'|'preferredCity'|'workMode'|'intro'|'skills'>>){
 const previous=readDemoAccount();if(!previous)throw Error('请先进入演示账户');
 const next:DemoAccount={...previous,
  nickname:clean(fields.nickname??previous.nickname,32)||defaults.nickname,
  headline:clean(fields.headline??previous.headline,110),
  city:clean(fields.city??previous.city,70),
  preferredRole:clean(fields.preferredRole??previous.preferredRole,70),
  preferredCity:clean(fields.preferredCity??previous.preferredCity,70),
  workMode:['不限','远程','现场','混合办公'].includes(String(fields.workMode))?fields.workMode!:previous.workMode,
  intro:clean(fields.intro??previous.intro,380),
  skills:clean(fields.skills??previous.skills,150),
  updatedAt:new Date().toISOString()};
 store(next);return next;
}
export function deleteDemoAccount(){store(null)}
export function useDemoAccount(){
 const [account,setAccount]=useState<DemoAccount|null>(()=>readDemoAccount());
 useEffect(()=>{
  const sync=()=>setAccount(readDemoAccount());
  addEventListener('hhba:demo-account-change',sync);
  addEventListener('storage',sync);
  return()=>{removeEventListener('hhba:demo-account-change',sync);removeEventListener('storage',sync)};
 },[]);
 return account;
}
