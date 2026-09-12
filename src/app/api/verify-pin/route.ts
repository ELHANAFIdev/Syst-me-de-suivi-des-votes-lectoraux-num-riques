import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing keys' }, { status: 500 });
  }

  const { pin } = await request.json();

  if (!pin) {
    return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Fetch users (up to 1000 to cover all bureaus)
    // Note: If you have >1000 bureaus, pagination would be required.
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000
    });

    if (listError) throw listError;

    const user = listData.users.find(u => u.user_metadata?.pin === pin);

    if (user && user.email) {
      return NextResponse.json({ success: true, email: user.email });
    } else {
      return NextResponse.json({ success: false, error: 'الرقم السري غير صحيح أو غير موجود' }, { status: 404 });
    }

  } catch (error: any) {
    console.error("Verify PIN API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
