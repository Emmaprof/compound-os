# CompoundOS

**Core Infrastructure for Residential Node Management**

CompoundOS is a production-grade, decentralized utility management protocol deployed on the Base L2 network. It bridges the gap between physical residential infrastructure and cryptographic settlement, enabling autonomous billing operations, real-time treasury analytics, and trustless USDC clearing. 

Designed with a focus on human-centric UI, minimal latency, and institutional-grade security.

---

## System Architecture

The protocol is divided into three primary execution environments:

* **Command Center (Admin):** The matrix deployment engine. Allows protocol administrators to broadcast network utility bills, suspend or reactivate residential nodes, and manage treasury liquidity routing (L1/L2 extraction).
* **Resident Ledger (User):** The execution layer for residential nodes. Facilitates one-click Web3 Vault settlements via USDC, fiat on-ramping via Paystack, and autonomous allowance allocations.
* **Data Terminal (Analytics):** A dashboard tracking Gross Treasury TVL, network efficiency, collection rates, and settlement liquidity flux in real-time.

---

## Core Features

* **Autonomous Vault Allowances:** Residents can pre-approve USDC spending limits, enabling zero-click or one-click frictionless utility deductions without repeated MetaMask signatures.
* **Dual-Routing Settlement:** Supports strictly verified on-chain USDC payments alongside traditional Fiat wire ingress (Paystack), mapping both to immutable database records.
* **Cryptographic Attestation:** Every cleared invoice generates a highly secure, printable PDF statement backed by an on-chain transaction hash.
* **Live Liveness Tracking:** Real-time WebSockets powered by Supabase broadcast state changes, ensuring zero-latency UI updates without heavy RPC polling.
* **Treasury Extraction Engine:** Secure, admin-only interface to route accumulated protocol liquidity to external non-custodial or centralized exchange vectors.

---

## Technical Stack

### Frontend & State Management
* **Framework:** Next.js (React)
* **Styling:** Tailwind CSS (Custom glassmorphism, dark-terminal aesthetic)
* **Data Fetching:** SWR (Stale-While-Revalidate)

### Web3 & Cryptography
* **Network:** Base Mainnet (Chain ID: 8453)
* **Wallet Integration:** RainbowKit & Wagmi v2
* **Contract Interaction:** Viem (Strict-typed RPC calls, keccak256 hashing)

### Backend & Infrastructure
* **Database:** Supabase (PostgreSQL)
* **Realtime:** Supabase Channels (WebSocket)
* **Edge Compute:** Supabase Edge Functions (Matrix gateway, Vault relayer, Paystack engine)

---

## Security & Invariants

* **Type Safety:** 100% strict TypeScript enforcement. Total eradication of variable type bleed and edge cases.
* **RPC Optimization:** Strategic debouncing and cached SWR requests to prevent RPC node rate-limiting and UI thread blocking.
* **Hash Collision Locks:** Database-level unique constraints on transaction hashes prevent double-spend or replay attacks on manual receipt submissions.
* **Event Log Verification:** Manual USDC transfers are verified strictly against the Base network event logs, bypassing purely client-side validation.

---

## Getting Started

### Prerequisites

Ensure you have the following installed:
* Node.js (v18.17.0 or higher)
* pnpm, npm, or yarn
* A Web3 Wallet connected to the Base Network.
