# 🛡️ Zelcor - Trust, Encoded

A decentralized escrow and complaint resolution system built with React, Flutter, Node.js, and Ethereum.

## 📁 Project Structure

```
Zelcor/
├── website/          # React + Vite + Tailwind (Frontend)
├── mobile/           # Flutter (iOS + Android)
├── backend/          # Node.js + Express + TypeScript
├── contracts/        # Solidity + Hardhat (Smart Contract)
├── .env.example      # Environment variables template
└── README.md
```

## 🚀 Quick Start

### 1. Clone & Install Dependencies

```bash
# Website
cd website && npm install

# Backend
cd backend && npm install

# Contracts
cd contracts && npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Start Development

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Website
cd website && npm run dev

# Terminal 3: Smart Contract (optional)
cd contracts && npx hardhat node
```

## 🔧 Tech Stack

| Component | Technology |
|-----------|------------|
| Website | React 19 + Vite + Tailwind CSS 4 |
| Mobile | Flutter + Dart |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (PostgreSQL) |
| AI | OpenAI GPT-4o mini |
| Blockchain | Solidity 0.8.28 + Hardhat + Sepolia |

## 📖 Documentation

- [System Design Document](./docs/SYSTEM_DESIGN.md)
- [API Endpoints](./docs/API.md)
- [Smart Contract](./contracts/contracts/ZelcorEscrow.sol)
- [Database Schema](./docs/SCHEMA.md)

## 🏗️ Development Order

1. **Set up Supabase** - Run SQL schema
2. **Deploy Smart Contract** - `cd contracts && npx hardhat run scripts/deploy.ts`
3. **Start Backend** - `cd backend && npm run dev`
4. **Start Website** - `cd website && npm run dev`
5. **Build Mobile** - `cd mobile && flutter pub get`

## 📄 License

MIT