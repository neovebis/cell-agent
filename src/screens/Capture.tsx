import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Card, Icon, PageTitle, RoundButton, Txt } from '../components/UI';
import { C, R } from '../theme';
import type { CaptureItem } from '../types';

type Draft = Omit<CaptureItem, 'id'|'createdAt'|'synced'>;
const options = [
  ['Foto','camera-outline'],['Vídeo','videocam-outline'],
  ['Galeria','images-outline'],['Documento','document-text-outline'],
  ['Áudio','mic-outline'],['Ecrã','phone-portrait-outline'],
  ['Texto','text-outline'],['Localização','location-outline'],
] as const;
export function CaptureScreen({ items, demo, onSave, onError }: { items: CaptureItem[]; demo: boolean; onSave: (draft: Draft) => Promise<void>; onError: (message: string) => void }) {
  const [captureOpen,setCaptureOpen]=useState(false);
  const [note,setNote]=useState('');
  const [textValue,setTextValue]=useState('');
  const [textOpen,setTextOpen]=useState(false);
  const [selected,setSelected]=useState<CaptureItem|null>(null);
  const [saving,setSaving]=useState(false);
  const save=async (draft: Draft)=>{setSaving(true);try{await onSave(draft);setCaptureOpen(false);setTextOpen(false);setNote('');setTextValue('');}catch(e){onError(e instanceof Error?e.message:'Erro ao guardar captura.');}finally{setSaving(false)}};
  const choose = async (kind: string) => {
    try {
      if(kind==='Texto'){setCaptureOpen(false);setTextOpen(true);return;}
      if(['Áudio','Ecrã','Localização'].includes(kind)){onError(`A captura de ${kind.toLowerCase()} exige o módulo nativo correspondente e ainda não está disponível nesta versão.`);return;}
      if(kind==='Documento'){
        const result=await DocumentPicker.getDocumentAsync({copyToCacheDirectory:true,multiple:false});
        if(result.canceled||!result.assets.length)return;
        const a=result.assets[0];
        await save({title:a.name,source:'Documento',type:'document',uri:a.uri,note});return;
      }
      let result: ImagePicker.ImagePickerResult;
      if (kind==='Galeria') result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.9});
      else {
        const permission=await ImagePicker.requestCameraPermissionsAsync();
        if(!permission.granted){onError('Acesso à câmara negado.');return;}
        result=await ImagePicker.launchCameraAsync({mediaTypes:kind==='Vídeo'?['videos']:['images'],quality:.9});
      }
      if (result.canceled||!result.assets.length)return;
      const a=result.assets[0];
      const type=a.type==='video'?'video':'image';
      await save({title:a.fileName||`${type==='video'?'Vídeo':'Imagem'} ${new Date().toLocaleDateString('pt-PT')}`,source:kind,type,uri:a.uri,note});
    } catch(e){onError(e instanceof Error?e.message:'Não foi possível capturar o conteúdo.');}
  };
  return <View style={{flex:1}}>
    <ScrollView contentContainerStyle={{padding:24,paddingTop:36,paddingBottom:135}}>
      <PageTitle kicker="O mundo físico entra aqui" title="Capture" />
      <Pressable onPress={()=>setCaptureOpen(true)} accessibilityLabel="Capturar novo conteúdo" style={styles.captureCard}>
        <View style={styles.cameraCircle}><Icon name="camera-outline" size={40} color={C.white}/></View>
        <Txt weight="700" size={29} style={{marginTop:28}}>Capturar</Txt>
        <Txt color={C.muted} size={17} style={{marginTop:9}}>Vai para a biblioteca</Txt>
      </Pressable>
      <Txt weight="700" color={C.muted} size={13} style={{marginTop:29,marginBottom:19,letterSpacing:.5}}>RECENTES</Txt>
      {items.length===0 ? <Card><Txt color={C.muted}>Nenhum conteúdo capturado ainda.</Txt><Txt color={C.faint} size={12} style={{marginTop:10}}>Toca em Capturar para começar.</Txt></Card> :
        items.map(item=><Pressable key={item.id} onPress={()=>setSelected(item)} style={{marginBottom:10}}>
          <Card style={{padding:20,flexDirection:'row',alignItems:'center',gap:12}}>
            <View style={{flex:1,gap:7}}><Txt weight="600" size={16} numberOfLines={1}>{item.title}</Txt><Txt color={C.muted} size={12}>{item.source} · {new Date(item.createdAt).toLocaleDateString('pt-PT')}</Txt>{item.synced===false&&<Txt color={C.muted} size={11}>Não sincronizado · demo</Txt>}</View>
            <View style={styles.source}><Txt size={12} color={C.muted}>{item.type==='image'?'Imagem':item.type==='video'?'Vídeo':item.type==='text'?'Texto':'Ficheiro'}</Txt></View>
          </Card>
        </Pressable>)}
      {demo && <Txt size={11} color={C.faint} style={{marginTop:16}}>Pré-visualização: capturas mantidas em memória até fechares a aplicação.</Txt>}
    </ScrollView>
    <Modal transparent animationType="slide" visible={captureOpen} onRequestClose={()=>setCaptureOpen(false)}>
      <View style={styles.backdrop}><Pressable style={{flex:1}} onPress={()=>setCaptureOpen(false)}/><View style={styles.sheet}>
        <View style={styles.sheetGrab}/>
        <TextInput value={note} onChangeText={setNote} placeholder="Nota ou contexto (opcional)" placeholderTextColor={C.muted} multiline style={styles.noteInput}/>
        <View style={styles.optionGrid}>{options.map(([label,icon])=><Pressable disabled={saving} key={label} style={styles.option} onPress={()=>choose(label)}><Icon name={icon} size={19}/><Txt size={16} weight="600">{label}</Txt></Pressable>)}</View>
      </View></View>
    </Modal>
    <Modal visible={textOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setTextOpen(false)}><View style={{flex:1,backgroundColor:C.white,padding:25,paddingTop:45}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Txt weight="700" size={27}>Capturar texto</Txt><RoundButton icon="close" label="Fechar" onPress={()=>setTextOpen(false)}/></View>
      <TextInput multiline value={textValue} onChangeText={setTextValue} placeholder="Escreve uma nota para a biblioteca..." style={[styles.noteInput,{marginTop:28,flex:1,textAlignVertical:'top',borderRadius:25}]} placeholderTextColor={C.muted}/>
      <Pressable disabled={saving||!textValue.trim()} onPress={()=>save({type:'text',source:'Texto',title:textValue.trim().slice(0,45),note:textValue.trim()})} style={[styles.saveButton,(saving||!textValue.trim())&&{opacity:.4}]}><Txt color={C.white} weight="700">Guardar na biblioteca</Txt></Pressable>
    </View></Modal>
    <Modal visible={selected!==null} transparent animationType="slide" onRequestClose={()=>setSelected(null)}><View style={styles.backdrop}><Pressable style={{flex:1}} onPress={()=>setSelected(null)}/><View style={styles.sheet}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:18}}><Txt size={21} weight="700" numberOfLines={1} style={{flex:1}}>{selected?.title}</Txt><RoundButton icon="close" label="Fechar" onPress={()=>setSelected(null)}/></View>
      {selected?.type==='image' && !!selected.uri ? <Image resizeMode="contain" source={{uri:selected.uri}} style={{width:'100%',height:260,borderRadius:20,backgroundColor:C.surface2}}/> : selected?.type==='text' ? <Txt size={16}>{selected.note}</Txt> : <Card><Txt color={C.muted}>Tipo: {selected?.type}</Txt><Txt color={C.muted}>Origem: {selected?.source}</Txt>{!!selected?.note&&<Txt>{selected.note}</Txt>}</Card>}
    </View></View></Modal>
  </View>;
}
const styles=StyleSheet.create({
  captureCard:{height:335,borderRadius:R.card,backgroundColor:C.surface,borderWidth:1,borderColor:C.border,justifyContent:'center',alignItems:'center'},
  cameraCircle:{width:102,height:102,borderRadius:100,backgroundColor:C.ink,justifyContent:'center',alignItems:'center'},
  source:{borderRadius:30,borderWidth:1,borderColor:C.border,paddingHorizontal:13,paddingVertical:8},
  backdrop:{flex:1,backgroundColor:'rgba(0,0,0,.39)',justifyContent:'flex-end'},
  sheet:{borderTopLeftRadius:34,borderTopRightRadius:34,backgroundColor:C.surface,paddingHorizontal:23,paddingTop:10,paddingBottom:34,gap:20},
  sheetGrab:{width:44,height:5,backgroundColor:C.border,borderRadius:5,alignSelf:'center',marginBottom:0},
  noteInput:{minHeight:80,borderRadius:32,backgroundColor:C.white,borderWidth:1,borderColor:C.border,fontSize:17,padding:18,color:C.ink},
  optionGrid:{flexDirection:'row',flexWrap:'wrap',columnGap:10,rowGap:10},
  option:{height:58,borderRadius:R.pill,borderWidth:1,borderColor:C.border,width:'48%',flexGrow:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  saveButton:{height:56,backgroundColor:C.ink,borderRadius:R.pill,alignItems:'center',justifyContent:'center',marginBottom:15},
});
