import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bureauNameRaw = searchParams.get('bureau');

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'الرجاء إضافة مفاتيح Supabase في ملف .env.local' }, { status: 500 });
  }

  if (!bureauNameRaw) {
    return NextResponse.json({ 
      error: 'الرجاء كتابة اسم المكتب في الرابط.',
      example: 'http://localhost:3000/api/setup-bureau?bureau=11' 
    }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Generate a simple ASCII email based on a simple hash of the bureau name to avoid Arabic character errors
    let hash = 0;
    for (let i = 0; i < bureauNameRaw.length; i++) {
      hash = (hash << 5) - hash + bureauNameRaw.charCodeAt(i);
      hash |= 0;
    }
    const safeId = Math.abs(hash);
    const email = `bureau_${safeId}@election.com`;
    const password = 'BureauPassword123!';

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json({ 
          message: 'حساب هذا المكتب موجود بالفعل.',
          credentials: { email, password }
        });
      }
      throw authError;
    }

    const userId = authData.user.id;

    // 2. We need to assign the exact original bureauName to the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        { id: userId, role: 'bureau_manager', bureau_name: bureauNameRaw }
      ]);

    if (profileError) throw profileError;

    return NextResponse.json({ 
      success: true, 
      message: `تم إنشاء حساب لمكتب التصويت (${bureauNameRaw}) بنجاح!`,
      credentials: {
        email: email,
        password: password
      },
      instructions: 'قم بتسجيل الخروج من حساب الأدمين، ثم سجل الدخول بهذه البيانات لتجربة واجهة الهاتف.'
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
