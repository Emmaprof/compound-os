import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 1. MANUAL TRIGGER (DAY 1) - Your existing frontend proxy
// ============================================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // SERVER-SIDE EXECUTION: The browser never sees this code or the secret key.
    const response = await fetch('https://prbtmafuvicwrpzlgcjq.supabase.co/functions/v1/notification-matrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MATRIX_CRON_SECRET}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`Edge function rejected payload with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data }, { status: 200 });

  } catch (error: any) {
    console.error("Matrix API Gateway Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server execution failed." }, 
      { status: 500 }
    );
  }
}

// ============================================================================
// 2. AUTOMATED TRIGGER (DAYS 2-5+) - Vercel Cron Engine
// ============================================================================
export async function GET(request: Request) {
  try {
    // Authenticate the cron request to prevent external spam
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.MATRIX_CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized Cron Access" }, { status: 401 });
    }

    // Initialize Supabase Admin to securely read the database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch only active, unpaid invoices
    const { data: invoices, error } = await supabase
      .from('tenant_invoices')
      .select('tenant_email, amount_due, is_paid, created_at')
      .eq('is_paid', false);

    if (error) throw error;

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ status: "ALL_CLEARED", message: "No unpaid invoices." });
    }

    // Calculate Days Elapsed based on the oldest unpaid bill in the current cycle
    const billDate = new Date(invoices[0].created_at);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - billDate.getTime());
    const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Route the logic based on the 5-day timeline
    let actionType = "DAILY_SYNC";
    if (daysElapsed >= 5) {
        actionType = "PENALTY_DEPLOYED";
    }

    // Forward the dynamically generated payload to your Edge Function
    const response = await fetch('https://prbtmafuvicwrpzlgcjq.supabase.co/functions/v1/notification-matrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MATRIX_CRON_SECRET}`
      },
      body: JSON.stringify({
        action_type: actionType,
        days_elapsed: daysElapsed,
        invoices: invoices
      })
    });

    if (!response.ok) throw new Error("Edge Function rejected the payload.");

    return NextResponse.json({ 
      success: true, 
      action_fired: actionType, 
      days_elapsed: daysElapsed,
      defaulters_notified: invoices.length 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Matrix Cron Gateway Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}