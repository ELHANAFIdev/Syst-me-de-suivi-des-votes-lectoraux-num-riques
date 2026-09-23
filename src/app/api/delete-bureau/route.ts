import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    const { bureau_name } = await request.json();

    if (!bureau_name) {
      return NextResponse.json({ error: 'الرجاء تحديد اسم المكتب.' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'الرجاء إضافة مفاتيح Supabase في ملف .env.local' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Delete all voters in this bureau
    const { error: deleteVotersError } = await supabaseAdmin
      .from('electeurs')
      .delete()
      .eq('bureau_name', bureau_name);

    if (deleteVotersError) {
      console.error('Error deleting voters:', deleteVotersError);
      throw deleteVotersError;
    }

    // 2. Find and delete the bureau manager account (if it exists)
    // The profile has role: 'bureau_manager' and bureau_name: exact name
    const { data: profiles, error: findProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('bureau_name', bureau_name)
      .eq('role', 'bureau_manager');

    if (findProfileError) {
      console.error('Error finding profile:', findProfileError);
    } else if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        // Delete user from auth (this will cascade to profiles)
        const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
        if (deleteUserError) {
          console.error(`Error deleting user ${profile.id}:`, deleteUserError);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `تم حذف المكتب (${bureau_name}) وجميع الناخبين التابعين له بنجاح.` 
    });

  } catch (error: any) {
    console.error('Delete Bureau API Error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ غير متوقع.' }, { status: 500 });
  }
}
