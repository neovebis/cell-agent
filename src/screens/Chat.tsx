import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AgentAvatar } from '../components/AgentAvatar';
import { Card, Icon, PageTitle, RoundButton, Txt } from '../components/UI';
import { C, R } from '../theme';
import type { Agent, AgentMessage } from '../types';

type Props = {
  agents: Agent[]; activeAgent: Agent | null; messages: AgentMessage[]; demo: boolean; busy: boolean;
  onOpen: (agent: Agent) => void; onBack: () => void; onNew: (name: string, description: string) => void;
  onSend: (content: string) => Promise<void>; onRefresh: () => void; onError: (message: string) => void;
};
export function ChatScreen(props: Props) {
  const [creationOpen, setCreationOpen] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [draft, setDraft] = useState('');
  const [showTools, setShowTools] = useState(false);
  const listRef = useRef<FlatList<AgentMessage>>(null);
  useEffect(() => { setDraft(''); setShowTools(false); }, [props.activeAgent?.id]);

  if (!props.activeAgent) return <View style={{ flex: 1 }}>
    <ScrollView style={{flex:1}} contentContainerStyle={{padding:24, paddingTop:36, paddingBottom:126}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
        <PageTitle kicker="Os teus espaços de trabalho" title="Agentes"/>
        <RoundButton icon="add" label="Criar novo agente" onPress={() => setCreationOpen(true)} size={52}/>
      </View>
      {props.demo && <Txt size={12} color={C.muted} style={{marginBottom:17}}>Pré-visualização · Agentes de demonstração</Txt>}
      <View style={{ gap: 12 }}>
        {props.agents.map(agent => <Pressable key={agent.id} onPress={() => props.onOpen(agent)} accessibilityLabel={`Abrir chat de ${agent.name}`}>
          <Card style={styles.agentCard}>
            <AgentAvatar size={53}/>
            <View style={{flex:1,marginLeft:15,gap:5}}>
              <Txt weight="700" size={19}>{agent.name}</Txt>
              <Txt color={C.muted} size={13} numberOfLines={1}>{agent.description}</Txt>
            </View>
            <Icon name="chevron-forward" color={C.muted} size={21}/>
          </Card>
        </Pressable>)}
        {props.agents.length === 0 && <Card><Txt color={C.muted}>Ainda não tens agentes. Cria o primeiro no botão +.</Txt></Card>}
      </View>
    </ScrollView>
    <Modal animationType="slide" presentationStyle="pageSheet" visible={creationOpen} onRequestClose={() => setCreationOpen(false)}>
      <View style={{flex:1,backgroundColor:C.white,padding:26,paddingTop:45}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:35}}><Txt size={27} weight="700">Criar agente</Txt><RoundButton icon="close" label="Fechar" onPress={() => setCreationOpen(false)}/></View>
        <Txt size={13} color={C.muted} style={{marginBottom:10}}>NOME DO AGENTE</Txt>
        <TextInput value={agentName} onChangeText={setAgentName} placeholder="Ex.: Eliot" style={styles.field} placeholderTextColor={C.faint}/>
        <Txt size={13} color={C.muted} style={{marginTop:20,marginBottom:10}}>DESCRIÇÃO</Txt>
        <TextInput value={agentDescription} onChangeText={setAgentDescription} placeholder="O que vai fazer este agente?" multiline style={[styles.field,{height:110,textAlignVertical:'top'}]} placeholderTextColor={C.faint}/>
        {props.demo && <Txt size={12} color={C.muted} style={{marginTop:16}}>Este agente será criado apenas nesta sessão de demonstração.</Txt>}
        <Pressable onPress={() => {
          if (!agentName.trim()) return props.onError('Indica o nome do agente.');
          props.onNew(agentName.trim(),agentDescription.trim());setCreationOpen(false);setAgentName('');setAgentDescription('');
        }} style={styles.blackButton}><Txt color={C.white} weight="700">Criar agente</Txt></Pressable>
      </View>
    </Modal>
  </View>;

  const agent = props.activeAgent;
  return <KeyboardAvoidingView style={{flex:1,backgroundColor:C.white}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <View style={styles.header}>
      <RoundButton icon="chevron-back" label="Voltar aos agentes" onPress={props.onBack}/>
      <AgentAvatar size={43}/>
      <View style={{flex:1}}><Txt weight="700" size={19}>{agent.name}</Txt><Txt color={C.muted} size={12}>{agent.status === 'running' ? 'Em execução' : 'Agente'}</Txt></View>
      <RoundButton icon="ellipsis-horizontal" label="Mais opções" onPress={() => props.onError('As opções avançadas deste agente serão sincronizadas com o backend existente.')}/>
    </View>
    <FlatList
      ref={listRef}
      style={{flex:1}}
      contentContainerStyle={{paddingHorizontal:25,paddingBottom:35,flexGrow:1}}
      data={props.messages}
      keyExtractor={m => m.id}
      onContentSizeChange={() => listRef.current?.scrollToEnd({animated:true})}
      renderItem={({item}) => <View style={{alignItems:item.role==='user'?'flex-end':'flex-start',marginBottom:16}}>
        {item.role==='assistant' && <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8}}><AgentAvatar size={22}/><Txt size={12} weight="600">{agent.name}</Txt></View>}
        <View style={[styles.bubble,item.role === 'user' && styles.userBubble]}>
          <Txt size={15} style={{lineHeight:23}}>{item.content}</Txt>
          {item.status==='failed' && <Txt color={C.error} size={12}>Falha no envio</Txt>}
        </View>
      </View>}
      ListEmptyComponent={<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10,marginBottom:70}}>
        <AgentAvatar size={74}/>
        <Txt size={30} weight="600" style={{marginTop:10,letterSpacing:-1}}>Como posso ajudar?</Txt>
        <Txt size={13} color={C.faint}>Envia uma mensagem a {agent.name}.</Txt>
        {props.demo && <Txt size={12} color={C.muted} style={{marginTop:15}}>Modo demo: não há respostas de IA.</Txt>}
      </View>}
    />
    {props.busy && <View style={{padding:8}}><ActivityIndicator color={C.ink}/></View>}
    {showTools && <View style={{flexDirection:'row',justifyContent:'space-around',paddingBottom:15}}>
      <Pressable onPress={() => props.onError('Para anexar um ficheiro, usa Capture e seleciona o conteúdo.')}><Icon name="document-outline"/><Txt size={12}>Ficheiro</Txt></Pressable>
      <Pressable onPress={() => props.onError('Seleciona o conteúdo na biblioteca Capture.')}><Icon name="images-outline"/><Txt size={12}>Biblioteca</Txt></Pressable>
    </View>}
    <View style={styles.composer}>
      <TextInput value={draft} onChangeText={setDraft} multiline placeholder="Escrever" placeholderTextColor={C.muted} style={styles.composeInput} accessibilityLabel="Mensagem ao agente" />
      <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
        <RoundButton icon="add" label="Adicionar anexo" size={46} onPress={()=>setShowTools(!showTools)}/>
        <View style={styles.agentChip}><AgentAvatar size={22}/><Txt size={14} weight="600" numberOfLines={1} style={{flexShrink:1}}>{agent.name}</Txt><Icon name="chevron-down" size={17} color={C.muted}/></View>
        <View style={{flex:1}}/>
        <RoundButton icon="mic-outline" label="Voz (em preparação)" size={46} onPress={()=>props.onError('A conversação por voz será adicionada após integrar o serviço de áudio do CELL SYSTEM.')}/>
        <RoundButton icon="arrow-up" label="Enviar mensagem" primary size={48} onPress={async ()=>{if(!draft.trim()||props.busy) return; const text=draft.trim();setDraft('');try{await props.onSend(text);}catch{setDraft(text);}}}/>
      </View>
    </View>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  agentCard:{padding:17,minHeight:91,flexDirection:'row',alignItems:'center'},
  field:{backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:23,padding:18,fontSize:16,color:C.ink},
  blackButton:{backgroundColor:C.ink,borderRadius:R.pill,height:55,alignItems:'center',justifyContent:'center',marginTop:30},
  header:{paddingHorizontal:18,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderColor:'#F1F1F1'},
  bubble:{maxWidth:'89%',paddingHorizontal:15,paddingVertical:14,borderRadius:21,backgroundColor:C.surface},
  userBubble:{backgroundColor:'#EBEBEB'},
  composer:{marginHorizontal:17,marginBottom:12,borderRadius:R.composer,borderWidth:1,borderColor:C.border,backgroundColor:C.surface,paddingHorizontal:12,paddingTop:16,paddingBottom:11},
  composeInput:{minHeight:43,maxHeight:150,fontSize:17,color:C.ink,paddingHorizontal:8,textAlignVertical:'top'},
  agentChip:{height:44,borderRadius:30,borderWidth:1,borderColor:C.border,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:10,maxWidth:168},
});
