import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // SERVER-SIDE EXECUTION: The browser never sees this code or the secret key.
    const response = await fetch('https://prbtmafuvicwrpzlgcjq.supabase.co/functions/v1/notification-matrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Injecting the secure server-only environment variable
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
    // Security Best Practice: Never leak exact stack traces back to the client
    return NextResponse.json(
      { success: false, message: "Internal server execution failed." }, 
      { status: 500 }
    );
  }
}