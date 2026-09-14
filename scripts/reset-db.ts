import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }});

async function reset() {
  console.log('⏳ جاري إعادة ضبط قاعدة البيانات (إلغاء جميع الأصوات)...');
  
  // Update all voters to unvoted
  const { error } = await supabase
    .from('electeurs')
    .update({ has_voted: false, voted_at: null })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to update all

  if (error) {
    console.error('❌ خطأ:', error);
  } else {
    console.log('✅ تم إرجاع جميع الناخبين للحالة العادية (لم يصوت).');
  }
}

reset();
