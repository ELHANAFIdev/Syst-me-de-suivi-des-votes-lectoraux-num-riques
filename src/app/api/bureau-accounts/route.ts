import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'الرجاء إضافة مفاتيح Supabase في ملف .env.local' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    let requestBody: any = {};
    try {
      requestBody = await request.json();
    } catch (e) {
      // Ignore if no JSON body
    }

    const singleBureauName = requestBody.bureau_name;
    const uniqueBureaux = new Map<string, { bureau_name: string, province: string }>();

    if (singleBureauName) {
      uniqueBureaux.set(singleBureauName, { bureau_name: singleBureauName, province: 'غير محدد' });
    } else {
      // 1. Fetch all unique bureaux from electeurs (paginate to bypass 1000 limit)
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabaseAdmin
          .from('electeurs')
          .select('bureau_name, province')
          .range(from, from + step - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = allData.concat(data);
          from += step;
          if (data.length < step) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      // Deduplicate
      allData.forEach(v => {
        if (v.bureau_name && v.province) {
          if (!uniqueBureaux.has(v.bureau_name)) {
            uniqueBureaux.set(v.bureau_name, { bureau_name: v.bureau_name, province: v.province });
          }
        }
      });
    }

    const results = [];

    // 2. Process each bureau sequentially to avoid rate limits
    for (const [bureauName, info] of uniqueBureaux.entries()) {
      // Generate secure 6-digit PIN
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Generate Hash for email
      let hash = 0;
      for (let i = 0; i < bureauName.length; i++) {
        hash = (hash << 5) - hash + bureauName.charCodeAt(i);
        hash |= 0;
      }
      const safeId = Math.abs(hash);
      const email = `bureau_${safeId}@election.com`;

      let userId = null;

      // 3. Try to create the user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: { pin: pin }
      });

      if (authError) {
        if (authError.message.includes('already been registered')) {
          // If exists, fetch user ID from profiles table instead of listUsers (which limits to 50)
          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('bureau_name', bureauName)
            .single();

          if (existingProfile && existingProfile.id) {
            userId = existingProfile.id;
            // Update to the new PIN
            await supabaseAdmin.auth.admin.updateUserById(userId, { 
              password: pin,
              user_metadata: { pin: pin }
            });
          } else {
            // Fallback: If not in profiles, we have to search Auth users (paginated)
            let page = 1;
            let foundUser = null;
            while (true) {
              const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
              if (!listData || !listData.users || listData.users.length === 0) break;
              
              foundUser = listData.users.find(u => u.email === email);
              if (foundUser) break;
              page++;
            }
            
            if (foundUser) {
              userId = foundUser.id;
              await supabaseAdmin.auth.admin.updateUserById(userId, { 
                password: pin,
                user_metadata: { pin: pin }
              });
            }
          }
        } else {
          console.error(`Error creating auth for ${bureauName}:`, authError);
          continue; // Skip on error
        }
      } else {
        userId = authData.user.id;
      }

      // 4. Update profiles table
      if (userId) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert([
            { id: userId, role: 'bureau_manager', bureau_name: bureauName }
          ]);

        if (profileError) {
          console.error(`Error updating profile for ${bureauName}:`, profileError);
        } else {
          results.push({
            province: info.province,
            bureau_name: bureauName,
            email: email, // Admin might not need this, but good for debugging
            pin: pin
          });
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `تم إنشاء / تحديث حسابات ${results.length} مكتب بنجاح!`,
      accounts: results
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
