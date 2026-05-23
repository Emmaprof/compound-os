import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-neutral-300 font-sans p-8 md:p-16">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/" className="text-blue-400 hover:text-blue-300 font-mono text-sm inline-flex items-center gap-2">
          ← Return to Terminal
        </Link>
        
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Privacy Policy</h1>
        <p className="text-sm font-mono text-neutral-500 uppercase tracking-widest">Last Updated: {new Date().toLocaleDateString()}</p>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">1. Information Collection</h2>
          <p>CompoundOS ("we", "our", "the Protocol") collects minimal operational data necessary for network utility settlements. When you authenticate via Google, we securely receive and store your email address, basic profile information, and associated cryptographic wallet addresses.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">2. Infrastructure & Third Parties</h2>
          <p>Your data is processed through enterprise-grade infrastructure. We do not sell your data. We utilize the following secure routing layers:</p>
          <ul className="list-disc pl-5 space-y-2 text-neutral-400">
            <li><strong>Supabase:</strong> For encrypted database storage and session management.</li>
            <li><strong>Paystack:</strong> For off-chain fiat wire processing (we do not store your card details).</li>
            <li><strong>Base L2 Network:</strong> For immutable, on-chain ledger settlements and smart contract interactions.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">3. Cryptographic Consent</h2>
          <p>By connecting a Web3 wallet or executing a transaction, you consent to the public broadcasting of cryptographic hashes associated with your ledger settlements. On-chain data is immutable and public by design.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">4. Data Erasure</h2>
          <p>Tenants may request the suspension of their node and the deletion of off-chain personally identifiable information by contacting the Root SysAdmin (Lithos.eth). Note that on-chain cryptographic attestations cannot be erased.</p>
        </section>
      </div>
    </div>
  );
}