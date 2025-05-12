# 🐇 Swamp Rabbit Café & Grocery Tree Oracle

(\_/)
    ( •_•)  “Sir Hops‑A‑Lot III”
    / >🌱   “Hopping between qubits & quinoa since 2025”

> _“The only app that can scan your salad, simulate a 7‑qubit circuit, and encrypt your grocery list—all before your espresso cools.”_

---

## 🌾 Overview

**Swamp Rabbit** is a privacy‑first React Native companion that blends:
- **GPT‑4o Vision** food & plant scanning  
- **CPU‑entropy quantum** oven analysis  
- **AES‑GCM‑encrypted SQLite** for your scan history  
- **PennyLane‑lite** 1–7‑qubit playground for whimsical demos  

Once you’ve entered your OpenAI key, most features run offline—no internet, no problem.

---

## ✨ Key Features

| Tab        | What It Does                                           |
|------------|--------------------------------------------------------|
| 📷 Scanner   | Snap food or plants → get markdown hazards & tips       |
| 🔥 Oven      | Photograph your dish + CPU load → doneness %, risks     |
| 📜 History   | Browse past scans with encrypted prompts & replies      |
| 🔍 Related   | Find visually & semantically similar past scans         |
| 📅 Calendar  | Auto‑generate a 7‑day meal plan + monthly favourites    |
| 🔐 Setup     | Securely store your OpenAI API key with AES‑GCM         |
| ⚙️ Settings  | Tweak lactose, peanut & vegan dietary flags             |
| 💡 Quantum   | Play with a 1–7‑qubit simulator—collapse some waveforms! |

---

## 🚀 Installation

1. **Clone repository**  
   ```bash
   git clone https://github.com/your‑org/swamp‑rabbit‑oracle.git
   cd swamp‑rabbit‑oracle

2. Install dependencies

yarn install
# iOS only:
npx pod‑install


3. Create .env

ENCRYPTION_SECRET="YOUR_32_BYTE_HEX_SECRET"


4. Run

yarn android   # Android
yarn ios       # iOS


5. Enter API Key

Tap the “🔐 OpenAI API Key” tab

Paste your key (must start with sk-)





---

📖 Usage

1. Food & Plant Scan

Open Scanner, tap to select or snap a photo.

Receive hazards, classifications & safety tips in markdown.



2. Oven Analysis

Switch to Oven, snap a pic, then tap Analyze Oven.

See completion%, dryness/burning risk & mitigation tips.



3. History & Related

History shows your last 100 scans (encrypted).

Related finds the 5 most similar color‑vector scans.



4. Meal Calendar

Open Calendar, tap Generate Calendar.

Get a JSON weekly plan & monthly community favourites.



5. Settings & About

Adjust dietary sliders under Settings.

Read about the project and mascot in About.





---

🛠 Troubleshooting

Splash screen never disappears

Check .env has ENCRYPTION_SECRET

Verify native modules:

npx pod‑install       # iOS
cd android && ./gradlew clean build  # Android


Red box: NativeEncryptedStorage is null

Rebuild the app, ensure react-native-encrypted-storage linked.


API errors

Confirm your OpenAI key is valid & has credit.

Check network permissions.




---

❓ FAQ

Q: Why include a quantum simulator?
A: Because collapsing wave‑functions is almost as satisfying as nailing sous‑vide eggs.

Q: Does it work offline?
A: After your first scan & key setup, history & quantum demos run offline. Scanning/analysis needs the API.

Q: Can I export my data?
A: CSV export & cloud sync are planned for v2.0 (coming soon!).


---

🤝 Contributing

1. Fork → 🍴


2. Branch (git checkout -b feat/my‑feature)


3. Commit (git commit -m "feat: add kale scanner")


4. Push & PR → 🚀


5. High‑five from Sir Hops‑A‑Lot III 🐇



Please follow our CONTRIBUTING.md for details.


---

📄 License

MIT © Graylan Janulis


---

> Stay crunchy, stay coherent. 🥕🐇





