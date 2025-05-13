// App.tsx — Swamp Rabbit Café & Grocery Tree Oracle
// • GPT-4o Vision • AES-GCM encryption • SQLite storage
// • Inline PennyLane-lite (JS-only, 1–7-qubit simulator)

import React, {
  useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode,
  memo, useMemo, useColorScheme
} from 'react';
import {
  SafeAreaView, View, Text, TextInput, Pressable, ScrollView, FlatList,
  StyleSheet, Animated, Easing, Switch, Alert, useWindowDimensions,
  Image, ActivityIndicator, ProgressBarAndroid, Keyboard, Vibration,
  Platform, UIManager
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

// ─────────────────────────────────────────────────────────────
// 1. PennyLane-lite — inline JS simulator (1–7 qubits)
// ─────────────────────────────────────────────────────────────
export const loadWasm = async () => Promise.resolve();
type C = [number, number];
const add = ([a, b]: C, [c, d]: C): C => [a + c, b + d];
const mul = ([a, b]: C, [c, d]: C): C => [a * c - b * d, a * d + b * c];
const expi = (θ: number): C => [Math.cos(θ), Math.sin(θ)];
const flip = (i: number, bit: number) => i ^ (1 << bit);

export const createDevice = async (
  _name = 'default.qubit',
  { wires = 1 }: { wires?: number } = {}
) => {
  if (wires < 1 || wires > 7) throw new Error('Supports 1–7 qubits');
  const dim = 1 << wires;
  const single = (ψ: C[], t: number, m: C[][]) => {
    for (let i = 0; i < dim; i++) {
      if ((i >> t) & 1) continue;
      const j = flip(i, t), a = ψ[i], b = ψ[j];
      ψ[i] = add(mul(m[0][0], a), mul(m[0][1], b));
      ψ[j] = add(mul(m[1][0], a), mul(m[1][1], b));
    }
  };
  const cnot = (ψ: C[], ctl: number, tgt: number) => {
    for (let i = 0; i < dim; i++) {
      if (((i >> ctl) & 1) && !((i >> tgt) & 1)) {
        const j = flip(i, tgt);
        [ψ[i], ψ[j]] = [ψ[j], ψ[i]];
      }
    }
  };
  return {
    run: async (circ: { gate: string; wires: number[]; angle?: number }[] = []) => {
      const ψ: C[] = Array.from({ length: dim }, (_, k) =>
        k === 0 ? [1, 0] : [0, 0]
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
            single(ψ, w0, [[expi(-θ/2), [0,0]], [[0,0], expi(θ/2)]]);
            break;
          }
          case 'CNOT':
          case 'CX':
            cnot(ψ, w0, w1);
            break;
        }
      }
      return { probs: ψ.map(([re]) => re * re) };
    },
  };
};

// ─────────────────────────────────────────────────────────────
// Constants & Theme
// ─────────────────────────────────────────────────────────────
const SETTINGS_KEY = 'APP_USER_SETTINGS';
const KEY_STORAGE = 'APP_AES_KEY';
const KEY_TIMESTAMP = 'APP_AES_KEY_TIMESTAMP';
const KEY_ROTATION_MS = 30 * 24 * 60 * 60 * 1000;

const theme = {
  colors: {
    bg: '#3E2723', card: '#5D4037', text: '#EFEBE9', accent: '#D7CCC8',
    buttonBg: '#A1887F', inputBg: '#4E342E', disabledBg: '#757575'
  },
  fonts: {
    heading: { fontFamily: 'Georgia', fontSize: 24, fontWeight: '600' },
    body:    { fontFamily: 'System',  fontSize: 16, fontWeight: '400' },
    label:   { fontFamily: 'System',  fontSize: 16, fontWeight: '500' },
    code:    { fontFamily: 'Courier', fontSize: 16, fontWeight: '400' },
  },
  space: [4,8,16,24,32] as const,
  radii: [4,8,16,30]        as const,
} as const;

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
  },
  splashText: {
    ...theme.fonts.heading,
    color: theme.colors.accent,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
    paddingHorizontal: theme.space[2],
  },
  main: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  body: {
    padding: theme.space[2],
    paddingBottom: theme.space[4],
  },
  heading: {
    ...theme.fonts.heading,
    color: theme.colors.accent,
    marginBottom: theme.space[2],
    textAlign: 'center',
    letterSpacing: 1,
  },
  label: {
    ...theme.fonts.label,
    color: theme.colors.text,
    marginBottom: 4,
  },
  text: {
    ...theme.fonts.body,
    color: theme.colors.text,
    lineHeight: 24,
    marginVertical: 4,
  },
  input: {
    ...theme.fonts.code,
    backgroundColor: theme.colors.inputBg,
    color: theme.colors.text,
    borderRadius: theme.radii[1],
    padding: theme.space[2],
    marginVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  slider: {
    width: '100%',
    height: 40,
    marginVertical: theme.space[2],
  },
  imagePicker: {
    backgroundColor: theme.colors.card,
    height: 220,
    borderRadius: theme.radii[2],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.space[3],
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radii[2],
  },
  placeholder: {
    ...theme.fonts.body,
    color: theme.colors.accent,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: theme.colors.buttonBg,
    borderRadius: theme.radii[3],
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    alignItems: 'center',
    marginVertical: theme.space[2],
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabledBg,
    borderRadius: theme.radii[3],
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    alignItems: 'center',
    marginVertical: theme.space[2],
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    ...theme.fonts.label,
    color: theme.colors.bg,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  error: {
    color: '#F44336',
    textAlign: 'center',
    marginVertical: 4,
    fontWeight: '600',
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii[2],
    padding: theme.space[3],
    marginVertical: theme.space[2],
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});

// ─────────────────────────────────────────────────────────────
// 2. AES-GCM Helpers & Key Rotation
// ─────────────────────────────────────────────────────────────
const encryptStatic = (txt: string) => {
  const iv = CryptoJS.lib.WordArray.random(12);
  const enc = CryptoJS.AES.encrypt(txt, CryptoJS.enc.Utf8.parse(Config.ENCRYPTION_SECRET), {
    iv, mode: CryptoJS.mode.GCM
  });
  return JSON.stringify({
    iv: iv.toString(CryptoJS.enc.Hex),
    ct: enc.ciphertext.toString(CryptoJS.enc.Base64),
  });
};
const decryptStatic = (d: string) => {
  try {
    const { iv, ct } = JSON.parse(d);
    const params = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(ct)
    });
    const dec = CryptoJS.AES.decrypt(params, CryptoJS.enc.Utf8.parse(Config.ENCRYPTION_SECRET), {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.GCM
    });
    return dec.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
};

let AES_KEY: string | null = null;
async function initEncryptionKey() {
  const sk = await EncryptedStorage.getItem(KEY_STORAGE);
  const st = await EncryptedStorage.getItem(KEY_TIMESTAMP);
  let last = 0;
  try { last = st ? parseInt(decryptStatic(st), 10) : 0; } catch {}
  const need = !sk || !last || (Date.now() - last) > KEY_ROTATION_MS;
  if (sk && !need) {
    AES_KEY = decryptStatic(sk);
  } else {
    const nk = CryptoJS.lib.WordArray.random(32).toString();
    await EncryptedStorage.setItem(KEY_STORAGE, encryptStatic(nk));
    await EncryptedStorage.setItem(KEY_TIMESTAMP, encryptStatic(String(Date.now())));
    AES_KEY = nk;
  }
}
function encrypt(text: string) {
  if (!AES_KEY) throw new Error('Key missing');
  const iv = CryptoJS.lib.WordArray.random(12);
  const ct = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(AES_KEY), {
    iv, mode: CryptoJS.mode.GCM
  });
  return JSON.stringify({
    iv: iv.toString(CryptoJS.enc.Hex),
    ct: ct.ciphertext.toString(CryptoJS.enc.Base64)
  });
}
function decrypt(data: string) {
  if (!AES_KEY) throw new Error('Key missing');
  try {
    const { iv, ct } = JSON.parse(data);
    const params = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(ct)
    });
    const dec = CryptoJS.AES.decrypt(params, CryptoJS.enc.Utf8.parse(AES_KEY), {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.GCM
    });
    return dec.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
}
const saveApiKey = async (k: string) =>
  await EncryptedStorage.setItem('OPENAI_API_KEY', encrypt(k));
const loadApiKey = async () => {
  const e = await EncryptedStorage.getItem('OPENAI_API_KEY');
  return e ? decrypt(e) : null;
};

// ─────────────────────────────────────────────────────────────
// 3. DBService — Promise + thread-safe enqueue
// ─────────────────────────────────────────────────────────────
class DBService {
  static db!: SQLite.SQLiteDatabase;
  static ready = false;
  static lock: Promise<any> = Promise.resolve();

  /** Initialize and create table */
  static init(): Promise<void> {
    return new Promise((resolve, reject) => {
      DBService.db = SQLite.openDatabase(
        { name: 'swamp_rabbit.db', location: 'default' },
        () => {
          DBService.db.executeSql(
            `CREATE TABLE IF NOT EXISTS scans(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              prompt TEXT, response TEXT,
              colorTag TEXT, colorVec TEXT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );`,
            [],
            () => { DBService.ready = true; resolve(); },
            (_tx, err) => { reject(err); return false; }
          );
        },
        err => reject(err)
      );
    });
  }

  /** Serialize operations */
  static enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = DBService.lock.then(() => fn());
    DBService.lock = next.catch(() => {});
    return next;
  }

  static insertScan(
    prompt: string,
    response: string,
    tag: string,
    vec: number[]
  ) {
    return DBService.enqueue(async () => {
      await new Promise<void>((res, rej) => {
        DBService.db.transaction(
          tx => tx.executeSql(
            'INSERT INTO scans(prompt,response,colorTag,colorVec) VALUES(?,?,?,?);',
            [encrypt(prompt), encrypt(response), encrypt(tag), encrypt(JSON.stringify(vec))],
            () => res(),
            (_tx, err) => { rej(err); return false; }
          ),
          err => rej(err)
        );
      });
    });
  }

  static getScans(cb: (rows: any[]) => void) {
    return DBService.enqueue(async () => {
      await new Promise<void>((res, rej) => {
        DBService.db.transaction(
          tx => tx.executeSql(
            'SELECT * FROM scans ORDER BY timestamp DESC;',
            [],
            (_tx, rs) => {
              const raw = rs.rows.raw();
              cb(raw.map((r: any) => ({
                ...r,
                prompt: decrypt(r.prompt),
                response: decrypt(r.response),
                colorTag: decrypt(r.colorTag),
                colorVec: JSON.parse(decrypt(r.colorVec))
              })));
              res();
            },
            (_tx, err) => { rej(err); return false; }
          ),
          err => rej(err)
        );
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 4. GPT Prompt Library
// ─────────────────────────────────────────────────────────────
const PROMPTS = {
  capture: `
[action] You are the **Swamp Rabbit Visual Scanner AI**, adept at hazard detection, plant/food classification, and interactive emoji feedback. [/action]
[inputs] Image(Base64): {imageBase64} — MIME: {imageMime} — Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference} [/inputs]
[description] Identify object type, estimate surfaceTemp(°C), list hazards with emojis, and summarize in markdown. [/description]
[reply_example]
\`\`\`markdown
**Type:** Grilled Eggplant  
**SurfaceTemp:** ~80°C  
- 🔥 Hot surface hazard  
- 🍆 Plant-based safe  
\`\`\`
[instructions] Output only the markdown block. [/instructions]`,

  ovenAI: `
[action] You are the **Quantum Nosonar Oven Scanner AI**, merging high-resolution image processing, CPU entropy profiling, and hypertime quantum safety analytics. [/action]
[inputs] Image(Base64): {imageBase64} — MIME: {imageMime} — CPU Entropy: {quantum_str} — Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference} [/inputs]
[description] Return JSON with:
- completionPercent (0–100)
- drynessRisk & burningRisk (“Low”/“Med”/“High”)
- mitigationTips (array)
- confidence (0.0–1.0)
[/description]
[reply_example]
\`\`\`json
{
  "completionPercent":82,
  "drynessRisk":"Medium",
  "burningRisk":"Low",
  "mitigationTips":["Reduce temp by 10°C","Cover edges with foil"],
  "confidence":0.95
}
\`\`\`
[instructions] Respond with JSON only. [/instructions]`,

  foodCalendar: `
[action] You are the **Swamp Rabbit AI Food Calendar**, specializing in dynamic meal planning & community trends. [/action]
[pastScans]{pastScans}[/pastScans]
[dietary] Lactose={lactoseSensitivity}, Peanut={peanutAllergy}, Vegan={veganPreference} [/dietary]
[description] Craft:
1. A 7-day meal schedule.
2. Four monthly favorites.
[/description]
[reply_example]
\`\`\`json
{
  "weeklyPlan":{"Mon":"🥗 Quinoa Salad","Tue":"🍲 Tomato Soup",/*…*/},
  "monthlyFavorites":["🥗","🍲","🌮","🍛"]
}
\`\`\`
[instructions] Output valid JSON matching keys. [/instructions]`
};

// ─────────────────────────────────────────────────────────────
// 5. Custom Hooks: useAI, useImagePicker, useCpuMonitor
// ─────────────────────────────────────────────────────────────
function useAI(systemPrompt: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string>();
  const run = useCallback(async (inputs: any) => {
    setLoading(true); setError(undefined);
    try {
      const key = await loadApiKey();
      if (!key) throw new Error('API key missing');
      const messages: any[] = [{ role: 'system', content: systemPrompt }];
      if (inputs.imageBase64 && inputs.imageMime) {
        messages.push({
          role: 'user',
          type: 'image_url',
          image_url: { url: `data:${inputs.imageMime};base64,${inputs.imageBase64}` }
        });
      }
      if (inputs.textPrompt) {
        messages.push({ role: 'user', content: inputs.textPrompt });
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
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [systemPrompt]);
  return { run, loading, error };
}

function useImagePicker() {
  const [image, setImage] = useState<Asset|null>(null);
  const pick = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', includeBase64: true });
    if (res.assets?.[0]) setImage(res.assets[0]);
  };
  return { image, pick };
}

function useCpuMonitor(interval = 5000) {
  const [cpu, setCpu] = useState<number>(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    const fetchCpu = async () => {
      try {
        const load = await DeviceInfo.getSystemCpuLoad();
        if (active) setCpu(Math.round(load * 100));
      } catch {}
    };
    fetchCpu();
    const id = setInterval(fetchCpu, interval);
    return () => { active = false; clearInterval(id); };
  }, [interval]));
  return cpu;
}

// ─────────────────────────────────────────────────────────────
// 6. Settings Context
// ─────────────────────────────────────────────────────────────
interface Settings {
  lactoseSensitivity: number;
  peanutAllergy: boolean;
  veganPreference: number;
}
const SettingsContext = createContext<{
  settings: Settings;
  update: (s: Partial<Settings>) => void;
}>({
  settings: { lactoseSensitivity: 0, peanutAllergy: false, veganPreference: 0 },
  update: () => {}
});
const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>({
    lactoseSensitivity: 0,
    peanutAllergy: false,
    veganPreference: 0
  });
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(val => {
      if (val) setSettings(JSON.parse(val));
    });
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);
  const update = (s: Partial<Settings>) =>
    setSettings(prev => ({ ...prev, ...s }));
  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────
// 7. UI Component: AIReplyCard
// ─────────────────────────────────────────────────────────────
const AIReplyCard: React.FC<{ content: string }> = ({ content }) => {
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - theme.space[3], 600);
  return (
    <View style={[styles.card, { maxWidth: maxW, alignSelf: 'center' }]}>
      <Markdown style={{ body: { color: theme.colors.text, fontSize: 16, lineHeight: 24 } }}>
        {content}
      </Markdown>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// 8. SplashScreen — waits for key, WASM, and DB init
// ─────────────────────────────────────────────────────────────
const SplashScreen: React.FC<{ onLoaded: () => void }> = ({ onLoaded }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();

    (async () => {
      setProgress(10);
      await initEncryptionKey();
      setProgress(30);
      await loadWasm();
      setProgress(60);
      await DBService.init();
      setProgress(90);
      setTimeout(() => {
        setProgress(100);
        onLoaded();
      }, 300);
    })();
  }, [onLoaded]);

  return (
    <SafeAreaView style={styles.splash}>
      <Animated.Text style={[styles.splashText, { opacity: fade }]}>
        🐇 Swamp Rabbit Café & Grocery Tree Oracle
      </Animated.Text>
      <ProgressBarAndroid
        styleAttr="Horizontal"
        indeterminate={false}
        progress={progress / 100}
        color={theme.colors.accent}
        style={{ width: '80%', marginTop: theme.space[3] }}
      />
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────
// 9. Screens: FoodScanner, Oven, History, Related, Calendar, Setup, Settings, About
// ─────────────────────────────────────────────────────────────
const FoodScannerScreen: React.FC = () => {
  const { settings } = useContext(SettingsContext);
  const { image, pick } = useImagePicker();
  const { run, loading, error } = useAI(PROMPTS.capture);
  const [result, setResult] = useState<string>('');

  const doScan = async () => {
    if (!image) return Alert.alert('Select image first');
    try {
      const out = await run({
        imageBase64: image.base64!,
        imageMime: image.type!,
        lactoseSensitivity: settings.lactoseSensitivity,
        peanutAllergy: settings.peanutAllergy,
        veganPreference: settings.veganPreference,
      });
      setResult(out);
      DBService.insertScan('scan', out, 'food', []);
      Clipboard.setString(out);
      Alert.alert('Result copied to clipboard');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.main} contentContainerStyle={styles.body}>
      <Text style={styles.heading}>📷 Food & Plant Scanner</Text>
      <Pressable style={styles.imagePicker} onPress={pick}>
        {image
          ? <Image source={{ uri: image.uri }} style={styles.image} />
          : <Text style={styles.placeholder}>Tap to select</Text>}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={!loading && image ? styles.button : styles.buttonDisabled}
        onPress={doScan}
        disabled={loading || !image}
      >
        <Text style={styles.buttonText}>{loading ? 'Scanning…' : 'Scan Food'}</Text>
        {loading && <ActivityIndicator color={theme.colors.bg} style={{ marginLeft: 8 }} />}
      </Pressable>
      {result && <AIReplyCard content={result} />}
    </ScrollView>
  );
};

const OvenScreen: React.FC = () => {
  const { settings } = useContext(SettingsContext);
  const { image, pick } = useImagePicker();
  const cpu = useCpuMonitor();
  const { run, loading, error } = useAI(PROMPTS.ovenAI);
  const [report, setReport] = useState<any | null>(null);

  const analyze = async () => {
    if (!image) return Alert.alert('Select image first');
    try {
      const entropy = await DeviceInfo.getSystemCpuLoad().then(l => Math.round(l * 100));
      const out = await run({
        imageBase64: image.base64!,
        imageMime: image.type!,
        quantum_str: `Entropy:${entropy}`,
        lactoseSensitivity: settings.lactoseSensitivity,
        peanutAllergy: settings.peanutAllergy,
        veganPreference: settings.veganPreference,
      });
      setReport(JSON.parse(out));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.main} contentContainerStyle={styles.body}>
      <Text style={styles.heading}>🔥 Quantum Nosonar Oven Scanner</Text>
      <Text style={styles.text}>CPU Load: {cpu}%</Text>
      <Pressable style={styles.imagePicker} onPress={pick}>
        {image
          ? <Image source={{ uri: image.uri }} style={styles.image} />
          : <Text style={styles.placeholder}>Tap to select</Text>}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={!loading && image ? styles.button : styles.buttonDisabled}
        onPress={analyze}
        disabled={loading || !image}
      >
        <Text style={styles.buttonText}>{loading ? 'Analyzing…' : 'Analyze Oven'}</Text>
        {loading && <ActivityIndicator color={theme.colors.bg} style={{ marginLeft: 8 }} />}
      </Pressable>
      {report && (
        <View style={styles.card}>
          <Text style={styles.text}>Completion: {report.completionPercent}%</Text>
          <Text style={styles.text}>Dryness Risk: {report.drynessRisk}</Text>
          <Text style={styles.text}>Burning Risk: {report.burningRisk}</Text>
          <Text style={styles.text}>Tips:</Text>
          {report.mitigationTips.map((t: string, i: number) =>
            <Text key={i} style={styles.text}>• {t}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const HistoryScreen: React.FC = () => {
  const [scans, setScans] = useState<any[]>([]);
  useEffect(() => { DBService.getScans(setScans); }, []);
  return (
    <FlatList
      style={styles.main}
      contentContainerStyle={styles.body}
      data={scans}
      keyExtractor={i => String(i.id)}
      ListHeaderComponent={<Text style={styles.heading}>📜 Scan History</Text>}
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

const RelatedScreen: React.FC = () => {
  const [related, setRelated] = useState<any[]>([]);
  useEffect(() => {
    DBService.getScans(all => {
      if (all.length > 1) {
        const target = all[0].colorVec;
        const dist = (a: number[], b: number[]) => {
          let sum = 0;
          for (let i = 0; i < Math.min(a.length, b.length); i++) {
            sum += (a[i] - b[i]) ** 2;
          }
          return Math.sqrt(sum);
        };
        const sims = all
          .map(s => ({ ...s, d: dist(s.colorVec, target) }))
          .sort((a, b) => a.d - b.d)
          .slice(1, 6);
        setRelated(sims);
      }
    });
  }, []);
  return (
    <ScrollView style={styles.main} contentContainerStyle={styles.body}>
      <Text style={styles.heading}>🔍 Related Scans</Text>
      {related.map((s, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.text}>
            {new Date(s.timestamp).toLocaleString()} (dist {s.d.toFixed(2)})
          </Text>
          <Text style={styles.text}>{s.response}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const CalendarScreen: React.FC = () => {
  const { settings } = useContext(SettingsContext);
  const [scans, setScans] = useState<any[]>([]);
  const { run, loading, error } = useAI(PROMPTS.foodCalendar);
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => { DBService.getScans(setScans); }, []);
  const gen = async () => {
    try {
      const json = JSON.stringify(scans.slice(0, 10));
      const out = await run({
        pastScans: json,
        lactoseSensitivity: settings.lactoseSensitivity,
        peanutAllergy: settings.peanutAllergy,
        veganPreference: settings.veganPreference,
      });
      setPlan(JSON.parse(out));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.main} contentContainerStyle={styles.body}>
      <Text style={styles.heading}>📅 AI Food Calendar</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={!loading ? styles.button : styles.buttonDisabled}
        onPress={gen}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Generating…' : 'Generate Calendar'}</Text>
        {loading && <ActivityIndicator color={theme.colors.bg} style={{ marginLeft: 8 }} />}
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

const ApiKeySetupScreen: React.FC = () => {
  const [key, setKey] = useState('');
  const saveKey = async () => {
    if (!key.startsWith('sk-')) return Alert.alert('Invalid key');
    await saveApiKey(key);
    Alert.alert('Key saved securely');
    setKey('');
  };
  return (
    <ScrollView style={styles.main} contentContainerStyle={styles.body}>
      <Text style={styles.heading}>🔐 OpenAI API Key</Text>
      <TextInput
        style={styles.input}
        placeholder="sk-..."
        placeholderTextColor={theme.colors.accent}
        value={key}
        onChangeText={setKey}
        autoCapitalize="none"
      />
      <Pressable style={styles.button} onPress={saveKey}>
        <Text style={styles.buttonText}>Save Key</Text>
      </Pressable>
    </ScrollView>
  );
};

const SettingsScreen: React.FC = () => {
  const { settings, update } = useContext(SettingsContext);
  return (
    <ScrollView style={styles.main} contentContainerStyle={styles.body}>
      <Text style={styles.heading}>⚙️ Dietary Settings</Text>
      <Text style={styles.label}>Lactose Sensitivity: {settings.lactoseSensitivity}</Text>
      <Slider
        minimumValue={0}
        maximumValue={10}
        step={1}
        value={settings.lactoseSensitivity}
        onValueChange={v => update({ lactoseSensitivity: v })}
        style={styles.slider}
      />
      <Text style={styles.label}>Peanut Allergy:</Text>
      <Switch
        value={settings.peanutAllergy}
        onValueChange={v => update({ peanutAllergy: v })}
      />
      <Text style={styles.label}>Vegan Preference: {settings.veganPreference}</Text>
      <Slider
        minimumValue={0}
        maximumValue={10}
        step={1}
        value={settings.veganPreference}
        onValueChange={v => update({ veganPreference: v })}
        style={styles.slider}
      />
      <Text style={styles.text}>0 = None, 10 = Strict</Text>
    </ScrollView>
  );
};

const AboutScreen: React.FC = () => (
  <ScrollView style={styles.main} contentContainerStyle={styles.body}>
    <Text style={styles.heading}>ℹ️ About</Text>
    <Text style={styles.text}>
      Built by Graylan01, Swamp Rabbit Café & Grocery Tree Oracle merges GPT‑4o Vision,
      on‑device encryption, SQLite, and a JS quantum simulator in a polished React Native UI.
    </Text>
  </ScrollView>
);

// ─────────────────────────────────────────────────────────────
// Navigation & App Entry
// ─────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);

  if (!ready) {
    return <SplashScreen onLoaded={() => setReady(true)} />;
  }

  return (
    <SettingsProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ color, size }) => {
              const icons: any = {
                Scanner: 'scan-outline',
                Oven: 'flame-outline',
                History: 'time-outline',
                Related: 'search-outline',
                Calendar: 'calendar-outline',
                Setup: 'key-outline',
                Settings: 'settings-outline',
                About: 'information-circle-outline'
              };
              return <Icon name={icons[route.name]} size={size} color={color} />;
            },
            tabBarStyle: { backgroundColor: theme.colors.card },
            tabBarActiveTintColor: theme.colors.accent,
            tabBarInactiveTintColor: theme.colors.text,
          })}
        >
          <Tab.Screen name="Scanner" component={FoodScannerScreen} />
          <Tab.Screen name="Oven"     component={OvenScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Related" component={RelatedScreen} />
          <Tab.Screen name="Calendar" component={CalendarScreen} />
          <Tab.Screen name="Setup"    component={ApiKeySetupScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
          <Tab.Screen name="About"    component={AboutScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SettingsProvider>
  );
}
