import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log('🚀 بدء اختبار الضغط (Stress Test)...');
  console.log('⏳ جاري جلب الناخبين...');
  
  // Fetch voters that haven't voted yet
  const { data: voters, error } = await supabase
    .from('electeurs')
    .select('id, nom, prenom, bureau_name')
    .eq('has_voted', false);
  
  if (error || !voters) {
    console.error('❌ خطأ في جلب الناخبين:', error);
    return;
  }

  if (voters.length === 0) {
    console.log('✅ جميع الناخبين قاموا بالتصويت مسبقاً! قم بإعادة ضبط قاعدة البيانات أولاً.');
    return;
  }

  console.log(`✅ تم العثور على ${voters.length} ناخب لم يصوت بعد.`);
  console.log('🔥 بدء محاكاة التصويت العشوائي (تصويت واحد كل ثانية)...');
  console.log('يمكنك إيقاف الاختبار في أي وقت بالضغط على Ctrl + C');

  let count = 0;
  
  // Create an interval to cast a random vote every 500ms
  const interval = setInterval(async () => {
    if (voters.length === 0) {
      console.log('🎉 انتهى الاختبار! جميع الناخبين قاموا بالتصويت.');
      clearInterval(interval);
      return;
    }
    
    // Pick a random voter
    const randomIndex = Math.floor(Math.random() * voters.length);
    const voter = voters.splice(randomIndex, 1)[0];
    
    // Cast the vote
    const { error: updateError } = await supabase
      .from('electeurs')
      .update({ has_voted: true, voted_at: new Date().toISOString() })
      .eq('id', voter.id);
      
    if (updateError) {
      console.error(`❌ خطأ أثناء التصويت لـ ${voter.nom}:`, updateError);
    } else {
      count++;
      console.log(`[${count}] 🟢 تم التصويت: ${voter.nom} ${voter.prenom} (المكتب: ${voter.bureau_name})`);
    }
  }, 333); // 3 votes per second
}

run();
