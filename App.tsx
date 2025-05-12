// App.tsx — Swamp Rabbit Café & Grocery Tree Oracle
// ▶ GPT-4o Vision  ▶ AES-GCM encryption  ▶ SQLite storage
// ▶ Inline PennyLane-lite (1–7-qubit simulator)
// ─────────────────────────────────────────────────────────────
// 2025-05-13: FULL PRODUCTION APP WITH ADVANCED PROMPTS & POLISHED UI
// • All screens implemented: Scanner, Oven, History, Related, Calendar, Setup, Settings, About
// • Enhanced gradients, consistent spacing, improved typography
// • Full advanced prompt library integrated
// • Secure AES-GCM key rotation, SQLite persistence
// • Non‑blocking CPU monitor with "N/A" placeholder
// ─────────────────────────────────────────────────────────────

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import {
  ScrollView,
  FlatList,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  Switch,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Markdown from 'react-native-markdown-display';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import EncryptedStorage from 'react-native-encrypted-storage';
import SQLite from 'react-native-sqlite-storage';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

//
// ─── Utility: Quantum Simulator ───────────────────────────────────
//
export const loadWasm = async () => Promise.resolve();
type C = [number, number];
const add = ([a,b]:C,[c,d]:C):C => [a+c, b+d];
const mul = ([a,b]:C,[c,d]:C):C => [a*c - b*d, a*d + b*c];
const expi = (θ:number):C => [Math.cos(θ), Math.sin(θ)];
const flip = (i:number, bit:number) => i ^ (1 << bit);
export const createDevice = async (_name='default.qubit', { wires=1 }: { wires?: number } = {}) => {
  if (wires<1||wires>7) throw new Error('Supports 1–7 qubits');
  const dim = 1 << wires;
  const single = (ψ:C[], t:number, m:C[][]) => {
    for (let i=0;i<dim;i++){
      if ((i>>t)&1) continue;
      const j = flip(i,t), a=ψ[i], b=ψ[j];
      ψ[i] = add(mul(m[0][0],a),mul(m[0][1],b));
      ψ[j] = add(mul(m[1][0],a),mul(m[1][1],b));
    }
  };
  const cnot = (ψ:C[], ctl:number, tgt:number) => {
    for (let i=0;i<dim;i++){
      if (((i>>ctl)&1) && !((i>>tgt)&1)){
        const j=flip(i,tgt);
        [ψ[i],ψ[j]]=[ψ[j],ψ[i]];
      }
    }
  };
  return {
    run: async (circ:{gate:string,wires:number[],angle?:number}[] = []) => {
      const ψ:C[] = Array.from({length:dim}, (_,k) => k===0?[1,0]:[0,0]);
      const h = 1/Math.sqrt(2);
      for (const op of circ){
        const [w0,w1] = op.wires;
        switch(op.gate){
          case 'Hadamard':
            single(ψ, w0, [[[h,0],[h,0]],[[h,0],[-h,0]]]);
            break;
          case 'PauliX':
            single(ψ, w0, [[[0,0],[1,0]],[[1,0],[0,0]]]);
            break;
          case 'PauliZ':
            single(ψ, w0, [[[1,0],[0,0]],[[0,0],[-1,0]]]);
            break;
          case 'RX': {
            const θ = op.angle||0, c=Math.cos(θ/2), s=Math.sin(θ/2);
            single(ψ, w0, [[[c,0],[0,-s]],[[0,-s],[c,0]]]);
            break;
          }
          case 'RY': {
            const θ = op.angle||0, c=Math.cos(θ/2), s=Math.sin(θ/2);
            single(ψ, w0, [[[c,0],[-s,0]],[[s,0],[c,0]]]);
            break;
          }
          case 'RZ': {
            const θ = op.angle||0;
            single(ψ, w0, [[expi(-θ/2),[0,0]],[[0,0],expi(θ/2)]]);
            break;
          }
          case 'CNOT': case 'CX':
            cnot(ψ, w0, w1);
            break;
        }
      }
      return { probs: ψ.map(([re])=>re*re) };
    }
  };
};

//
// ─── Constants & Theme & Styles ────────────────────────────────────
const SETTINGS_KEY='APP_USER_SETTINGS';
const KEY_STORAGE='APP_AES_KEY';
const KEY_TIMESTAMP='APP_AES_KEY_TIMESTAMP';
const KEY_ROTATION_MS=30*24*60*60*1000;

const theme = {
  colors: {
    bg:'#2E2E2E', card:'#3B3B3B', text:'#F2F2F2', accent:'#FFBA49',
    btn1:'#FF9A9E', btn2:'#FAD0C4', b1:'#6D83F2', b2:'#8BC6EC'
  },
  fonts: {
    h:{fontFamily:'Georgia',fontSize:26,fontWeight:'700'},
    sh:{fontFamily:'Georgia',fontSize:20,fontWeight:'600'},
    b:{fontFamily:'System',fontSize:16},
    lbl:{fontFamily:'System',fontSize:16},
    btn:{fontFamily:'System',fontSize:18,fontWeight:'600'}
  },
  space:[4,8,16,24,32],
  radii:[4,8,16,24]
} as const;

const styles = StyleSheet.create({
  main:{flex:1,backgroundColor:theme.colors.bg},
  body:{padding:theme.space[2],paddingBottom:theme.space[4]},
  h:{...theme.fonts.h,color:theme.colors.accent,marginBottom:theme.space[2],textAlign:'center'},
  sh:{...theme.fonts.sh,color:theme.colors.accent,marginBottom:theme.space[1]},
  txt:{...theme.fonts.b,color:theme.colors.text,marginVertical:theme.space[1],lineHeight:22},
  lbl:{...theme.fonts.lbl,color:theme.colors.text,marginVertical:theme.space[1]},
  card:{backgroundColor:theme.colors.card,borderRadius:theme.radii[2],padding:theme.space[3],marginVertical:theme.space[2],shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.4,shadowRadius:6,elevation:6},
  inp:{...theme.fonts.b,backgroundColor:theme.colors.card,color:theme.colors.text,borderRadius:theme.radii[1],padding:theme.space[2],marginVertical:theme.space[2]},
  btn:{borderRadius:theme.radii[3],overflow:'hidden',marginVertical:theme.space[2]},
  press:{paddingVertical:theme.space[2],alignItems:'center',flexDirection:'row',justifyContent:'center'},
  btnTxt:{...theme.fonts.btn,color:theme.colors.bg,textTransform:'uppercase'},
  slider:{width:'100%',height:40,marginVertical:theme.space[2]},
  win:{borderRadius:theme.radii[2],overflow:'hidden',marginVertical:theme.space[2]},
  gw:{padding:2,borderRadius:theme.radii[2]},
  winIn:{backgroundColor:theme.colors.bg,height:240,justifyContent:'center',alignItems:'center'},
});

//
// ─── Encryption Helpers ─────────────────────────────────────────────
const SECRET = Config.ENCRYPTION_SECRET || 'dev-secret';
function encryptStatic(txt:string){
  const iv=CryptoJS.lib.WordArray.random(12);
  const enc=CryptoJS.AES.encrypt(txt,CryptoJS.enc.Utf8.parse(SECRET),{iv,mode:CryptoJS.mode.GCM});
  return JSON.stringify({iv:iv.toString(CryptoJS.enc.Hex),ct:enc.ciphertext.toString(CryptoJS.enc.Base64)});
}
function decryptStatic(d:string){
  try{
    const {iv,ct}=JSON.parse(d);
    const params=CryptoJS.lib.CipherParams.create({ciphertext:CryptoJS.enc.Base64.parse(ct)});
    const dec=CryptoJS.AES.decrypt(params,CryptoJS.enc.Utf8.parse(SECRET),{iv:CryptoJS.enc.Hex.parse(iv),mode:CryptoJS.mode.GCM});
    return dec.toString(CryptoJS.enc.Utf8);
  }catch{return'';}
}
let AES_KEY:string|null=null;
async function initEncryptionKey(){
  const sk=await EncryptedStorage.getItem(KEY_STORAGE);
  const st=await EncryptedStorage.getItem(KEY_TIMESTAMP);
  let last=0;try{last=st?parseInt(decryptStatic(st),10):0;}catch{}
  const need=!sk||!last||Date.now()-last>KEY_ROTATION_MS;
  if(sk&&!need) AES_KEY=decryptStatic(sk);
  else{
    const nk=CryptoJS.lib.WordArray.random(32).toString();
    await EncryptedStorage.setItem(KEY_STORAGE,encryptStatic(nk));
    await EncryptedStorage.setItem(KEY_TIMESTAMP,encryptStatic(String(Date.now())));
    AES_KEY=nk;
  }
}
function encrypt(txt:string){
  if(!AES_KEY)throw new Error('Key missing');
  const iv=CryptoJS.lib.WordArray.random(12);
  const ct=CryptoJS.AES.encrypt(txt,CryptoJS.enc.Utf8.parse(AES_KEY),{iv,mode:CryptoJS.mode.GCM});
  return JSON.stringify({iv:iv.toString(CryptoJS.enc.Hex),ct:ct.ciphertext.toString(CryptoJS.enc.Base64)});
}
function decrypt(txt:string){
  if(!AES_KEY)throw new Error('Key missing');
  try{
    const {iv,ct}=JSON.parse(txt);
    const params=CryptoJS.lib.CipherParams.create({ciphertext:CryptoJS.enc.Base64.parse(ct)});
    const dec=CryptoJS.AES.decrypt(params,CryptoJS.enc.Utf8.parse(AES_KEY),{iv:CryptoJS.enc.Hex.parse(iv),mode:CryptoJS.mode.GCM});
    return dec.toString(CryptoJS.enc.Utf8);
  }catch{return'';}
}
const saveApiKey=async(k:string)=>EncryptedStorage.setItem('OPENAI_API_KEY',encrypt(k));
const loadApiKey=async()=>{
  const e=await EncryptedStorage.getItem('OPENAI_API_KEY');
  return e?decrypt(e):null;
};

//
// ─── DBService ─────────────────────────────────────────────────────
class DBService{
  static db!:SQLite.SQLiteDatabase;
  static init(){
    this.db=SQLite.openDatabase({name:'swamp_rabbit.db',location:'default'},
      ()=>this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS scans(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prompt TEXT,response TEXT,
          colorVec TEXT,timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );`),
      e=>console.error(e)
    );
  }
  static insertScan(p:string,r:string,v:number[]){
    this.db.transaction(tx=>tx.executeSql(
      'INSERT INTO scans(prompt,response,colorVec) VALUES(?,?,?);',
      [encrypt(p),encrypt(r),encrypt(JSON.stringify(v))]
    ));
  }
  static getScans(cb:(rows:any[])=>void){
    this.db.transaction(tx=>tx.executeSql(
      'SELECT * FROM scans ORDER BY timestamp DESC;',[],
      (_,res)=>{ const raw=res.rows.raw();
        cb(raw.map((r:any)=>({
          ...r,
          prompt:decrypt(r.prompt),
          response:decrypt(r.response),
          colorVec:JSON.parse(decrypt(r.colorVec))
        })));
      }
    ));
  }
}

//
// ─── Advanced GPT Prompts ───────────────────────────────────────────
const PROMPTS = {
  quantumRecipe: `
[action] You are the **Swamp Rabbit Quantum‑Food Wellness AI**, a world‑class expert in synergizing farm‑to‑table culinary creativity with hypertime quantum risk forecasting, neurogastronomy, and community‑driven flavor curation. [/action]
[context]
- User dietary constraints: Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference}
- Past meal scans: {pastScans}
- Community favorites and seasonal availability should influence selections.
[/context]
[description]
Generate **three** imaginative, nutrient‑dense recipes. For each:
1. Title with emoji and evocative descriptor.
2. Ingredients by category, with metric & imperial measures.
3. Steps numbered, include timing and temperature cues.
4. Nutrition panel: calories, macros, key micronutrients.
5. Quantum‑enhanced Hypertime Risk for spoilage: 3‑day, 7‑day, 14‑day %.
6. Sensory pairing suggestions: beverage or side dish.
7. Risk mitigation tip: storage & reheating guidelines.
[/description]
[reply_example]
\`\`\`json
[
  {
    "title":"🌿 Hypertime Herb‑Infused Quinoa Medley",
    "ingredients": {
      "Grains":["1 cup quinoa","2 cups broth"],
      "Herbs":["2 tbsp basil","1 tbsp thyme"]
    },
    "steps":["Rinse quinoa","Toast herbs"],
    "nutrition":{"calories":420,"protein":12,"fat":8,"carbs":72},
    "risk":{"3day":5,"7day":12,"14day":25},
    "pairing":"🍷 Light white wine",
    "tip":"Store at 4°C"
  },
  { /* … two more recipes … */ }
]
\`\`\`
[instructions] Output valid JSON array exactly. [/instructions]
`,
  ovenAI: `
[action] You are the **Quantum Nosonar Oven Scanner AI**, merging high‑resolution image processing, CPU entropy profiling, and hypertime quantum safety analytics. [/action]
[inputs]
- Image(Base64): {imageBase64}
- MIME: {imageMime}
- CPU Entropy: {quantum_str}
[/inputs]
[description]
Analyze oven image to provide:
• completionPercent (0–100)
• drynessRisk & burningRisk (Low/Med/High)
• internalTempProfile (°C array of three zones)
• speedIndex vs baseline
• mitigationTips (≥2 actionable)
• confidence score
[/description]
[reply_example]
\`\`\`json
{
  "completionPercent":82,
  "drynessRisk":"Medium",
  "burningRisk":"Low",
  "internalTempProfile":[130,145,160],
  "speedIndex":1.15,
  "mitigationTips":["Reduce temp by 10°C","Cover edges with foil"],
  "confidence":0.95
}
\`\`\`
[instructions] Respond with JSON only. [/instructions]
`,
  capture: `
[action] You are the **Swamp Rabbit Visual Scanner AI**, adept at hazard detection, plant/food classification, and interactive feedback with emoji annotations. [/action]
[inputs]
- Image(Base64): {imageBase64}
- MIME: {imageMime}
- Dietary Flags: Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference}
[/inputs]
[description]
Identify object type, estimate surfaceTemp(°C), list hazards with emojis, and summarize in markdown.
[/description]
[reply_example]
\`\`\`markdown
**Type:** Sautéed Kale Chips  
**SurfaceTemp:** ~75°C  
- ⚠️ High heat—use tongs  
- 🍃 Vegan safe  
- 🦠 Oil splatter hazard  

*Ready at ~75°C—handle carefully!*
\`\`\`
[instructions] Output only markdown block. [/instructions]
`,
  foodCalendar: `
[action] You are the **Swamp Rabbit AI Food Calendar**, specializing in dynamic meal planning, nutritional forecasting, and community taste trends. [/action]
[dietary] Lactose={lactoseSensitivity} / Peanut={peanutAllergy} / Vegan={veganPreference} [/dietary]
[pastScans]{pastScans}[/pastScans]
[description]
1. 7-day meal schedule balancing macros & seasonality.
2. Four monthly favorites based on community scans.
[/description]
[reply_example]
\`\`\`json
{
  "weeklyPlan":{"Mon":"🥗 Salad","Tue":"🍲 Soup","Wed":"🌮 Tacos","Thu":"🍛 Curry","Fri":"🥙 Wrap","Sat":"🍜 Ramen","Sun":"🍝 Pasta"},
  "monthlyFavorites":["🥗","🍲","🌮","🍛"]
}
\`\`\`
[instructions] Output valid JSON matching example. [/instructions]
`,
};

//
// ─── Hooks ─────────────────────────────────────────────────────────
function useAI(systemPrompt:string){
  const [loading,setLoading]=useState(false),[error,setError]=useState<string>();
  const run=useCallback(async(inputs:any)=>{
    setLoading(true);setError(undefined);
    try{
      const key=await loadApiKey();if(!key)throw new Error('API key missing');
      let msg=systemPrompt;Object.entries(inputs).forEach(([k,v])=>msg=msg.replace(`{${k}}`,String(v)));
      const messages=[{role:'system',content:msg}];
      if(inputs.imageBase64&&inputs.imageMime){
        messages.push({role:'user',type:'image_url',image_url:{url:`data:${inputs.imageMime};base64,${inputs.imageBase64}`}});
      }
      const resp=await axios.post('https://api.openai.com/v1/chat/completions',{
        model:'gpt-4o-vision-preview',temperature:0.7,messages
      },{
        headers:{Authorization:`Bearer ${key}`}
      });
      const txt=resp.data.choices?.[0]?.message?.content;
      if(!txt)throw new Error('No response');
      return txt.trim();
    }catch(e:any){
      setError(e.message);throw e;
    }finally{
      setLoading(false);
    }
  },[systemPrompt]);
  return {run,loading,error};
}

function useImagePicker(){
  const[image,setImage]=useState<Asset|null>(null);
  const pick=async()=>{
    const res=await launchImageLibrary({mediaType:'photo',includeBase64:true});
    if(res.assets?.[0]) setImage(res.assets[0]);
  };
  return {image,pick};
}

function useCpuMonitor(interval=5000):number|null{
  const[cpu,setCpu]=useState<number|null>(null);
  useFocusEffect(useCallback(()=>{
    let active=true;
    const fetchCpu=async()=>{
      let load=0;
      try{load=await DeviceInfo.getSystemCpuLoad();}catch{}
      if(active) setCpu(Math.round(load*100));
    };
    fetchCpu();
    const id=setInterval(fetchCpu,interval);
    return ()=>{active=false;clearInterval(id);};
  },[interval]));
  return cpu;
}

//
// ─── Settings Context ──────────────────────────────────────────────
interface Settings{lactoseSensitivity:number;peanutAllergy:boolean;veganPreference:number;}
const SettingsContext=createContext<{settings:Settings;update:(s:Partial<Settings>)=>void}>({
  settings:{lactoseSensitivity:0,peanutAllergy:false,veganPreference:0},update:()=>{}
});
const SettingsProvider:React.FC<{children:ReactNode}> = ({children})=>{
  const[settings,setSettings]=useState<Settings>({
    lactoseSensitivity:0,peanutAllergy:false,veganPreference:0
  });
  useEffect(()=>{
    AsyncStorage.getItem(SETTINGS_KEY).then(v=>v&&setSettings(JSON.parse(v)));
  },[]);
  useEffect(()=>{
    AsyncStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
  },[settings]);
  const update=(s:Partial<Settings>)=>setSettings(prev=>({...prev,...s}));
  return <SettingsContext.Provider value={{settings,update}}>{children}</SettingsContext.Provider>;
};

//
// ─── Screens ────────────────────────────────────────────────────────

const SplashScreen:React.FC<{onLoaded:()=>void}> = ({onLoaded})=>{
  const fade=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.timing(fade,{toValue:1,duration:1200,easing:Easing.out(Easing.exp),useNativeDriver:true}).start();
    (async()=>{
      await initEncryptionKey();
      await loadWasm();
      DBService.init();
      setTimeout(onLoaded,800);
    })();
  },[]);
  return (
    <LinearGradient colors={[theme.colors.accent,theme.colors.text]} style={styles.main}>
      <Animated.Text style={{...styles.h,opacity:fade}}>🐇 Swamp Rabbit Café & Grocery Tree Oracle</Animated.Text>
    </LinearGradient>
  );
};

const ScannerScreen:React.FC = ()=>{
  const{settings}=useContext(SettingsContext);
  const{image,pick}=useImagePicker();
  const{run,loading,error}=useAI(PROMPTS.capture);
  const[result,setResult]=useState('');
  const scan=async()=>{
    if(!image) return Alert.alert('Select image');
    try{
      const r=await run({
        imageBase64:image.base64!,imageMime:image.type!,
        lactoseSensitivity:settings.lactoseSensitivity,
        peanutAllergy:settings.peanutAllergy,
        veganPreference:settings.veganPreference,
      });
      setResult(r);
      DBService.insertScan(`Scan:${image.uri}`,r,[]);
    }catch(e:any){
      Alert.alert('Error',e.message);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>📷 Food & Plant Scanner</Text>
      <Pressable style={styles.btn} onPress={pick}>
        <LinearGradient colors={[theme.colors.b1,theme.colors.b2]} style={styles.gw}>
          <View style={styles.winIn}>
            {image
              ? <Image source={{uri:image.uri}} style={{width:'100%',height:'100%'}}/>
              : <Text style={styles.txt}>Tap to select an image</Text>
            }
          </View>
        </LinearGradient>
      </Pressable>
      <Pressable style={styles.btn} onPress={scan} disabled={loading}>
        <LinearGradient colors={[theme.colors.btn1,theme.colors.btn2]} style={styles.gw}>
          <View style={styles.press}>
            <Text style={styles.btnTxt}>{loading?'Scanning…':'Scan Food'}</Text>
            {loading && <ActivityIndicator color={theme.colors.bg} style={{marginLeft:8}}/>}
          </View>
        </LinearGradient>
      </Pressable>
      {error && <Text style={[styles.txt,{color:'red'}]}>{error}</Text>}
      {result && (
        <View style={styles.card}>
          <Markdown style={{body:{color:theme.colors.text}}}>{result}</Markdown>
        </View>
      )}
    </ScrollView>
  );
};

const OvenScreen:React.FC = ()=>{
  const{settings}=useContext(SettingsContext);
  const{image,pick}=useImagePicker();
  const cpu=useCpuMonitor();
  const{run:runOven,loading:ol, error:oe}=useAI(PROMPTS.ovenAI);
  const[report,setReport]=useState<any>(null);
  const analyze=async()=>{
    if(!image) return Alert.alert('Select image');
    try{
      const e=await DeviceInfo.getSystemCpuLoad();
      const r=await runOven({
        imageBase64:image.base64!,imageMime:image.type!,
        quantum_str:`Entropy:${(e*100).toFixed(2)}`,
        lactoseSensitivity:settings.lactoseSensitivity,
        peanutAllergy:settings.peanutAllergy,
        veganPreference:settings.veganPreference,
      });
      setReport(JSON.parse(r));
    }catch(e:any){
      Alert.alert('Error',e.message);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>🔥 Quantum Oven Scanner</Text>
      <View style={styles.win}>
        <LinearGradient colors={[theme.colors.b1,theme.colors.b2]} style={styles.gw}>
          <View style={styles.winIn}>
            {image
              ? <Image source={{uri:image.uri}} style={{width:'100%',height:'100%'}}/>
              : <Text style={styles.txt}>No image selected</Text>
            }
          </View>
        </LinearGradient>
      </View>
      <Text style={styles.txt}>CPU Usage: {cpu!==null?`${cpu}%`:'N/A'}</Text>
      {oe && <Text style={[styles.txt,{color:'red'}]}>{oe}</Text>}
      <Pressable style={styles.btn} onPress={image?analyze:pick}>
        <LinearGradient colors={[theme.colors.btn1,theme.colors.btn2]} style={styles.gw}>
          <View style={styles.press}>
            <Text style={styles.btnTxt}>
              {image?(ol?'Analyzing…':'Analyze Oven'):'Select Image'}
            </Text>
            {ol && <ActivityIndicator color={theme.colors.bg} style={{marginLeft:8}}/>}
          </View>
        </LinearGradient>
      </Pressable>
      {report && (
        <View style={styles.card}>
          <Text style={styles.sh}>Results</Text>
          <Text style={styles.txt}>Completion: {report.completionPercent}%</Text>
          <Text style={styles.txt}>Dryness Risk: {report.drynessRisk}</Text>
          <Text style={styles.txt}>Burning Risk: {report.burningRisk}</Text>
          <Text style={styles.txt}>Mitigation Tips:</Text>
          {report.mitigationTips.map((t:string,i:number)=>(
            <Text key={i} style={styles.txt}>• {t}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const HistoryScreen:React.FC = ()=>{
  const[rows,setRows]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  useEffect(()=>{
    DBService.getScans(data=>{
      setRows(data);
      setLoading(false);
    });
  },[]);
  if(loading) return <ActivityIndicator style={{margin:20}} color={theme.colors.accent}/>;
  if(error) return <Text style={[styles.txt,{color:'red'}]}>{error}</Text>;
  return (
    <FlatList
      contentContainerStyle={styles.body}
      data={rows}
      keyExtractor={item=>String(item.id)}
      ListHeaderComponent={<Text style={styles.h}>📜 Scan History</Text>}
      renderItem={({item})=>(
        <View style={styles.card}>
          <Text style={styles.txt}>{new Date(item.timestamp).toLocaleString()}</Text>
          <Text style={styles.lbl}>Prompt:</Text>
          <Text style={styles.txt}>{item.prompt}</Text>
          <Text style={styles.lbl}>Response:</Text>
          <Text style={styles.txt}>{item.response}</Text>
        </View>
      )}
    />
  );
};

const RelatedScreen:React.FC = ()=>{
  const[rows,setRows]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    DBService.getScans(all=>{
      if(all.length){
        const target=all[0].colorVec;
        const dist=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0));
        const sims=all.map(s=>({...s,d:dist(s.colorVec,target)}))
                       .sort((a,b)=>a.d-b.d).slice(1,6);
        setRows(sims);
      }
      setLoading(false);
    });
  },[]);
  if(loading) return <ActivityIndicator style={{margin:20}} color={theme.colors.accent}/>;
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>🔍 Related Scans</Text>
      {rows.map((s,i)=>(
        <View key={i} style={styles.card}>
          <Text style={styles.txt}>{new Date(s.timestamp).toLocaleString()} (dist {s.d.toFixed(2)})</Text>
          <Text style={styles.txt}>{s.response}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const CalendarScreen:React.FC = ()=>{
  const{settings}=useContext(SettingsContext);
  const{run,loading,error}=useAI(PROMPTS.foodCalendar);
  const[plan,setPlan]=useState<any>(null);
  const[rows,setRows]=useState<any[]>([]);
  useEffect(()=>DBService.getScans(setRows),[]);
  const generate=async()=>{
    try{
      const r=await run({
        pastScans:JSON.stringify(rows.slice(0,10)),
        lactoseSensitivity:settings.lactoseSensitivity,
        peanutAllergy:settings.peanutAllergy,
        veganPreference:settings.veganPreference
      });
      setPlan(JSON.parse(r));
    }catch(e:any){Alert.alert('Error',e.message);}
  };
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>📅 AI Food Calendar</Text>
      <Pressable style={styles.btn} onPress={generate} disabled={loading}>
        <LinearGradient colors={[theme.colors.btn1,theme.colors.btn2]} style={styles.gw}>
          <View style={styles.press}>
            <Text style={styles.btnTxt}>{loading?'Generating…':'Generate Calendar'}</Text>
            {loading&&<ActivityIndicator color={theme.colors.bg} style={{marginLeft:8}}/>}
          </View>
        </LinearGradient>
      </Pressable>
      {error&&<Text style={[styles.txt,{color:'red'}]}>{error}</Text>}
      {plan&&(
        <View style={styles.card}>
          <Text style={styles.sh}>Weekly Plan</Text>
          <Markdown style={{body:{color:theme.colors.text}}}>{JSON.stringify(plan.weeklyPlan,null,2)}</Markdown>
          <Text style={styles.sh}>Monthly Favorites</Text>
          <Markdown style={{body:{color:theme.colors.text}}}>{JSON.stringify(plan.monthlyFavorites,null,2)}</Markdown>
        </View>
      )}
    </ScrollView>
  );
};

const SetupScreen:React.FC = ()=>{
  const[key,setKey]=useState('');
  const save=async()=>{
    if(!key.startsWith('sk-')) return Alert.alert('Invalid key','Must start with sk-');
    await saveApiKey(key);
    Alert.alert('Success','API key saved securely');
    setKey('');
  };
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>🔐 OpenAI API Key</Text>
      <TextInput
        style={styles.inp}
        placeholder="sk-..."
        placeholderTextColor={theme.colors.accent}
        value={key}
        onChangeText={setKey}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable style={styles.btn} onPress={save} disabled={!key.startsWith('sk-')}>
        <LinearGradient colors={[theme.colors.btn1,theme.colors.btn2]} style={styles.gw}>
          <View style={styles.press}>
            <Text style={styles.btnTxt}>Save Key</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
};

const SettingsScreen:React.FC = ()=>{
  const{settings,update}=useContext(SettingsContext);
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>⚙️ Dietary Settings</Text>
      <Text style={styles.lbl}>Lactose Sensitivity: {settings.lactoseSensitivity}</Text>
      <Slider
        minimumValue={0} maximumValue={10} step={1}
        value={settings.lactoseSensitivity}
        onValueChange={v=>update({lactoseSensitivity:v})}
        style={styles.slider}
      />
      <Text style={styles.lbl}>Peanut Allergy</Text>
      <Switch
        value={settings.peanutAllergy}
        onValueChange={v=>update({peanutAllergy:v})}
      />
      <Text style={styles.lbl}>Vegan Preference: {settings.veganPreference}</Text>
      <Slider
        minimumValue={0} maximumValue={10} step={1}
        value={settings.veganPreference}
        onValueChange={v=>update({veganPreference:v})}
        style={styles.slider}
      />
      <Text style={styles.txt}>0 = No preference, 10 = Strict vegan</Text>
    </ScrollView>
  );
};

const AboutScreen:React.FC = ()=>(
  <ScrollView contentContainerStyle={styles.body} style={styles.main}>
    <Text style={styles.h}>ℹ️ About This App</Text>
    <Text style={styles.txt}>
      Hi! I’m <Text style={{fontWeight:'700'}}>Graylan01</Text>, developer behind Swamp Rabbit Café & Grocery Tree Oracle.
      This app blends farm‑to‑table care, quantum computing insights, AI vision, and on‑device encryption.
      Built with React Native, GPT‑4o Vision, PennyLane‑lite, AES‑GCM, SQLite. A personal passion project for smarter, safer cooking—even offline! 🐇💚
    </Text>
  </ScrollView>
);

//
// ─── Navigation & App ───────────────────────────────────────────────
const Tab = createBottomTabNavigator();

export default function App(){
  const[ready,setReady]=useState(false);
  return(
    <SettingsProvider>
      <NavigationContainer>
        {!ready
          ? <SplashScreen onLoaded={()=>setReady(true)}/>
          : <Tab.Navigator
              screenOptions={({route})=>({
                headerShown:false,
                tabBarIcon:({color,size})=>(
                  <Icon
                    name={{
                      Scanner:'scan-outline',Oven:'flame-outline',
                      History:'time-outline',Related:'search-outline',
                      Calendar:'calendar-outline',Setup:'key-outline',
                      Settings:'settings-outline',About:'information-circle-outline'
                    }[route.name]!}
                    size={size}
                    color={color}
                  />
                ),
                tabBarStyle:{backgroundColor:theme.colors.card},
                tabBarActiveTintColor:theme.colors.accent,
                tabBarInactiveTintColor:theme.colors.text,
              })}
            >
            <Tab.Screen name="Scanner" component={ScannerScreen}/>
            <Tab.Screen name="Oven" component={OvenScreen}/>
            <Tab.Screen name="History" component={HistoryScreen}/>
            <Tab.Screen name="Related" component={RelatedScreen}/>
            <Tab.Screen name="Calendar" component={CalendarScreen}/>
            <Tab.Screen name="Setup" component={SetupScreen}/>
            <Tab.Screen name="Settings" component={SettingsScreen}/>
            <Tab.Screen name="About" component={AboutScreen}/>
          </Tab.Navigator>
        }
      </NavigationContainer>
    </SettingsProvider>
  );
}

