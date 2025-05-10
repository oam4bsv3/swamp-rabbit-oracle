// App.tsx — Swamp Rabbit Tree Oracle
// • Enhanced with GPT‑4o Vision, Secure AES‑GCM (env‑injected), Quantum, TinyLlama & AI
// • Repairs: analytic CPU‑entropy, persistent settings, disabled buttons when offline, progress feedback
// • Full prompt library included
// • All code in one giant file

import React, { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import {
  SafeAreaView, View, Text, TextInput, Pressable, ScrollView, FlatList,
  StyleSheet, Animated, Easing, Switch, Alert, useWindowDimensions,
  Image, ActivityIndicator, ProgressBarAndroid
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
import { loadWasm, createDevice } from '@pennylane/wasm';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DeviceInfo from 'react-native-device-info';
import { loadTinyLlama, runTinyLlama } from 'tinyllama-react-native';

// ── Constants & Keys ─────────────────────────────────────────────────────────
const MODEL_URL = 'https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0/resolve/main/tinyllama_model.bin';
const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/tinyllama_model.bin`;
const EXPECTED_HASH = Config.TINYLLAMA_SHA256; // injected at build-time
const SETTINGS_KEY = 'APP_USER_SETTINGS';
const KEY_STORAGE = 'APP_AES_KEY';
const KEY_TIMESTAMP = 'APP_AES_KEY_TIMESTAMP';
const KEY_ROTATION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

// ── Theme & Styles ───────────────────────────────────────────────────────────
const theme = {
  colors: {
    bg: '#3E2723',
    card: '#5D4037',
    text: '#EFEBE9',
    accent: '#D7CCC8',
    buttonBg: '#A1887F',
    inputBg: '#4E342E',
    disabledBg: '#757575',
  },
  fonts: {
    heading: { fontFamily: 'Georgia', fontSize: 24, fontWeight: '600' },
    body:    { fontFamily: 'System',  fontSize: 16, fontWeight: '400' },
    label:   { fontFamily: 'System',  fontSize: 16, fontWeight: '500' },
    code:    { fontFamily: 'Courier', fontSize: 16, fontWeight: '400' },
  },
  space: [4, 8, 16, 24, 32],
  radii: [4, 8, 16, 30],
};

const styles = StyleSheet.create({
  splash: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: theme.colors.bg
  },
  splashText: {
    ...theme.fonts.heading, color: theme.colors.accent,
    fontSize: 28, textAlign: 'center',
    textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 6,
    paddingHorizontal: theme.space[2],
  },
  main:        { flex: 1, backgroundColor: theme.colors.bg },
  body:        { padding: theme.space[2], paddingBottom: theme.space[4] },
  heading: {
    ...theme.fonts.heading, color: theme.colors.accent,
    marginBottom: theme.space[2], textAlign: 'center', letterSpacing: 1,
  },
  label:      { ...theme.fonts.label, color: theme.colors.text, marginBottom: 4 },
  text:       { ...theme.fonts.body, color: theme.colors.text, lineHeight: 24, marginVertical: 4 },
  input: {
    ...theme.fonts.code, backgroundColor: theme.colors.inputBg,
    color: theme.colors.text, borderRadius: theme.radii[1], padding: theme.space[2],
    marginVertical: 4, borderWidth: 1, borderColor: theme.colors.accent,
  },
  slider:      { width: '100%', height: 40, marginVertical: theme.space[2] },
  imagePicker: {
    backgroundColor: theme.colors.card, height: 220,
    borderRadius: theme.radii[2], justifyContent: 'center', alignItems: 'center',
    marginBottom: theme.space[3], borderWidth: 1, borderColor: theme.colors.accent,
  },
  image:       { width: '100%', height: '100%', borderRadius: theme.radii[2] },
  placeholder: { ...theme.fonts.body, color: theme.colors.accent, fontStyle: 'italic' },
  button: {
    backgroundColor: theme.colors.buttonBg, borderRadius: theme.radii[3],
    paddingVertical: theme.space[2], paddingHorizontal: theme.space[3],
    alignItems: 'center', marginVertical: theme.space[2],
    shadowColor: '#000', shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabledBg, borderRadius: theme.radii[3],
    paddingVertical: theme.space[2], paddingHorizontal: theme.space[3],
    alignItems: 'center', marginVertical: theme.space[2],
  },
  buttonText: {
    ...theme.fonts.label, color: theme.colors.bg,
    fontWeight: '700', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  error:       { color: '#F44336', textAlign: 'center', marginVertical: 4, fontWeight: '600' },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radii[2],
    padding: theme.space[3], marginVertical: theme.space[2],
    shadowColor: '#000', shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 10
  },
  banner:     { backgroundColor: '#FFA000', padding: 8, alignItems: 'center' },
  bannerText: { color: '#000', fontWeight: '600' },
});

// ── Encryption & Storage ─────────────────────────────────────────────────────
function encryptStatic(text: string) {
  const secret = Config.ENCRYPTION_SECRET;
  const iv = CryptoJS.lib.WordArray.random(12);
  const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(secret), { iv, mode: CryptoJS.mode.GCM });
  return JSON.stringify({ iv: iv.toString(CryptoJS.enc.Hex), ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64) });
}
function decryptStatic(data: string): string {
  try {
    const { iv, ct } = JSON.parse(data);
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(ct) });
    const secret = Config.ENCRYPTION_SECRET;
    const decrypted = CryptoJS.AES.decrypt(cipherParams, CryptoJS.enc.Utf8.parse(secret), { iv: CryptoJS.enc.Hex.parse(iv), mode: CryptoJS.mode.GCM });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
}
let AES_KEY: string | null = null;
async function initEncryptionKey() {
  const sk = await EncryptedStorage.getItem(KEY_STORAGE);
  const st = await EncryptedStorage.getItem(KEY_TIMESTAMP);
  let last = 0;
  try { last = st ? parseInt(decryptStatic(st), 10) : 0; } catch {}
  const needs = !sk || !last || Date.now() - last > KEY_ROTATION_INTERVAL_MS;
  if (sk && !needs) {
    AES_KEY = decryptStatic(sk);
  } else {
    const newKey = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    await EncryptedStorage.setItem(KEY_STORAGE, encryptStatic(newKey));
    await EncryptedStorage.setItem(KEY_TIMESTAMP, encryptStatic(String(Date.now())));
    AES_KEY = newKey;
  }
}
function encrypt(text: string): string {
  if (!AES_KEY) throw new Error('Key not initialized');
  const iv = CryptoJS.lib.WordArray.random(12);
  const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(AES_KEY), { iv, mode: CryptoJS.mode.GCM });
  return JSON.stringify({ iv: iv.toString(CryptoJS.enc.Hex), ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64) });
}
function decrypt(data: string): string {
  if (!AES_KEY) throw new Error('Key not initialized');
  try {
    const { iv, ct } = JSON.parse(data);
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(ct) });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, CryptoJS.enc.Utf8.parse(AES_KEY), { iv: CryptoJS.enc.Hex.parse(iv), mode: CryptoJS.mode.GCM });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch { return ''; }
}
async function saveApiKey(key: string) {
  await EncryptedStorage.setItem('OPENAI_API_KEY', encrypt(key));
}
async function loadApiKey(): Promise<string | null> {
  const e = await EncryptedStorage.getItem('OPENAI_API_KEY');
  return e ? decrypt(e) : null;
}

// ── Database Service ────────────────────────────────────────────────────────
class DBService {
  static db!: SQLite.SQLiteDatabase;
  static init() {
    this.db = SQLite.openDatabase(
      { name: 'swamp_rabbit.db', location: 'default' },
      () => {
        this.db.executeSql(`
          CREATE TABLE IF NOT EXISTS scans(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt TEXT,
            response TEXT,
            colorTag TEXT,
            colorVec TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          );`);
      },
      e => console.error(e)
    );
  }
  static insertScan(prompt: string, response: string, tagJson: string, vec: number[]) {
    const ep = encrypt(prompt),
          er = encrypt(response),
          et = encrypt(tagJson),
          ev = encrypt(JSON.stringify(vec));
    this.db.transaction(tx =>
      tx.executeSql(`INSERT INTO scans(prompt,response,colorTag,colorVec) VALUES(?,?,?,?);`, [ep, er, et, ev])
    );
  }
  static getScans(cb: (rows: any[]) => void) {
    this.db.transaction(tx =>
      tx.executeSql(`SELECT * FROM scans ORDER BY timestamp DESC;`, [], (_, res) =>
        cb(res.rows.raw().map((r: any) => ({
          ...r,
          prompt: decrypt(r.prompt),
          response: decrypt(r.response),
          colorTag: decrypt(r.colorTag),
          colorVec: JSON.parse(decrypt(r.colorVec)),
        })))
      )
    );
  }
  static clearScans() {
    this.db.transaction(tx => tx.executeSql(`DELETE FROM scans;`));
  }
}

// ── Quantum & CPU Entropy ────────────────────────────────────────────────────
let quantumDev: any;
async function setupQuantum() {
  await loadWasm();
  quantumDev = await createDevice('default.qubit', { wires: 1 });
}
async function computeCpuEntropy(cpuPct: number) {
  const angle = (cpuPct / 100) * Math.PI;
  const p = Math.cos(angle / 2) ** 2;
  return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}

// ── TinyLlama On‑Device LLM ──────────────────────────────────────────────────
let tinyLlamaReady = false;
async function initTinyLlamaModel() {
  try {
    await loadTinyLlama({ modelPath: MODEL_PATH });
    tinyLlamaReady = true;
  } catch (e) {
    console.error(e);
  }
}
async function isModelDownloaded() {
  try { return await RNFS.exists(MODEL_PATH); } catch { return false; }
}
function useTinyLlama() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const run = useCallback(async (prompt: string) => {
    if (!tinyLlamaReady) throw new Error('Offline model not ready');
    setLoading(true);
    setError(undefined);
    try {
      const txt = await runTinyLlama(prompt, { maxTokens: 128, temperature: 0.7 });
      return txt.trim();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  return { run, loading, error };
}

// ── PROMPTS ───────────────────────────────────────────────────────────────────
const PROMPTS = {
  quantumRecipe: `
[action] You are the **Swamp Rabbit Quantum‑Food Wellness AI**, a world‑class expert in synergizing farm‑to‑table culinary creativity with hypertime quantum risk forecasting, neurogastronomy, and community-driven flavor curation. [/action]
[context]
- User dietary constraints: Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference}
- Past meal scans: {pastScans}
- Community favorites and seasonal availability should influence selections.
[/context]
[description] Generate **three** imaginative, nutrient‑dense recipes. For each:
1. Title with emoji and evocative descriptor.
2. Ingredients by category, with metric & imperial measures.
3. Steps numbered, include timing and temperature cues.
4. Nutrition panel: calories, macros, key micronutrients.
5. Quantum‑enhanced Hypertime Risk for spoilage: 3‑day, 7‑day, 14‑day %.
6. Sensory pairing suggestions: beverage or side dish.
7. Risk mitigation tip: storage & reheating guidelines.
[/description]
[reply_example]
\`json
[
  {
    "title":"🌿 Hypertime Herb‑Infused Quinoa Medley",
    "ingredients": {
      "Grains":["1 cup quinoa","2 cups broth"], ...
    },
    ...
  }
]
\`
[instructions]
- Output valid JSON array.
- Use detailed, sensory language.
- Ensure keys match example.
[/instructions]`,
  ovenAI: `
[action] You are the **Quantum Nosonar Oven Scanner AI**, merging high‑resolution image processing, CPU entropy profiling, and hypertime quantum safety analytics. [/action]
[inputs]
- Image(Base64): {imageBase64}
- MIME: {imageMime}
- CPU Entropy: {quantum_str}
- Dietary Flags: Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference}
[/inputs]
[description] Analyze oven image to provide:
• completionPercent (0-100%)
• drynessRisk & burningRisk (Low/Med/High)
• internalTempProfile (°C array of 3 zones)
• speedIndex vs baseline
• mitigationTips (≥2 actionable)
• confidence score
[/description]
[reply_example]
\`json
{
  "completionPercent":82,
  "drynessRisk":"Medium",
  "burningRisk":"Low",
  "internalTempProfile":[130,145,160],
  "speedIndex":1.15,
  "mitigationTips":["Reduce temp by 10°C","Cover edges with foil"],
  "confidence":0.95
}
\`
[instructions]
- Integers for percentages; two decimals for floats.
- JSON only.
[/instructions]`,
  capture: `
[action] You are the **Swamp Rabbit Visual Scanner AI**, adept at hazard detection, plant/food classification, and interactive feedback with emoji annotations. [/action]
[inputs]
- Image(Base64): {imageBase64}
- MIME: {imageMime}
- Dietary Flags: Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference}
[/inputs]
[description] Identify object type, estimate surfaceTemp(°C), list hazards with emojis, and summarize in a markdown paragraph.
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
- Markdown only.
[/instructions]`,
  foodCalendar: `
[action] You are the **Swamp Rabbit AI Food Calendar**, specializing in dynamic meal planning, nutritional forecasting, and community taste trends over weekly & monthly horizons. [/action]
[dietary]
- Lactose={lactoseSensitivity}
- Peanut={peanutAllergy}
- Vegan={veganPreference}
[/dietary]
[pastScans] {pastScans} [/pastScans]
[description]
Craft:
1. A 7-day meal schedule balancing macros & seasonality.
2. 4 monthly favorites based on community scans.
[/description]
[reply_example]
\`json
{
  "weeklyPlan":{"Mon":"🥗","Tue":"🍲", ...},
  "monthlyFavorites":["🥗","🍲","🌮","🍛"]
}
\`
[instructions]
- JSON only; exact keys.
[/instructions]`,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────
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
        messages.push({ role: 'user', type: 'image_url', image_url: { url: `data:${inputs.imageMime};base64,${inputs.imageBase64}` } });
      }
      const resp = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        { model: 'gpt-4o-vision-preview', temperature: 0.7, messages },
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
  const [image, setImage] = useState<Asset | null>(null);
  const pick = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', includeBase64: true });
    if (res.assets?.[0]) setImage(res.assets[0]);
  };
  return { image, pick };
}

function useCpuMonitor(interval = 5000) {
  const [cpu, setCpu] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    const fetchCpu = async () => {
      try { const load = await DeviceInfo.getSystemCpuLoad(); if (active) setCpu(Math.round(load * 100)); }
      catch {}
    };
    fetchCpu();
    const id = setInterval(fetchCpu, interval);
    return () => { active = false; clearInterval(id); };
  }, [interval]));
  return cpu;
}

// ── Settings Context ──────────────────────────────────────────────────────────
interface Settings { lactoseSensitivity: number; peanutAllergy: boolean; veganPreference: number; }
const SettingsContext = createContext<{ settings: Settings; update: (s: Partial<Settings>) => void }>({
  settings: { lactoseSensitivity: 0, peanutAllergy: false, veganPreference: 0 }, update: () => {},
});
const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>({ lactoseSensitivity: 0, peanutAllergy: false, veganPreference: 0 });
  useEffect(() => { AsyncStorage.getItem(SETTINGS_KEY).then(val => { if (val) setSettings(JSON.parse(val)); }); }, []);
  useEffect(() => { AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  const update = (s: Partial<Settings>) => setSettings(prev => ({ ...prev, ...s }));
  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>;
};

// ── Shared Components ────────────────────────────────────────────────────────
const AIReplyCard: React.FC<{ content: string }> = ({ content }) => {
  const { width } = useWindowDimensions(); const maxW = Math.min(width - theme.space[3], 600);
  return <View style={[styles.card, { maxWidth: maxW }]}><Markdown style={{ body: { color: theme.colors.text, fontSize: 16, lineHeight: 24 } }}>{content}</Markdown></View>;
};

const ColorTagStrip: React.FC<{ jsonTag: string }> = ({ jsonTag }) => {
  let tag = { palette: [] as string[], tagId: '' };
  try { tag = JSON.parse(jsonTag); } catch {}
  return (
    <View style={{ marginVertical: theme.space[2] }}>
      <Text style={{ color: theme.colors.accent, fontSize: 12 }}>Tag: {tag.tagId}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {tag.palette.map((h, i) => (
          <Pressable key={i} onLongPress={() => { Clipboard.setString(h); Alert.alert(`Copied ${h}`); }}>
            <View style={{ backgroundColor: h, width: 20, height: 20, margin: 1, borderRadius: 2, borderWidth: 1, borderColor: theme.colors.text }} />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

// ── Distance Utility ──────────────────────────────────────────────────────────
function findSimilarScans(targetVec: number[], scans: any[], topN = 5) {
  const dist = (a: number[], b: number[]) => {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
  };
  return scans.map(s => ({ ...s, distance: dist(targetVec, s.colorVec) }))
              .sort((a, b) => a.distance - b.distance)
              .slice(1, topN + 1);
}

// ── Screens ───────────────────────────────────────────────────────────────────
const SplashScreen: React.FC<{ onLoaded: () => void }> = ({ onLoaded }) => {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 1200, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
    (async () => {
      await Promise.all([initEncryptionKey(), setupQuantum(), initTinyLlamaModel()]);
      DBService.init();
      setTimeout(onLoaded, 800);
    })();
  }, []);
  return (
    <LinearGradient colors={[theme.colors.accent, theme.colors.text]} style={styles.splash}>
      <Animated.Text style={[styles.splashText, { opacity: fade }]}>
        🐇 Swamp Rabbit Café & Grocery Tree Oracle
      </Animated.Text>
    </LinearGradient>
  );
};

const FoodScannerScreen: React.FC = () => {
  const { image, pick } = useImagePicker();
  const { run, loading, error } = useAI(PROMPTS.capture);
  const [result, setResult] = useState('');
  const [vec, setVec] = useState<number[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);

  useEffect(() => { loadApiKey().then(k => setApiLoaded(!!k)); }, []);

  const scan = async () => {
    if (!image) return Alert.alert('Select image');
    try {
      const r = await run({ textPrompt: 'Scan for hazards & color vector', imageBase64: image.base64!, imageMime: image.type! });
      const parsed = JSON.parse(r);
      setResult(parsed.summary);
      setVec(parsed.colorVec);
      DBService.insertScan(`Scan:${image.uri}`, parsed.summary, parsed.tagJson, parsed.colorVec);
    } catch (e: any) {
      Alert.alert('Scan error', e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>📷 Food & Plant Scanner</Text>
      <Pressable style={styles.imagePicker} onPress={pick}>
        {image ? <Image source={{ uri: image.uri }} style={styles.image} /> : <Text style={styles.placeholder}>Tap to select</Text>}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={apiLoaded && !loading ? styles.button : styles.buttonDisabled} onPress={scan} disabled={!apiLoaded || loading}>
        <Text style={styles.buttonText}>{loading ? 'Scanning…' : 'Scan Food'}</Text>
        {loading && <ActivityIndicator style={{ marginLeft: 8 }} color={theme.colors.bg} />}
      </Pressable>
      {result && <AIReplyCard content={result} />}
      {vec.length > 0 && <ColorTagStrip jsonTag={JSON.stringify({ palette: [], tagId: '' })} />}
    </ScrollView>
  );
};

const OvenScreen: React.FC = () => {
  const { image, pick } = useImagePicker();
  const cpu = useCpuMonitor();
  const { run: runOven, loading: ovLoad, error: ovErr } = useAI(PROMPTS.ovenAI);
  const { run: runTag, loading: tagLoad } = useAI(PROMPTS.capture);
  const [report, setReport] = useState<any>(null);
  const [colorTag, setColorTag] = useState('');
  const [vec, setVec] = useState<number[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);

  useEffect(() => { loadApiKey().then(k => setApiLoaded(!!k)); }, []);

  const analyze = async () => {
    if (!image) return Alert.alert('Select image');
    try {
      const entropy = await computeCpuEntropy(cpu);
      const ov = await runOven({ imageBase64: image.base64!, imageMime: image.type!, quantum_str: `Entropy:${entropy.toFixed(4)}` });
      const parsedOv = JSON.parse(ov);
      setReport(parsedOv);
      const tagResult = await runTag({ textPrompt: 'Generate secure color tag and vector JSON:', imageBase64: image.base64!, imageMime: image.type! });
      const parsedTag = JSON.parse(tagResult);
      setColorTag(parsedTag.tagJson);
      setVec(parsedTag.colorVec);
      DBService.insertScan(`Img:${image.uri},CPU:${cpu}`, ov, parsedTag.tagJson, parsedTag.colorVec);
    } catch (e: any) {
      Alert.alert('Analyze error', e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>🔥 Quantum Nosonar Oven Scanner</Text>
      <Pressable style={styles.imagePicker} onPress={pick}>
        {image ? <Image source={{ uri: image.uri }} style={styles.image} /> : <Text style={styles.placeholder}>Tap to select</Text>}
      </Pressable>
      <Text style={styles.text}>CPU Usage: {cpu}%</Text>
      {ovErr && <Text style={styles.error}>{ovErr}</Text>}
      <Pressable
        style={apiLoaded && !ovLoad && !tagLoad ? styles.button : styles.buttonDisabled}
        onPress={analyze}
        disabled={!apiLoaded || ovLoad || tagLoad}
      >
        <Text style={styles.buttonText}>{ovLoad || tagLoad ? 'Analyzing…' : 'Analyze & Tag'}</Text>
        {(ovLoad || tagLoad) && <ActivityIndicator style={{ marginLeft: 8 }} color={theme.colors.bg} />}
      </Pressable>
      {report && (
        <View style={styles.card}>
          <Text style={styles.text}>🔥 Dryness Risk: {report.drynessRisk.toUpperCase()}</Text>
          <Text style={styles.text}>🔥 Burning Risk: {report.burningRisk.toUpperCase()}</Text>
          <Text style={styles.text}>🛠️ Mitigation Tips:</Text>
          {report.mitigationTips.map((s: string, i: number) => <Text key={i} style={styles.text}>• {s}</Text>)}
        </View>
      )}
      {colorTag && <ColorTagStrip jsonTag={colorTag} />}
    </ScrollView>
  );
};

const HistoryScreen: React.FC = () => {
  const [scans, setScans] = useState<any[]>([]);
  useEffect(() => { DBService.getScans(setScans); }, []);

  return (
    <FlatList
      contentContainerStyle={styles.body}
      data={scans}
      keyExtractor={item => String(item.id)}
      ListHeaderComponent={<Text style={styles.heading}>📜 Scan History</Text>}
      ListFooterComponent={<View style={{ height: theme.space[4] }} />}
      renderItem={({ item }) => (
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
  const [related, setRelated] = useState<any[]>([]);
  useEffect(() => {
    DBService.getScans(all => { if (all.length > 0) setRelated(findSimilarScans(all[0].colorVec, all, 5)); });
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>🔍 Related Past Scans</Text>
      {related.map((s, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.text}>{new Date(s.timestamp).toLocaleString()} (dist {s.distance.toFixed(2)})</Text>
          <Text style={styles.text}>Prompt: {s.prompt}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const FoodCalendarScreen: React.FC = () => {
  const { run, loading, error } = useAI(PROMPTS.foodCalendar);
  const [plan, setPlan] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);

  useEffect(() => { DBService.getScans(setScans); }, []);

  const generate = async () => {
    try {
      const js = JSON.stringify(scans.slice(0, 10));
      const r = await run({ pastScans: js });
      setPlan(JSON.parse(r));
    } catch (e: any) {
      Alert.alert('Calendar error', e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>📅 AI Food Calendar</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={!loading ? styles.button : styles.buttonDisabled} onPress={generate} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Generating…' : 'Generate Calendar'}</Text>
        {loading && <ActivityIndicator style={{ marginLeft: 8 }} color={theme.colors.bg} />}
      </Pressable>
      {plan && (
        <View style={styles.card}>
          <Text style={styles.label}>Weekly Plan:</Text>
          <Text style={styles.text}>{JSON.stringify(plan.weeklyPlan, null, 2)}</Text>
          <Text style={styles.label}>Monthly Favorites:</Text>
          <Text style={styles.text}>{JSON.stringify(plan.monthlyFavorites, null, 2)}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const OfflineDownloadScreen: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState('');

  const handleDownload = async () => {
    setStatus('downloading');
    const dl = RNFS.downloadFile({
      fromUrl: MODEL_URL,
      toFile: MODEL_PATH,
      begin: () => setProgress(0),
      progress: { count: 1, callback: res => setProgress(res.bytesWritten / (res.contentLength || 1)) },
    });
    try {
      await dl.promise;
      const hash = CryptoJS.SHA256(await RNFS.readFile(MODEL_PATH, 'base64')).toString();
      if (hash !== EXPECTED_HASH) throw new Error('Integrity check failed');
      setStatus('success');
      onSuccess();
    } catch (e: any) {
      setMsg(e.message);
      setStatus('error');
    }
  };

  return (
    <View style={styles.body}>
      <Text style={styles.heading}>🤖 Download Offline Model</Text>
      {status === 'downloading' && <ProgressBarAndroid styleAttr="Horizontal" progress={progress} indeterminate={false} />}
      {(status === 'idle' || status === 'error') && (
        <Pressable style={styles.button} onPress={handleDownload}>
          <Text style={styles.buttonText}>{status === 'error' ? 'Retry Download' : 'Download TinyLlama Model'}</Text>
        </Pressable>
      )}
      {status === 'error' && <Text style={styles.error}>{msg}</Text>}
      {status === 'success' && <Text style={styles.text}>Model downloaded & verified!</Text>}
    </View>
  );
};

const OfflineScreen: React.FC = () => {
  const [modelAvailable, setModelAvailable] = useState(false);
  const { run, loading, error } = useTinyLlama();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');

  useEffect(() => {
    isModelDownloaded().then(ok => { setModelAvailable(ok); if (ok) initTinyLlamaModel(); });
  }, []);

  if (!modelAvailable) {
    return <OfflineDownloadScreen onSuccess={() => setModelAvailable(true)} />;
  }

  const handleRun = async () => {
    try { const r = await run(prompt); setResponse(r); } catch {}
  };

  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>🤖 Offline AI (TinyLlama)</Text>
      <TextInput
        style={styles.input}
        placeholder="Type a prompt..."
        placeholderTextColor={theme.colors.accent}
        value={prompt}
        onChangeText={setPrompt}
      />
      <Pressable style={!loading ? styles.button : styles.buttonDisabled} onPress={handleRun} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Thinking…' : 'Run TinyLlama'}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      {response && <AIReplyCard content={response} />}
    </ScrollView>
  );
};

const SettingsScreen: React.FC = () => {
  const { settings, update } = useContext(SettingsContext);
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>⚙️ Dietary Settings</Text>
      <Text style={styles.label}>Lactose Sensitivity: {settings.lactoseSensitivity}</Text>
      <Slider minimumValue={0} maximumValue={10} step={1} value={settings.lactoseSensitivity}
        onValueChange={v => update({ lactoseSensitivity: v })} style={styles.slider} />
      <Text style={styles.label}>Peanut Allergy:</Text>
      <Switch value={settings.peanutAllergy} onValueChange={v => update({ peanutAllergy: v })} />
      <Text style={styles.label}>Vegan Preference: {settings.veganPreference}</Text>
      <Slider minimumValue={0} maximumValue={10} step={1} value={settings.veganPreference}
        onValueChange={v => update({ veganPreference: v })} style={styles.slider} />
      <Text style={styles.text}>0 = No preference, 10 = Strictly vegan</Text>
    </ScrollView>
  );
};

const ApiKeySetup: React.FC = () => {
  const [key, setKey] = useState('');
  const saveKey = async () => {
    if (!key.startsWith('sk-')) return Alert.alert('Invalid key');
    await saveApiKey(key);
    Alert.alert('API key saved securely');
    setKey('');
  };
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.heading}>🔐 OpenAI API Key</Text>
      <TextInput style={styles.input} placeholder="sk-..." placeholderTextColor={theme.colors.accent}
        value={key} onChangeText={setKey} />
      <Pressable style={styles.button} onPress={saveKey}>
        <Text style={styles.buttonText}>Save Key</Text>
      </Pressable>
    </ScrollView>
  );
};

const AboutScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.body} style={styles.main}>
    <Text style={styles.heading}>ℹ️ About This App</Text>
    <Text style={styles.text}>
      Hi! I’m <Text style={{ fontWeight: '600' }}>Graylan01</Text>, developer behind Swamp Rabbit Café & Grocery Tree Oracle.
      This app blends farm‑to‑table care, quantum computing insights, AI vision, and on‑device TinyLlama.
      Built with: React Native, GPT‑4o Vision, TinyLlama, PennyLane WASM, AES‑GCM, SQLite. A personal passion project for smarter,
      safer cooking—even offline! 🐇💚
    </Text>
  </ScrollView>
);

const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  return (
    <SettingsProvider>
      <NavigationContainer>
        {!ready ? (
          <SplashScreen onLoaded={() => setReady(true)} />
        ) : (
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Icon
                  name={{
                    Scanner: 'camera-outline',
                    Oven: 'flame-outline',
                    History: 'document-text-outline',
                    Similar: 'search-outline',
                    Calendar: 'calendar-outline',
                    Offline: 'download-outline',
                    Setup: 'key-outline',
                    Settings: 'settings-outline',
                    About: 'information-circle-outline',
                  }[route.name]!}
                  size={size}
                  color={color}
                />
              ),
              tabBarStyle: { backgroundColor: theme.colors.card },
              tabBarActiveTintColor: theme.colors.accent,
              tabBarInactiveTintColor: theme.colors.text,
            })}
          >
            <Tab.Screen name="Scanner" component={FoodScannerScreen} />
            <Tab.Screen name="Oven" component={OvenScreen} />
            <Tab.Screen name="History" component={HistoryScreen} />
            <Tab.Screen name="Similar" component={SimilarScansScreen} options={{ title: 'Related' }} />
            <Tab.Screen name="Calendar" component={FoodCalendarScreen} />
            <Tab.Screen name="Offline" component={OfflineScreen} />
            <Tab.Screen name="Setup" component={ApiKeySetup} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
            <Tab.Screen name="About" component={AboutScreen} options={{ title: 'About Me' }} />
          </Tab.Navigator>
        )}
      </NavigationContainer>
    </SettingsProvider>
  );
}
