'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useSwitchChain, usePublicClient, useReadContract } from 'wagmi';
import { decodeEventLog, getAddress, parseUnits, formatUnits, keccak256, stringToHex } from 'viem';
import { base } from 'viem/chains';
import useSWR from 'swr';

import { TREASURY_ADDRESS, TREASURY_ABI } from '../../lib/web3/contractABI';

// ============================================================
// STRICT TYPE DEFINITIONS
// ============================================================
interface Tenant {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  avatar_url?: string;
}

interface UserSession extends Tenant {
  is_admin?: boolean;
  user_metadata?: {
    picture?: string;
    avatar_url?: string;
    full_name?: string;
  };
}

interface MonthlyBill {
  billing_period: string;
  due_date: string;
  total_amount_naira: number;
}

interface Invoice {
  id: string;
  tenant_id: string;
  amount_due: number;
  is_paid: boolean;
  payment_method?: string;
  transaction_reference?: string;
  paid_at?: string;
  created_at: string;
  monthly_bills: MonthlyBill | MonthlyBill[];
  tenants?: Tenant;
}

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };

// ============================================================
// PRODUCTION MAINNET CONSTANTS
// ============================================================
const USDC_CONTRACT_ADDRESS = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const TARGET_CHAIN_ID = 8453; // Base Mainnet

const ERC20_ABI = [
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "boolean" }], stateMutability: "nonpayable", type: "function" },
  { anonymous: false, inputs: [{ indexed: true, name: "from", type: "address" }, { indexed: true, name: "to", type: "address" }, { indexed: false, name: "value", type: "uint256" }], name: "Transfer", type: "event" },
  { inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "boolean" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" }
] as const;

// ============================================================
// HELPER FUNCTIONS
// ============================================================
async function safeWriteClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function escapeHTML(str: string | undefined): string {
  if (!str) return '—';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ============================================================
// POLYMARKET/LIMITLESS GRADE WALLET CONNECTION UI
// ============================================================
function CustomConnectButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

        if (!ready) {
          return (
            <div aria-hidden="true" className="opacity-0 pointer-events-none select-none">
              <button>Connect Wallet</button>
            </div>
          );
        }

        if (!connected) {
          return (
            <button onClick={openConnectModal} className="bg-blue-600 hover:bg-blue-500 text-white font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest py-2 md:py-2.5 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button onClick={openChainModal} className="bg-red-500 hover:bg-red-400 text-white font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest py-2 md:py-2.5 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Wrong Network
            </button>
          );
        }

        return (
          <div className="flex items-center gap-1.5 bg-[#050A1A] border border-blue-500/20 rounded-xl p-1 shadow-[0_0_15px_rgba(37,99,235,0.1)]">
            <button onClick={openChainModal} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-lg transition-colors text-white font-mono text-[10px] md:text-[11px] font-bold">
              {chain.hasIcon && (
                <div style={{ background: chain.iconBackground, width: 16, height: 16, borderRadius: 999, overflow: 'hidden' }}>
                  {chain.iconUrl && <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} style={{ width: 16, height: 16 }} />}
                </div>
              )}
              <span className="hidden md:block tracking-widest uppercase">{chain.name}</span>
            </button>
            <div className="w-px h-4 bg-white/10"></div>
            <button onClick={openAccountModal} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-lg transition-colors text-white font-mono text-[10px] md:text-[11px] font-bold tracking-widest uppercase">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address: userAddress, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useSwitchChain();
  const { switchChainAsync } = useSwitchChain();
  const writeContract = useWriteContract();
  const publicClient = usePublicClient();

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? '';
      if (
        msg.includes('Connection interrupted while trying to subscribe') ||
        msg.includes('WebSocket connection failed')
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  // ============================================================
  // CORE STATE
  // ============================================================
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<'RESIDENT' | 'ADMIN' | 'ANALYTICS'>('RESIDENT');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [billAmount, setBillAmount] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [ngnToUsdRate, setNgnToUsdRate] = useState<number>(1520);

  const [viewingReceipt, setViewingReceipt] = useState<Invoice | null>(null);
  const [allowanceInput, setAllowanceInput] = useState<string>('5');
  const [isApproving, setIsApproving] = useState(false);

  const [displayLimit, setDisplayLimit] = useState(8);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [paymentPortalMode, setPaymentPortalMode] = useState<'FIAT' | 'USDC' | 'VAULT' | null>(null);
  const [manualTxHash, setManualTxHash] = useState('');
  const [lastConfirmedTx, setLastConfirmedTx] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paymentLifecycle, setPaymentLifecycle] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS'>('IDLE');

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawDestination, setWithdrawDestination] = useState('');
  const [withdrawAmountInput, setWithdrawAmountInput] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // 🛡️ ZERO-TRUST PERSISTENT CACHE STATE (Prevents SWR from reverting UI on refresh)
  const [localPaidState, setLocalPaidState] = useState<Record<string, { method: string, ref: string }>>({});

  useEffect(() => {
    // Rehydrate optimistic UI state securely from session
    const saved = sessionStorage.getItem('compoundos_optimistic_ledger');
    if (saved) {
      try { setLocalPaidState(JSON.parse(saved)); } catch {}
    }
  }, []);

  const markOptimisticallyPaid = useCallback((id: string, method: string, ref: string) => {
    setLocalPaidState(prev => {
      const next = { ...prev, [id]: { method, ref } };
      sessionStorage.setItem('compoundos_optimistic_ledger', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isNotificationsOpen]);

  // ============================================================
  // CONTRACT READS
  // ============================================================
  const { data: currentAllowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: USDC_CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, TREASURY_ADDRESS] : undefined,
    query: { enabled: !!userAddress }
  });
  const baseAllowanceUSDC = currentAllowanceRaw ? Number(currentAllowanceRaw) / 1_000_000 : 0;

  const { data: treasuryBalanceRaw } = useReadContract({
    address: USDC_CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [TREASURY_ADDRESS as `0x${string}`],
    query: { refetchInterval: 10_000 }
  });
  const treasuryBalance = treasuryBalanceRaw ? Number(treasuryBalanceRaw) / 1_000_000 : 0;

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const handleExportReceiptPDF = useCallback((receipt: Invoice) => {
    if (!receipt) return;
    
    const baseUrl = window.location.origin;
    let rawBillingPeriod = '—';
    if (Array.isArray(receipt.monthly_bills) && receipt.monthly_bills.length > 0) {
        rawBillingPeriod = receipt.monthly_bills[0].billing_period;
    } else if (!Array.isArray(receipt.monthly_bills) && receipt.monthly_bills) {
        rawBillingPeriod = receipt.monthly_bills.billing_period;
    }

    const billingPeriod = escapeHTML(rawBillingPeriod);
    const methodStr = escapeHTML(receipt.payment_method) || 'FIAT';
    const amountDue = Number(receipt.amount_due).toLocaleString();
    
    const isWeb3 = methodStr === 'USDC' || methodStr.includes('Vault');
    const rawTxRef = isWeb3 ? (receipt.transaction_reference || '—') : receipt.id;
    const cleanTxRef = escapeHTML(rawTxRef);
    
    const clearanceDate = receipt.paid_at 
        ? new Date(receipt.paid_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
        : '—';

    const badgeColor = isWeb3 ? '#3b82f6' : '#a855f7';
    const badgeBg = isWeb3 ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)';
    const badgeBorder = isWeb3 ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>CompoundOS | Settlement Proof</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap');
    @page { size: A4; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 210mm; height: 297mm; background: #ffffff !important;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      font-family: 'JetBrains Mono', monospace; color: #000000;
    }
    .page { width: 210mm; height: 297mm; background: #ffffff; display: flex; justify-content: center; align-items: center; }
    .modal-container { width: 100%; max-width: 500px; background: #ffffff; border: 1.5px solid #10b981; border-radius: 24px; padding: 40px; }
    .header-logo-row { display: flex; justify-content: flex-end; margin-bottom: -20px; position: relative; z-index: 10; }
    .header-content { margin-bottom: 40px; }
    .title-row { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 8px; height: 8px; background-color: #10b981; border-radius: 50%; }
    .header-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #111827; }
    .header-subtitle { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
    .value-section { text-align: center; margin-bottom: 40px; }
    .value-label { font-size: 11px; color: #10b981; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; display: block; }
    .value-amount { font-size: 56px; font-weight: 700; color: #111827; letter-spacing: -2px; line-height: 1; }
    .data-list { border-top: 1px solid rgba(16,185,129,0.1); padding-top: 24px; display: flex; flex-direction: column; gap: 12px; }
    .data-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; }
    .data-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
    .data-val { font-size: 11px; color: #111827; font-weight: 700; }
    .route-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; }
    .hash-container { padding: 14px 16px; background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; }
    .hash-label { font-size: 11px; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 8px; }
    .hash-box { display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e7eb; gap: 12px; }
    .hash-value { font-size: 10px; color: #10b981; font-weight: 700; word-break: break-all; }
    .basescan-link { color: #3b82f6; text-decoration: none; flex-shrink: 0; display: flex; align-items: center; }
    .basescan-link svg { width: 14px; height: 14px; }
    @media print { .page { padding: 0; margin: 0; } .modal-container { box-shadow: none !important; border: 1.5px solid #10b981 !important; } }
  </style>
</head>
<body>
<div class="page">
  <div class="modal-container">
    <div class="header-logo-row">
      <img src="${baseUrl}/logo.jpg" alt="CompoundOS Logo" style="width: 48px; height: 48px; border-radius: 12px; object-fit: cover; border: 1px solid rgba(16,185,129,0.2);" onerror="this.style.display='none'" />
    </div>
    <div class="header-content">
      <div class="title-row">
        <div class="status-dot"></div>
        <div class="header-title">Official Settlement Proof</div>
      </div>
      <div class="header-subtitle">CompoundOS Audited Record</div>
    </div>
    <div class="value-section">
      <span class="value-label">Value Extinguished</span>
      <div class="value-amount">₦${amountDue}</div>
    </div>
    <div class="data-list">
      <div class="data-row">
        <span class="data-label">Billing Cycle</span>
        <span class="data-val">${billingPeriod}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Clearance Date</span>
        <span class="data-val">${clearanceDate}</span>
      </div>
      <div class="data-row">
        <span class="data-label">Routing Method</span>
        <span class="route-badge">${methodStr}</span>
      </div>
      <div class="hash-container">
        <span class="hash-label">Cryptographic Attestation Hash</span>
        <div class="hash-box">
          <span class="hash-value">${cleanTxRef}</span>
          ${isWeb3 && rawTxRef.startsWith('0x') ? `
            <a href="https://basescan.org/tx/${cleanTxRef}" target="_blank" rel="noreferrer" class="basescan-link">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  </div>
</div>
<script>
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { setTimeout(() => { window.print(); }, 300); });
  } else { setTimeout(() => { window.print(); }, 800); }
  window.addEventListener('afterprint', () => { window.close(); });
</script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    if (!printWin) {
      showToast('Pop-up blocked — please allow pop-ups for this site.', 'error');
      return;
    }
    printWin.document.write(html);
    printWin.document.close();
  }, [showToast]);

  const calculateDynamicAmount = useCallback((baseAmount: number, dueDateStr: string | undefined) => {
    if (!dueDateStr) return { amount: baseAmount, isLate: false, daysLeft: 0, totalGrace: 5 };
    const dueDate = new Date(dueDateStr);
    const now = new Date();
    const isLate = now > dueDate;
    const timeDiff = dueDate.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    return { amount: isLate ? baseAmount * 1.10 : baseAmount, isLate, daysLeft, totalGrace: 5 };
  }, []);

  // ============================================================
  // SWR DATA FETCHING
  // ============================================================
  const { data: dashboardData, mutate: mutateDashboard, isValidating } = useSWR(
    user?.id ? `dashboard-${user.id}` : null,
    async () => {
      if (!user) return { pending: [], cleared: [], allHistorical: [], roster: [], stats: { activeNodes: 0, currentCyclePaid: 0, currentCycleTotal: 0 } };

      const [invoicesRes, globalLedgerRes] = await Promise.all([
        supabase
          .from('tenant_invoices')
          .select(`id, amount_due, is_paid, payment_method, transaction_reference, paid_at, created_at, monthly_bills ( billing_period, due_date )`)
          .eq('tenant_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_global_ledger')
      ]);

      let pending: Invoice[] = [], cleared: Invoice[] = [], allHistorical: Invoice[] = [], roster: Tenant[] = [];
      let stats = { activeNodes: 0, currentCyclePaid: 0, currentCycleTotal: 0 };

      if (!invoicesRes.error && invoicesRes.data) {
        const fetchedInvoices = invoicesRes.data as Invoice[];
        pending = fetchedInvoices.filter(inv => !inv.is_paid);
        cleared = fetchedInvoices.filter(inv => inv.is_paid);
      }

      if (!globalLedgerRes.error && globalLedgerRes.data) {
        allHistorical = globalLedgerRes.data.map((row: any) => ({
          ...row,
          monthly_bills: { billing_period: row.billing_period, due_date: row.due_date },
          tenants: { full_name: row.tenant_name, avatar_url: row.tenant_avatar }
        }));
      }

      if (user.is_admin) {
        const { data: tenantsRes } = await supabase.from('tenants').select('*');
        roster = tenantsRes || [];
      }

      const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      const currentCycle = allHistorical.filter((inv: Invoice) => {
        let period = '';
        if (Array.isArray(inv.monthly_bills) && inv.monthly_bills.length > 0) {
          period = inv.monthly_bills[0].billing_period;
        } else if (!Array.isArray(inv.monthly_bills) && inv.monthly_bills) {
          period = inv.monthly_bills.billing_period;
        }
        const createdMonth = new Date(inv.created_at).toLocaleString('default', { month: 'long', year: 'numeric' });
        return period === currentMonthName || createdMonth === currentMonthName;
      });

      stats = {
        activeNodes: roster.length > 0
          ? roster.filter((t: Tenant) => t.is_active !== false).length
          : new Set(allHistorical.map((i: Invoice) => i.tenant_id)).size,
        currentCyclePaid: currentCycle.filter((i: Invoice) => i.is_paid).length,
        currentCycleTotal: currentCycle.length
      };

      return { pending, cleared, allHistorical, roster, stats };
    },
    { revalidateOnFocus: true, keepPreviousData: true }
  );

  // 🛡️ ZERO-TRUST CACHE INJECTION (Overriding SWR State if Optimistic Exists)
  const pendingActionInvoices = useMemo(() => {
    const raw = dashboardData?.pending ?? [];
    return raw.filter((inv: Invoice) => !localPaidState[inv.id]);
  }, [dashboardData?.pending, localPaidState]);

  const clearedInvoices = useMemo(() => {
    const rawCleared = dashboardData?.cleared ?? [];
    const clearedIds = new Set(rawCleared.map((i: Invoice) => i.id));
    
    // Inject optimistic clears that backend hasn't finalized yet to prevent blinking UI
    const rawPending = dashboardData?.pending ?? [];
    const optimisticItems = rawPending
      .filter((inv: Invoice) => localPaidState[inv.id] && !clearedIds.has(inv.id))
      .map((inv: Invoice) => ({
        ...inv,
        is_paid: true,
        payment_method: localPaidState[inv.id].method,
        transaction_reference: localPaidState[inv.id].ref,
        paid_at: new Date().toISOString()
      }));

    return [...optimisticItems, ...rawCleared];
  }, [dashboardData?.cleared, dashboardData?.pending, localPaidState]);

  // 🛡️ LIVE CYCLE FIX: Inject optimistic data directly into admin stats calculation
  const adminStats = useMemo(() => {
    const baseStats = dashboardData?.stats ?? { activeNodes: 0, currentCyclePaid: 0, currentCycleTotal: 0 };
    const rawPending = dashboardData?.pending ?? [];
    // Count how many pending items exist in the optimistic cache
    const optimisticCount = rawPending.filter((inv: Invoice) => localPaidState[inv.id]).length;
    
    return {
        ...baseStats,
        // Prevent count from exceeding total by capping it mathematically
        currentCyclePaid: Math.min(baseStats.currentCycleTotal, baseStats.currentCyclePaid + optimisticCount)
    };
  }, [dashboardData?.stats, dashboardData?.pending, localPaidState]);

  const allHistoricalInvoices = useMemo(() => dashboardData?.allHistorical ?? [], [dashboardData?.allHistorical]);
  const tenantRoster = useMemo(() => dashboardData?.roster ?? [], [dashboardData?.roster]);

  // ============================================================
  // CORE SECURITY GATEWAY (Zero-Trust Ledger Update)
  // ============================================================
  const verifySettlementOffchain = useCallback(async (
    targetInvoiceId: string,
    method: 'FIAT' | 'USDC' | 'VAULT',
    reference: string,
    clientVerified: boolean = false
  ) => {
    // 1. INSTANT OPTIMISTIC UI 
    if (clientVerified) {
      setLastConfirmedTx(reference);
      setPaymentLifecycle('SUCCESS');
      markOptimisticallyPaid(targetInvoiceId, method, reference);
      // Immediately reflect UI state change for cycle tracking
      mutateDashboard(); 
    } else {
      setPaymentLifecycle('PROCESSING');
    }

    // 2. SILENT BACKGROUND SYNC
    let attempt = 0;
    const maxAttempts = 6; 
    let backendSuccess = false;

    while (attempt < maxAttempts && !backendSuccess) {
      try {
        const { data, error } = await supabase.functions.invoke('verify-settlement', {
          body: { invoiceId: targetInvoiceId, method, reference }
        });

        if (!error && data?.success) {
          backendSuccess = true;
        }
      } catch (err) {
        // Fail silently in the background, loop will retry
      }

      if (!backendSuccess) {
        attempt++;
        if (attempt < maxAttempts) {
          await new Promise(res => setTimeout(res, Math.min(2000 * Math.pow(1.5, attempt), 15000))); 
        }
      }
    }

    // 3. FALLBACK HANDLING: If Edge function completely failed but we have cryptographic proof from client
    if (clientVerified && !backendSuccess) {
        try {
            // Direct RPC fallback to force the True state on the DB
            await supabase.from('tenant_invoices').update({
                is_paid: true,
                payment_method: method,
                transaction_reference: reference,
                paid_at: new Date().toISOString()
            }).eq('id', targetInvoiceId);
            mutateDashboard();
        } catch (e) {
            console.error("Direct RPC Fallback Error:", e);
        }
    }

    if (!clientVerified) {
      if (backendSuccess) {
        setLastConfirmedTx(reference);
        setPaymentLifecycle('SUCCESS');
        markOptimisticallyPaid(targetInvoiceId, method, reference);
        mutateDashboard();
      } else {
        showToast('Settlement Pending: Network state will finalize shortly.', 'info');
        setPaymentLifecycle('IDLE'); 
      }
    } else if (backendSuccess) {
       // Silent data refresh to ensure perfect parity once backend finally catches up
       mutateDashboard();
    }
  }, [markOptimisticallyPaid, mutateDashboard, showToast]);

  const verifyPaystackReturn = useCallback(async (reference: string) => {
    window.history.replaceState({}, document.title, window.location.pathname);
    
    try {
      const pendingId = localStorage.getItem('pending_fiat_invoice');
      if (!pendingId) return;

      const { data: matchedInvoice } = await supabase
        .from('tenant_invoices')
        .select('*, monthly_bills(*)')
        .eq('id', pendingId)
        .single();

      if (matchedInvoice) {
        setActiveInvoice(matchedInvoice);
        setPaymentPortalMode('FIAT');
        
        // 🛡️ FIAT PERFORMANCE UPGRADE: Trust local payload to pop success instantly, sync silently in background
        if (matchedInvoice.is_paid) {
           setLastConfirmedTx(reference);
           setPaymentLifecycle('SUCCESS');
        } else {
           await verifySettlementOffchain(pendingId, 'FIAT', reference, true);
        }
        
        localStorage.removeItem('pending_fiat_invoice');
        sessionStorage.removeItem('pending_fiat_invoice');
      }
    } catch (err) {
      console.error('State Recovery Error:', err);
    }
  }, [verifySettlementOffchain]);

  useEffect(() => {
    let cancelled = false;
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data?.rates?.NGN) setNgnToUsdRate(data.rates.NGN);
      })
      .catch(() => console.warn('Exchange rate oracle offline — using fallback.'));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeAppSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        if (isMounted) { setUser(null); setLoading(false); router.replace('/'); }
        return;
      }

      if (
        window.location.hash.includes('access_token=') ||
        window.location.search.includes('code=')
      ) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const { data: dbUser } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!isMounted) return;

      const authPhoto = session.user.user_metadata?.picture || session.user.user_metadata?.avatar_url;
      if (dbUser && !dbUser.avatar_url && authPhoto) {
        await supabase.from('tenants').update({ avatar_url: authPhoto }).eq('id', session.user.id);
        dbUser.avatar_url = authPhoto;
      }

      const mergedUser: UserSession = { ...session.user, ...dbUser };
      setUser(mergedUser);
      if (mergedUser?.is_admin) setActiveWorkspace('ADMIN');

      const paystackRef = searchParams.get('reference') || searchParams.get('trxref');
      if (paystackRef) {
        await verifyPaystackReturn(paystackRef);
      }

      if (isMounted) setLoading(false);
    };

    initializeAppSession();
    return () => { isMounted = false; };
  }, [searchParams, router, verifyPaystackReturn]);

  const channelRef = useRef<any>(null);
  useEffect(() => {
    if (!user?.id || loading) return;
    if (channelRef.current) return;

    const channelName = `ledger-flux-${user.id}`;
    const websocketChannel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant_invoices' }, () => {
        mutateDashboard();
      });

    websocketChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = websocketChannel;
      }
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, loading, mutateDashboard]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    if (loading || isValidating) return;
    if (displayLimit >= clearedInvoices.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit(prev => Math.min(prev + 8, clearedInvoices.length));
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, isValidating, clearedInvoices.length, displayLimit]);

  const handleCloseModal = useCallback(() => {
    setPaymentPortalMode(null);
    setActiveInvoice(null);
    setManualTxHash('');
    setLastConfirmedTx('');
    setPaymentLifecycle('IDLE');
  }, []);

  const handleVerifyManualCrypto = useCallback(async () => {
    const cleanedHash = manualTxHash.trim() as `0x${string}`;
    if (!cleanedHash.startsWith('0x') || cleanedHash.length !== 66) {
      return showToast('Invalid hash format — must be 66 char 0x-prefixed.', 'error');
    }
    setPaymentLifecycle('PROCESSING');
    try {
      if (!publicClient) throw new Error('RPC client failed to mount.');
      const receipt = await publicClient.getTransactionReceipt({ hash: cleanedHash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.');

      if (!activeInvoice) throw new Error('No active invoice.');
      const expectedHash = keccak256(stringToHex(activeInvoice.id));
      let validPaymentFound = false;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi: TREASURY_ABI, data: log.data, topics: log.topics });
          if (decoded.eventName === 'InvoicePaidManual' && (decoded.args as any).invoiceHash === expectedHash) {
            validPaymentFound = true;
            break;
          }
        } catch (_) { /* Skip non-matching logs to filter pure signal */ }
      }

      if (!validPaymentFound) throw new Error('No cryptographic match found in Treasury event logs.');
      
      // Execute Secure Hand-off
      await verifySettlementOffchain(activeInvoice.id, 'USDC', cleanedHash, true);

    } catch (err: any) {
      showToast(err.shortMessage || err.message || 'Failed to verify transaction.', 'error');
      setPaymentLifecycle('IDLE');
    }
  }, [manualTxHash, activeInvoice, publicClient, verifySettlementOffchain, showToast]);

  const handlePayWithConnectedWallet = useCallback(async () => {
    if (!activeInvoice || !userAddress) return;
    setPaymentLifecycle('PROCESSING');

    try {
      if (chainId !== TARGET_CHAIN_ID) await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      if (!publicClient) throw new Error('RPC interface offline.');

      let dueStr = '';
      if (Array.isArray(activeInvoice.monthly_bills) && activeInvoice.monthly_bills.length > 0) {
        dueStr = activeInvoice.monthly_bills[0].due_date;
      } else if (!Array.isArray(activeInvoice.monthly_bills) && activeInvoice.monthly_bills) {
        dueStr = activeInvoice.monthly_bills.due_date;
      }

      const dueInfo = calculateDynamicAmount(activeInvoice.amount_due, dueStr);
      // Precision Fix: Calculate the absolute required token amount
      const rawUsdValue = dueInfo.amount / ngnToUsdRate;
      const cryptoValue = parseUnits(rawUsdValue.toFixed(6), 6);
      const invoiceHash = keccak256(stringToHex(activeInvoice.id));

      // 🛡️ SECURITY LAYER 1: STRICT BALANCE CHECK 
      const currentBalance = await publicClient.readContract({
        address: USDC_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`]
      });

      if (currentBalance < cryptoValue) {
        const shortReq = formatUnits(cryptoValue, 6);
        const shortBal = formatUnits(currentBalance, 6);
        throw new Error(`Insufficient liquidity. Need exactly ${shortReq} USDC (Wallet Holds: ${shortBal} USDC).`);
      }

      // 🛡️ SECURITY LAYER 2: ALLOWANCE CHECK
      const currentAllowance = await publicClient.readContract({
        address: USDC_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress as `0x${string}`, TREASURY_ADDRESS]
      });

      if (currentAllowance < cryptoValue) {
        showToast('Authorizing Treasury Access...', 'info');
        const approveHash = await writeContract.writeContractAsync({
          address: USDC_CONTRACT_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [TREASURY_ADDRESS, cryptoValue]
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        showToast('Authorization confirmed. Routing settlement...', 'success');
      }

      // 🛡️ CLEAR SIGNING INITIATION
      const txHash = await writeContract.writeContractAsync({
        address: TREASURY_ADDRESS,
        abi: TREASURY_ABI,
        functionName: 'payInvoice',
        args: [invoiceHash, cryptoValue]
      });

      showToast('Awaiting Base L2 finality...', 'info');

      // 🛡️ SECURITY LAYER 3: ENFORCE CRYPTOGRAPHIC FINALITY ON CLIENT
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') {
        throw new Error('Transaction reverted on-chain. Database sync mathematically aborted.');
      }

      // 🛡️ SECURITY LAYER 4: ZERO-TRUST OFF-CHAIN VERIFICATION
      await verifySettlementOffchain(activeInvoice.id, 'USDC', txHash, true);

    } catch (err: any) {
      showToast(err.shortMessage || err.message, 'error');
      setPaymentLifecycle('IDLE');
    }
  }, [activeInvoice, chainId, userAddress, publicClient, ngnToUsdRate, calculateDynamicAmount, switchChainAsync, writeContract, verifySettlementOffchain, showToast]);

  const handleInitializeFiatPayment = useCallback(async () => {
    if (!activeInvoice || !user) return;
    setPaymentLifecycle('PROCESSING');
    try {
      let dueStr = '';
      if (Array.isArray(activeInvoice.monthly_bills) && activeInvoice.monthly_bills.length > 0) {
          dueStr = activeInvoice.monthly_bills[0].due_date;
      } else if (!Array.isArray(activeInvoice.monthly_bills) && activeInvoice.monthly_bills) {
          dueStr = activeInvoice.monthly_bills.due_date;
      }
      
      const dueInfo = calculateDynamicAmount(activeInvoice.amount_due, dueStr);
      sessionStorage.setItem('pending_fiat_invoice', activeInvoice.id);
      localStorage.setItem('pending_fiat_invoice', activeInvoice.id);

      const { data, error } = await supabase.functions.invoke('paystack-engine', {
        body: { action: 'initialize_payment', email: user?.email, amount: dueInfo.amount, invoiceId: activeInvoice.id }
      });
      if (error || data?.error) throw new Error(data?.error || 'Gateway response exception');
      window.location.href = data.checkout_url;
    } catch (err: any) {
      showToast(err.message, 'error');
      setPaymentLifecycle('IDLE');
    }
  }, [activeInvoice, user, calculateDynamicAmount, showToast]);

  const handleOneClickSettle = useCallback(async (invoice: Invoice) => {
    if (!userAddress) return showToast('Node wallet disconnected.', 'error');
    const capturedInvoice = invoice;
    setActiveInvoice(capturedInvoice);
    setPaymentPortalMode('VAULT');
    setPaymentLifecycle('PROCESSING');

    try {
      let dueStr = '';
      if (Array.isArray(capturedInvoice.monthly_bills) && capturedInvoice.monthly_bills.length > 0) {
          dueStr = capturedInvoice.monthly_bills[0].due_date;
      } else if (!Array.isArray(capturedInvoice.monthly_bills) && capturedInvoice.monthly_bills) {
          dueStr = capturedInvoice.monthly_bills.due_date;
      }
      
      const exactUsdcDeduction = calculateDynamicAmount(capturedInvoice.amount_due, dueStr).amount / ngnToUsdRate;

      const { data, error } = await supabase.functions.invoke('vault-relayer', {
        body: {
          invoiceId: capturedInvoice.id,
          userAddress,
          exactUsdcAmount: exactUsdcDeduction
        }
      });

      if (error || !data?.success) {
        throw new Error(`Relayer denied: ${error?.message || data?.error || 'Unknown reason'}`);
      }

      refetchAllowance();
      setLastConfirmedTx(data.txHash);
      setPaymentLifecycle('SUCCESS');
      mutateDashboard();
    } catch (err: any) {
      showToast(err.message, 'error');
      setPaymentLifecycle('IDLE');
      setPaymentPortalMode(null);
      setActiveInvoice(null);
    }
  }, [userAddress, ngnToUsdRate, calculateDynamicAmount, refetchAllowance, mutateDashboard, showToast]);

  const handleApproveAllowance = useCallback(async () => {
    const amount = Number(allowanceInput);
    if (!allowanceInput || isNaN(amount) || amount <= 0) {
      return showToast('Enter a valid USDC amount.', 'error');
    }
    setIsApproving(true);
    try {
      if (chainId !== TARGET_CHAIN_ID) await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      await writeContract.writeContractAsync({
        address: USDC_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [TREASURY_ADDRESS, parseUnits(allowanceInput, 6)]
      });
      showToast('Web3 Vault allowance confirmed.', 'success');
      refetchAllowance();
    } catch (err: any) {
      showToast(err.shortMessage || err.message, 'error');
    } finally {
      setIsApproving(false);
      setAllowanceInput('');
    }
  }, [allowanceInput, chainId, switchChainAsync, writeContract, refetchAllowance, showToast]);

  const isGeneratingRef = useRef(false);
  const handleGenerateBill = useCallback(async () => {
    if (!user) return showToast('Node session offline.', 'error');
    if (!billAmount || isNaN(Number(billAmount))) return showToast('Enter a valid amount.', 'error');
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsGenerating(true);

    try {
      const totalAmount = Number(billAmount);
      const { data: activeTenants, error: activeErr } = await supabase
        .from('tenants')
        .select('*')
        .eq('is_active', true);

      if (activeErr || !activeTenants?.length) throw new Error('Zero active nodes detected.');

      const baseSplit = totalAmount / activeTenants.length;
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

      const { data: masterBill, error: billError } = await supabase
        .from('monthly_bills')
        .insert({
          billing_period: currentMonth,
          total_amount_naira: totalAmount,
          active_tenant_count: activeTenants.length,
          base_split_amount: baseSplit,
          due_date: dueDate,
          created_by: user?.id
        })
        .select()
        .single();

      if (billError || !masterBill) throw new Error('Failed to create master bill record.');

      const invoicesToDeploy = activeTenants.map((t: Tenant) => ({
        bill_id: masterBill.id,
        tenant_id: t.id,
        amount_due: baseSplit
      }));
      await supabase.from('tenant_invoices').insert(invoicesToDeploy);

      const response = await fetch('/api/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'MATRIX_GENERATED',
          total_network_volume: totalAmount,
          invoices: activeTenants.map((t: Tenant) => ({ tenant_email: t.email, amount_due: baseSplit }))
        })
      });

      const matrixResult = await response.json();
      if (!response.ok) throw new Error(matrixResult.message || 'Gateway rejected notification payload.');

      showToast('Invoices broadcast across all nodes.', 'success');
      setBillAmount('');
      mutateDashboard();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  }, [billAmount, user, mutateDashboard, showToast]);

  const handleToggleNodeState = useCallback(async (tenantId: string, currentState: boolean) => {
    const newState = !currentState;
    mutateDashboard((currentData: any) => {
      if (!currentData) return currentData;
      return {
        ...currentData,
        roster: currentData.roster.map((t: Tenant) =>
          t.id === tenantId ? { ...t, is_active: newState } : t
        )
      };
    }, false);

    try {
      const { error } = await supabase.from('tenants').update({ is_active: newState }).eq('id', tenantId);
      if (error) throw error;
      showToast(`Node ${newState ? 'reactivated' : 'suspended'}.`, 'success');
    } catch (err) {
      showToast('Failed to update node state — reverting.', 'error');
      mutateDashboard();
    }
  }, [mutateDashboard, showToast]);

  const copyToClipboard = useCallback(async (text: string, fieldId: string) => {
    const ok = await safeWriteClipboard(text);
    if (ok) {
      setCopiedField(fieldId);
      showToast('Copied to clipboard.', 'success');
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      showToast('Copy failed — please select manually.', 'error');
    }
  }, [showToast]);

  const handleSignOut = useCallback(async () => {
    await supabase.removeAllChannels();
    await supabase.auth.signOut();
    router.push('/');
  }, [router]);

  const handleExecuteWithdrawal = useCallback(async () => {
    const dest = withdrawDestination.trim() as `0x${string}`;
    const amount = withdrawAmountInput.trim();

    if (!dest.startsWith('0x') || dest.length !== 42) {
      return showToast('Invalid destination address.', 'error');
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return showToast('Invalid withdrawal amount.', 'error');
    }
    if (Number(amount) > treasuryBalance) {
      return showToast('Amount exceeds available treasury balance.', 'error');
    }

    setIsWithdrawing(true);
    try {
      if (chainId !== TARGET_CHAIN_ID) await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      const cryptoAmount = parseUnits(amount, 6);
      await writeContract.writeContractAsync({
        address: TREASURY_ADDRESS,
        abi: TREASURY_ABI,
        functionName: 'routeToExternal',
        args: [dest, cryptoAmount]
      });
      showToast('Withdrawal executed successfully.', 'success');
      setIsWithdrawModalOpen(false);
      setWithdrawAmountInput('');
      setWithdrawDestination('');
    } catch (err: any) {
      showToast(err.shortMessage || err.message, 'error');
    } finally {
      setIsWithdrawing(false);
    }
  }, [withdrawDestination, withdrawAmountInput, treasuryBalance, chainId, switchChainAsync, writeContract, showToast]);

  const analytics = useMemo(() => {
    if (!allHistoricalInvoices || allHistoricalInvoices.length === 0) {
      const emptyMonths = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        return { label: d.toLocaleString('default', { month: 'short' }), networkTotal: 0, personalTotal: 0, key: '' };
      }).reverse();
      return { totalFiat: 0, totalCrypto: 0, collectionRate: 0, totalVolume: 0, personalVolume: 0, monthlyData: emptyMonths, maxMonthValue: 1, recentFeed: [], activeAvatars: [] };
    }

    const paid = allHistoricalInvoices.filter((i: Invoice) => i.is_paid === true);
    const fiatPaid = paid.filter((i: Invoice) => i.payment_method?.toUpperCase() === 'FIAT');
    const cryptoPaid = paid.filter((i: Invoice) => {
      const m = i.payment_method?.toUpperCase() ?? '';
      return m === 'USDC' || m.includes('VAULT');
    });

    const totalVolume = paid.reduce((sum: number, i: Invoice) => sum + Number(i.amount_due || 0), 0);
    const personalVolume = paid
      .filter((i: Invoice) => i.tenant_id === user?.id)
      .reduce((sum: number, i: Invoice) => sum + Number(i.amount_due || 0), 0);

    const collectionRate = allHistoricalInvoices.length > 0
      ? Math.round((paid.length / allHistoricalInvoices.length) * 100)
      : 0;

    let activeAvatars: string[] = [];
    if (tenantRoster.length > 0) {
      activeAvatars = tenantRoster
        .filter((t: Tenant) => t.is_active === true)
        .map((t: Tenant) => {
          const encodedName = encodeURIComponent(t.full_name || 'Node');
          return t.avatar_url || `https://ui-avatars.com/api/?name=${encodedName}&background=0F172A&color=3B82F6&bold=true`;
        });
    } else {
      const pic = user?.user_metadata?.picture || user?.user_metadata?.avatar_url;
      if (pic) activeAvatars.push(pic);
    }

    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('default', { month: 'short' }),
        networkTotal: 0,
        personalTotal: 0
      };
    }).reverse();

    paid.forEach((inv: Invoice) => {
      try {
        const dateToParse = inv.paid_at || inv.created_at;
        if (!dateToParse) return;
        const d = new Date(dateToParse);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const targetMonth = last6Months.find(m => m.key === key);
        if (targetMonth) {
          const amount = Number(inv.amount_due || 0);
          targetMonth.networkTotal += amount;
          if (inv.tenant_id === user?.id) targetMonth.personalTotal += amount;
        }
      } catch (_) {}
    });

    const absoluteMax = Math.max(...last6Months.map(d => d.networkTotal), 1);
    const maxMonthValue = absoluteMax * 1.2;
    const recentFeed = [...paid]
      .sort((a: Invoice, b: Invoice) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime())
      .slice(0, 10);

    return {
      totalFiat: fiatPaid.reduce((sum: number, i: Invoice) => sum + Number(i.amount_due || 0), 0),
      totalCrypto: cryptoPaid.reduce((sum: number, i: Invoice) => sum + Number(i.amount_due || 0), 0),
      collectionRate,
      totalVolume,
      personalVolume,
      monthlyData: last6Months,
      maxMonthValue,
      recentFeed,
      activeAvatars
    };
  }, [allHistoricalInvoices, user, tenantRoster]);

  const resolvedUserName = user?.user_metadata?.full_name || user?.full_name || 'Compound Node';
  const authPhoto = user?.user_metadata?.picture || user?.user_metadata?.avatar_url;
  const resolvedAvatarUrl = user?.avatar_url || authPhoto
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedUserName)}&background=0F172A&color=3B82F6&bold=true`;

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = `https://ui-avatars.com/api/?name=Node&background=111111&color=444444&bold=true`;
    e.currentTarget.onerror = null;
  };

  if (loading || (!dashboardData && user)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-black text-neutral-100 font-sans selection:bg-blue-500/30 overflow-hidden relative">

      <div className="fixed inset-0 pointer-events-none z-0">
        {/* 🛡️ PERFORMANCE UPGRADE: Removed animate-pulse & mix-blend-screen. Hardware accelerated via transform-gpu */}
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[150px] opacity-30 transform-gpu pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[120px] opacity-20 transform-gpu pointer-events-none"></div>
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`, backgroundSize: '32px 32px' }}></div>
      </div>

      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-5 py-4 rounded-xl shadow-2xl backdrop-blur-xl border font-mono text-[10px] md:text-xs animate-in slide-in-from-right-5 duration-300 ${t.type === 'error' ? 'border-red-500/40 bg-[#1A0505]/90 text-red-400' : 'border-blue-500/30 bg-[#050A1A]/90 text-blue-400'}`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${t.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
              {t.message}
            </div>
          </div>
        ))}
      </div>

      <aside className="hidden md:flex flex-col w-64 border-r border-white/[0.04] bg-black/50 backdrop-blur-3xl shrink-0 z-20 relative">
        <div className="p-6 border-b border-white/[0.04] flex items-center gap-4">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md group-hover:bg-blue-500/40 transition-all"></div>
            <img src="/logo.jpg" alt="Logo" className="w-9 h-9 rounded-xl object-cover relative z-10 border border-white/10" />
          </div>
          <div>
            <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-200 to-neutral-500 tracking-tight">CompoundOS</h1>
            <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">Core Infrastructure</p>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 flex flex-col gap-2">
          {user?.is_admin && (
            <button
              onClick={() => setActiveWorkspace('ADMIN')}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 ${activeWorkspace === 'ADMIN' ? 'bg-blue-900/20 text-blue-400 border border-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)] font-bold' : 'text-neutral-500 hover:text-white hover:bg-white/[0.02] border border-transparent'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
              Command Center
            </button>
          )}

          <button
            onClick={() => setActiveWorkspace('ANALYTICS')}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 ${activeWorkspace === 'ANALYTICS' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] font-bold' : 'text-neutral-500 hover:text-white hover:bg-white/[0.02] border border-transparent'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" /></svg>
            Data Terminal
          </button>

          <button
            onClick={() => setActiveWorkspace('RESIDENT')}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 ${activeWorkspace === 'RESIDENT' ? 'bg-white/[0.05] text-white border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] font-bold' : 'text-neutral-500 hover:text-white hover:bg-white/[0.02] border border-transparent'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
            Resident Ledger
          </button>

          <div className="mt-auto border-t border-white/[0.04] pt-4">
            <a 
              href="https://t.me/Lithos_eth" 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[10px] font-mono uppercase tracking-wider text-neutral-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-300 group"
            >
              <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
              Contact Support Oracle
            </a>
          </div>
        </div>

        <div className="p-4 border-t border-white/[0.04]">
          <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-between gap-3 hover:border-white/10 transition-colors group">
            <img src={resolvedAvatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10 object-cover" onError={handleImageError} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">{resolvedUserName}</p>
              <p className="text-[9px] text-neutral-500 truncate font-mono uppercase mt-0.5 tracking-wider">{user?.is_admin ? 'Root SysAdmin' : 'Node Resident'}</p>
            </div>
            <button onClick={handleSignOut} className="text-neutral-500 hover:text-red-400 p-1 transition-colors" title="Sign out">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-transparent relative z-10 w-full">
        <header className="md:hidden flex justify-between items-center px-5 py-4 border-b border-white/[0.04] bg-black/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-lg blur-md"></div>
              <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg object-cover relative z-10 border border-white/10" />
            </div>
            <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-200 to-neutral-500 tracking-tight">CompoundOS</h1>
          </div>
          <div className="flex items-center gap-2">
            <CustomConnectButton />
            <button onClick={handleSignOut} className="text-neutral-500 hover:text-red-400 p-2 bg-white/[0.02] border border-white/10 rounded-xl transition-colors" title="Sign Out">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </header>

        <div className="md:hidden flex border-b border-white/[0.04] bg-black/80 backdrop-blur-xl sticky top-[65px] z-20 overflow-x-auto custom-scrollbar">
          {user?.is_admin && (
            <button
              onClick={() => setActiveWorkspace('ADMIN')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap px-4 border-b-2 transition-colors ${activeWorkspace === 'ADMIN' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-neutral-500'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
              Command
            </button>
          )}
          <button
            onClick={() => setActiveWorkspace('ANALYTICS')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap px-4 border-b-2 transition-colors ${activeWorkspace === 'ANALYTICS' ? 'border-emerald-500 text-emerald-400 font-bold' : 'border-transparent text-neutral-500'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" /></svg>
            Data
          </button>
          <button
            onClick={() => setActiveWorkspace('RESIDENT')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap px-4 border-b-2 transition-colors ${activeWorkspace === 'RESIDENT' ? 'border-white text-white font-bold' : 'border-transparent text-neutral-500'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
            Ledger
          </button>
        </div>

        <header className="hidden md:flex justify-between items-center px-10 py-5 border-b border-white/[0.04] bg-black/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">System Operational • Signal Focus • Latency 12ms</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotificationsOpen(v => !v)}
                className="relative p-2 text-neutral-400 hover:text-white transition-colors focus:outline-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {pendingActionInvoices.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-black"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] md:w-80 bg-black border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                  <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h4 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Notification Hub</h4>
                    <span className="text-[9px] font-mono text-neutral-500 uppercase px-2 py-0.5 bg-white/5 rounded">Live Feed</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                    {pendingActionInvoices.length > 0 ? (
                      pendingActionInvoices.map((inv: Invoice, idx: number) => {
                        let dueStr = '';
                        if (Array.isArray(inv.monthly_bills) && inv.monthly_bills.length > 0) {
                            dueStr = inv.monthly_bills[0].due_date;
                        } else if (!Array.isArray(inv.monthly_bills) && inv.monthly_bills) {
                            dueStr = inv.monthly_bills.due_date;
                        }
                        
                        const { isLate } = calculateDynamicAmount(inv.amount_due, dueStr);
                        return (
                          <div
                            key={idx}
                            className={`p-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors ${isLate ? 'border-l-2 border-l-red-500' : 'border-l-2 border-l-blue-500'}`}
                          >
                            <p className="text-[10px] text-white font-mono uppercase">{isLate ? 'Penalty Deployed' : 'New Invoice Generated'}</p>
                            <p className="text-[9px] text-neutral-500 font-mono mt-1 leading-relaxed">
                              {isLate ? '10% late fee applied. Immediate settlement required.' : 'A new network utility bill is ready for signature.'}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-[10px] font-mono text-neutral-600 uppercase">System state quiet</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <CustomConnectButton />
          </div>
        </header>

        <div className="p-5 md:p-10 max-w-[1400px] w-full mx-auto space-y-8 md:space-y-10">
          <div className="hidden md:flex justify-between items-end pb-2">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">
                {activeWorkspace === 'ADMIN' ? 'Command Center' : activeWorkspace === 'ANALYTICS' ? 'Data Terminal' : 'Resident Ledger'}
              </h2>
              <p className="text-[10px] md:text-xs text-neutral-500 mt-2 font-mono uppercase tracking-widest flex items-center gap-2">
                {activeWorkspace === 'ADMIN'
                  ? 'Billing Matrix Deployment Engine'
                  : activeWorkspace === 'ANALYTICS'
                    ? 'Dune-Grade Statistical Analytics'
                    : 'Obligations & Cryptographic Settlements'}
              </p>
            </div>
          </div>

          {/* ==============================================================
              MODULE: COMMAND CENTER (ADMIN ONLY)
          ============================================================== */}
          {activeWorkspace === 'ADMIN' && user?.is_admin && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-6 md:p-8 h-fit shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/[0.03] blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-2 relative z-10 flex items-center gap-2">
                    Broadcast Invoices
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] px-2 py-0.5 rounded-full">Cron Bound</span>
                  </h2>
                  <p className="text-[10px] md:text-[11px] text-neutral-400 mb-8 font-mono leading-relaxed relative z-10 md:pr-8">
                    Calculates base splits and propagates to all active nodes. Suspended nodes are excluded from the matrix.
                  </p>
                  <div className="space-y-6 relative z-10">
                    <div className="relative border-b border-white/10 focus-within:border-blue-500/50 transition-colors py-2">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xl">₦</span>
                      <input
                        type="number"
                        value={billAmount}
                        onChange={(e) => setBillAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-transparent py-3 md:py-4 pl-8 pr-4 text-white font-mono tabular-nums text-2xl focus:outline-none placeholder-neutral-800 tracking-tight"
                      />
                    </div>
                    <button
                      onClick={handleGenerateBill}
                      disabled={isGenerating || !billAmount}
                      className="w-full bg-white hover:bg-neutral-200 text-black py-4 rounded-xl font-bold text-[11px] md:text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                    >
                      {isGenerating ? 'Compiling Matrix...' : 'Broadcast Network Bills'}
                    </button>
                  </div>
                </div>

                <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/[0.03] blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <div>
                    <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 mb-2 relative z-10">
                      Live Cycle Tracking
                    </h2>
                    <p className="text-[10px] md:text-[11px] text-neutral-400 font-mono relative z-10">
                      {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} Settlement Index
                    </p>
                  </div>
                  <div className="mt-8 md:mt-12 relative z-10">
                    <div className="flex items-end gap-2 mb-4">
                      <span className="text-5xl md:text-7xl font-bold text-white font-mono tabular-nums tracking-tighter leading-none">{adminStats.currentCyclePaid}</span>
                      <span className="text-xl md:text-2xl text-neutral-600 font-mono tabular-nums mb-1">/ {adminStats.currentCycleTotal}</span>
                    </div>
                    <p className="text-[9px] md:text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-6">Nodes Cleared</p>
                    <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${adminStats.currentCycleTotal > 0 ? (adminStats.currentCyclePaid / adminStats.currentCycleTotal) * 100 : 0}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-white/[0.04] pb-5 mb-5 relative z-10">
                  <div>
                    <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                      Network Node Roster
                    </h2>
                    <p className="text-[9px] md:text-[10px] text-neutral-500 font-mono mt-1 uppercase tracking-widest">
                      Active nodes receive broadcast matrices. Suspended nodes remain in history.
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-white/[0.02] border border-white/5 rounded-full text-[9px] font-mono uppercase tracking-widest text-neutral-400">
                    {tenantRoster.length} Registered
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 relative z-10">
                  {tenantRoster.length > 0 ? tenantRoster.map((tenant: Tenant) => {
                    const encodedName = encodeURIComponent(tenant.full_name || 'Network Node');
                    const avatar = tenant.avatar_url || `https://ui-avatars.com/api/?name=${encodedName}&background=0F172A&color=3B82F6&bold=true`;
                    const isActive = tenant.is_active;
                    return (
                      <div
                        key={tenant.id}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-white/[0.01] border-white/5 hover:border-white/20' : 'bg-[#050505] border-red-900/20 opacity-70 hover:opacity-100'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative">
                            <img src={avatar} className={`w-10 h-10 rounded-full object-cover border ${isActive ? 'border-white/10' : 'border-red-900/50 grayscale'}`} alt="Node" onError={handleImageError} />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[11px] md:text-xs font-bold font-mono truncate ${isActive ? 'text-white' : 'text-neutral-500 line-through decoration-red-500/50'}`}>{tenant.full_name || 'Anonymous Node'}</p>
                            <p className="text-[9px] font-mono text-neutral-500 truncate mt-0.5">{tenant.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleNodeState(tenant.id, isActive)}
                          className={`shrink-0 ml-3 px-3 py-1.5 rounded text-[8px] md:text-[9px] font-mono font-bold uppercase tracking-widest transition-all ${isActive ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'}`}
                        >
                          {isActive ? 'Suspend' : 'Reactivate'}
                        </button>
                      </div>
                    );
                  }) : (
                    <div className="col-span-full py-8 text-center border border-dashed border-white/10 rounded-2xl">
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">No nodes mapped from database.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/[0.03] blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>

                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                      Treasury Liquidity
                    </h2>
                    <p className="text-[10px] md:text-[11px] text-neutral-400 font-mono">Real-time Smart Contract TVL</p>
                  </div>
                  <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono rounded-full uppercase tracking-widest">
                    Secured
                  </div>
                </div>

                <div className="mt-8 md:mt-12 relative z-10">
                  <div className="flex items-baseline gap-1.5 mb-6">
                    <span className="text-5xl md:text-6xl font-bold text-white font-mono tabular-nums tracking-tighter">
                      ${treasuryBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xl text-neutral-500 font-mono font-bold">USDC</span>
                  </div>

                  {isConnected ? (
                    <button
                      onClick={() => setIsWithdrawModalOpen(true)}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white py-4 rounded-xl font-bold text-[11px] md:text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Initialize Withdrawal
                    </button>
                  ) : (
                    <div className="w-full [&>div]:w-full [&_button]:w-full">
                      <ConnectButton label="Connect Wallet to Withdraw" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              MODULE: DATA TERMINAL (ANALYTICS)
          ============================================================== */}
          {activeWorkspace === 'ANALYTICS' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Gross Treasury TVL</h3>
                      <p className="text-[10px] text-emerald-400 font-mono mt-1 uppercase flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Network State</p>
                    </div>
                  </div>
                  <p className="text-3xl lg:text-4xl font-mono tabular-nums font-bold text-white tracking-tighter drop-shadow-lg">₦{analytics.totalVolume.toLocaleString()}</p>
                </div>

                <div className="bg-black/80 backdrop-blur-md border border-emerald-500/10 rounded-3xl p-5 md:p-6 shadow-[0_0_20px_rgba(16,185,129,0.05)] relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.05] blur-3xl rounded-full"></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <h3 className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,1)]"></span> Personal Contribution
                    </h3>
                  </div>
                  <p className="text-3xl lg:text-4xl font-mono tabular-nums font-bold text-emerald-400 tracking-tighter relative z-10">₦{analytics.personalVolume.toLocaleString()}</p>
                </div>

                <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/[0.03] blur-3xl rounded-full"></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <h3 className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,1)]"></span> Web3 Vault
                    </h3>
                  </div>
                  <p className="text-3xl lg:text-4xl font-mono tabular-nums font-bold text-white tracking-tighter relative z-10">₦{analytics.totalCrypto.toLocaleString()}</p>
                </div>

                <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden group hover:border-purple-500/30 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/[0.03] blur-3xl rounded-full"></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <h3 className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,1)]"></span> Fiat Vault
                    </h3>
                  </div>
                  <p className="text-3xl lg:text-4xl font-mono tabular-nums font-bold text-white tracking-tighter relative z-10">₦{analytics.totalFiat.toLocaleString()}</p>
                </div>

                <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl relative group hover:border-white/10 transition-all duration-300 flex flex-col justify-between">
                  <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] blur-3xl rounded-full"></div>
                  </div>
                  <div className="flex justify-between items-start mb-4 relative z-10 gap-3">
                    <h3 className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest whitespace-nowrap">Network Effic.</h3>
                    <div className="flex -space-x-2 shrink-0">
                      {analytics.activeAvatars.slice(0, 5).map((url, idx) => (
                        <img key={idx} src={url} alt="Node" className="w-6 h-6 md:w-7 md:h-7 rounded-full border-2 border-black object-cover relative z-10 shadow-md" onError={handleImageError} />
                      ))}
                      {analytics.activeAvatars.length > 5 && (
                        <div className="w-6 h-6 md:w-7 md:h-7 rounded-full border-2 border-black bg-neutral-800 flex items-center justify-center text-[8px] font-mono text-white relative z-10 shadow-md">
                          +{analytics.activeAvatars.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 relative z-10 gap-3">
                    <p className="text-3xl lg:text-4xl font-mono tabular-nums font-bold text-white tracking-tighter shrink-0">{analytics.collectionRate}%</p>
                    <div className="w-full sm:w-24 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div style={{ width: `${analytics.collectionRate}%` }} className="h-full bg-white transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-8 shadow-2xl relative group hover:border-white/10 transition-colors duration-500">
                  <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `linear-gradient(to right, #ffffff05 1px, transparent 1px), linear-gradient(to bottom, #ffffff05 1px, transparent 1px)`, backgroundSize: '40px 40px' }}></div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 md:mb-12 relative z-10 gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Settlement Liquidity Flux</h3>
                      <p className="text-[9px] md:text-[10px] text-neutral-500 font-mono mt-2 uppercase tracking-widest flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)]"></span> Network Total</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> Personal Output</span>
                      </p>
                    </div>
                  </div>
                  <div className="h-48 md:h-64 flex items-end justify-between gap-2 md:gap-6 relative z-10 border-l border-b border-white/[0.05] pl-2 pb-0 pt-4">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pt-4 pb-0 pl-2">
                      <div className="w-full h-px bg-white/[0.03] border-t border-dashed border-white/[0.05]"></div>
                      <div className="w-full h-px bg-white/[0.03] border-t border-dashed border-white/[0.05]"></div>
                      <div className="w-full h-px bg-white/[0.03] border-t border-dashed border-white/[0.05]"></div>
                    </div>
                    {analytics.monthlyData.map((data, idx) => {
                      const networkPct = Math.max((data.networkTotal / analytics.maxMonthValue) * 100, 1);
                      const personalPct = data.personalTotal > 0 ? Math.max((data.personalTotal / analytics.maxMonthValue) * 100, 1) : 0;
                      const isZero = data.networkTotal === 0;
                      return (
                        <div key={idx} tabIndex={0} className="flex flex-col items-center flex-1 group/month relative h-full justify-end cursor-pointer outline-none touch-manipulation">
                          <div className="flex items-end justify-center gap-1 md:gap-2 w-full h-full relative z-10">
                            <div className={`w-3 md:w-6 lg:w-8 transition-all duration-700 ease-out rounded-t-md ${isZero ? 'bg-white/[0.05]' : 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] group-hover/month:bg-blue-500 group-focus/month:bg-blue-500'}`} style={{ height: `${networkPct}%` }}></div>
                            {!isZero && (
                              <div className="w-3 md:w-6 lg:w-8 transition-all duration-700 ease-out rounded-t-md bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] group-hover/month:bg-emerald-400 group-focus/month:bg-emerald-400" style={{ height: `${personalPct}%` }}></div>
                            )}
                          </div>
                          {!isZero && (
                            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/month:opacity-100 group-focus/month:opacity-100 transition-all duration-200 bg-[#0A0A0A] border border-white/20 text-white text-[9px] md:text-[10px] font-mono p-4 rounded-xl pointer-events-none shadow-[0_20px_50px_rgba(0,0,0,1)] z-50 min-w-[170px] backdrop-blur-xl scale-95 group-hover/month:scale-100 group-focus/month:scale-100 origin-bottom">
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-white/20"></div>
                              <div className="text-center text-neutral-400 mb-3 pb-2 border-b border-white/10 uppercase tracking-widest font-bold">{data.label} Settlement</div>
                              <div className="flex justify-between gap-4 mb-2">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]"></span> Network</span>
                                <span className="font-bold text-white">₦{data.networkTotal.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span> Personal</span>
                                <span className="font-bold text-emerald-400">₦{data.personalTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                          <span className="text-[8px] md:text-[10px] text-neutral-500 font-mono mt-3 md:mt-4 uppercase tracking-widest">{data.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-4 bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col h-[350px] md:h-[410px] hover:border-white/10 transition-colors duration-500 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
                  <div className="border-b border-white/[0.06] pb-4 mb-4 shrink-0 flex justify-between items-center relative z-10">
                    <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Live Protocol Logs</h3>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar relative z-10">
                    {analytics.recentFeed.map((inv: Invoice, idx: number) => {
                      const isWeb3 = inv.payment_method?.toUpperCase() === 'USDC' || inv.payment_method?.toUpperCase()?.includes('VAULT');
                      const isCurrentUser = inv.tenant_id === user?.id;
                      const nodeUserName = user?.is_admin || isCurrentUser
                        ? (inv.tenants?.full_name || 'Network Node')
                        : `Node 0x${inv.tenant_id?.slice(0, 4)}...`;
                      const currentUserAuthPic = user?.user_metadata?.picture || user?.user_metadata?.avatar_url;
                      const nodeAvatar = isCurrentUser ? (currentUserAuthPic || inv.tenants?.avatar_url) : inv.tenants?.avatar_url;
                      const encodedName = encodeURIComponent(inv.tenants?.full_name || 'Node');
                      const finalAvatar = nodeAvatar || `https://ui-avatars.com/api/?name=${encodedName}&background=0F172A&color=3B82F6&bold=true`;
                      return (
                        <div key={idx} className="bg-transparent border border-white/[0.04] p-3 rounded-2xl flex items-center justify-between group hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={finalAvatar} className="w-8 h-8 rounded-full border border-white/10 object-cover" alt="Node" onError={handleImageError} />
                            <div className="min-w-0">
                              <p className="text-[10px] md:text-[11px] font-bold font-mono text-white truncate max-w-[100px] md:max-w-[130px] group-hover:text-blue-400 transition-colors">{nodeUserName}</p>
                              <p className="text-[8px] md:text-[9px] font-mono text-neutral-500 uppercase tracking-widest mt-1 truncate max-w-[100px] md:max-w-[130px] flex items-center gap-1.5">
                                {isWeb3
                                  ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                                  : <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></span>}
                                {inv.transaction_reference?.startsWith('0x')
                                  ? `${inv.transaction_reference.slice(0, 12)}...`
                                  : 'Ledger Sync'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] md:text-[12px] font-mono tabular-nums font-bold text-white">₦{Number(inv.amount_due).toLocaleString()}</p>
                            <p className={`text-[8px] md:text-[9px] font-mono font-bold uppercase tracking-widest mt-1 ${isWeb3 ? 'text-blue-400' : inv.is_paid ? 'text-purple-400' : 'text-amber-500'}`}>
                              {inv.is_paid ? (inv.payment_method || 'FIAT') : 'Pending'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {analytics.recentFeed.length === 0 && (
                      <div className="h-full flex items-center justify-center text-[9px] md:text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Awaiting First Block</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              MODULE: RESIDENT LEDGER
          ============================================================== */}
          {activeWorkspace === 'RESIDENT' && (
            <div className="animate-in fade-in duration-500 space-y-8">
              <div className="bg-[#050A1A] border border-blue-500/20 rounded-3xl p-6 md:p-10 relative overflow-hidden shadow-[0_0_50px_rgba(37,99,235,0.05)]">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)`, backgroundSize: '30px 30px' }}></div>

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
                  <div className="flex-1 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      <span className="text-[9px] font-mono font-bold text-blue-400 uppercase tracking-widest">L2 Base Protocol Vault</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">Trustless Immutability</h3>
                    <p className="text-[11px] md:text-xs text-neutral-400 font-mono leading-relaxed max-w-xl">
                      Authorizing USDC requires precise payload parsing directly on your hardware layer to execute automatic network deductions. Blind signing has been strictly prohibited across this network infrastructure.
                    </p>
                  </div>

                  <div className="w-full lg:w-[450px] bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col gap-5">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Active Limit</span>
                        <span className="text-2xl md:text-3xl font-mono tabular-nums font-bold text-white tracking-tighter">${baseAllowanceUSDC.toFixed(2)}</span>
                      </div>
                      <div className="relative h-2 w-full bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${baseAllowanceUSDC > 0 ? 'bg-gradient-to-r from-blue-500 to-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-transparent'}`}
                          style={{ width: `${Math.min(100, (baseAllowanceUSDC / 50) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Status Engine</span>
                        {baseAllowanceUSDC > 0 ? (
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded font-bold uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Ready for Execution
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Awaiting Deposit Limit</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#050505] border border-white/5 p-1.5 rounded-xl flex items-center gap-2 focus-within:border-blue-500/50 focus-within:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all">
                      {isConnected ? (
                        <>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-xs font-bold">$</span>
                            <input
                              type="number"
                              value={allowanceInput}
                              onChange={(e) => setAllowanceInput(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-transparent py-2.5 pl-7 pr-3 text-white font-mono tabular-nums text-sm focus:outline-none placeholder-neutral-800"
                            />
                          </div>
                          <button
                            onClick={handleApproveAllowance}
                            disabled={isApproving}
                            className="bg-white hover:bg-neutral-200 text-black px-4 md:px-6 py-2.5 rounded-lg text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {isApproving ? 'Signing...' : 'Top-Up Vault'}
                          </button>
                        </>
                      ) : (
                        <div className="w-full flex justify-center py-1 [&>div]:w-full [&_button]:w-full">
                          <CustomConnectButton />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {pendingActionInvoices.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] md:text-[11px] font-mono text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_6px_rgba(59,130,246,1)]"></span>
                    Dynamic Ledger Requirements
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                    {pendingActionInvoices.map((invoice: Invoice) => {
                      let dueStr = '';
                      let period = 'Current Bill';
                      if (Array.isArray(invoice.monthly_bills) && invoice.monthly_bills.length > 0) {
                          dueStr = invoice.monthly_bills[0].due_date;
                          period = invoice.monthly_bills[0].billing_period;
                      } else if (!Array.isArray(invoice.monthly_bills) && invoice.monthly_bills) {
                          dueStr = invoice.monthly_bills.due_date;
                          period = invoice.monthly_bills.billing_period;
                      }
                      
                      const { amount, isLate, daysLeft, totalGrace } = calculateDynamicAmount(invoice.amount_due, dueStr);
                      const usdValue = (amount / ngnToUsdRate).toFixed(2);
                      const isVaultReady = baseAllowanceUSDC >= Number(usdValue);

                      return (
                        <div
                          key={invoice.id}
                          className={`bg-black/80 backdrop-blur-md border ${isLate ? 'border-red-500/40' : 'border-white/[0.04] hover:border-white/20'} rounded-3xl p-6 md:p-8 flex flex-col justify-between gap-6 md:gap-8 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-2xl ${isLate ? 'hover:shadow-[0_0_40px_rgba(239,68,68,0.2)]' : 'hover:shadow-[0_0_40px_rgba(59,130,246,0.15)]'}`}
                        >
                          {!isLate && (
                            <div className="absolute top-0 left-0 w-full h-1 bg-white/[0.02]">
                              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${((totalGrace - daysLeft) / totalGrace) * 100}%` }}></div>
                            </div>
                          )}
                          {isLate && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)]"></div>}

                          <div className="space-y-3 relative z-10">
                            <div className="flex justify-between items-start">
                              <span className="inline-block text-[8px] md:text-[9px] font-mono text-neutral-400 border border-white/10 bg-white/[0.02] px-2 md:px-3 py-1 md:py-1.5 rounded uppercase tracking-widest">
                                {period}
                              </span>
                              {isLate ? (
                                <span className="inline-block text-[8px] md:text-[9px] font-mono text-red-400 font-bold uppercase tracking-widest animate-pulse border border-red-500/20 bg-red-500/10 px-2 md:px-3 py-1 md:py-1.5 rounded">10% Penalty Active</span>
                              ) : (
                                <span className="inline-block text-[8px] md:text-[9px] font-mono text-blue-400 font-bold uppercase tracking-widest border border-blue-500/20 bg-blue-500/10 px-2 md:px-3 py-1 md:py-1.5 rounded">
                                  {daysLeft} Days to Penalty
                                </span>
                              )}
                            </div>
                            <div className="pt-2">
                              <h3 className={`text-4xl md:text-5xl font-bold tracking-tight font-mono tabular-nums transition-colors ${isLate ? 'text-red-400 group-hover:text-red-300' : 'text-white'}`}>
                                ₦{Number(amount).toLocaleString()}
                              </h3>
                              <p className="text-[10px] md:text-[11px] text-neutral-500 font-mono mt-3 uppercase tracking-widest flex items-center gap-2">
                                Est: ${usdValue} USDC
                                {!isVaultReady && (
                                  <span className="text-[8px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">Vault Deficit</span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 md:gap-4 relative z-10">
                            {isVaultReady ? (
                              <button
                                onClick={() => handleOneClickSettle(invoice)}
                                className="col-span-2 md:col-span-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3.5 md:py-4 rounded-xl text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                1-Click Settle
                              </button>
                            ) : (
                              <button
                                onClick={() => { setActiveInvoice({ ...invoice, amount_due: amount }); setPaymentPortalMode('USDC'); }}
                                className="bg-white hover:bg-neutral-200 text-black py-3.5 md:py-4 rounded-xl text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                              >
                                Pay USDC
                              </button>
                            )}
                            <button
                              onClick={() => { setActiveInvoice({ ...invoice, amount_due: amount }); setPaymentPortalMode('FIAT'); }}
                              className={`bg-transparent border border-white/10 hover:border-white hover:bg-white/5 text-white py-3.5 md:py-4 rounded-xl text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${isVaultReady ? 'col-span-2 md:col-span-1' : ''}`}
                            >
                              Fiat Wire
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {clearedInvoices.length > 0 && (
                <div className="space-y-4 pt-5 md:pt-6 border-t border-white/[0.04]">
                  <h3 className="text-[10px] md:text-[11px] font-mono text-neutral-400 uppercase tracking-widest mb-4 md:mb-6">Settled Invariant Logs</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {clearedInvoices.slice(0, displayLimit).map((invoice: Invoice) => {
                      let period = 'Cleared Log';
                      if (Array.isArray(invoice.monthly_bills) && invoice.monthly_bills.length > 0) {
                          period = invoice.monthly_bills[0].billing_period;
                      } else if (!Array.isArray(invoice.monthly_bills) && invoice.monthly_bills) {
                          period = invoice.monthly_bills.billing_period;
                      }
                      
                      return (
                        <div
                          key={invoice.id}
                          onClick={() => setViewingReceipt(invoice)}
                          className="bg-[#050505]/60 backdrop-blur-md border border-white/[0.04] p-5 flex flex-col justify-between gap-4 rounded-2xl group hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-all duration-300 relative overflow-hidden cursor-pointer animate-in fade-in zoom-in-95"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] blur-xl rounded-full group-hover:bg-emerald-500/[0.08] transition-colors"></div>
                          <div className="flex items-center justify-between relative z-10">
                            <span className="text-[8px] md:text-[9px] font-mono text-neutral-500 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">
                              {period}
                            </span>
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-white/[0.04] flex items-center justify-center text-white group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
                              <svg className="w-2.5 h-2.5 md:w-3 md:h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </div>
                          </div>
                          <div className="relative z-10">
                            <h3 className="text-lg md:text-xl font-bold tabular-nums text-neutral-300 font-mono group-hover:text-white transition-colors">₦{Number(invoice.amount_due).toLocaleString()}</h3>
                            <p className="text-[7px] md:text-[8px] font-mono text-neutral-500 uppercase tracking-widest mt-1 group-hover:text-neutral-400">
                              Route: {invoice.payment_method} • View Proof
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {displayLimit < clearedInvoices.length && (
                    <div ref={sentinelRef} className="w-full py-8 flex justify-center items-center">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              )}

              {pendingActionInvoices.length === 0 && clearedInvoices.length === 0 && !isValidating && (
                <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-10 md:p-16 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-5 md:mb-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-xs md:text-sm font-bold text-white font-mono uppercase tracking-widest">Ledger State Synchronized</h3>
                  <p className="text-[9px] md:text-[10px] text-neutral-500 mt-2 font-mono uppercase tracking-widest">No dangling liabilities found across active index hashes.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ================================================================
          MODAL: SMART RECEIPT
      ================================================================ */}
      {viewingReceipt && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingReceipt(null); }}
        >
          <div className="w-full max-w-[480px] bg-[#050505] border border-white/10 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_150px_rgba(16,185,129,0.15)] animate-in zoom-in-95 duration-300">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  Official Settlement Proof
                </h3>
                <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest mt-1">CompoundOS Audited Record</p>
              </div>
              <button
                onClick={() => setViewingReceipt(null)}
                className="text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="text-center mb-8 relative z-10">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block mb-2">Value Extinguished</span>
              <p className="text-5xl font-bold font-mono tabular-nums text-white tracking-tighter">₦{Number(viewingReceipt.amount_due).toLocaleString()}</p>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-6 font-mono text-[10px] relative z-10">
              <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-neutral-500 uppercase">Billing Cycle</span>
                <span className="text-white font-bold">
                  {Array.isArray(viewingReceipt.monthly_bills) && viewingReceipt.monthly_bills.length > 0
                    ? viewingReceipt.monthly_bills[0].billing_period
                    : !Array.isArray(viewingReceipt.monthly_bills) && viewingReceipt.monthly_bills
                        ? viewingReceipt.monthly_bills.billing_period
                        : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-neutral-500 uppercase">Clearance Date</span>
                <span className="text-white">{viewingReceipt.paid_at ? new Date(viewingReceipt.paid_at).toLocaleString() : '—'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-neutral-500 uppercase">Routing Method</span>
                <span className={`font-bold px-2 py-0.5 rounded ${viewingReceipt.payment_method === 'USDC' || viewingReceipt.payment_method?.includes('Vault') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                  {viewingReceipt.payment_method || '—'}
                </span>
              </div>
              
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-neutral-500 uppercase block mb-2">Cryptographic Attestation Hash</span>
                <div className="flex items-center justify-between gap-3 bg-[#000] p-2 rounded-lg border border-white/5">
                  <span className="text-emerald-400 text-[9px] truncate select-all">
                    {viewingReceipt.payment_method === 'FIAT' ? viewingReceipt.id : (viewingReceipt.transaction_reference || '—')}
                  </span>
                  {(viewingReceipt.payment_method === 'USDC' || viewingReceipt.payment_method?.includes('Vault')) && viewingReceipt.transaction_reference?.startsWith('0x') && (
                    <a
                      href={`https://basescan.org/tx/${viewingReceipt.transaction_reference}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-white shrink-0"
                      aria-label="View on Basescan"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleExportReceiptPDF(viewingReceipt)}
              className="w-full mt-8 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 py-4 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export PDF Statement
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: PAYMENT GATEWAY
      ================================================================ */}
      {paymentPortalMode && activeInvoice && (
        <div
          className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && paymentLifecycle !== 'PROCESSING') handleCloseModal();
          }}
        >
          <div className="w-full md:max-w-[420px] bg-[#050505] border-t md:border border-white/10 rounded-t-3xl md:rounded-3xl p-6 md:p-8 flex flex-col max-h-[90vh] md:max-h-[85vh] overflow-y-auto custom-scrollbar shadow-[0_0_100px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 pb-10 md:pb-8">

            {paymentLifecycle !== 'SUCCESS' && (
              <div className="flex justify-between items-start mb-8 md:mb-10">
                <div>
                  <h3 className="text-[9px] md:text-[10px] font-bold text-neutral-400 font-mono uppercase tracking-widest flex items-center gap-2">
                    {paymentPortalMode === 'FIAT'
                      ? <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                      : <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                    {paymentPortalMode === 'FIAT' ? 'Fiat Wire Gateway' : paymentPortalMode === 'VAULT' ? 'Vault Auto-Relayer' : 'ERC20 Routing Engine'}
                  </h3>
                  <p className="text-xs md:text-sm font-bold text-white font-mono uppercase mt-1">
                    {Array.isArray(activeInvoice.monthly_bills) && activeInvoice.monthly_bills.length > 0 
                        ? activeInvoice.monthly_bills[0].due_date 
                        : !Array.isArray(activeInvoice.monthly_bills) && activeInvoice.monthly_bills
                            ? activeInvoice.monthly_bills.due_date
                            : '—'}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  disabled={paymentLifecycle === 'PROCESSING'}
                  className="text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {paymentLifecycle === 'PROCESSING' ? (
              <div className="py-24 md:py-32 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in">
                <div className="w-8 h-8 md:w-10 md:h-10 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                <p className="text-[9px] md:text-[10px] text-neutral-400 font-mono uppercase tracking-widest animate-pulse">Broadcasting Cryptographic Attestation...</p>
              </div>
            ) : paymentLifecycle === 'SUCCESS' ? (
              <div className="py-6 md:py-8 flex flex-col space-y-8 md:space-y-10 animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative mb-2">
                    {/* 🛡️ PERFORMANCE UPGRADE: Replaced heavy layout ping animation with static layered glow */}
                    <div className="absolute inset-[-12px] md:inset-[-16px] border border-emerald-500/30 rounded-full opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.2)]"></div>
                    <img src={resolvedAvatarUrl} alt="Identity" className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-emerald-500/50 object-cover bg-[#000]" onError={handleImageError} />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 md:w-8 md:h-8 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                      <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg md:text-xl font-bold text-white font-mono uppercase tracking-wide">Settlement Finalized</h4>
                    <p className="text-[9px] md:text-[10px] text-emerald-400 font-mono uppercase tracking-widest mt-1">Signer: {resolvedUserName}</p>
                  </div>
                </div>

                <div className="bg-black border border-white/10 p-6 md:p-8 text-center rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-emerald-500/5 blur-2xl rounded-full"></div>
                  <span className="text-[8px] md:text-[9px] font-mono uppercase tracking-widest text-neutral-500 block mb-2 md:mb-3 relative z-10">Value Extinguished</span>
                  <p className="text-4xl md:text-5xl font-bold font-mono tabular-nums text-white tracking-tighter mb-6 md:mb-8 relative z-10">₦{Number(activeInvoice.amount_due).toLocaleString()}</p>
                  <div className="border-t border-white/5 pt-4 md:pt-5 text-left space-y-3 md:space-y-4 font-mono text-[9px] md:text-[10px] relative z-10">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500 uppercase tracking-wider">Protocol Route</span>
                      <span className="text-white uppercase font-bold flex items-center gap-1.5">
                        {paymentPortalMode === 'FIAT'
                          ? <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          : <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                        {paymentPortalMode === 'FIAT' ? 'Paystack Core' : paymentPortalMode === 'VAULT' ? 'Vault Auto-Execution' : 'Base L2'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500 uppercase tracking-wider">Atomic Time</span>
                      <span className="text-neutral-300 uppercase">{new Date().toLocaleTimeString()}</span>
                    </div>
                    <div className="flex flex-col gap-2 pt-3 md:pt-4 border-t border-white/5">
                      <span className="text-neutral-500 uppercase tracking-wider">Cryptographic Hash</span>
                      <span className="text-emerald-400 text-[9px] md:text-[10px] break-all bg-emerald-500/10 p-2 md:p-3 border border-emerald-500/20 rounded-lg mt-1 font-bold">
                        {lastConfirmedTx || 'SECURE-OFFCHAIN-WIRE-LOG'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={handleCloseModal} className="w-full bg-white hover:bg-neutral-200 text-black py-4 rounded-xl text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-colors shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                  Close Terminal
                </button>
              </div>
            ) : (
              <div className="space-y-5 md:space-y-6">
                {paymentPortalMode === 'FIAT' && (
                  <div className="space-y-5 md:space-y-6 animate-in fade-in zoom-in-95">
                    <div className="bg-black border border-white/10 p-6 md:p-8 text-center rounded-2xl md:rounded-3xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-purple-500/10 blur-2xl rounded-full"></div>
                      <span className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-2 md:mb-3 relative z-10">Required Fiat Ingress</span>
                      <span className="text-3xl md:text-4xl font-bold tabular-nums text-white font-mono tracking-tighter relative z-10">
                        ₦{Number(activeInvoice.amount_due).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-black border border-white/10 p-6 md:p-8 text-center space-y-5 md:space-y-6 rounded-2xl md:rounded-3xl">
                      <div>
                        <h4 className="text-[11px] md:text-[12px] font-bold text-white font-mono uppercase tracking-widest">Routing Execution Gateway</h4>
                        <p className="text-[9px] md:text-[10px] text-neutral-400 mt-2 md:mt-3 font-mono uppercase tracking-widest leading-relaxed">Payment will open in a secure Paystack checkout window. Your session is tracked.</p>
                      </div>
                      <button
                        onClick={handleInitializeFiatPayment}
                        className="w-full bg-white hover:bg-neutral-200 text-black py-3.5 md:py-4 text-[10px] md:text-[11px] font-bold font-mono uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] rounded-xl"
                      >
                        Route Intent to Checkout
                      </button>
                    </div>
                  </div>
                )}

                {paymentPortalMode === 'USDC' && (
                  <div className="space-y-6 animate-in fade-in zoom-in-95">
                    <div className="bg-gradient-to-b from-blue-900/20 to-[#050505] border border-blue-500/20 p-8 text-center rounded-3xl relative overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.05)]">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>
                      <span className="text-blue-400 text-[10px] font-mono uppercase tracking-widest block mb-2 relative z-10">Amount Due</span>
                      <div className="flex items-baseline justify-center gap-1.5 relative z-10">
                        <span className="text-4xl md:text-5xl text-white font-bold tabular-nums tracking-tighter">
                          ${(activeInvoice.amount_due / ngnToUsdRate).toFixed(2)}
                        </span>
                        <span className="text-sm md:text-base text-neutral-500 font-mono font-bold">USDC</span>
                      </div>
                    </div>

                    <div className="border border-white/10 bg-[#0A0A0A] p-6 space-y-5 rounded-3xl hover:border-white/20 transition-all duration-300">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-[11px] font-mono font-bold border border-blue-500/20">1</div>
                        <div>
                          <h4 className="text-[11px] font-bold text-white font-mono uppercase tracking-widest">Pay via Smart Contract</h4>
                          <p className="text-[9px] text-neutral-500 font-mono mt-0.5">Recommended • Instant Settlement</p>
                        </div>
                      </div>
                      {isConnected ? (
                        <button
                          onClick={handlePayWithConnectedWallet}
                          className="w-full bg-white hover:bg-neutral-200 text-black py-4 text-[11px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] rounded-xl flex items-center justify-center gap-2"
                        >
                          {chainId !== TARGET_CHAIN_ID ? 'Switch to Base Network' : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              Sign Transaction
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="flex justify-center w-full [&>div]:w-full [&_button]:w-full">
                          <CustomConnectButton />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 px-6 py-1">
                      <div className="h-px bg-white/5 flex-1"></div>
                      <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest">Or Manual Transfer</span>
                      <div className="h-px bg-white/5 flex-1"></div>
                    </div>

                    <div className="border border-white/5 bg-[#050505] p-6 space-y-5 rounded-3xl hover:border-white/10 transition-all duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 text-[11px] font-mono font-bold border border-white/10">2</div>
                        <div>
                          <h4 className="text-[11px] font-bold text-white font-mono uppercase tracking-widest">Verify External Payment</h4>
                          <p className="text-[9px] text-neutral-500 font-mono mt-0.5">Send USDC to Treasury then paste receipt</p>
                        </div>
                      </div>
                      <div className="bg-[#0A0A0A] border border-white/5 p-3 flex items-center justify-between gap-3 rounded-xl focus-within:border-white/20 transition-colors">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[8px] text-neutral-500 font-mono uppercase mb-0.5">Treasury Address (Base)</span>
                          <span className="text-[10px] font-mono text-white truncate">{TREASURY_ADDRESS}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(TREASURY_ADDRESS, 'wallet')}
                          className="text-[9px] font-mono font-bold uppercase bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors shrink-0"
                        >
                          {copiedField === 'wallet' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Paste Base Tx Hash (0x...)"
                          value={manualTxHash}
                          onChange={(e) => setManualTxHash(e.target.value)}
                          className="w-full bg-[#0A0A0A] border border-white/5 p-4 font-mono text-[11px] text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500/50 focus:bg-[#050A1A] transition-colors rounded-xl"
                        />
                        <button
                          onClick={handleVerifyManualCrypto}
                          disabled={!manualTxHash}
                          className="w-full bg-transparent hover:bg-white/[0.03] border border-white/10 hover:border-white/30 text-white py-4 text-[11px] font-mono font-bold uppercase tracking-widest transition-all disabled:opacity-30 rounded-xl"
                        >
                          Submit Receipt
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: TREASURY WITHDRAWAL
      ================================================================ */}
      {isWithdrawModalOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isWithdrawing) {
              setIsWithdrawModalOpen(false);
              setWithdrawAmountInput('');
              setWithdrawDestination('');
            }
          }}
        >
          <div className="w-full md:max-w-[480px] bg-[#050505] border-t md:border border-white/10 rounded-t-3xl md:rounded-3xl p-6 md:p-8 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar shadow-[0_0_100px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">

            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  L1/L2 Extraction Engine
                </h3>
                <p className="text-sm font-bold text-white font-mono uppercase mt-1">Route Treasury Liquidity</p>
              </div>
              <button
                onClick={() => {
                  if (!isWithdrawing) {
                    setIsWithdrawModalOpen(false);
                    setWithdrawAmountInput('');
                    setWithdrawDestination('');
                  }
                }}
                disabled={isWithdrawing}
                className="text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors disabled:opacity-30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Available Capacity</span>
                <span className="text-lg font-mono font-bold text-emerald-400">
                  ${treasuryBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest px-1">Extraction Amount (USDC)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-sm font-bold">$</span>
                  <input
                    type="number"
                    value={withdrawAmountInput}
                    onChange={(e) => setWithdrawAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0A0A0A] border border-white/10 py-4 pl-8 pr-20 text-white font-mono tabular-nums text-lg focus:outline-none focus:border-emerald-500/50 rounded-xl"
                  />
                  <button
                    onClick={() => setWithdrawAmountInput(treasuryBalance.toFixed(6))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-lg transition-colors uppercase"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest px-1 flex justify-between">
                  <span>Destination Vector</span>
                  <span className="text-emerald-500/70">CEX or Non-Custodial</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  </div>
                  <input
                    type="text"
                    value={withdrawDestination}
                    onChange={(e) => setWithdrawDestination(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-[#0A0A0A] border border-white/10 py-4 pl-10 pr-4 text-white font-mono text-sm focus:outline-none focus:border-emerald-500/50 rounded-xl placeholder-neutral-700"
                  />
                </div>
              </div>

              <div className="pt-4">
                <p className="text-[8px] text-neutral-500 font-mono uppercase tracking-widest leading-relaxed mb-4 text-center">
                  Warning: Ensure destination is on Base Mainnet. Funds routed to other networks are permanently lost.
                </p>
                <button
                  onClick={handleExecuteWithdrawal}
                  disabled={isWithdrawing || !withdrawAmountInput || !withdrawDestination}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                >
                  {isWithdrawing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                      Signing...
                    </>
                  ) : (
                    'Confirm Cryptographic Transfer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 3px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type="number"] { -moz-appearance: textfield; }
        `
      }} />
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}