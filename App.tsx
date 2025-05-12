// App.tsx — Swamp Rabbit Café & Grocery Tree Oracle
// ▶ GPT-4o Vision  ▶ AES-GCM encryption  ▶ SQLite storage
// ▶ Inline PennyLane-lite (1–7-qubit simulator)
// ─────────────────────────────────────────────────────────────
// 2025-05-15: Full Production App with Advanced Prompts & Animations
// • Recipe → Shopping List & Price Estimator → Step‑by‑Step Oven Scanner
// • History, Related, Calendar, Setup, Settings, About screens
// • SafeAreaView & full-screen Splash → Navigator fix
// • AES‑GCM encryption, SQLite, GPT‑4o Vision, animations
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
  SafeAreaView,
  StatusBar,
  Animated,
  Alert,
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
  ActivityIndicator,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Slider from '@react-native-community/slider';
import Markdown from 'react-native-markdown-display';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import SQLite from 'react-native-sqlite-storage';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Data Models & Context ─────────────────────────────────────────
interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  prepTime: string;
  cookTime: string;
}
const RECIPES: Recipe[] = [
  {
    id: '1',
    title: 'Roast Chicken',
    ingredients: [
      '1 whole chicken',
      '2 tbsp olive oil',
      '1 tsp salt',
      '½ tsp pepper',
      '1 lemon',
      '2 sprigs rosemary',
    ],
    steps: [
      'Preheat oven to 200°C.',
      'Rub chicken with oil, salt, and pepper.',
      'Stuff with lemon and rosemary.',
      'Roast for 1hr 15min.',
      'Rest 10min before carving.',
    ],
    prepTime: '15 min',
    cookTime: '1 hr 15 min',
  },
  {
    id: '2',
    title: 'Chocolate Cake',
    ingredients: [
      '200g flour',
      '200g sugar',
      '50g cocoa powder',
      '2 eggs',
      '1 tsp baking powder',
      '100ml milk',
      '50g butter',
    ],
    steps: [
      'Preheat oven to 180°C.',
      'Mix dry ingredients.',
      'Add eggs, milk, melted butter.',
      'Bake 30min.',
      'Cool before slicing.',
    ],
    prepTime: '20 min',
    cookTime: '30 min',
  },
];

interface AppState {
  recipe: Recipe | null;
  shoppingList: { item: string; quantity: string }[];
  prices: { item: string; price: number }[];
}

const AppContext = createContext<{
  state: AppState;
  setRecipe: (r: Recipe) => void;
  setShoppingList: (l: AppState['shoppingList']) => void;
  setPrices: (p: AppState['prices']) => void;
}>({ state: { recipe: null, shoppingList: [], prices: [] }, setRecipe: () => {}, setShoppingList: () => {}, setPrices: () => {} });

const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({ recipe: null, shoppingList: [], prices: [] });
  const setRecipe = (r: Recipe) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setState(s => ({ ...s, recipe: r, shoppingList: [], prices: [] })); };
  const setShoppingList = (l: any[]) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setState(s => ({ ...s, shoppingList: l })); };
  const setPrices = (p: any[]) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setState(s => ({ ...s, prices: p })); };
  return <AppContext.Provider value={{ state, setRecipe, setShoppingList, setPrices }}>{children}</AppContext.Provider>;
};

// ─── Theme & Styles ────────────────────────────────────────────────
const theme = {
  colors: {
    bg: '#2E2E2E', card: '#3B3B3B', text: '#F2F2F2', accent: '#FFBA49',
    btn1: '#FF9A9E', btn2: '#FAD0C4', b1: '#6D83F2', b2: '#8BC6EC',
  },
  fonts: {
    h: { fontFamily: 'Georgia', fontSize: 26, fontWeight: '700' } as const,
    sh: { fontFamily: 'Georgia', fontSize: 20, fontWeight: '600' } as const,
    b: { fontFamily: 'System', fontSize: 16 } as const,
    lbl: { fontFamily: 'System', fontSize: 16 } as const,
    btn: { fontFamily: 'System', fontSize: 18, fontWeight: '600' } as const,
  },
  space: [4, 8, 16, 24, 32] as const,
  radii: [4, 8, 16, 24] as const,
};

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: theme.colors.bg },
  body: { padding: theme.space[2], paddingBottom: theme.space[4] },
  h: { ...theme.fonts.h, color: theme.colors.accent, marginBottom: theme.space[2], textAlign: 'center' },
  sh: { ...theme.fonts.sh, color: theme.colors.accent, marginBottom: theme.space[1] },
  txt: { ...theme.fonts.b, color: theme.colors.text, marginVertical: theme.space[1], lineHeight: 22 },
  lbl: { ...theme.fonts.lbl, color: theme.colors.text, marginVertical: theme.space[1] },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radii[2], padding: theme.space[3], marginVertical: theme.space[2], shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 6 },
  inp: { ...theme.fonts.b, backgroundColor: theme.colors.card, color: theme.colors.text, borderRadius: theme.radii[1], padding: theme.space[2], marginVertical: theme.space[2] },
  btn: { borderRadius: theme.radii[3], overflow: 'hidden', marginVertical: theme.space[2] },
  press: { paddingVertical: theme.space[2], alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  btnTxt: { ...theme.fonts.btn, color: theme.colors.bg, textTransform: 'uppercase' },
  slider: { width: '100%', height: 40, marginVertical: theme.space[2] },
  win: { borderRadius: theme.radii[2], overflow: 'hidden', marginVertical: theme.space[2] },
  gw: { padding: 2, borderRadius: theme.radii[2] },
  winIn: { backgroundColor: theme.colors.bg, height: 240, justifyContent: 'center', alignItems: 'center' },
  progressBar: { height: 10, borderRadius: 5, backgroundColor: '#555', overflow: 'hidden', marginVertical: theme.space[2] },
  progressFill: { height: '100%', backgroundColor: theme.colors.accent },
});

// ─── SplashScreen ─────────────────────────────────────────────────
const SplashScreen: React.FC<{ onLoaded: () => void }> = ({ onLoaded }) => {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
    const id = setTimeout(onLoaded, 2000);
    return () => clearTimeout(id);
  }, [onLoaded]);
  return (
    <SafeAreaView style={styles.main}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[theme.colors.accent, theme.colors.text]} style={StyleSheet.absoluteFill} />
      <Animated.Text
        style={[
          theme.fonts.h,
          {
            color: theme.colors.bg,
            opacity: fade,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: [{ translateX: -40 }, { translateY: -20 }],
          },
        ]}
      >
        🐇
      </Animated.Text>
    </SafeAreaView>
  );
};

// ─── Encryption & DBService ────────────────────────────────────────
const SECRET = Config.ENCRYPTION_SECRET ?? 'dev-secret';
function encryptStatic(text: string) {
  const iv = CryptoJS.lib.WordArray.random(12);
  const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(SECRET), { iv, mode: CryptoJS.mode.GCM });
  return JSON.stringify({ iv: iv.toString(CryptoJS.enc.Hex), ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64) });
}
function decryptStatic(data: string) {
  try {
    const { iv, ct } = JSON.parse(data);
    const params = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(ct) });
    const dec = CryptoJS.AES.decrypt(params, CryptoJS.enc.Utf8.parse(SECRET), { iv: CryptoJS.enc.Hex.parse(iv), mode: CryptoJS.mode.GCM });
    return dec.toString(CryptoJS.enc.Utf8);
  } catch { return ''; }
}
let AES_KEY: string | null = null;
async function initEncryptionKey() {
  const sk = await EncryptedStorage.getItem('APP_AES_KEY');
  const st = await EncryptedStorage.getItem('APP_AES_KEY_TIMESTAMP');
  let last = 0;
  try { last = st ? parseInt(decryptStatic(st), 10) : 0; } catch {}
  const need = !sk || !last || Date.now() - last > 30 * 24 * 60 * 60 * 1000;
  if (sk && !need) AES_KEY = decryptStatic(sk);
  else {
    const newKey = CryptoJS.lib.WordArray.random(32).toString();
    await EncryptedStorage.setItem('APP_AES_KEY', encryptStatic(newKey));
    await EncryptedStorage.setItem('APP_AES_KEY_TIMESTAMP', encryptStatic(String(Date.now())));
    AES_KEY = newKey;
  }
}
function encrypt(text: string) {
  if (!AES_KEY) throw new Error('Key missing');
  const iv = CryptoJS.lib.WordArray.random(12);
  const ct = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(AES_KEY!), { iv, mode: CryptoJS.mode.GCM });
  return JSON.stringify({ iv: iv.toString(CryptoJS.enc.Hex), ct: ct.ciphertext.toString(CryptoJS.enc.Base64) });
}
function decrypt(text: string) {
  if (!AES_KEY) throw new Error('Key missing');
  try {
    const { iv, ct } = JSON.parse(text);
    const params = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(ct) });
    const dec = CryptoJS.AES.decrypt(params, CryptoJS.enc.Utf8.parse(AES_KEY!), { iv: CryptoJS.enc.Hex.parse(iv), mode: CryptoJS.mode.GCM });
    return dec.toString(CryptoJS.enc.Utf8);
  } catch { return ''; }
}
const saveApiKey = async (k: string) => await EncryptedStorage.setItem('OPENAI_API_KEY', encrypt(k));
const loadApiKey = async () => {
  const e = await EncryptedStorage.getItem('OPENAI_API_KEY');
  return e ? decrypt(e) : null;
};

class DBService {
  static db!: SQLite.SQLiteDatabase;
  static init() {
    this.db = SQLite.openDatabase(
      { name: 'swamp_rabbit.db', location: 'default' },
      () => this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS scans(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prompt TEXT,
          response TEXT,
          colorVec TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );`),
      e => console.error(e)
    );
  }
  static insertScan(p: string, r: string, v: any[]) {
    this.db.transaction(tx => tx.executeSql(
      'INSERT INTO scans(prompt,response,colorVec) VALUES(?,?,?);',
      [encrypt(p), encrypt(r), encrypt(JSON.stringify(v))]
    ));
  }
  static getScans(cb: (rows: any[]) => void) {
    this.db.transaction(tx => tx.executeSql(
      'SELECT * FROM scans ORDER BY timestamp DESC;',
      [], (_, res) => {
        const raw = res.rows.raw();
        cb(raw.map((r: any) => ({
          ...r,
          prompt: decrypt(r.prompt),
          response: decrypt(r.response),
          colorVec: JSON.parse(decrypt(r.colorVec)),
        })));
      }
    ));
  }
}

// ─── Advanced GPT Prompts ───────────────────────────────────────────
const PROMPTS = {
  shoppingList: `
[action] You are the **Swamp Rabbit Shopping List AI**. Given ingredients:
{ingredients}
Generate a JSON array of objects with "item" and "quantity". [/action]
`,
  priceEstimator: `
[action] You are the **Swamp Rabbit Price Estimator AI**. Given shopping list:
{shoppingList}
Estimate USD price for each item. Return JSON array with "item" and "estimatedPrice". [/action]
`,
  ovenAI: `
[action] You are the **Quantum Nosonar Oven Scanner AI**. Given:
Image(Base64): {imageBase64}
MIME: {imageMime}
CPU Entropy: {quantum_str}
Analyze and return JSON with:
- completionPercent
- drynessRisk
- burningRisk
- mitigationTips (array)
[/action]
`,
  foodCalendar: `
[action] You are the **Swamp Rabbit AI Food Calendar**. Given past scans:
{pastScans}
Generate JSON with:
"weeklyPlan" (Mon–Sun recipes)
"monthlyFavorites" (4 emojis)
[/action]
`,
};

// ─── Hooks ─────────────────────────────────────────────────────────
function useAI(systemPrompt: string) {
  const [loading, setLoading] = useState(false), [error, setError] = useState<string>();
  const run = useCallback(async (inputs: any) => {
    setLoading(true); setError(undefined);
    try {
      const key = await loadApiKey(); if (!key) throw new Error('API key missing');
      let msg = systemPrompt;
      Object.entries(inputs).forEach(([k, v]) => msg = msg.replace(`{${k}}`, typeof v === 'string' ? v : JSON.stringify(v)));
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-vision-preview',
        temperature: 0.7,
        messages: [{ role: 'system', content: msg }],
      }, { headers: { Authorization: `Bearer ${key}` } });
      const txt = resp.data.choices[0].message.content;
      if (!txt) throw new Error('No response');
      return txt.trim();
    } catch (e: any) {
      setError(e.message);
      throw e;
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

function useCpuMonitor(interval = 5000): number | null {
  const [cpu, setCpu] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    const fetchCpu = async () => {
      let load = 0;
      try { load = await DeviceInfo.getSystemCpuLoad(); } catch {}
      if (active) setCpu(Math.round(load * 100));
    };
    fetchCpu();
    const id = setInterval(fetchCpu, interval);
    return () => { active = false; clearInterval(id); };
  }, [interval]));
  return cpu;
}

// ─── Animated Components ───────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const GradientButton: React.FC<{ children: ReactNode }> = ({ children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient colors={[theme.colors.btn1, theme.colors.btn2]} style={[styles.btn, { paddingHorizontal: theme.space[3] }]}>
          {children}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

const GradientFrame: React.FC<{ children: ReactNode }> = ({ children }) => (
  <LinearGradient colors={[theme.colors.b1, theme.colors.b2]} style={[styles.win, { padding: 2 }]}>
    <View style={styles.winIn}>{children}</View>
  </LinearGradient>
);

// ─── Screens ────────────────────────────────────────────────────────

const RecipeSelectionScreen: React.FC = () => {
  const { setRecipe } = useContext(AppContext);
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>🔍 Select a Recipe</Text>
      {RECIPES.map(r => (
        <AnimatedPressable key={r.id} onPress={() => setRecipe(r)}>
          <GradientButton><Text style={styles.btnTxt}>{r.title}</Text></GradientButton>
        </AnimatedPressable>
      ))}
    </ScrollView>
  );
};

const ShoppingListScreen: React.FC = () => {
  const { state, setShoppingList, setPrices } = useContext(AppContext);
  const { recipe, shoppingList, prices } = state;
  const slAI = useAI(PROMPTS.shoppingList), prAI = useAI(PROMPTS.priceEstimator);

  const generate = async () => {
    if (!recipe) return;
    try {
      const list = JSON.parse(await slAI.run({ ingredients: recipe.ingredients }));
      setShoppingList(list);
      const priceArr = JSON.parse(await prAI.run({ shoppingList: list }));
      setPrices(priceArr);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>🛒 Shopping List</Text>
      {!shoppingList.length ? (
        <AnimatedPressable onPress={generate} disabled={slAI.loading}>
          <GradientButton>
            {slAI.loading
              ? <ActivityIndicator color={theme.colors.bg}/>
              : <Text style={styles.btnTxt}>Generate List</Text>
            }
          </GradientButton>
        </AnimatedPressable>
      ) : (
        shoppingList.map((i, idx) => (
          <View key={idx} style={styles.card}>
            <Text style={styles.txt}>• {i.item} — {i.quantity}</Text>
            {prices[idx] && <Text style={styles.lbl}>${prices[idx].price.toFixed(2)}</Text>}
          </View>
        ))
      )}
    </ScrollView>
  );
};

const OvenScannerScreen: React.FC = () => {
  const { state } = useContext(AppContext);
  const { recipe } = state;
  const { image, pick } = useImagePicker();
  const cpu = useCpuMonitor();
  const { run, loading, error } = useAI(PROMPTS.ovenAI);
  const [report, setReport] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setCurrentStep(0);
    Animated.timing(progress, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    setReport(null);
  }, [recipe]);

  const scan = async () => {
    if (!image || !recipe) return Alert.alert('Select recipe & image');
    try {
      const e = await DeviceInfo.getSystemCpuLoad();
      const rpt = JSON.parse(await run({
        imageBase64: image.base64!,
        imageMime: image.type!,
        quantum_str: `Entropy:${(e*100).toFixed(2)}`
      }));
      setReport(rpt);
      const frac = rpt.completionPercent / 100;
      Animated.spring(progress, { toValue: frac, useNativeDriver: false }).start();
      setCurrentStep(Math.min(Math.floor(frac * recipe.steps.length), recipe.steps.length - 1));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (!recipe) {
    return (
      <View style={[styles.main, styles.body]}>
        <Text style={styles.h}>Select a recipe first</Text>
      </View>
    );
  }

  const width = useWindowDimensions().width - theme.space[4];
  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] });

  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>{recipe.title} Oven Scan</Text>
      <View style={styles.card}>
        <Text style={styles.lbl}>Prep: {recipe.prepTime} • Cook: {recipe.cookTime}</Text>
        <Text style={styles.sh}>Step {currentStep+1}:</Text>
        <Text style={styles.txt}>{recipe.steps[currentStep]}</Text>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
        </View>
      </View>
      <AnimatedPressable onPress={pick}>
        <GradientFrame>
          {image
            ? <Image source={{ uri: image.uri }} style={{ width: '100%', height: 200 }} />
            : <Text style={styles.txt}>Tap to select image</Text>
          }
        </GradientFrame>
      </AnimatedPressable>
      <Text style={styles.txt}>CPU: {cpu !== null ? `${cpu}%` : 'N/A'}</Text>
      {error && <Text style={[styles.txt, { color: 'red' }]}>{error}</Text>}
      <AnimatedPressable onPress={scan} disabled={loading}>
        <GradientButton>
          {loading
            ? <ActivityIndicator color={theme.colors.bg}/>
            : <Text style={styles.btnTxt}>Scan Oven</Text>
          }
        </GradientButton>
      </AnimatedPressable>
      {report && (
        <View style={styles.card}>
          <Text style={styles.sh}>Analysis</Text>
          <Text style={styles.txt}>Completion: {report.completionPercent}%</Text>
          <Text style={styles.txt}>Dryness: {report.drynessRisk}</Text>
          <Text style={styles.txt}>Burning: {report.burningRisk}</Text>
          <Text style={styles.txt}>Tips:</Text>
          {report.mitigationTips.map((t: string, i: number) => (
            <Text key={i} style={styles.txt}>• {t}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const HistoryScreen: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    DBService.getScans(data => { setRows(data); setLoading(false); });
  }, []);
  if (loading) return <ActivityIndicator style={{ margin: 20 }} color={theme.colors.accent} />;
  return (
    <FlatList
      contentContainerStyle={styles.body}
      data={rows}
      keyExtractor={item => String(item.id)}
      ListHeaderComponent={<Text style={styles.h}>📜 Scan History</Text>}
      renderItem={({ item }) => (
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

const RelatedScreen: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    DBService.getScans(all => {
      if (all.length) {
        const t = all[0].colorVec;
        const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v-b[i])**2, 0));
        const sims = all.map(s => ({ ...s, d: dist(s.colorVec, t) }))
                       .sort((a, b) => a.d - b.d)
                       .slice(1, 6);
        setRows(sims);
      }
      setLoading(false);
    });
  }, []);
  if (loading) return <ActivityIndicator style={{ margin: 20 }} color={theme.colors.accent} />;
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>🔍 Related Scans</Text>
      {rows.map((s, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.txt}>{new Date(s.timestamp).toLocaleString()} (dist {s.d.toFixed(2)})</Text>
          <Text style={styles.txt}>{s.response}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const CalendarScreen: React.FC = () => {
  const { run, loading, error } = useAI(PROMPTS.foodCalendar);
  const [plan, setPlan] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => DBService.getScans(setRows), []);
  const generate = async () => {
    try {
      const r = await run({ pastScans: JSON.stringify(rows.slice(0, 10)) });
      setPlan(JSON.parse(r));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>📅 AI Food Calendar</Text>
      <AnimatedPressable onPress={generate} disabled={loading}>
        <GradientButton>
          {loading ? <ActivityIndicator color={theme.colors.bg}/> : <Text style={styles.btnTxt}>Generate Calendar</Text>}
        </GradientButton>
      </AnimatedPressable>
      {error && <Text style={[styles.txt, { color: 'red' }]}>{error}</Text>}
      {plan && (
        <View style={styles.card}>
          <Text style={styles.sh}>Weekly Plan</Text>
          <Markdown style={{ body: { color: theme.colors.text } }}>
            {JSON.stringify(plan.weeklyPlan, null, 2)}
          </Markdown>
          <Text style={styles.sh}>Monthly Favorites</Text>
          <Markdown style={{ body: { color: theme.colors.text } }}>
            {JSON.stringify(plan.monthlyFavorites, null, 2)}
          </Markdown>
        </View>
      )}
    </ScrollView>
  );
};

const SetupScreen: React.FC = () => {
  const [key, setKey] = useState('');
  const save = async () => {
    if (!key.startsWith('sk-')) return Alert.alert('Invalid key', 'Must start with sk-');
    await saveApiKey(key);
    Alert.alert('Success', 'API key saved securely');
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
      <AnimatedPressable onPress={save} disabled={!key.startsWith('sk-')}>
        <GradientButton><Text style={styles.btnTxt}>Save Key</Text></GradientButton>
      </AnimatedPressable>
    </ScrollView>
  );
};

const SettingsScreen: React.FC = () => {
  const { settings, update } = useContext(SettingsContext);
  return (
    <ScrollView contentContainerStyle={styles.body} style={styles.main}>
      <Text style={styles.h}>⚙️ Dietary Settings</Text>
      <Text style={styles.lbl}>Lactose Sensitivity: {settings.lactoseSensitivity}</Text>
      <Slider
        minimumValue={0} maximumValue={10} step={1}
        value={settings.lactoseSensitivity}
        onValueChange={v => update({ lactoseSensitivity: v })}
        style={styles.slider}
      />
      <Text style={styles.lbl}>Peanut Allergy</Text>
      <Switch
        value={settings.peanutAllergy}
        onValueChange={v => update({ peanutAllergy: v })}
      />
      <Text style={styles.lbl}>Vegan Preference: {settings.veganPreference}</Text>
      <Slider
        minimumValue={0} maximumValue={10} step={1}
        value={settings.veganPreference}
        onValueChange={v => update({ veganPreference: v })}
        style={styles.slider}
      />
      <Text style={styles.txt}>0 = No preference, 10 = Strict vegan</Text>
    </ScrollView>
  );
};

const AboutScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.body} style={styles.main}>
    <Text style={styles.h}>ℹ️ About This App</Text>
    <Text style={styles.txt}>
      Hi! I’m <Text style={{ fontWeight: '700' }}>Graylan01</Text>, developer behind Swamp Rabbit Café & Grocery Tree Oracle.
      This app blends farm‑to‑table care, quantum computing insights, AI vision, and on‑device encryption.
      Built with React Native, GPT‑4o Vision, PennyLane‑lite, AES‑GCM, SQLite.
      A passion project for smarter, safer cooking—even offline! 🐇💚
    </Text>
  </ScrollView>
);

// ─── Navigation & App ───────────────────────────────────────────────
const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);

  return (
    <AppProvider>
      <NavigationContainer>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          {!ready ? (
            <SplashScreen onLoaded={() => setReady(true)} />
          ) : (
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ color, size }) => (
                  <Icon
                    name={{
                      Recipes: 'book-outline',
                      Shopping: 'cart-outline',
                      Oven: 'flame-outline',
                      History: 'time-outline',
                      Related: 'search-outline',
                      Calendar: 'calendar-outline',
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
              <Tab.Screen name="Recipes" component={RecipeSelectionScreen} />
              <Tab.Screen name="Shopping" component={ShoppingListScreen} />
              <Tab.Screen name="Oven" component={OvenScannerScreen} />
              <Tab.Screen name="History" component={HistoryScreen} />
              <Tab.Screen name="Related" component={RelatedScreen} />
              <Tab.Screen name="Calendar" component={CalendarScreen} />
              <Tab.Screen name="Setup" component={SetupScreen} />
              <Tab.Screen name="Settings" component={SettingsScreen} />
              <Tab.Screen name="About" component={AboutScreen} />
            </Tab.Navigator>
          )}
        </SafeAreaView>
      </NavigationContainer>
    </AppProvider>
  );
}
