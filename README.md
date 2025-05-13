

# 🐇 Swamp Rabbit Café & Grocery (Unoffical Quantum Intel) Tree Oracle

     (\_/)
    ( •_•)  “Sir Hops‑A‑Lot III”
    / >🌱   “Hopping between qubits & quinoa since 2025”




# How a Pasta Salad at Swamp Rabbit Café Inspired Me to Build an App

By Graylan01


---
# The Story 

I was sitting at Swamp Rabbit Café, eating the best dang pasta salad I’ve had in years. Somewhere between the tangy dressing and the perfect al dente noodles, a weird thought popped into my head:

“What if an app could scan my food, keep track of what I eat, and even help me plan meals… securely?”

So I built one.

It’s called Swamp Rabbit Café & Grocery Tree Oracle — a big name for a simple idea:
Help people eat better, stay safe, and get fun food insights, all from their phone.


---

What It Does (In Human Terms)

Snap a pic of your food, and it tells you what it is, if it’s hot, and if it’s safe for your diet (like vegan or peanut allergy).

Cook something in the oven? It can even guess how done it is and if it’s getting too dry or burnt.

Not sure what to eat this week? It builds a meal plan based on what you like and your past food scans.

Worried about privacy? No ads, no tracking. It saves everything safely on your phone.



---

How It’s Built (Kind of Like a Good Recipe)

Think of it like this:

Fresh ingredients: Photos, food, and your settings

Secret sauce: A bit of AI that understands your food

Strong container: Locked-up storage so only you can see your data


And just like Swamp Rabbit Café’s kitchen, everything gets built fresh every time I update it, thanks to a cool system that bakes the app and wraps it up ready for download.


---

Want to Try It?

1. Go to the GitHub page.


2. Click on “Actions,” find the latest version, and download it to your Android phone.


3. Take a pic of your lunch. See what it says.




---

Final Words

This whole app started with one bowl of pasta salad and a little curiosity. Now it’s a free tool for anyone who wants to:

Understand their meals

Plan their food week

Eat safer

And maybe have a bit of fun with tech that feels like magic


Give it a shot — and if it inspires you, give us a share when maybe yoh top build something weird and wonderful for quantum gastronomy. (Heston ref)


---



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

# 🛡️ Privacy Policy  
_Last updated: 12 May 2025_

Swamp Rabbit Café & Grocery Tree Oracle (“the App,” “we,” “our,” “us”) is an **offline-first** mobile application that values your right to privacy. This document explains what data we collect, how we use it, and the choices you have.

---

## 1. Data We Collect

| Category | What | When | Stored? | Encryption |
|----------|------|------|---------|------------|
| **Images** | Photos you select or capture for scanning | Only during a scan session | **Not** persistently saved unless you explicitly export | Transmitted once to OpenAI over TLS |
| **Scan Results** | AI responses, color tags, risk scores | After a successful scan | Yes (SQLite) | AES-256-GCM |
| **OpenAI API Key** | Your personal API token | When you save it in Setup | Yes (EncryptedStorage) | AES-256-GCM |
| **Dietary Settings** | Lactose, peanut, vegan preferences | When you adjust sliders | Yes (AsyncStorage) | Plaintext (device-local only) |
| **Crash / Error Logs** | Stack traces (opt-in only) | On app crash | No remote logging—saved locally until you share | — |

We **do not** collect GPS, contacts, or any advertising identifiers.

---

## 2. How We Use Data

1. **Food & Plant Scanning** – Images are converted to Base64 and sent via HTTPS to OpenAI’s GPT-4o Vision endpoint for analysis.  
2. **Oven Analysis** – Same flow as above, plus a CPU-entropy string for quantum calculations.  
3. **History & Related Tabs** – Results are stored locally (encrypted) so you can revisit previous scans.  
4. **Meal Calendar** – Past scans are summarized (locally) and the summary text is sent to OpenAI to generate a plan.

We never sell, rent, or monetize your data.

---

## 3. Third-Party Services

| Service | Purpose | Policy |
|---------|---------|--------|
| **OpenAI API** | Cloud-based image & text analysis | <https://openai.com/policies/privacy-policy> |
| **React Native Encrypted Storage** | Secure key/value storage | Local-only, open-source |
| **SQLite** | Offline database | Local-only, open-source |

---

## 4. Data Retention & Deletion

- **Local Data** – Remains on your device indefinitely. Clear it any time via **Settings → Clear History** (coming soon) or by uninstalling the app.  
- **OpenAI** – Images and prompts are kept by OpenAI per their policy (currently 30 days) for abuse monitoring, then deleted. We do not control this retention period.

---

## 5. Security Measures

- **Transport** – All API requests use HTTPS/TLS 1.2+.  
- **At Rest** –  
  - API key & AES key: AES-256-GCM via `react-native-encrypted-storage`  
  - Scan history: field-level AES-GCM inside SQLite  
- **Key Rotation** – The internal AES key auto-rotates every 30 days.  
- **Least Permissions** – The app requests Camera & Storage only when needed.

---

## 6. Children’s Privacy

The App is **not directed to children under 13**. We do not knowingly collect personal data from children. If a parent or guardian learns that a child has provided personal data, please contact us to delete it.

---

## 7. Your Choices

- **Opt-Out of Cloud Scans** – Use the Quantum tab or History browsing; these features are fully offline.  
- **Delete Local Data** – Uninstall the app or (soon) use the in-app “Clear History” button.  
- **Revoke OpenAI Consent** – Remove your API key from **Setup**.

---

## 8. Changes to This Policy

We may update this Privacy Policy to reflect new features or regulations. We’ll notify you via an in-app banner 7 days before changes take effect. Continued use after the effective date indicates acceptance.

---

## 9. Contact us in Github issues 
---

**Thank you for trusting Sir Hops-A-Lot III with your data—he guards those bits like carrots. 🥕**

Please follow our CONTRIBUTING.md for details.


---

📄 License

GPL3 © Graylan Janulis


---

> Stay crunchy, stay coherent. 🥕🐇





