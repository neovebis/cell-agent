import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Keyboard, Pressable, ScrollView, StatusBar, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { BottomNav } from './src/components/BottomNav';
import { AgentAvatar } from './src/components/AgentAvatar';
import { Icon, PageTitle, Txt } from './src/components/UI';
import { ActivityScreen } from './src/screens/Activity';
import { CaptureScreen } from './src/screens/Capture';
import { ChatScreen } from './src/screens/Chat';
import { ConnectorsScreen } from './src/screens/Connectors';
import { ProfileScreen } from './src/screens/Profile';
import { gateway } from './src/services/gateway';
import { enableNotifications } from './src/services/notifications';
import { forgetSession, loadSession, saveSession } from './src/services/session';
import { C } from './src/theme';
import type { ActivityItem, Agent, AgentMessage, CaptureItem, Connection, Session, Tab } from './src/types';

function Login({onSubmit,busy}:{onSubmit:(email:string,password:string)=>Promise<void>;busy:boolean}){
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  return <ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center',padding:30,backgroundColor:C.white}} keyboardShouldPersistTaps="handled">
    <View style={{alignItems:'center',marginBottom:35}}><AgentAvatar size={86}/></View>
    <PageTitle kicker="A tua conta do CELL SYSTEM" title="Bem-vindo"/>
    <Txt color={C.muted} size={14} style={{marginBottom:28,lineHeight:20}}>Inicia sessão com a conta que já utilizas. Não é criada nenhuma conta mobile separada.</Txt>
    <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor={C.muted}/>
    <TextInput secureTextEntry placeholder="Palavra-passe" value={password} onChangeText={setPassword} style={[styles.input,{marginTop:12}]} placeholderTextColor={C.muted}/>
    <Pressable disabled={busy} onPress={()=>onSubmit(email.trim(),password)} style={styles.loginButton}>{busy?<ActivityIndicator color={C.white}/>:<Txt color={C.white} weight="700">Entrar</Txt>}</Pressable>
    <Txt color={C.muted} size={11} style={{marginTop:20,lineHeight:18}}>Autenticação direta e segura via Supabase Auth com encriptação TLS de ponta a ponta.</Txt>
  </ScrollView>;
}
function Root(){
  const [tab,setTab]=useState<Tab>('Chat');
  const [agents,setAgents]=useState<Agent[]>([]);
  const [activeAgent,setActiveAgent]=useState<Agent|null>(null);
  const [messages,setMessages]=useState<AgentMessage[]>([]);
  const [captures,setCaptures]=useState<CaptureItem[]>([]);
  const [connections,setConnections]=useState<Connection[]>([]);
  const [activity,setActivity]=useState<ActivityItem[]>([]);
  const [session,setSession]=useState<Session|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false);
  const notify=(msg:string)=>Alert.alert('CELL AGENT',msg);
  const refresh=useCallback(async (currentSession:Session|null) => {
    if(!gateway.demo&&!currentSession)return;
    const auth=currentSession??undefined;
    const results=await Promise.allSettled([gateway.getAgents(auth),gateway.getCaptures(auth),gateway.getConnections(auth),gateway.getActivity(auth)]);
    const setters=[setAgents,setCaptures,setConnections,setActivity] as const;
    results.forEach((r,i)=>{
      if(r.status==='fulfilled') (setters[i] as (x:any)=>void)(r.value);
      else if(i===0) notify(r.reason instanceof Error?r.reason.message:'Não foi possível carregar os agentes.');
    });
  },[]);
  useEffect(()=>{
    let mounted=true;
    (async()=>{
      const s=gateway.demo?null:await loadSession();
      if(!mounted)return;
      setSession(s);setLoaded(true);
      await refresh(s);
    })().catch(e=>{if(mounted){setLoaded(true);notify(String(e));}});
    return()=>{mounted=false};
  },[refresh]);
  const loadMessages=useCallback(async(agent:Agent,currentSession:Session|null)=>{
    try{setMessages(await gateway.getMessages(agent.id,currentSession??undefined));}
    catch(e){notify(e instanceof Error?e.message:String(e));}
  },[]);
  useEffect(()=>{
    if(!activeAgent || gateway.demo || !session)return;
    const handle=setInterval(()=>{gateway.getMessages(activeAgent.id,session).then(setMessages).catch(()=>{});},4500);
    return()=>clearInterval(handle);
  },[activeAgent?.id,session]);
  useEffect(()=>{
    const subscription=Notifications.addNotificationResponseReceivedListener(response=>{
      const payload=response.notification.request.content.data;
      if(payload?.tab==='Atividade')setTab('Atividade');
      if(payload?.agentId&&typeof payload.agentId==='string'){
        const agent=agents.find(x=>x.id===payload.agentId);
        if(agent){setTab('Chat');setActiveAgent(agent);loadMessages(agent,session);}
      }
    });
    return()=>subscription.remove();
  },[agents,session,loadMessages]);
  useEffect(()=>{
    const back=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(activeAgent){setActiveAgent(null);return true;}
      if(tab!=='Chat'){setTab('Chat');return true;}
      return false;
    });
    return()=>back.remove();
  },[tab,activeAgent]);
  const openAgent=(agent:Agent)=>{setActiveAgent(agent);setMessages([]);loadMessages(agent,session);};
  const sendMessage=async(content:string)=>{
    if(!activeAgent)return;
    setBusy(true);
    try{
      await gateway.sendMessage(activeAgent.id,content,session??undefined);
      await loadMessages(activeAgent,session);
      const acts=await gateway.getActivity(session??undefined);setActivity(acts);
      if(gateway.demo)notify('Mensagem guardada nesta demonstração. Ainda não está ligada a uma IA real.');
    }catch(e){notify(e instanceof Error?e.message:'Erro ao enviar mensagem.');throw e;}
    finally{setBusy(false);}
  };
  const createAgent=async(name:string,description:string)=>{
    try{
      const agent=await gateway.createAgent(name,description,session??undefined);
      setAgents(prev=>[agent,...prev]);openAgent(agent);
    }catch(e){notify(e instanceof Error?e.message:'Erro ao criar agente.');}
  };
  const saveCapture=async(capture:Omit<CaptureItem,'id'|'createdAt'|'synced'>)=>{
    const saved=await gateway.saveCapture(capture,session??undefined);
    setCaptures(prev=>[saved,...prev]);
  };
  const login=async(email:string,password:string)=>{
    if(!email||!password){notify('Preenche o email e a palavra-passe.');return;}
    setBusy(true);
    try{const s=await gateway.signIn(email,password);await saveSession(s);setSession(s);await refresh(s);}
    catch(e){notify(e instanceof Error?e.message:'Falha na autenticação.');}
    finally{setBusy(false);}
  };
  const logout=async()=>{await forgetSession();setSession(null);setAgents([]);setMessages([]);setActiveAgent(null);setTab('Chat');};
  const doNotifications=async()=>{try{notify(await enableNotifications(gateway,session??undefined));}catch(e){notify(e instanceof Error?e.message:'Erro ao ativar as notificações.')}};
  if(!loaded)return <View style={{flex:1,backgroundColor:C.white,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={C.ink}/></View>;
  if(!gateway.demo&&!session)return <Login onSubmit={login} busy={busy}/>;
  return <View style={{flex:1,backgroundColor:C.white}}>
    {tab==='Chat' && <ChatScreen agents={agents} activeAgent={activeAgent} messages={messages} demo={gateway.demo} busy={busy} onOpen={openAgent} onBack={()=>{Keyboard.dismiss();setActiveAgent(null);}} onNew={createAgent} onSend={sendMessage} onRefresh={()=>refresh(session)} onError={notify}/>}
    {tab==='Capture'&&<CaptureScreen items={captures} demo={gateway.demo} onSave={saveCapture} onError={notify}/>}
    {tab==='Conectores'&&<ConnectorsScreen items={connections} demo={gateway.demo} onInfo={notify}/>}
    {tab==='Atividade'&&<ActivityScreen items={activity} demo={gateway.demo} onInfo={notify}/>}
    {tab==='Perfil'&&<ProfileScreen session={session} demo={gateway.demo} onNotifications={doNotifications} onSignOut={logout} onInfo={notify}/>}
    {!(tab==='Chat'&&activeAgent)&&<BottomNav tab={tab} onSelect={t=>{Keyboard.dismiss();setTab(t);}}/>}
    {gateway.demo && tab !== 'Chat' && <View pointerEvents="none" style={{position:'absolute',top:4,alignSelf:'center'}}><Txt size={9} color={C.faint}>DEMO</Txt></View>}
  </View>;
}
export default function App(){return <SafeAreaProvider><SafeAreaView edges={['top','bottom']} style={{flex:1,backgroundColor:C.white}}><StatusBar barStyle="dark-content" backgroundColor={C.white}/><Root/></SafeAreaView></SafeAreaProvider>}
const styles=StyleSheet.create({
  input:{borderRadius:24,backgroundColor:C.surface,borderWidth:1,borderColor:C.border,minHeight:58,paddingHorizontal:19,fontSize:16,color:C.ink},
  loginButton:{marginTop:22,height:56,borderRadius:50,backgroundColor:C.ink,alignItems:'center',justifyContent:'center'},
});
