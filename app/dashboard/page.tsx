'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase'; 
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useSwitchChain, usePublicClient, useReadContract } from 'wagmi';
import { decodeEventLog, getAddress, parseUnits } from 'viem';
import { base } from 'viem/chains';
import useSWR from 'swr';

// === PRODUCTION MAINNET CONSTANTS ===
const USDC_CONTRACT_ADDRESS = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const ADMIN_CRYPTO_WALLET = getAddress("0xbc1da63756fb1d71b313475f1cfefdffa2c1307d");
const TARGET_CHAIN_ID = 8453; 

const ERC20_ABI = [
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "boolean" }], stateMutability: "nonpayable", type: "function" },
  { anonymous: false, inputs: [{ indexed: true, name: "from", type: "address" }, { indexed: true, name: "to", type: "address" }, { indexed: false, name: "value", type: "uint256" }], name: "Transfer", type: "event" },
  { inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "boolean" }], stateMutability: "nonpayable", type: "function" }
] as const;

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address: userAddress, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('Connection interrupted while trying to subscribe')) {
        event.preventDefault(); 
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<'RESIDENT' | 'ADMIN' | 'ANALYTICS'>('RESIDENT'); 
  const [isVerifyingRedirect, setIsVerifyingRedirect] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const [billAmount, setBillAmount] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [ngnToUsdRate, setNgnToUsdRate] = useState<number>(1520);
  
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeInvoice, setActiveInvoice] = useState<any>(null);
  const [paymentPortalMode, setPaymentPortalMode] = useState<'FIAT' | 'USDC' | 'VAULT' | null>(null);
  const [manualTxHash, setManualTxHash] = useState('');
  const [lastConfirmedTx, setLastConfirmedTx] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paymentLifecycle, setPaymentLifecycle] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS'>('IDLE');
  
  const [viewingReceipt, setViewingReceipt] = useState<any>(null);
  const [allowanceInput, setAllowanceInput] = useState<string>('5');
  const [isApproving, setIsApproving] = useState(false);
  const [localDeductions, setLocalDeductions] = useState<number>(0);

  const [displayLimit, setDisplayLimit] = useState(8);
  const observer = useRef<IntersectionObserver | null>(null);

  // MAINNET FIX: Connected to TARGET_CHAIN_ID
  const { data: currentAllowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: USDC_CONTRACT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, ADMIN_CRYPTO_WALLET] : undefined,
    query: { enabled: !!userAddress }
  });
  
  const baseAllowanceUSDC = currentAllowanceRaw ? Number(currentAllowanceRaw) / 1000000 : 0;

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    showToast("Copied to clipboard", "success");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSignOut = async () => {
    await supabase.removeAllChannels(); 
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleCloseModal = () => {
    setPaymentPortalMode(null);
    setActiveInvoice(null);
    setManualTxHash('');
    setLastConfirmedTx('');
    setPaymentLifecycle('IDLE');
  };

  const calculateDynamicAmount = (baseAmount: number, dueDateStr: string) => {
    if (!dueDateStr) return { amount: baseAmount, isLate: false, daysLeft: 0, totalGrace: 5 };
    const dueDate = new Date(dueDateStr).getTime();
    const now = new Date().getTime();
    const isLate = now > dueDate;
    const timeDiff = dueDate - now;
    const daysLeft = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    return { amount: isLate ? baseAmount * 1.10 : baseAmount, isLate, daysLeft, totalGrace: 5 };
  };

  const { data: dashboardData, mutate: mutateDashboard, isValidating } = useSWR(
    user ? `dashboard-${user.id}` : null,
    async () => {
      const { data: userInvoices, error: invError } = await supabase
        .from('tenant_invoices')
        .select(`id, amount_due, is_paid, payment_method, transaction_reference, paid_at, created_at, monthly_bills ( billing_period, due_date )`)
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

      let pending = [], cleared = [], allHistorical = [], roster = [], stats = { activeNodes: 0, currentCyclePaid: 0, currentCycleTotal: 0 };

      if (!invError && userInvoices) {
        pending = userInvoices.filter(inv => !inv.is_paid);
        cleared = userInvoices.filter(inv => inv.is_paid);
      }

      const { data: globalLedger, error: globalErr } = await supabase.rpc('get_global_ledger');
      
      if (!globalErr && globalLedger) {
        allHistorical = globalLedger.map((row: any) => ({
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
      const currentCycle = allHistorical.filter(inv => {
          const period = inv.billing_period;
          const createdMonth = new Date(inv.created_at).toLocaleString('default', { month: 'long', year: 'numeric' });
          return period === currentMonthName || createdMonth === currentMonthName;
      });

      stats = {
          activeNodes: roster.length > 0 ? roster.filter(t => t.is_active !== false).length : new Set(allHistorical.map(i => i.tenant_id)).size,
          currentCyclePaid: currentCycle.filter(i => i.is_paid).length,
          currentCycleTotal: currentCycle.length
      };

      return { pending, cleared, allHistorical, roster, stats };
    },
    { revalidateOnFocus: true, keepPreviousData: true }
  );

  const pendingActionInvoices = dashboardData?.pending || [];
  const clearedInvoices = dashboardData?.cleared || [];
  const allHistoricalInvoices = dashboardData?.allHistorical || [];
  const tenantRoster = dashboardData?.roster || [];
  const adminStats = dashboardData?.stats || { activeNodes: 0, currentCyclePaid: 0, currentCycleTotal: 0 };

  const verifyPaystackReturn = async (reference: string) => {
    setIsVerifyingRedirect(true);
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
      await new Promise(resolve => setTimeout(resolve, 1000)); 

      const pendingId = localStorage.getItem('pending_fiat_invoice');
      if (pendingId) {
        const { data: matchedInvoice } = await supabase.from('tenant_invoices').select(`*`).eq('id', pendingId).single();
        if (matchedInvoice) {
           setActiveInvoice(matchedInvoice);
           setPaymentPortalMode('FIAT');
           setLastConfirmedTx(reference);
           setPaymentLifecycle('SUCCESS');
           
           await supabase.from('tenant_invoices').update({ 
             is_paid: true, payment_method: 'FIAT', transaction_reference: reference, paid_at: new Date().toISOString() 
           }).eq('id', pendingId);
        }
        localStorage.removeItem('pending_fiat_invoice');
      }
    } catch (err) {
      console.error("State recovery anomaly:", err);
    } finally {
      setIsVerifyingRedirect(false);
      mutateDashboard(); 
    }
  };

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => { if (data?.rates?.NGN) setNgnToUsdRate(data.rates.NGN); })
      .catch(() => console.warn("Oracle baseline offline."));
  }, []);

  useEffect(() => {
    let activeExecution = true;
    const initializeAppSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        if (activeExecution) {
          setUser(null);
          setLoading(false);
          router.replace('/'); 
        }
        return;
      }

      if (window.location.hash.includes('access_token=') || window.location.search.includes('code=')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const { data: dbUser } = await supabase.from('tenants').select('*').eq('id', session.user.id).single();
      if (!activeExecution) return;

      const authPhoto = session.user.user_metadata?.picture || session.user.user_metadata?.avatar_url || session.user.raw_user_metadata?.picture || session.user.raw_user_metadata?.avatar_url;
      
      if (dbUser && !dbUser.avatar_url && authPhoto) {
         await supabase.from('tenants').update({ avatar_url: authPhoto }).eq('id', session.user.id);
         dbUser.avatar_url = authPhoto;
      }

      const mergedUser = { ...session.user, ...dbUser };
      setUser(mergedUser);
      if (mergedUser?.is_admin) setActiveWorkspace('ADMIN');

      const paystackRef = searchParams.get('reference') || searchParams.get('trxref');
      if (paystackRef) {
        await verifyPaystackReturn(paystackRef);
      }

      setLoading(false);
    };

    initializeAppSession();
    return () => { activeExecution = false; };
  }, [searchParams]);

  const channelRef = useRef<any>(null);
  useEffect(() => {
    if (!user?.id || loading) return; 

    const channelName = `ledger-flux-${user.id}`;
    if (channelRef.current) return;

    const websocketChannel = supabase.channel(channelName)
      .on('postgres', { event: '*', schema: 'public', table: 'tenant_invoices' }, () => {
        mutateDashboard(); 
      });

    websocketChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = websocketChannel;
      }
    });
  }, [user?.id, loading, mutateDashboard]);

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || isValidating) return;
    if (observer.current) observer.current.disconnect();

    if (node) {
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit((prevLimit) => {
            const nextLimit = prevLimit + 8;
            return nextLimit > clearedInvoices.length ? clearedInvoices.length : nextLimit;
          });
        }
      }, { rootMargin: '200px' }); 
      
      observer.current.observe(node);
    }
  }, [loading, isValidating, clearedInvoices.length]);

  const analytics = useMemo(() => {
    if (!allHistoricalInvoices || allHistoricalInvoices.length === 0) {
      const emptyMonths = Array.from({length: 6}, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        return { label: d.toLocaleString('default', { month: 'short' }), total: 0, key: '' };
      }).reverse();
      return { totalFiat: 0, totalCrypto: 0, collectionRate: 0, totalVolume: 0, monthlyData: emptyMonths, maxMonthValue: 1, recentFeed: [], activeAvatars: [] };
    }
    
    const paid = allHistoricalInvoices.filter(i => i.is_paid === true || i.is_paid === 'true');
    const fiatPaid = paid.filter(i => i.payment_method?.toUpperCase() === 'FIAT');
    const cryptoPaid = paid.filter(i => i.payment_method?.toUpperCase() === 'USDC' || i.payment_method?.includes('Vault'));
    
    const totalVolume = paid.reduce((sum, i) => sum + Number(i.amount_due || 0), 0);
    const collectionRate = allHistoricalInvoices.length > 0 ? Math.round((paid.length / allHistoricalInvoices.length) * 100) : 0;

    const activeAvatarsMap = new Map();
    const currentUserAuthPic = user?.user_metadata?.picture || user?.user_metadata?.avatar_url || user?.raw_user_metadata?.picture;
    
    allHistoricalInvoices.forEach(inv => {
      const isMe = inv.tenant_id === user?.id;
      const targetAvatar = isMe ? (currentUserAuthPic || inv.tenants?.avatar_url) : inv.tenants?.avatar_url;
      
      if (targetAvatar && !activeAvatarsMap.has(inv.tenant_id)) {
        activeAvatarsMap.set(inv.tenant_id, targetAvatar);
      }
    });
    
    if (currentUserAuthPic && !activeAvatarsMap.has(user?.id)) {
      activeAvatarsMap.set(user?.id, currentUserAuthPic);
    }
    const activeAvatars = Array.from(activeAvatarsMap.values()).slice(0, 5);

    const last6Months = Array.from({length: 6}, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('default', { month: 'short' }), total: 0 };
    }).reverse();

    paid.forEach(inv => {
       try {
         const dateToParse = inv.paid_at || inv.created_at;
         if(!dateToParse) return;
         const d = new Date(dateToParse);
         if (isNaN(d.getTime())) return;
         const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
         const targetMonth = last6Months.find(m => m.key === key);
         if (targetMonth) targetMonth.total += Number(inv.amount_due || 0);
       } catch (e) { }
    });

    const maxMonthValue = Math.max(...last6Months.map(d => d.total), 1);
    const recentFeed = [...paid].sort((a, b) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime()).slice(0, 10); 

    return { totalFiat: fiatPaid.reduce((sum, i) => sum + Number(i.amount_due || 0), 0), totalCrypto: cryptoPaid.reduce((sum, i) => sum + Number(i.amount_due || 0), 0), collectionRate, totalVolume, monthlyData: last6Months, maxMonthValue, recentFeed, activeAvatars };
  }, [allHistoricalInvoices, user]);

  const handleGenerateBill = async () => {
    if (!billAmount || isNaN(Number(billAmount))) return showToast("Enter a valid amount.", "error");
    setIsGenerating(true);
    try {
      const totalAmount = Number(billAmount);
      const { data: activeTenants, error: activeErr } = await supabase.from('tenants').select('*').eq('is_active', true);
      if (activeErr || !activeTenants?.length) throw new Error("Zero active nodes detected!");
      
      const baseSplit = totalAmount / activeTenants.length;
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

      const { data: masterBill } = await supabase.from('monthly_bills').insert({
        billing_period: currentMonth, total_amount_naira: totalAmount, active_tenant_count: activeTenants.length,
        base_split_amount: baseSplit, due_date: dueDate, created_by: user.id
      }).select().single();

      const invoicesToDeploy = activeTenants.map(t => ({ bill_id: masterBill.id, tenant_id: t.id, amount_due: baseSplit }));
      await supabase.from('tenant_invoices').insert(invoicesToDeploy);

      fetch('/api/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: "MATRIX_GENERATED", total_network_volume: totalAmount, invoices: activeTenants.map(t => ({ tenant_email: t.email, amount_due: baseSplit })) })
      }).catch(() => {});

      showToast(`Invoices broadcasted across all nodes.`, "success");
      setBillAmount('');
      mutateDashboard(); 
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleNodeState = async (tenantId: string, currentState: boolean) => {
    const newState = !currentState;
    mutateDashboard((currentData: any) => {
      if (!currentData) return currentData;
      return { ...currentData, roster: currentData.roster.map((t: any) => t.id === tenantId ? { ...t, is_active: newState } : t) };
    }, false);

    try {
      const { error } = await supabase.from('tenants').update({ is_active: newState }).eq('id', tenantId);
      if (error) throw error;
      showToast(`Node ${newState ? 'synchronized' : 'suspended'} successfully.`, "success");
      mutateDashboard(); 
    } catch (err) {
      showToast("Failed to mutate node state. Reverting.", "error");
      mutateDashboard(); 
    }
  };

  const handleUpdateInvoiceRecord = async (targetInvoiceId: string, method: 'FIAT' | 'USDC', reference: string) => {
    const { error } = await supabase.from('tenant_invoices').update({
      is_paid: true, payment_method: method, transaction_reference: reference, paid_at: new Date().toISOString()
    }).eq('id', targetInvoiceId);
    
    if (!error) { 
      setLastConfirmedTx(reference);
      setPaymentLifecycle('SUCCESS'); 
      mutateDashboard(); 
    } else {
      showToast("Database rejected state verification.", "error");
      setPaymentLifecycle('IDLE');
    }
  };

  // MAINNET FIX: Verify Manual Crypto connected to TARGET_CHAIN_ID variables
  const handleVerifyManualCrypto = async () => {
    const cleanedHash = manualTxHash.trim();
    if (!cleanedHash.startsWith('0x') || cleanedHash.length !== 66) return showToast("Invalid hash format syntax.", "error");
    setPaymentLifecycle('PROCESSING');
    
    try {
      if (!publicClient) throw new Error("RPC Interface failed to mount.");
      const receipt = await publicClient.getTransactionReceipt({ hash: cleanedHash as `0x${string}` });
      if (receipt.status !== 'success') throw new Error("Transaction state indicates failure on-chain.");
      
      const dueInfo = calculateDynamicAmount(activeInvoice.amount_due, Array.isArray(activeInvoice.monthly_bills) ? activeInvoice.monthly_bills[0]?.due_date : activeInvoice.monthly_bills?.due_date);
      const expectedMin = BigInt(Math.max(10000, Math.floor((dueInfo.amount / ngnToUsdRate) * 0.98 * 1000000))); 
      
      let validTransferFound = false;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase()) {
          try {
            const decoded = decodeEventLog({ abi: ERC20_ABI, eventName: 'Transfer', topics: log.topics, data: log.data });
            if (decoded.args.to.toLowerCase() === ADMIN_CRYPTO_WALLET.toLowerCase() && decoded.args.value >= expectedMin) { 
              validTransferFound = true; break; 
            }
          } catch (_) {}
        }
      }
      if (!validTransferFound) throw new Error("No matching USDC transaction matched treasury address.");
      await handleUpdateInvoiceRecord(activeInvoice.id, 'USDC', cleanedHash);
    } catch (err: any) {
      showToast(err.shortMessage || err.message || "Failed to verify transaction.", "error");
      setPaymentLifecycle('IDLE');
    }
  };

  // MAINNET FIX: Pay With Connected Wallet connected to TARGET_CHAIN_ID variables
  const handlePayWithConnectedWallet = async () => {
    setPaymentLifecycle('PROCESSING');
    try {
      if (chainId !== TARGET_CHAIN_ID) return await switchChainAsync({ chainId: TARGET_CHAIN_ID }).then(() => setPaymentLifecycle('IDLE'));
      
      const dueInfo = calculateDynamicAmount(activeInvoice.amount_due, Array.isArray(activeInvoice.monthly_bills) ? activeInvoice.monthly_bills[0]?.due_date : activeInvoice.monthly_bills?.due_date);
      const cryptoValue = parseUnits(((dueInfo.amount / ngnToUsdRate).toFixed(6)), 6); 

      const txHash = await writeContractAsync({ 
        address: USDC_CONTRACT_ADDRESS, abi: ERC20_ABI, functionName: 'transfer', args: [ADMIN_CRYPTO_WALLET, cryptoValue] 
      });
      await handleUpdateInvoiceRecord(activeInvoice.id, 'USDC', txHash);
    } catch (err: any) {
      showToast(err.shortMessage || err.message, "error");
      setPaymentLifecycle('IDLE');
    }
  };

  const handleInitializeFiatPayment = async () => {
    setPaymentLifecycle('PROCESSING');
    try {
      const dueInfo = calculateDynamicAmount(activeInvoice.amount_due, Array.isArray(activeInvoice.monthly_bills) ? activeInvoice.monthly_bills[0]?.due_date : activeInvoice.monthly_bills?.due_date);
      localStorage.setItem('pending_fiat_invoice', activeInvoice.id);

      const { data, error } = await supabase.functions.invoke('paystack-engine', {
        body: { action: 'initialize_payment', email: user.email, amount: dueInfo.amount, invoiceId: activeInvoice.id }
      });
      if (error || data?.error) throw new Error(data?.error || "Gateway response exception");
      window.location.href = data.checkout_url;
    } catch (err: any) {
      showToast(err.message, "error");
      setPaymentLifecycle('IDLE');
    }
  };

  const handleOneClickSettle = async (invoice: any) => {
    if (!userAddress) return showToast("Node wallet disconnected", "error");
    setActiveInvoice(invoice);
    setPaymentPortalMode('VAULT');
    setPaymentLifecycle('PROCESSING');

    try {
        const dueStr = Array.isArray(invoice.monthly_bills) ? invoice.monthly_bills[0]?.due_date : invoice.monthly_bills?.due_date;
        const exactUsdcDeduction = calculateDynamicAmount(invoice.amount_due, dueStr).amount / ngnToUsdRate;

        const { data, error } = await supabase.functions.invoke('vault-relayer', {
            body: { invoiceId: invoice.id, userAddress: userAddress, exactUsdcAmount: exactUsdcDeduction }
        });

        if (error || !data?.success) throw new Error(`Relayer Execution Denied: ${error?.message || data?.error || "Unknown reason"}`);
        
        setLocalDeductions(prev => prev + exactUsdcDeduction);
        setTimeout(() => refetchAllowance(), 2000);
        
        setLastConfirmedTx(data.txHash);
        setPaymentLifecycle('SUCCESS');
        mutateDashboard();
    } catch (err: any) {
        showToast(err.message, "error");
        setPaymentLifecycle('IDLE');
        setPaymentPortalMode(null);
    }
  };

  // MAINNET FIX: Approve connected to TARGET_CHAIN_ID variables
  const handleApproveAllowance = async () => {
    if (!allowanceInput || isNaN(Number(allowanceInput)) || Number(allowanceInput) <= 0) return showToast("Enter a valid USDC amount", "error");
    setIsApproving(true);
    try {
      if (chainId !== TARGET_CHAIN_ID) await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      await writeContractAsync({ address: USDC_CONTRACT_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [ADMIN_CRYPTO_WALLET, parseUnits(allowanceInput, 6)] });
      showToast("Web3 Vault Allowance Confirmed", "success");
      setLocalDeductions(0);
      setTimeout(() => refetchAllowance(), 4000); 
    } catch (err: any) {
      showToast(err.shortMessage || err.message, "error");
    } finally {
      setIsApproving(false);
      setAllowanceInput('');
    }
  };

  const resolvedUserName = user?.user_metadata?.full_name || user?.full_name || "Compound Node";
  const authPhoto = user?.user_metadata?.picture || user?.user_metadata?.avatar_url || user?.raw_user_metadata?.picture || user?.raw_user_metadata?.avatar_url;
  const resolvedAvatarUrl = user?.avatar_url || authPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedUserName)}&background=0F172A&color=3B82F6&bold=true`;

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = `https://ui-avatars.com/api/?name=Node&background=111111&color=444444&bold=true`;
  };

  if (loading || (!dashboardData && user)) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-black text-neutral-100 font-sans selection:bg-blue-500/30 overflow-hidden relative">
      
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[150px] opacity-30 mix-blend-screen animate-pulse duration-10000"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[120px] opacity-20 mix-blend-screen"></div>
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`, backgroundSize: '32px 32px' }}></div>
      </div>

      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto px-5 py-4 rounded-xl shadow-2xl backdrop-blur-xl border font-mono text-[10px] md:text-xs animate-in slide-in-from-right-5 duration-300 ${t.type === 'error' ? 'border-red-500/40 bg-[#1A0505]/90 text-red-400' : 'border-blue-500/30 bg-[#050A1A]/90 text-blue-400'}`}>
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
              <button onClick={() => setActiveWorkspace('ADMIN')} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 ${activeWorkspace === 'ADMIN' ? 'bg-blue-900/20 text-blue-400 border border-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)] font-bold' : 'text-neutral-500 hover:text-white hover:bg-white/[0.02] border border-transparent'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                Command Center
              </button>
          )}
          
          <button onClick={() => setActiveWorkspace('ANALYTICS')} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 ${activeWorkspace === 'ANALYTICS' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] font-bold' : 'text-neutral-500 hover:text-white hover:bg-white/[0.02] border border-transparent'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
            Data Terminal
          </button>

          <button onClick={() => setActiveWorkspace('RESIDENT')} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 ${activeWorkspace === 'RESIDENT' ? 'bg-white/[0.05] text-white border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] font-bold' : 'text-neutral-500 hover:text-white hover:bg-white/[0.02] border border-transparent'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            Resident Ledger
          </button>
        </div>

        <div className="p-4 border-t border-white/[0.04]">
          <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-between gap-3 hover:border-white/10 transition-colors group cursor-pointer">
            <img src={resolvedAvatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10 object-cover" onError={handleImageError} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">{resolvedUserName}</p>
              <p className="text-[9px] text-neutral-500 truncate font-mono uppercase mt-0.5 tracking-wider">{user?.is_admin ? 'Root SysAdmin' : 'Node Resident'}</p>
            </div>
            <button onClick={handleSignOut} className="text-neutral-500 hover:text-red-400 p-1 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg></button>
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
           <div className="flex items-center gap-3">
              <ConnectButton chainStatus={{ smallScreen: 'full', largeScreen: 'full' }} accountStatus={{ smallScreen: 'full', largeScreen: 'full' }} showBalance={false} />
           </div>
        </header>

        <div className="md:hidden flex border-b border-white/[0.04] bg-black/80 backdrop-blur-xl sticky top-[65px] z-20 overflow-x-auto custom-scrollbar">
          {user?.is_admin && (
              <button onClick={() => setActiveWorkspace('ADMIN')} className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap px-4 border-b-2 transition-colors ${activeWorkspace === 'ADMIN' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-neutral-500'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                Command
              </button>
          )}
          <button onClick={() => setActiveWorkspace('ANALYTICS')} className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap px-4 border-b-2 transition-colors ${activeWorkspace === 'ANALYTICS' ? 'border-emerald-500 text-emerald-400 font-bold' : 'border-transparent text-neutral-500'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
            Data
          </button>
          <button onClick={() => setActiveWorkspace('RESIDENT')} className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap px-4 border-b-2 transition-colors ${activeWorkspace === 'RESIDENT' ? 'border-white text-white font-bold' : 'border-transparent text-neutral-500'}`}>
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
             Ledger
          </button>
        </div>

        <header className="hidden md:flex justify-between items-center px-10 py-5 border-b border-white/[0.04] bg-black/50 backdrop-blur-xl sticky top-0 z-30">
           <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">System Operational • Latency 12ms</span>
           </div>
           
           <div className="flex items-center gap-6">
              <div className="relative">
                 <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="relative p-2 text-neutral-400 hover:text-white transition-colors focus:outline-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    {pendingActionInvoices.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-black"></span>}
                 </button>
                 
                 {isNotificationsOpen && (
                    <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] md:w-80 bg-black border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                       <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                          <h4 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Notification Hub</h4>
                          <span className="text-[9px] font-mono text-neutral-500 uppercase px-2 py-0.5 bg-white/5 rounded">Live Feed</span>
                       </div>
                       <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                          {pendingActionInvoices.length > 0 ? (
                             pendingActionInvoices.map((inv, idx) => {
                               const dueStr = Array.isArray(inv.monthly_bills) ? inv.monthly_bills[0]?.due_date : inv.monthly_bills?.due_date;
                               const { isLate } = calculateDynamicAmount(inv.amount_due, dueStr);
                               return (
                                 <div key={idx} className={`p-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors ${isLate ? 'border-l-2 border-l-red-500' : 'border-l-2 border-l-blue-500'}`}>
                                    <p className="text-[10px] text-white font-mono uppercase">{isLate ? 'Penalty Deployed' : 'New Invoice Generated'}</p>
                                    <p className="text-[9px] text-neutral-500 font-mono mt-1 leading-relaxed">
                                       {isLate ? '10% late fee applied. Immediate settlement required.' : 'A new network utility bill is ready for signature.'}
                                    </p>
                                 </div>
                               )
                             })
                          ) : (
                             <div className="p-6 text-center text-[10px] font-mono text-neutral-600 uppercase">System state quiet</div>
                          )}
                       </div>
                    </div>
                 )}
              </div>
              <ConnectButton chainStatus={{ smallScreen: 'full', largeScreen: 'full' }} accountStatus={{ smallScreen: 'full', largeScreen: 'full' }} showBalance={false} />
           </div>
        </header>

        <div className="p-5 md:p-10 max-w-[1400px] w-full mx-auto space-y-8 md:space-y-10">
          
          <div className="hidden md:flex justify-between items-end pb-2">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">
                {activeWorkspace === 'ADMIN' ? 'Command Center' : activeWorkspace === 'ANALYTICS' ? 'Data Terminal' : 'Resident Ledger'}
              </h2>
              <p className="text-[10px] md:text-xs text-neutral-500 mt-2 font-mono uppercase tracking-widest flex items-center gap-2">
                {activeWorkspace === 'ADMIN' ? 'Billing Matrix Deployment Engine' : activeWorkspace === 'ANALYTICS' ? 'Dune-Grade Statistical Analytics' : 'Obligations & Cryptographic Settlements'}
              </p>
            </div>
          </div>

          {/* === MODULE: COMMAND CENTER === */}
          {activeWorkspace === 'ADMIN' && user?.is_admin && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-6 md:p-8 h-fit shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/[0.03] blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-2 relative z-10 flex items-center gap-2">
                      Broadcast Invoices
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] px-2 py-0.5 rounded-full">Cron Bound</span>
                  </h2>
                  <p className="text-[10px] md:text-[11px] text-neutral-400 mb-8 font-mono leading-relaxed relative z-10 md:pr-8">Calculates base splits and propagates to all active nodes. Suspended nodes are excluded from the matrix.</p>
                  
                  <div className="space-y-6 relative z-10">
                    <div className="relative border-b border-white/10 focus-within:border-blue-500/50 transition-colors py-2">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-xl">₦</span>
                      <input type="number" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent py-3 md:py-4 pl-8 pr-4 text-white font-mono tabular-nums text-2xl focus:outline-none placeholder-neutral-800 tracking-tight" />
                    </div>
                    <button onClick={handleGenerateBill} disabled={isGenerating || !billAmount} className="w-full bg-white hover:bg-neutral-200 text-black py-4 rounded-xl font-bold text-[11px] md:text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
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
                    <p className="text-[10px] md:text-[11px] text-neutral-400 font-mono relative z-10">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} Settlement Index</p>
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
                     <p className="text-[9px] md:text-[10px] text-neutral-500 font-mono mt-1 uppercase tracking-widest">Active nodes receive broadcast matrices. Suspended nodes remain in history but are ignored by routing.</p>
                   </div>
                   <div className="px-3 py-1 bg-white/[0.02] border border-white/5 rounded-full text-[9px] font-mono uppercase tracking-widest text-neutral-400">
                     {tenantRoster.length} Total Registered
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 relative z-10">
                   {tenantRoster.length > 0 ? tenantRoster.map((tenant) => {
                      const encodedName = encodeURIComponent(tenant.full_name || 'Network Node');
                      const fallback = `https://ui-avatars.com/api/?name=${encodedName}&background=0F172A&color=3B82F6&bold=true`;
                      const avatar = tenant.avatar_url || fallback;
                      const isActive = tenant.is_active;

                      return (
                        <div key={tenant.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-white/[0.01] border-white/5 hover:border-white/20' : 'bg-[#050505] border-red-900/20 opacity-70 hover:opacity-100'}`}>
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
                      )
                   }) : (
                     <div className="col-span-full py-8 text-center border border-dashed border-white/10 rounded-2xl">
                       <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">No nodes mapped from database.</p>
                     </div>
                   )}
                </div>
              </div>

            </div>
          )}

          {/* === MODULE: GOOGLE/DUNE-GRADE DATA TERMINAL === */}
          {activeWorkspace === 'ANALYTICS' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                       <div>
                           <h3 className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Gross Treasury TVL</h3>
                           <p className="text-[10px] text-emerald-400 font-mono mt-1 uppercase flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Syncing Public State</p>
                       </div>
                       <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                           <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                       </div>
                    </div>
                    <p className="text-3xl md:text-4xl font-mono tabular-nums font-bold text-white tracking-tighter drop-shadow-lg">₦{analytics.totalVolume.toLocaleString()}</p>
                  </div>

                  <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/[0.03] blur-3xl rounded-full"></div>
                    <div className="flex justify-between items-start mb-6 relative z-10">
                       <h3 className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,1)]"></span> Web3 Vault
                       </h3>
                    </div>
                    <p className="text-3xl md:text-4xl font-mono tabular-nums font-bold text-white tracking-tighter relative z-10">₦{analytics.totalCrypto.toLocaleString()}</p>
                  </div>

                  <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden group hover:border-purple-500/30 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/[0.03] blur-3xl rounded-full"></div>
                    <div className="flex justify-between items-start mb-6 relative z-10">
                       <h3 className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,1)]"></span> Fiat Vault
                       </h3>
                    </div>
                    <p className="text-3xl md:text-4xl font-mono tabular-nums font-bold text-white tracking-tighter relative z-10">₦{analytics.totalFiat.toLocaleString()}</p>
                  </div>

                  <div className="bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-300 flex flex-col justify-between">
                     <div className="flex justify-between items-start mb-4">
                        <h3 className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Network Efficiency</h3>
                        <div className="flex -space-x-2">
                           {analytics.activeAvatars.map((url, idx) => (
                             <img key={idx} src={url} alt="Node" className="w-6 h-6 rounded-full border-2 border-black object-cover relative z-10" onError={handleImageError} />
                           ))}
                        </div>
                     </div>
                     <div className="flex items-end justify-between mt-4">
                        <p className="text-3xl md:text-4xl font-mono tabular-nums font-bold text-white tracking-tighter">{analytics.collectionRate}%</p>
                        <div className="w-20 h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-2">
                           <div style={{ width: `${analytics.collectionRate}%` }} className="h-full bg-white transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                 <div className="lg:col-span-8 bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-8 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-colors duration-500">
                    <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: `linear-gradient(to right, #ffffff05 1px, transparent 1px), linear-gradient(to bottom, #ffffff05 1px, transparent 1px)`, backgroundSize: '40px 40px' }}></div>
                    <div className="flex justify-between items-start mb-8 md:mb-12 relative z-10">
                       <div>
                         <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Settlement Liquidity Flux</h3>
                         <p className="text-[9px] md:text-[10px] text-neutral-500 font-mono mt-1 uppercase tracking-widest">Trailing 6-Month Block Volume</p>
                       </div>
                    </div>
                    <div className="h-48 md:h-64 flex items-end justify-between gap-2 md:gap-6 relative z-10 border-l border-b border-white/[0.05] pl-2 pb-0 pt-4">
                       <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pt-4 pb-0 pl-2">
                          <div className="w-full h-px bg-white/[0.03] border-t border-dashed border-white/[0.05]"></div>
                          <div className="w-full h-px bg-white/[0.03] border-t border-dashed border-white/[0.05]"></div>
                          <div className="w-full h-px bg-white/[0.03] border-t border-dashed border-white/[0.05]"></div>
                       </div>
                       {analytics.monthlyData.map((data, idx) => {
                          const heightPct = Math.max((data.total / analytics.maxMonthValue) * 100, 2); 
                          const isZero = data.total === 0;
                          const barColor = isZero ? 'bg-white/[0.05]' : 'bg-[#1D9BF0] group-hover/bar:bg-[#71C9F8] shadow-[0_4px_20px_rgba(29,155,240,0.15)]';

                          return (
                            <div key={idx} className="flex flex-col items-center flex-1 group/bar relative h-full justify-end">
                               <div className={`w-full max-w-[56px] transition-all duration-500 ease-out relative cursor-crosshair rounded-t-md ${barColor}`} style={{ height: `${heightPct}%` }}>
                                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-white text-black text-[9px] md:text-[10px] font-mono tabular-nums font-bold px-2 py-1 md:px-3 md:py-1.5 rounded pointer-events-none shadow-[0_10px_30px_rgba(255,255,255,0.2)] z-20 whitespace-nowrap">
                                    ₦{data.total.toLocaleString()}
                                  </div>
                               </div>
                               <span className="text-[8px] md:text-[10px] text-neutral-500 font-mono mt-3 md:mt-4 uppercase tracking-widest">{data.label}</span>
                            </div>
                          )
                       })}
                    </div>
                 </div>

                 <div className="lg:col-span-4 bg-black/80 backdrop-blur-md border border-white/[0.04] rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col h-[350px] md:h-[410px] hover:border-white/10 transition-colors duration-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
                    <div className="border-b border-white/[0.06] pb-4 mb-4 shrink-0 flex justify-between items-center relative z-10">
                       <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">Live Protocol Logs</h3>
                       <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar relative z-10">
                       {analytics.recentFeed.map((inv, idx) => {
                          const isWeb3 = inv.payment_method?.toUpperCase() === 'USDC' || inv.payment_method?.includes('Vault');
                          const isCurrentUser = inv.tenant_id === user?.id;
                          
                          const nodeUserName = user?.is_admin || isCurrentUser ? (inv.tenants?.full_name || 'Network Node') : `Node 0x${inv.tenant_id?.slice(0, 4)}...`;
                          const currentUserAuthPic = user?.user_metadata?.picture || user?.user_metadata?.avatar_url || user?.raw_user_metadata?.picture;
                          const nodeAvatar = isCurrentUser ? (currentUserAuthPic || inv.tenants?.avatar_url) : inv.tenants?.avatar_url;
                          
                          const encodedName = encodeURIComponent(inv.tenants?.full_name || 'Node');
                          const dynamicFallback = `https://ui-avatars.com/api/?name=${encodedName}&background=0F172A&color=3B82F6&bold=true`;
                          const finalAvatar = nodeAvatar || dynamicFallback;
                          
                          return (
                            <div key={idx} className="bg-transparent border border-white/[0.04] p-3 rounded-2xl flex items-center justify-between group hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300">
                               <div className="flex items-center gap-3 min-w-0">
                                  <img src={finalAvatar} className="w-8 h-8 rounded-full border border-white/10 object-cover shadow-[0_0_10px_rgba(59,130,246,0.1)]" alt="Node" onError={handleImageError} />
                                  <div className="min-w-0">
                                     <p className="text-[10px] md:text-[11px] font-bold font-mono text-white truncate max-w-[100px] md:max-w-[130px] group-hover:text-blue-400 transition-colors">{nodeUserName}</p>
                                     <p className="text-[8px] md:text-[9px] font-mono text-neutral-500 uppercase tracking-widest mt-1 truncate max-w-[100px] md:max-w-[130px] flex items-center gap-1.5">
                                        {isWeb3 ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></span> : <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></span>}
                                        {inv.transaction_reference && inv.transaction_reference.startsWith('0x') ? `${inv.transaction_reference.slice(0, 12)}...` : 'Processing Ledger Sync'}
                                     </p>
                                  </div>
                               </div>
                               <div className="text-right shrink-0">
                                  <p className="text-[11px] md:text-[12px] font-mono tabular-nums font-bold text-white group-hover:scale-105 transition-transform origin-right">₦{Number(inv.amount_due).toLocaleString()}</p>
                                  <p className={`text-[8px] md:text-[9px] font-mono font-bold uppercase tracking-widest mt-1 ${isWeb3 ? 'text-blue-400' : inv.is_paid ? 'text-purple-400' : 'text-amber-500'}`}>
                                     {inv.is_paid ? (inv.payment_method || 'FIAT Wire') : 'Awaiting Settlement'}
                                  </p>
                               </div>
                            </div>
                          )
                       })}
                       {analytics.recentFeed.length === 0 && (
                          <div className="h-full flex items-center justify-center text-[9px] md:text-[10px] font-mono text-neutral-600 uppercase tracking-widest">Awaiting First Block</div>
                       )}
                    </div>
                 </div>
               </div>
            </div>
          )}

          {/* === MODULE: RESIDENT WORKSPACE === */}
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
                       
                       <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">Autonomous Allowances</h3>
                       <p className="text-[11px] md:text-xs text-neutral-400 font-mono leading-relaxed max-w-xl">
                          Authorize USDC for zero-click network deductions. Avoid signing multiple MetaMask transactions. You maintain 100% cryptographic control of this limit.
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
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Ready for Execution
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
                                   <input type="number" value={allowanceInput} onChange={(e) => setAllowanceInput(e.target.value)} placeholder="0.00" className="w-full bg-transparent py-2.5 pl-7 pr-3 text-white font-mono tabular-nums text-sm focus:outline-none placeholder-neutral-800" />
                                </div>
                                <button onClick={handleApproveAllowance} disabled={isApproving} className="bg-white hover:bg-neutral-200 text-black px-4 md:px-6 py-2.5 rounded-lg text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-colors disabled:opacity-50 whitespace-nowrap">
                                   {isApproving ? 'Signing Protocol...' : 'Top-Up Vault'}
                                </button>
                             </>
                          ) : (
                             <div className="w-full flex justify-center py-1 [&>div]:w-full [&_button]:w-full"><ConnectButton label="Connect to Initialize Vault" /></div>
                          )}
                       </div>

                    </div>
                 </div>
              </div>

              {pendingActionInvoices.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] md:text-[11px] font-mono text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_6px_rgba(59,130,246,1)]"></span> Dynamic Ledger Requirements
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                    {pendingActionInvoices.map((invoice: any) => {
                      const dueStr = Array.isArray(invoice.monthly_bills) ? invoice.monthly_bills[0]?.due_date : invoice.monthly_bills?.due_date;
                      const period = Array.isArray(invoice.monthly_bills) ? invoice.monthly_bills[0]?.billing_period : invoice.monthly_bills?.billing_period;
                      const { amount, isLate, daysLeft, totalGrace } = calculateDynamicAmount(invoice.amount_due, dueStr);
                      const usdValue = (amount / ngnToUsdRate).toFixed(2);
                      
                      const isVaultReady = baseAllowanceUSDC >= Number(usdValue);

                      return (
                        <div key={invoice.id} className={`bg-black/80 backdrop-blur-md border ${isLate ? 'border-red-500/40' : 'border-white/[0.04] hover:border-white/20'} rounded-3xl p-6 md:p-8 flex flex-col justify-between gap-6 md:gap-8 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-2xl ${isLate ? 'hover:shadow-[0_0_40px_rgba(239,68,68,0.2)]' : 'hover:shadow-[0_0_40px_rgba(59,130,246,0.15)]'}`}>
                          
                          {!isLate && (
                             <div className="absolute top-0 left-0 w-full h-1 bg-white/[0.02]">
                                <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${((totalGrace - daysLeft) / totalGrace) * 100}%` }}></div>
                             </div>
                          )}
                          {isLate && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)]"></div>}

                          <div className="space-y-3 relative z-10">
                            <div className="flex justify-between items-start">
                              <span className="inline-block text-[8px] md:text-[9px] font-mono text-neutral-400 border border-white/10 bg-white/[0.02] px-2 md:px-3 py-1 md:py-1.5 rounded uppercase tracking-widest">
                                {period || 'Current Bill'}
                              </span>
                              {isLate ? (
                                <span className="inline-block text-[8px] md:text-[9px] font-mono text-red-400 font-bold uppercase tracking-widest animate-pulse border border-red-500/20 bg-red-500/10 px-2 md:px-3 py-1 md:py-1.5 rounded">10% Latency Penalty Triggered</span>
                              ) : (
                                <span className="inline-block text-[8px] md:text-[9px] font-mono text-blue-400 font-bold uppercase tracking-widest border border-blue-500/20 bg-blue-500/10 px-2 md:px-3 py-1 md:py-1.5 rounded">
                                  {daysLeft} Days to Penalty
                                </span>
                              )}
                            </div>
                            <div className="pt-2">
                              <h3 className={`text-4xl md:text-5xl font-bold tracking-tight font-mono tabular-nums transition-colors ${isLate ? 'text-red-400 group-hover:text-red-300' : 'text-white'}`}>₦{Number(amount).toLocaleString()}</h3>
                              <p className="text-[10px] md:text-[11px] text-neutral-500 font-mono mt-3 uppercase tracking-widest flex items-center gap-2">
                                 Est Valuation: ${usdValue} USDC
                                 {!isVaultReady && <span className="text-[8px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">Deficit Detected</span>}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 md:gap-4 relative z-10">
                            {isVaultReady ? (
                               <button onClick={() => handleOneClickSettle(invoice)} className="col-span-2 md:col-span-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3.5 md:py-4 rounded-xl text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                 1-Click Settle
                               </button>
                            ) : (
                               <button onClick={() => { setActiveInvoice({ ...invoice, amount_due: amount }); setPaymentPortalMode('USDC'); }} className="bg-white hover:bg-neutral-200 text-black py-3.5 md:py-4 rounded-xl text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">Pay USDC</button>
                            )}
                            <button onClick={() => { setActiveInvoice({ ...invoice, amount_due: amount }); setPaymentPortalMode('FIAT'); }} className={`bg-transparent border border-white/10 hover:border-white hover:bg-white/5 text-white py-3.5 md:py-4 rounded-xl text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${isVaultReady ? 'col-span-2 md:col-span-1' : ''}`}>Fiat Wire</button>
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
                    {clearedInvoices.slice(0, displayLimit).map((invoice: any) => {
                      const period = Array.isArray(invoice.monthly_bills) ? invoice.monthly_bills[0]?.due_date : invoice.monthly_bills?.due_date;
                      return (
                        <div 
                          key={invoice.id} 
                          onClick={() => setViewingReceipt(invoice)}
                          className="bg-[#050505]/60 backdrop-blur-md border border-white/[0.04] p-5 flex flex-col justify-between gap-4 rounded-2xl group hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-all duration-300 relative overflow-hidden cursor-pointer animate-in fade-in zoom-in-95"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] blur-xl rounded-full group-hover:bg-emerald-500/[0.08] transition-colors"></div>
                          <div className="flex items-center justify-between relative z-10">
                            <span className="text-[8px] md:text-[9px] font-mono text-neutral-500 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">
                              {period || 'Cleared Log'}
                            </span>
                            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-white/[0.04] flex items-center justify-center text-white group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
                              <svg className="w-2.5 h-2.5 md:w-3 md:h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            </div>
                          </div>
                          <div className="relative z-10">
                            <h3 className="text-lg md:text-xl font-bold tabular-nums text-neutral-300 font-mono group-hover:text-white transition-colors">₦{Number(invoice.amount_due).toLocaleString()}</h3>
                            <p className="text-[7px] md:text-[8px] font-mono text-neutral-500 uppercase tracking-widest mt-1 group-hover:text-neutral-400">Route: {invoice.payment_method} • View Proof</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {displayLimit < clearedInvoices.length && (
                     <div ref={lastElementRef} className="w-full py-8 flex justify-center items-center">
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

      {/* --- SMART RECEIPT MODAL --- */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl transition-all animate-in fade-in duration-200">
          <div className="w-full max-w-[480px] bg-[#050505] border border-white/10 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_150px_rgba(16,185,129,0.15)] animate-in zoom-in-95 duration-300">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none">
               <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            </div>

            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  Official Settlement Proof
                </h3>
                <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest mt-1">CompoundOS Audited Record</p>
              </div>
              <button onClick={() => setViewingReceipt(null)} className="text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div className="text-center mb-8 relative z-10">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block mb-2">Value Extinguished</span>
              <p className="text-5xl font-bold font-mono tabular-nums text-white tracking-tighter">₦{Number(viewingReceipt.amount_due).toLocaleString()}</p>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-6 font-mono text-[10px] relative z-10">
              <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-neutral-500 uppercase">Billing Cycle</span>
                <span className="text-white font-bold">{Array.isArray(viewingReceipt.monthly_bills) ? viewingReceipt.monthly_bills[0]?.billing_period : viewingReceipt.monthly_bills?.billing_period}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-neutral-500 uppercase">Clearance Date</span>
                <span className="text-white">{new Date(viewingReceipt.paid_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-neutral-500 uppercase">Routing Method</span>
                <span className={`font-bold px-2 py-0.5 rounded ${viewingReceipt.payment_method === 'USDC' || viewingReceipt.payment_method?.includes('Vault') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                  {viewingReceipt.payment_method}
                </span>
              </div>
              
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-neutral-500 uppercase block mb-2">Cryptographic Attestation Hash</span>
                <div className="flex items-center justify-between gap-3 bg-[#000] p-2 rounded-lg border border-white/5">
                  <span className="text-emerald-400 text-[9px] truncate select-all">{viewingReceipt.transaction_reference}</span>
                  {(viewingReceipt.payment_method === 'USDC' || viewingReceipt.payment_method?.includes('Vault')) && viewingReceipt.transaction_reference?.startsWith('0x') && (
                    <a href={`https://basescan.org/tx/${viewingReceipt.transaction_reference}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-white shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <button onClick={() => window.print()} className="w-full mt-8 bg-transparent hover:bg-white/[0.02] border border-white/20 text-white py-4 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              Export PDF Statement
            </button>
          </div>
        </div>
      )}

      {/* --- PAYMENT GATEWAY MODAL --- */}
      {paymentPortalMode && activeInvoice && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/90 backdrop-blur-xl transition-all animate-in fade-in duration-200">
          <div className="w-full md:max-w-[420px] bg-[#050505] border-t md:border border-white/10 rounded-t-3xl md:rounded-3xl p-6 md:p-8 flex flex-col max-h-[90vh] md:max-h-[85vh] overflow-y-auto custom-scrollbar shadow-[0_0_100px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 pb-10 md:pb-8">
            
            {paymentLifecycle !== 'SUCCESS' && (
              <div className="flex justify-between items-start mb-8 md:mb-10">
                <div>
                  <h3 className="text-[9px] md:text-[10px] font-bold text-neutral-400 font-mono uppercase tracking-widest flex items-center gap-2">
                     {paymentPortalMode === 'FIAT' ? <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span> : paymentPortalMode === 'VAULT' ? <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span> : <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>}
                     {paymentPortalMode === 'FIAT' ? 'Fiat Wire Gateway' : paymentPortalMode === 'VAULT' ? 'Vault Auto-Relayer' : 'ERC20 Routing Engine'}
                  </h3>
                  <p className="text-xs md:text-sm font-bold text-white font-mono uppercase mt-1">
                    {Array.isArray(activeInvoice.monthly_bills) ? activeInvoice.monthly_bills[0]?.due_date : activeInvoice.monthly_bills?.due_date}
                  </p>
                </div>
                <button onClick={handleCloseModal} className="text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
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
                     <div className="absolute inset-[-12px] md:inset-[-16px] border border-emerald-500/30 rounded-full animate-[ping_2.5s_infinite]"></div>
                     <img src={resolvedAvatarUrl} alt="Identity Status" className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-emerald-500/50 object-cover bg-[#000]" onError={handleImageError} />
                     <div className="absolute -bottom-1 -right-1 w-6 h-6 md:w-8 md:h-8 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                        <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                     </div>
                  </div>
                  <div>
                     <h4 className="text-lg md:text-xl font-bold text-white font-mono uppercase tracking-wide">Settlement Finalized</h4>
                     <p className="text-[9px] md:text-[10px] text-emerald-400 font-mono uppercase tracking-widest mt-1">Signer: {resolvedUserName}</p>
                  </div>
                </div>

                <div className="bg-black border border-white/10 p-6 md:p-8 text-center rounded-2xl shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-emerald-500/5 blur-2xl rounded-full"></div>
                  <span className="text-[8px] md:text-[9px] font-mono uppercase tracking-widest text-neutral-500 block mb-2 md:mb-3 relative z-10">Value Extinguished</span>
                  <p className="text-4xl md:text-5xl font-bold font-mono tabular-nums text-white tracking-tighter mb-6 md:mb-8 relative z-10">₦{Number(activeInvoice.amount_due).toLocaleString()}</p>
                  
                  <div className="border-t border-white/5 pt-4 md:pt-5 text-left space-y-3 md:space-y-4 font-mono text-[9px] md:text-[10px] relative z-10">
                     <div className="flex justify-between items-center">
                        <span className="text-neutral-500 uppercase tracking-wider">Protocol Route</span>
                        <span className="text-white uppercase font-bold flex items-center gap-1.5">
                           {paymentPortalMode === 'FIAT' ? <span className="w-2 h-2 rounded-full bg-purple-500"></span> : paymentPortalMode === 'VAULT' ? <span className="w-2 h-2 rounded-full bg-blue-500"></span> : <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                           {paymentPortalMode === 'FIAT' ? 'Paystack Core Node' : paymentPortalMode === 'VAULT' ? 'Automated Vault Execution' : 'Base L2 Execution'}
                        </span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-neutral-500 uppercase tracking-wider">Atomic Time</span>
                        <span className="text-neutral-300 uppercase">{new Date().toLocaleTimeString()}</span>
                     </div>
                     <div className="flex flex-col gap-2 pt-3 md:pt-4 border-t border-white/5">
                        <span className="text-neutral-500 uppercase tracking-wider">Cryptographic Hash</span>
                        <span className="text-emerald-400 text-[9px] md:text-[10px] break-all bg-emerald-500/10 p-2 md:p-3 border border-emerald-500/20 rounded-lg mt-1 font-bold">{lastConfirmedTx || 'SECURE-OFFCHAIN-WIRE-LOG'}</span>
                     </div>
                  </div>
                </div>
                <button onClick={handleCloseModal} className="w-full bg-white hover:bg-neutral-200 text-black py-4 rounded-xl text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-colors shadow-[0_0_30px_rgba(255,255,255,0.15)]">Extinguish Terminal Window</button>
              </div>
            ) : (
              <div className="space-y-5 md:space-y-6">
                {paymentPortalMode === 'FIAT' && (
                  <div className="space-y-5 md:space-y-6 animate-in fade-in zoom-in-95">
                    <div className="bg-black border border-white/10 p-6 md:p-8 text-center rounded-2xl md:rounded-3xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-purple-500/10 blur-2xl rounded-full"></div>
                       <span className="text-[9px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest block mb-2 md:mb-3 relative z-10">Required Fiat Ingress</span>
                       <span className="text-3xl md:text-4xl font-bold tabular-nums text-white font-mono tracking-tighter relative z-10">₦{Number(activeInvoice.amount_due).toLocaleString()}</span>
                    </div>

                    <div className="bg-black border border-white/10 p-6 md:p-8 text-center space-y-5 md:space-y-6 rounded-2xl md:rounded-3xl">
                      <div>
                        <h4 className="text-[11px] md:text-[12px] font-bold text-white font-mono uppercase tracking-widest">Routing Execution Gateway</h4>
                        <p className="text-[9px] md:text-[10px] text-neutral-400 mt-2 md:mt-3 font-mono uppercase tracking-widest leading-relaxed">Initiating out-of-app payment channel synchronization state. Cache tracking activated.</p>
                      </div>
                      <button onClick={handleInitializeFiatPayment} className="w-full bg-white hover:bg-neutral-200 text-black py-3.5 md:py-4 text-[10px] md:text-[11px] font-bold font-mono uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] rounded-xl">
                        Route Intent to Checkout
                      </button>
                    </div>
                  </div>
                )}

                {paymentPortalMode === 'USDC' && (
                  <div className="space-y-5 md:space-y-6 animate-in fade-in zoom-in-95">
                    <div className="bg-black border border-white/10 p-6 md:p-8 text-center font-mono rounded-2xl md:rounded-3xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-blue-500/10 blur-2xl rounded-full"></div>
                      <span className="text-neutral-500 text-[9px] md:text-[10px] uppercase tracking-widest block mb-2 md:mb-3 relative z-10">Required Asset Volume</span>
                      <span className="text-3xl md:text-4xl text-white font-bold tabular-nums tracking-tighter relative z-10">${(activeInvoice.amount_due / ngnToUsdRate).toFixed(2)} <span className="text-[10px] md:text-[12px] text-neutral-500 ml-1">USDC</span></span>
                    </div>

                    <div className="border border-white/10 bg-black p-6 md:p-8 space-y-4 md:space-y-5 rounded-2xl md:rounded-3xl">
                      <div className="flex items-center gap-3 mb-2 md:mb-3">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] md:text-[11px] font-mono font-bold border border-blue-500/30">1</div>
                        <h4 className="text-[10px] md:text-[11px] font-bold text-white font-mono uppercase tracking-widest">On-Chain RPC Execution</h4>
                      </div>
                      {isConnected ? (
                        <button onClick={handlePayWithConnectedWallet} className="w-full bg-white hover:bg-neutral-200 text-black py-3.5 md:py-4 text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] rounded-xl">
                          {chainId !== TARGET_CHAIN_ID ? "Re-route Network to Base Mainnet" : "Sign State Transition"}
                        </button>
                      ) : (
                        <div className="pt-1 md:pt-2 flex justify-center w-full [&>div]:w-full [&_button]:w-full"><ConnectButton label="Connect Node Wallet" /></div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 px-4 py-1 md:px-6 md:py-2">
                       <div className="h-px bg-white/10 flex-1"></div>
                       <span className="text-[8px] md:text-[9px] font-mono text-neutral-600 uppercase tracking-widest">OR</span>
                       <div className="h-px bg-white/10 flex-1"></div>
                    </div>

                    <div className="border border-white/10 bg-black p-6 md:p-8 space-y-4 md:space-y-5 rounded-2xl md:rounded-3xl">
                      <div className="flex items-center gap-3 mb-2 md:mb-3">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-white/10 flex items-center justify-center text-white text-[10px] md:text-[11px] font-mono font-bold">2</div>
                        <h4 className="text-[10px] md:text-[11px] font-bold text-white font-mono uppercase tracking-widest">Asynchronous Log Matching</h4>
                      </div>
                      
                      <div className="bg-[#050505] border border-white/5 p-3 md:p-4 flex items-center justify-between gap-3 rounded-xl">
                        <span className="text-[9px] md:text-[10px] font-mono text-neutral-400 truncate">{ADMIN_CRYPTO_WALLET}</span>
                        <button onClick={() => copyToClipboard(ADMIN_CRYPTO_WALLET, 'wallet')} className="text-[8px] md:text-[9px] font-mono bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 md:px-3 md:py-1.5 rounded transition-colors shrink-0">
                          {copiedField === 'wallet' ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      <div className="space-y-3 md:space-y-4">
                        <input type="text" placeholder="Paste tx hash (0x...)" value={manualTxHash} onChange={(e) => setManualTxHash(e.target.value)} className="w-full bg-[#050505] border border-white/10 p-3.5 md:p-4 font-mono text-[10px] md:text-[11px] text-white placeholder-neutral-700 focus:outline-none focus:border-white transition-colors rounded-xl" />
                        <button onClick={handleVerifyManualCrypto} disabled={!manualTxHash} className="w-full bg-transparent hover:bg-white/[0.02] border border-white/20 text-white py-3.5 md:py-4 text-[10px] md:text-[11px] font-mono font-bold uppercase tracking-widest transition-colors disabled:opacity-40 rounded-xl">
                          Verify Telemetry Log
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

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
        
        /* Remove arrows from number input */
        input[type="number"]::-webkit-inner-spin-button, 
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}} />
    </div>
  );
}