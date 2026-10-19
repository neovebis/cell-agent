import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, Icon, PageTitle, Txt } from '../components/UI';
import { C } from '../theme';
import type { ActivityItem } from '../types';
export function ActivityScreen({items,onInfo,demo}:{items:ActivityItem[];onInfo:(text:string)=>void;demo:boolean}){
  const [filter,setFilter]=useState<'Todas'|'Ativas'|'Concluídas'>('Todas');
  const visible=items.filter(i=>filter==='Todas'||(filter==='Ativas'?(i.kind==='running'||i.kind==='approval'):i.kind==='complete'));
  return <ScrollView contentContainerStyle={{padding:24,paddingTop:36,paddingBottom:125}}>
    <PageTitle kicker="Tudo o que acontece" title="Atividade"/>
    <View style={{flexDirection:'row',backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:40,padding:5,marginBottom:24}}>
      {(['Todas','Ativas','Concluídas'] as const).map(k=><Pressable key={k} onPress={()=>setFilter(k)} style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:filter===k?C.ink:'transparent',borderRadius:40,height:44}}><Txt weight="600" color={filter===k?C.white:C.muted} size={12}>{k}</Txt></Pressable>)}
    </View>
    {visible.length===0?<Card style={{paddingVertical:37,alignItems:'center',gap:12}}><Icon name="checkmark-circle-outline" color={C.muted} size={35}/><Txt color={C.muted}>Sem atividade para apresentar.</Txt><Txt color={C.faint} size={12}>As missões dos teus agentes aparecem aqui.</Txt></Card> : <View style={{gap:12}}>{visible.map(item=><Pressable key={item.id} onPress={()=>onInfo(item.kind==='approval'?'As aprovações exigem confirmação autenticada no runtime do CELL SYSTEM.':item.subtitle)}>
      <Card style={{flexDirection:'row',gap:13,padding:18}}>
        <View style={{height:44,width:44,borderRadius:100,backgroundColor:C.white,alignItems:'center',justifyContent:'center'}}><Icon name={item.kind==='complete'?'checkmark-circle-outline':item.kind==='approval'?'shield-checkmark-outline':item.kind==='failed'?'alert-circle-outline':'time-outline'} color={item.kind==='failed'?C.error:C.ink}/></View>
        <View style={{flex:1,gap:5}}><Txt weight="700" size={16}>{item.title}</Txt><Txt size={13} color={C.muted}>{item.subtitle}</Txt><Txt size={11} color={C.faint}>{new Date(item.createdAt).toLocaleString('pt-PT')}</Txt></View>
      </Card>
    </Pressable>)}</View>}
    {demo&&<Txt color={C.faint} size={12} style={{marginTop:18}}>O modo de demonstração não executa missões reais.</Txt>}
  </ScrollView>;
}
