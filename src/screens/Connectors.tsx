import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, Icon, PageTitle, Txt } from '../components/UI';
import { C } from '../theme';
import type { Connection } from '../types';
const kinds = ['Tudo','Conectores','Plugins','MCP','Skills','Cells'] as const;
export function ConnectorsScreen({items,demo,onInfo}:{items:Connection[];demo:boolean;onInfo:(text:string)=>void}) {
  const [kind,setKind]=useState<typeof kinds[number]>('Tudo');
  const visible=kind==='Tudo'?items:items.filter(x=>x.kind===kind);
  return <ScrollView contentContainerStyle={{padding:24,paddingTop:36,paddingBottom:135}}>
    <PageTitle kicker="Ferramentas e capacidades" title="Conectores"/>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal:-24,marginBottom:23}} contentContainerStyle={{paddingHorizontal:24,gap:8}}>
      {kinds.map(k=><Pressable onPress={()=>setKind(k)} key={k} style={{backgroundColor:kind===k?C.ink:C.surface,borderRadius:40,paddingHorizontal:18,height:43,borderWidth:1,borderColor:kind===k?C.ink:C.border,justifyContent:'center'}}><Txt size={13} weight="600" color={kind===k?C.white:C.muted}>{k}</Txt></Pressable>)}
    </ScrollView>
    {demo && <Txt size={12} color={C.muted} style={{marginBottom:12}}>Catálogo ilustrativo · Não ligado às contas reais</Txt>}
    <View style={{gap:12}}>{visible.map(conn=><Pressable key={conn.id} onPress={()=>onInfo(demo?'Esta é uma integração ilustrativa. Em produção, as configurações virão do backend partilhado.':`A configuração de ${conn.name} deve abrir o fluxo autenticado do conector existente no servidor.`)}>
      <Card style={{padding:17,flexDirection:'row',alignItems:'center',minHeight:100}}>
        <View style={{width:52,height:52,borderRadius:19,backgroundColor:C.white,borderWidth:1,borderColor:C.border,justifyContent:'center',alignItems:'center',marginRight:13}}><Icon name={conn.kind==='MCP'?'server-outline':conn.kind==='Skills'?'sparkles-outline':conn.kind==='Cells'?'cube-outline':conn.kind==='Plugins'?'extension-puzzle-outline':'link-outline'}/></View>
        <View style={{flex:1,gap:4}}><Txt weight="700" size={17}>{conn.name}</Txt><Txt size={12} color={C.muted} numberOfLines={2}>{conn.description}</Txt><Txt color={conn.connected?C.success:C.muted} size={11}>{conn.connected?'Ligado':'Não ligado'} · {conn.kind}</Txt></View>
        <Icon name="chevron-forward" color={C.muted} size={19}/>
      </Card>
    </Pressable>)}</View>
    {visible.length===0&&<Card><Txt color={C.muted}>Nenhum elemento nesta categoria.</Txt></Card>}
  </ScrollView>;
}
