import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'الرجاء إضافة مفاتيح Supabase في ملف .env.local أولاً' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    const email = 'admin@admin.com';
    const password = 'AdminPassword123!';

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json({ message: 'حساب الأدمن موجود بالفعل. يمكنك تسجيل الدخول باستخدام admin@admin.com' });
      }
      throw authError;
    }

    const userId = authData.user.id;

    // 2. Insert into profiles table as admin
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        { id: userId, role: 'admin', bureau_name: null }
      ]);

    if (profileError) throw profileError;

    return NextResponse.json({ 
      success: true, 
      message: 'تم إنشاء حساب الأدمن بنجاح!',
      credentials: {
        email,
        password
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
