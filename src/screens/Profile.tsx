import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Card, Icon, PageTitle, RoundButton, Txt } from '../components/UI';
import { C, R } from '../theme';
import type { Session } from '../types';
export function ProfileScreen({session,demo,onNotifications,onSignOut,onInfo}:{session:Session|null;demo:boolean;onNotifications:()=>void;onSignOut:()=>void;onInfo:(message:string)=>void}){
  const [settings,setSettings]=useState(false);
  return <View style={{flex:1}}><ScrollView contentContainerStyle={{padding:24,paddingTop:36,paddingBottom:125}}>
    <PageTitle kicker="A tua conta" title="Perfil"/>
    <Card style={{flexDirection:'row',alignItems:'center',gap:15,padding:20}}>
      <View style={{height:65,width:65,borderRadius:40,backgroundColor:C.ink,alignItems:'center',justifyContent:'center'}}><Icon name="person-outline" color={C.white} size={30}/></View>
      <View style={{flex:1,gap:5}}><Txt size={21} weight="700">{session?.displayName??'Demonstração'}</Txt><Txt size={12} color={C.muted}>{session?.email??'Sem sessão ligada ao servidor'}</Txt></View>
    </Card>
    <Pressable onPress={()=>setSettings(true)} style={{marginTop:15}}><Card style={{flexDirection:'row',alignItems:'center',gap:12,padding:20}}><Icon name="settings-outline"/><View style={{flex:1}}><Txt weight="600">Definições</Txt><Txt color={C.muted} size={12}>Notificações, privacidade e sessão</Txt></View><Icon name="chevron-forward" color={C.muted}/></Card></Pressable>
    {demo&&<Txt color={C.muted} size={12} style={{marginTop:18}}>Modo demonstração · Os utilizadores do CELL SYSTEM não são recriados neste app.</Txt>}
  </ScrollView>
    <Modal visible={settings} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setSettings(false)}><View style={{flex:1,backgroundColor:C.white,padding:25,paddingTop:45}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:32}}><Txt size={28} weight="700">Definições</Txt><RoundButton icon="close" label="Fechar" onPress={()=>setSettings(false)}/></View>
      <Pressable onPress={onNotifications}><Card style={{flexDirection:'row',alignItems:'center',gap:13,padding:20}}><Icon name="notifications-outline"/><View style={{flex:1,gap:4}}><Txt weight="700" size={16}>Notificações</Txt><Txt size={12} color={C.muted}>Ativar alertas e missões</Txt></View><Icon name="chevron-forward" color={C.muted}/></Card></Pressable>
      <Pressable onPress={()=>onInfo('Os dados e permissões pertencem ao backend partilhado. O app não mantém uma base de dados própria.')} style={{marginTop:12}}><Card style={{flexDirection:'row',alignItems:'center',gap:12,padding:20}}><Icon name="shield-checkmark-outline"/><Txt weight="600">Privacidade e permissões</Txt></Card></Pressable>
      {!demo&&<Pressable onPress={()=>{setSettings(false);onSignOut();}} style={{backgroundColor:C.ink,borderRadius:R.pill,alignItems:'center',justifyContent:'center',height:54,marginTop:25}}><Txt color={C.white} weight="700">Terminar sessão</Txt></Pressable>}
    </View></Modal>
  </View>
}
