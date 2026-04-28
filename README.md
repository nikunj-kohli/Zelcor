# 🛡️ Zelcor - Trust, Encoded

Zelcor is a state-of-the-art **Multi-Industry Trust Platform** that revolutionizes escrow, inspections, and insurance through **Decentralized Blockchain Logic** and **AI-Powered Forensic Analysis**. From rental deposits to medical insurance claims, Zelcor eliminates fraud and automates settlements with "Trust, Encoded."

---

## 🚀 Core Ecosystem Modules

### 🏠 1. AI-Powered Rental Module
A professional-grade inspection workflow designed to secure property deposits.
- **Forensic Evidence Collection**: Strict "1-Label, 1-Image" evidence gallery with live base64 hashing.
- **AI Forensic Engine**: Powered by **Roboflow** (Damage Detection) and **Hugging Face** (Image Authenticity).
- **Zelcor Edge AI**: High-performance local fallback for pixel-level forensic validation.
- **Automated Settlement**: 48-hour resolution window with automated escrow release based on AI-calculated deductions.

### 🏥 2. Smart Insurance Module
Revolutionizing the medical insurance claim process.
- **AI Claims Analysis**: Real-time validation of medical diagnoses and symptoms using advanced LLMs.
- **Urgency Classification**: Automated prioritization of critical medical cases for immediate funding.
- **Policy Verification**: Secure document storage with blockchain integrity proof.

### ⛓️ 3. Decentralized Escrow & Disputes
The backbone of Zelcor trust.
- **Smart Contract Integration**: Secure funds on the Sepolia testnet using `ZelcorEscrow.sol`.
- **E-commerce Analysis**: Instant Amazon/Shop link analysis with price verification and fake-listing detection.
- **AI Dispute Resolution**: 85%+ confidence threshold for automated blockchain-based refunds.

---

## 🛠️ Technical Stack

### **Frontend**
- **Framework**: React 18 with Vite
- **Styling**: Vanilla CSS / Tailwind (Premium Glassmorphism Design System)
- **Icons**: Material Symbols Rounded
- **Navigation**: React Router DOM

### **Backend**
- **Server**: Node.js + Express
- **Database**: Supabase (PostgreSQL with JSONB evidence storage)
- **Real-time**: Pusher (Live dispute alerts)
- **AI Integration**: Roboflow (Computer Vision), Hugging Face (Forensics), OpenAI/Groq (LLM Reasoning)

### **Blockchain**
- **Providers**: Ethers.js
- **Network**: Sepolia Testnet
- **Security**: SHA-256 Content Hashing

---

## 📁 Project Structure

```bash
Zelcor/
├── client/              # React Frontend (Vite)
│   ├── src/
│   │   ├── rental/      # Main Rental Module Logic
│   │   ├── pages/       # Dashboard, Wallet, Insurance, Shop
│   │   └── components/  # Premium UI Components
├── backend/             # Node.js API Server
│   ├── src/
│   │   └── index.js     # Unified AI & Blockchain Gateway
├── contracts/           # Solidity Smart Contracts
└── mobile/              # Experimental Flutter Mobile App
```

---

## 🏁 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- Supabase Account
- API Keys for Roboflow & Hugging Face

### 2. Environment Configuration
Create a `.env` in the `backend/` directory:
```env
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
ROBOFLOW_API_KEY=your_key
ROBOFLOW_DAMAGE_ENDPOINT=https://detect.roboflow.com/damage-detection/1
HUGGINGFACE_API_KEY=your_key
HUGGINGFACE_IMAGE_MODEL=google/vit-base-patch16-224
```

### 3. Installation
```bash
# Clone the repository
git clone https://github.com/nikunj-kohli/Zelcor.git

# Install Backend
cd backend && npm install

# Install Frontend
cd client && npm install
```

### 4. Launch
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd client && npm run dev
```

---

## 🛡️ Security & Integrity
Zelcor uses a **Zero-Tolerance AI Policy**. Every piece of evidence is hashed, analyzed for synthetic alteration, and verified against pre-existing conditions before a single rupee is deducted from an escrow.

**Zelcor: The future of trust, encoded into every transaction.**