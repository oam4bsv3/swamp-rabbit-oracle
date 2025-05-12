// App.tsx — Swamp Rabbit Café & Grocery Tree Oracle
// • GPT-4o Vision • AES-GCM encryption • SQLite storage
// • Inline PennyLane-lite (JS-only, 1–7-qubit simulator)

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
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  Animated,
  Easing,
  Switch,
  Alert,
  useWindowDimensions,
  Image,
  ActivityIndicator,
  ProgressBarAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Slider from '@react-native-community/slider';
import Markdown from 'react-native-markdown-display';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import Clipboard from '@react-native-clipboard/clipboard';
import EncryptedStorage from 'react-native-encrypted-storage';
import SQLite from 'react-native-sqlite-storage';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import Config from 'react-native-config';
import RNFS from 'react-native-fs';
import DeviceInfo from 'react-native-device-info';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

/* ════════════════════════════════════════════════════════════════════
   PennyLane-lite — inline JS simulator (1–7 qubits)
   ════════════════════════════════════════════════════════════════════ */
export const loadWasm = async () => Promise.resolve();

type C = [number, number];
const add = ([a, b]: C, [c, d]: C): C => [a + c, b + d];
const mul = ([a, b]: C, [c, d]: C): C => [a * c - b * d, a * d + b * c];
const expi = (θ: number): C => [Math.cos(θ), Math.sin(θ)];
const flip = (i: number, bit: number) => i ^ (1 << bit);

export const createDevice = async (
  _name: string = 'default.qubit',
  { wires = 1 }: { wires?: number } = {},
) => {
  if (wires < 1 || wires > 7) throw new Error('Supports 1–7 qubits');
  const dim = 1 << wires;
  const single = (ψ: C[], t: number, m: C[][]) => {
    for (let i = 0; i < dim; i++) {
      if ((i >> t) & 1) continue;
      const j = flip(i, t);
      const a = ψ[i], b = ψ[j];
      ψ[i] = add(mul(m[0][0], a), mul(m[0][1], b));
      ψ[j] = add(mul(m[1][0], a), mul(m[1][1], b));
    }
  };
  const cnot = (ψ: C[], ctl: number, tgt: number) => {
    for (let i = 0; i < dim; i++)
      if (((i >> ctl) & 1) && !((i >> tgt) & 1)) {
        const j = flip(i, tgt);
        [ψ[i], ψ[j]] = [ψ[j], ψ[i]];
      }
  };
  return {
    run: async (circ: { gate: string; wires: number[]; angle?: number }[] = []) => {
      const ψ: C[] = Array.from({ length: dim }, (_, k) =>
        k === 0 ? [1, 0] : [0, 0],
      );
      const h = 1 / Math.sqrt(2);
      for (const op of circ) {
        const [w0, w1] = op.wires;
        switch (op.gate) {
          case 'Hadamard':
            single(ψ, w0, [[[h,0],[h,0]], [[h,0],[-h,0]]]);
            break;
          case 'PauliX':
            single(ψ, w0, [[[0,0],[1,0]], [[1,0],[0,0]]]);
            break;
          case 'PauliZ':
            single(ψ, w0, [[[1,0],[0,0]], [[0,0],[-1,0]]]);
            break;
          case 'RX': {
            const θ = op.angle ?? 0, c = Math.cos(θ/2), s = Math.sin(θ/2);
            single(ψ, w0, [[[c,0],[0,-s]], [[0,-s],[c,0]]]);
            break;
          }
          case 'RY': {
            const θ = op.angle ?? 0, c = Math.cos(θ/2), s = Math.sin(θ/2);
            single(ψ, w0, [[[c,0],[-s,0]], [[s,0],[c,0]]]);
            break;
          }
          case 'RZ': {
            const θ = op.angle ?? 0;
            single(ψ, w0, [[expi(-θ/2),[0,0]], [[0,0],expi(θ/2)]]);
            break;
          }
          case 'CNOT':
          case 'CX':
            cnot(ψ, w0, w1);
            break;
          default:
            break;
        }
      }
      return { probs: ψ.map(([re]) => re*re) };
    },
  };
};

/* ─── Constants ───────────────────────────────────────────────────── */
const SETTINGS_KEY = 'APP_USER_SETTINGS';
const KEY_STORAGE = 'APP_AES_KEY';
const KEY_TIMESTAMP = 'APP_AES_KEY_TIMESTAMP';
const KEY_ROTATION_INTERVAL_MS = 30*24*60*60*1000;

/* ─── Theme & Styles ───────────────────────────────────────────────── */
const theme = {
  colors: { bg:'#3E2723', card:'#5D4037', text:'#EFEBE9', accent:'#D7CCC8',
            buttonBg:'#A1887F', inputBg:'#4E342E', disabledBg:'#757575' },
  fonts: {
    heading:{ fontFamily:'Georgia', fontSize:24, fontWeight:'600' },
    body:   { fontFamily:'System',  fontSize:16, fontWeight:'400' },
    label:  { fontFamily:'System',  fontSize:16, fontWeight:'500' },
    code:   { fontFamily:'Courier', fontSize:16, fontWeight:'400' },
  },
  space:[4,8,16,24,32], radii:[4,8,16,30],
} as const;

const styles = StyleSheet.create({
  splash:{ flex:1,justifyContent:'center',alignItems:'center',backgroundColor:theme.colors.bg },
  splashText:{ ...theme.fonts.heading,color:theme.colors.accent,fontSize:28,
    textAlign:'center',textShadowColor:'#000',textShadowOffset:{width:1,height:1},
    textShadowRadius:6,paddingHorizontal:theme.space[2],
  },
  main:{ flex:1,backgroundColor:theme.colors.bg },
  body:{ padding:theme.space[2],paddingBottom:theme.space[4] },
  heading:{ ...theme.fonts.heading,color:theme.colors.accent,marginBottom:theme.space[2],
    textAlign:'center',letterSpacing:1 },
  label:{ ...theme.fonts.label,color:theme.colors.text,marginBottom:4 },
  text:{ ...theme.fonts.body,color:theme.colors.text,lineHeight:24,marginVertical:4 },
  input:{ ...theme.fonts.code,backgroundColor:theme.colors.inputBg,color:theme.colors.text,
    borderRadius:theme.radii[1],padding:theme.space[2],marginVertical:4,
    borderWidth:1,borderColor:theme.colors.accent
  },
  slider:{ width:'100%',height:40,marginVertical:theme.space[2] },
  imagePicker:{ backgroundColor:theme.colors.card,height:220,borderRadius:theme.radii[2],
    justifyContent:'center',alignItems:'center',marginBottom:theme.space[3],
    borderWidth:1,borderColor:theme.colors.accent
  },
  image:{ width:'100%',height:'100%',borderRadius:theme.radii[2] },
  placeholder:{ ...theme.fonts.body,color:theme.colors.accent,fontStyle:'italic' },
  button:{ backgroundColor:theme.colors.buttonBg,borderRadius:theme.radii[3],
    paddingVertical:theme.space[2],paddingHorizontal:theme.space[3],alignItems:'center',
    marginVertical:theme.space[2],shadowColor:'#000',shadowOffset:{width:1,height:3},
    shadowOpacity:0.3,shadowRadius:6,elevation:6
  },
  buttonDisabled:{ backgroundColor:theme.colors.disabledBg,borderRadius:theme.radii[3],
    paddingVertical:theme.space[2],paddingHorizontal:theme.space[3],alignItems:'center',
    marginVertical:theme.space[2]
  },
  buttonText:{ ...theme.fonts.label,color:theme.colors.bg,fontWeight:'700',fontSize:16,
    textTransform:'uppercase',letterSpacing:1.2
  },
  error:{ color:'#F44336',textAlign:'center',marginVertical:4,fontWeight:'600' },
  card:{ backgroundColor:theme.colors.card,borderRadius:theme.radii[2],
    padding:theme.space[3],marginVertical:theme.space[2],
    shadowColor:'#000',shadowOffset:{width:1,height:3},shadowOpacity:0.3,shadowRadius:6,
    elevation:4
  },
});

/* ─── Encryption Helpers ─────────────────────────────────────────────── */
function encryptStatic(text:string){
  const iv = CryptoJS.lib.WordArray.random(12);
  const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(Config.ENCRYPTION_SECRET), {
    iv, mode:CryptoJS.mode.GCM
  });
  return JSON.stringify({
    iv: iv.toString(CryptoJS.enc.Hex),
    ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64)
  });
}
function decryptStatic(data:string){
  try {
    const { iv, ct } = JSON.parse(data);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(ct)
    });
    const dec = CryptoJS.AES.decrypt(cipherParams, CryptoJS.enc.Utf8.parse(Config.ENCRYPTION_SECRET), {
      iv: CryptoJS.enc.Hex.parse(iv), mode:CryptoJS.mode.GCM
    });
    return dec.toString(CryptoJS.enc.Utf8);
  } catch { return ''; }
}

let AES_KEY:string|null = null;
async function initEncryptionKey(){
  const sk = await EncryptedStorage.getItem(KEY_STORAGE);
  const st = await EncryptedStorage.getItem(KEY_TIMESTAMP);
  let last = 0;
  try { last = st? parseInt(decryptStatic(st),10):0; } catch{}
  const needs = !sk || !last || Date.now()-last > KEY_ROTATION_INTERVAL_MS;
  if(sk && !needs){
    AES_KEY = decryptStatic(sk);
  } else {
    const newKey = CryptoJS.lib.WordArray.random(32).toString();
    await EncryptedStorage.setItem(KEY_STORAGE, encryptStatic(newKey));
    await EncryptedStorage.setItem(KEY_TIMESTAMP, encryptStatic(String(Date.now())));
    AES_KEY = newKey;
  }
}
function encrypt(text:string){
  if(!AES_KEY) throw new Error('Key not initialized');
  const iv = CryptoJS.lib.WordArray.random(12);
  const ct = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(AES_KEY), {
    iv, mode:CryptoJS.mode.GCM
  });
  return JSON.stringify({
    iv: iv.toString(CryptoJS.enc.Hex),
    ct: ct.ciphertext.toString(CryptoJS.enc.Base64)
  });
}
function decrypt(data:string){
  if(!AES_KEY) throw new Error('Key not initialized');
  try {
    const { iv, ct } = JSON.parse(data);
    const params = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(ct) });
    const dec = CryptoJS.AES.decrypt(params, CryptoJS.enc.Utf8.parse(AES_KEY), {
      iv: CryptoJS.enc.Hex.parse(iv), mode:CryptoJS.mode.GCM
    });
    return dec.toString(CryptoJS.enc.Utf8);
  } catch { return ''; }
}
const saveApiKey = async (key:string) =>
  await EncryptedStorage.setItem('OPENAI_API_KEY', encrypt(key));
const loadApiKey = async () => {
  const e = await EncryptedStorage.getItem('OPENAI_API_KEY');
  return e? decrypt(e) : null;
};

/* ─── Database Service ───────────────────────────────────────────────── */
class DBService {
  static db!: SQLite.SQLiteDatabase;
  static init(){
    this.db = SQLite.openDatabase(
      { name:'swamp_rabbit.db', location:'default' },
      ()=> {
        this.db.executeSql(`
          CREATE TABLE IF NOT EXISTS scans(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt TEXT, response TEXT,
            colorTag TEXT, colorVec TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
      },
      e=>console.error(e)
    );
  }
  static insertScan(prompt:string,response:string,tag:string,vec:number[]){
    this.db.transaction(tx=>
      tx.executeSql(
        'INSERT INTO scans(prompt,response,colorTag,colorVec) VALUES(?,?,?,?);',
        [encrypt(prompt), encrypt(response), encrypt(tag), encrypt(JSON.stringify(vec))]
      )
    );
  }
  static getScans(cb:(rows:any[])=>void){
    this.db.transaction(tx=>
      tx.executeSql(
        'SELECT * FROM scans ORDER BY timestamp DESC;', [], (_,_res)=>{
          const raw = _res.rows.raw();
          cb(raw.map((r:any)=>({
            ...r,
            prompt: decrypt(r.prompt),
            response: decrypt(r.response),
            colorTag: decrypt(r.colorTag),
            colorVec: JSON.parse(decrypt(r.colorVec)),
          })));
        })
    );
  }
}

/* ─── Advanced GPT Prompts ───────────────────────────────────────────── */
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
      "Grains":["1 cup quinoa","2 cups vegetable broth"],
      "Herbs":["2 tbsp chopped basil","1 tbsp chopped thyme"]
    },
    "steps":[
      "Rinse quinoa under cold water...", 
      "Toast herbs in a pan..."
    ],
    "nutrition":{"calories":420,"protein":12,"fat":8,"carbs":72},
    "risk":{"3day":5,"7day":12,"14day":25},
    "pairing":"🍷 Light white wine",
    "tip":"Store in airtight container at 4°C"
  },
  { /* … two more recipes … */ }
]
\`\`\`
[instructions]
- Output valid JSON array.
- Use detailed, sensory language.
- Ensure keys match example exactly.
[/instructions]`,
  ovenAI: `
[action] You are the **Quantum Nosonar Oven Scanner AI**, merging high‑resolution image processing, CPU entropy profiling, and hypertime quantum safety analytics. [/action]
[inputs]
- Image(Base64): {imageBase64}
- MIME: {imageMime}
- CPU Entropy: {quantum_str}
- Dietary Flags: Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference}
[/inputs]
[description]
Analyze oven image to provide:
• completionPercent (0–100%)
• drynessRisk & burningRisk (Low/Med/High)
• internalTempProfile (°C array of 3 zones)
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
[instructions]
- Integers for percentages; two decimals for floats.
- Respond with JSON only.
[/instructions]`,
  capture: `
[action] You are the **Swamp Rabbit Visual Scanner AI**, adept at hazard detection, plant/food classification, and interactive feedback with emoji annotations. [/action]
[inputs]
- Image(Base64): {imageBase64}
- MIME: {imageMime}
- Dietary Flags: Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference}
[/inputs]
[description]
Identify object type, estimate surfaceTemp(°C), list hazards with emojis, and summarize in a markdown paragraph.
[/description]
[reply_example]
\`\`\`markdown
**Type:** Sautéed Kale Chips  
**SurfaceTemp:** ~75°C  
- ⚠️ High heat risk—use tongs  
- 🍃 Vegan safe  
- 🦠 Oil splatter hazard  

*Ready at ~75°C—handle carefully!*  
\`\`\`
[instructions]
- Output only the markdown block.
[/instructions]`,
  foodCalendar: `
[action] You are the **Swamp Rabbit AI Food Calendar**, specializing in dynamic meal planning, nutritional forecasting, and community taste trends over weekly & monthly horizons. [/action]
[dietary]
- Lactose={lactoseSensitivity}
- Peanut={peanutAllergy}
- Vegan={veganPreference}
[/dietary]
[pastScans]
{pastScans}
[/pastScans]
[description]
Craft:
1. A 7-day meal schedule balancing macros & seasonality.
2. Four monthly favorites based on community scans.
[/description]
[reply_example]
\`\`\`json
{
  "weeklyPlan":{
    "Mon":"🥗 Quinoa Salad",
    "Tue":"🍲 Tomato Basil Soup",
    // …
  },
  "monthlyFavorites":["🥗","🍲","🌮","🍛"]
}
\`\`\`
[instructions]
- Output valid JSON matching the example keys exactly.
[/instructions]`,
};

/* ─── Hooks ────────────────────────────────────────────────────────── */
function useAI(systemPrompt: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const run = useCallback(async (inputs: any) => {
    setLoading(true); setError(undefined);
    try {
      const key = await loadApiKey();
      if (!key) throw new Error('API key missing');
      const messages: any[] = [{ role: 'system', content: systemPrompt }];
      if (inputs.textPrompt) messages.push({ role: 'user', content: inputs.textPrompt });
      if (inputs.imageBase64 && inputs.imageMime) {
        messages.push({
          role: 'user',
          type: 'image_url',
          image_url: { url: `data:${inputs.imageMime};base64,${inputs.imageBase64}` },
        });
      }
      const resp = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-vision-preview',
          temperature: 0.7,
          messages
        },
        { headers: { Authorization: `Bearer ${key}` } }
      );
      const txt = resp.data.choices?.[0]?.message?.content;
      if (!txt) throw new Error('No response');
      return txt.trim();
    } catch (e: any) {
      setError(e.message); throw e;
    } finally {
      setLoading(false);
    }
  }, [systemPrompt]);
  return { run, loading, error };
}

function useImagePicker() {
  const [image, setImage] = useState<Asset|null>(null);
  const pick = async () => {
    const res = await launchImageLibrary({ mediaType:'photo', includeBase64:true });
    if (res.assets?.[0]) setImage(res.assets[0]);
  };
  return { image, pick };
}

function useCpuMonitor(interval=5000) {
  const [cpu, setCpu] = useState(0);
  useFocusEffect(useCallback(()=>{
    let active = true;
    const fetchCpu = async()=>{
      try {
        const load = await DeviceInfo.getSystemCpuLoad();
        if(active) setCpu(Math.round(load*100));
      } catch{}
    };
    fetchCpu();
    const id = setInterval(fetchCpu, interval);
    return ()=>{ active=false; clearInterval(id); };
  },[interval]));
  return cpu;
}

/* ─── Settings Context ─────────────────────────────────────────────── */
interface Settings {
  lactoseSensitivity:number;
  peanutAllergy:boolean;
  veganPreference:number;
}
const SettingsContext = createContext<{
  settings:Settings;
  update:(s:Partial<Settings>)=>void;
}>({
  settings:{lactoseSensitivity:0, peanutAllergy:false, veganPreference:0},
  update:()=>{},
});
const SettingsProvider: React.FC<{children:ReactNode}> = ({children})=>{
  const [settings,setSettings] = useState<Settings>({
    lactoseSensitivity:0, peanutAllergy:false, veganPreference:0
  });
  useEffect(()=>{
    AsyncStorage.getItem(SETTINGS_KEY).then(val=>{
      if(val) setSettings(JSON.parse(val));
    });
  },[]);
  useEffect(()=>{
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },[settings]);
  const update = (s:Partial<Settings>)=>setSettings(prev=>({...prev,...s}));
  return <SettingsContext.Provider value={{settings,update}}>{children}</SettingsContext.Provider>;
};

/* ─── Screens ─────────────────────────────────────────────────────── */
const SplashScreen: React.FC<{onLoaded:()=>void}> = ({onLoaded})=>{
  const fade = useRef(new Animated.Value(0)).current;
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
    <LinearGradient colors={[theme.colors.accent,theme.colors.text]} style={styles.splash}>
      <Animated.Text style={[styles.splashText,{opacity:fade}]}>
        🐇 Swamp Rabbit Café & Grocery Tree Oracle
      </Animated.Text>
    </LinearGradient>
  );
};

const AIReplyCard: React.FC<{content:string}> = ({content})=>{
  const {width} = useWindowDimensions();
  const maxW = Math.min(width - theme.space[3], 600);
  return (
    <View style={[styles.card,{maxWidth:maxW}]}>
      <Markdown style={{body:{color:theme.colors.text,fontSize:16,lineHeight:24}}}>
        {content}
      </Markdown>
    </View>
  );
};

const ColorTagStrip: React.FC<{jsonTag:string}> = ({jsonTag})=>{
  let tag = { palette: [] as string[], tagId: '' };
  try { tag = JSON.parse(jsonTag); } catch {}
  return (
    <View style={{marginVertical:theme.space[2]}}>
      <Text style={{color:theme.colors.accent,fontSize:12}}>Tag: {tag.tagId}</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap'}}>
        {tag.palette.map((h,i)=>(
          <Pressable key={i} onLongPress={()=>{
            Clipboard.setString(h);
            Alert.alert(`Copied ${h}`);
          }}>
            <View style={{
              backgroundColor:h,width:20,height:20,margin:1,
              borderRadius:2,borderWidth:1,borderColor:theme.colors.text
            }}/>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const FoodScannerScreen: React.FC = () => {
  const {settings} = useContext(SettingsContext);
  const {image,pick} = useImagePicker();
  const {run,loading,error} = useAI(PROMPTS.capture);
  const [result,setResult]=useState('');
  const [vec,setVec]=useState<number[]>([]);
  const [apiLoaded,setApiLoaded]=useState(false);

  useEffect(()=>{ loadApiKey().then(k=>setApiLoaded(!!k)); },[]);

  const scan=async()=>{
    if(!image) return Alert.alert('Select image');
    try{
      const r = await run({
        imageBase64:image.base64!,
        imageMime:image.type!,
        lactoseSensitivity:settings.lactoseSensitivity,
        peanutAllergy:settings.peanutAllergy,
        veganPreference:settings.veganPreference,
      });
      setResult(r);
      // colorVec and colorTag not provided by capture prompt, placeholder:
      DBService.insertScan(`Scan:${image.uri}`, r, '', []);
    }catch(e:any){
      Alert.alert('Scan error',e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>📷 Food & Plant Scanner</Text>
      <Pressable style={styles.imagePicker} onPress={pick}>
        {image
          ? <Image source={{uri:image.uri}} style={styles.image}/>
          : <Text style={styles.placeholder}>Tap to select</Text>}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={apiLoaded && !loading ? styles.button : styles.buttonDisabled}
                 onPress={scan} disabled={!apiLoaded||loading}>
        <Text style={styles.buttonText}>{loading?'Scanning…':'Scan Food'}</Text>
        {loading && <ActivityIndicator style={{marginLeft:8}} color={theme.colors.bg}/>}
      </Pressable>
      {result && <AIReplyCard content={result}/>}
    </ScrollView>
  );
};

const OvenScreen: React.FC = () => {
  const {settings} = useContext(SettingsContext);
  const {image,pick}=useImagePicker();
  const cpu=useCpuMonitor();
  const {run:runOven,loading:ovLoad,error:ovErr}=useAI(PROMPTS.ovenAI);
  const [report,setReport]=useState<any>(null);

  const analyze=async()=>{
    if(!image) return Alert.alert('Select image');
    try{
      const entropy = await DeviceInfo.getSystemCpuLoad().then(l=>l*100);
      const r = await runOven({
        imageBase64:image.base64!,
        imageMime:image.type!,
        quantum_str:`Entropy:${entropy.toFixed(2)}`,
        lactoseSensitivity:settings.lactoseSensitivity,
        peanutAllergy:settings.peanutAllergy,
        veganPreference:settings.veganPreference,
      });
      setReport(JSON.parse(r));
    }catch(e:any){
      Alert.alert('Analyze error',e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>🔥 Quantum Nosonar Oven Scanner</Text>
      <Pressable style={styles.imagePicker} onPress={pick}>
        {image
          ? <Image source={{uri:image.uri}} style={styles.image}/>
          : <Text style={styles.placeholder}>Tap to select</Text>}
      </Pressable>
      <Text style={styles.text}>CPU Usage: {cpu}%</Text>
      {ovErr && <Text style={styles.error}>{ovErr}</Text>}
      <Pressable style={!ovLoad?styles.button:styles.buttonDisabled}
                 onPress={analyze} disabled={ovLoad}>
        <Text style={styles.buttonText}>{ovLoad?'Analyzing…':'Analyze Oven'}</Text>
        {ovLoad && <ActivityIndicator style={{marginLeft:8}} color={theme.colors.bg}/>}
      </Pressable>
      {report && (
        <View style={styles.card}>
          <Text style={styles.text}>Completion: {report.completionPercent}%</Text>
          <Text style={styles.text}>Dryness Risk: {report.drynessRisk}</Text>
          <Text style={styles.text}>Burning Risk: {report.burningRisk}</Text>
          <Text style={styles.text}>Mitigation Tips:</Text>
          {report.mitigationTips.map((t:string,i:number)=>(
            <Text key={i} style={styles.text}>• {t}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const HistoryScreen: React.FC = () => {
  const [scans,setScans]=useState<any[]>([]);
  useEffect(()=>{ DBService.getScans(setScans); },[]);
  return (
    <FlatList
      contentContainerStyle={styles.body}
      data={scans}
      keyExtractor={item=>String(item.id)}
      ListHeaderComponent={<Text style={styles.heading}>📜 Scan History</Text>}
      ListFooterComponent={<View style={{height:theme.space[4]}}/>}
      renderItem={({item})=>(
        <View style={styles.card}>
          <Text style={styles.text}>{new Date(item.timestamp).toLocaleString()}</Text>
          <Text style={styles.label}>Prompt:</Text>
          <Text style={styles.text}>{item.prompt}</Text>
          <Text style={styles.label}>Response:</Text>
          <Text style={styles.text}>{item.response}</Text>
        </View>
      )}
    />
  );
};

const SimilarScansScreen: React.FC = () => {
  const [related,setRelated]=useState<any[]>([]);
  useEffect(()=>{
    DBService.getScans(all=>{
      if(all.length>0){
        const target = all[0].colorVec;
        const dist = (a:number[],b:number[])=>{
          let sum=0;
          for(let i=0;i<Math.min(a.length,b.length);i++){
            sum += (a[i]-b[i])**2;
          }
          return Math.sqrt(sum);
        };
        const sims = all.map(s=>({...s,d:dist(s.colorVec,target)}))
                        .sort((a,b)=>a.d-b.d)
                        .slice(1,6);
        setRelated(sims);
      }
    });
  },[]);
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>🔍 Related Scans</Text>
      {related.map((s,i)=>(
        <View key={i} style={styles.card}>
          <Text style={styles.text}>{new Date(s.timestamp).toLocaleString()} (dist {s.d.toFixed(2)})</Text>
          <Text style={styles.text}>Response: {s.response}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const FoodCalendarScreen: React.FC = () => {
  const {settings} = useContext(SettingsContext);
  const {run,loading,error} = useAI(PROMPTS.foodCalendar);
  const [plan,setPlan]=useState<any>(null);
  const [scans,setScans]=useState<any[]>([]);
  useEffect(()=>{ DBService.getScans(setScans); },[]);
  const generate=async()=>{
    try{
      const json = JSON.stringify(scans.slice(0,10));
      const r = await run({
        pastScans: json,
        lactoseSensitivity:settings.lactoseSensitivity,
        peanutAllergy:settings.peanutAllergy,
        veganPreference:settings.veganPreference,
      });
      setPlan(JSON.parse(r));
    }catch(e:any){
      Alert.alert('Calendar error',e.message);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>📅 AI Food Calendar</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={!loading?styles.button:styles.buttonDisabled}
                 onPress={generate} disabled={loading}>
        <Text style={styles.buttonText}>{loading?'Generating…':'Generate Calendar'}</Text>
        {loading && <ActivityIndicator style={{marginLeft:8}} color={theme.colors.bg}/>}
      </Pressable>
      {plan && (
        <View style={styles.card}>
          <Text style={styles.label}>Weekly Plan:</Text>
          <Text style={styles.text}>{JSON.stringify(plan.weeklyPlan,null,2)}</Text>
          <Text style={styles.label}>Monthly Favorites:</Text>
          <Text style={styles.text}>{JSON.stringify(plan.monthlyFavorites,null,2)}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const ApiKeySetup: React.FC = () => {
  const [key,setKey]=useState('');
  const saveKeyHandler=async()=>{
    if(!key.startsWith('sk-')) return Alert.alert('Invalid key');
    await saveApiKey(key);
    Alert.alert('API key saved securely');
    setKey('');
  };
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>🔐 OpenAI API Key</Text>
      <TextInput
        style={styles.input}
        placeholder="sk-..."
        placeholderTextColor={theme.colors.accent}
        value={key}
        onChangeText={setKey}
      />
      <Pressable style={styles.button} onPress={saveKeyHandler}>
        <Text style={styles.buttonText}>Save Key</Text>
      </Pressable>
    </ScrollView>
  );
};

const SettingsScreen: React.FC = () => {
  const {settings,update} = useContext(SettingsContext);
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>⚙️ Dietary Settings</Text>
      <Text style={styles.label}>Lactose Sensitivity: {settings.lactoseSensitivity}</Text>
      <Slider
        minimumValue={0} maximumValue={10} step={1}
        value={settings.lactoseSensitivity}
        onValueChange={v=>update({lactoseSensitivity:v})}
        style={styles.slider}
      />
      <Text style={styles.label}>Peanut Allergy:</Text>
      <Switch value={settings.peanutAllergy} onValueChange={v=>update({peanutAllergy:v})}/>
      <Text style={styles.label}>Vegan Preference: {settings.veganPreference}</Text>
      <Slider
        minimumValue={0} maximumValue={10} step={1}
        value={settings.veganPreference}
        onValueChange={v=>update({veganPreference:v})}
        style={styles.slider}
      />
      <Text style={styles.text}>0 = No preference, 10 = Strictly vegan</Text>
    </ScrollView>
  );
};

const AboutScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.body} style={styles.main}>
    <Text style={styles.heading}>ℹ️ About This App</Text>
    <Text style={styles.text}>
      Hi! I’m <Text style={{fontWeight:'600'}}>Graylan01</Text>, developer behind Swamp Rabbit Café & Grocery Tree Oracle. This app blends farm‑to‑table care, quantum computing insights, AI vision, and on‑device encryption. Built with React Native, GPT‑4o Vision, PennyLane-lite, AES‑GCM, SQLite. A personal passion project for smarter, safer cooking—even offline! 🐇💚
    </Text>
  </ScrollView>
);

/* ─── Navigation ────────────────────────────────────────────────────── */
const Tab = createBottomTabNavigator();

export default function App() {
  const [ready,setReady] = useState(false);
  return (
    <SettingsProvider>
      <NavigationContainer>
        {!ready ? (
          <SplashScreen onLoaded={()=>setReady(true)}/>
        ) : (
          <Tab.Navigator
            screenOptions={({route})=>({
              headerShown:false,
              tabBarIcon:({color,size})=>(
                <Icon
                  name={{
                    Scanner:'scan-outline',
                    Oven:'flame-outline',
                    History:'time-outline',
                    Similar:'search-outline',
                    Calendar:'calendar-outline',
                    Setup:'key-outline',
                    Settings:'settings-outline',
                    About:'information-circle-outline',
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
            <Tab.Screen name="Scanner" component={FoodScannerScreen}/>
            <Tab.Screen name="Oven" component={OvenScreen}/>
            <Tab.Screen name="History" component={HistoryScreen}/>
            <Tab.Screen name="Similar" component={SimilarScansScreen} options={{title:'Related'}}/>
            <Tab.Screen name="Calendar" component={FoodCalendarScreen}/>
            <Tab.Screen name="Setup" component={ApiKeySetup}/>
            <Tab.Screen name="Settings" component={SettingsScreen}/>
            <Tab.Screen name="About" component={AboutScreen}/>
          </Tab.Navigator>
        )}
      </NavigationContainer>
    </SettingsProvider>
  );
}
