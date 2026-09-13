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

    const singleResponsableName = requestBody.responsable_name;
    const uniqueResponsables = new Map<string, { type: string }>();

    if (singleResponsableName) {
      uniqueResponsables.set(singleResponsableName, { type: 'مسؤول' });
    } else {
      // 1. Fetch all unique responsables from electeurs
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabaseAdmin
          .from('electeurs')
          .select('responsable, sous_responsable')
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
        if (v.responsable && v.responsable.trim()) {
          uniqueResponsables.set(v.responsable.trim().toUpperCase(), { type: 'مسؤول' });
        }
        if (v.sous_responsable && v.sous_responsable.trim()) {
          const sousResp = v.sous_responsable.trim().toUpperCase();
          if (!uniqueResponsables.has(sousResp)) {
            uniqueResponsables.set(sousResp, { type: 'نائب مسؤول' });
          }
        }
      });
    }

    const results = [];

    // 2. Process each responsable sequentially
    for (const [respName, info] of uniqueResponsables.entries()) {
      // Generate secure 6-digit PIN
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Generate Hash for email
      let hash = 0;
      for (let i = 0; i < respName.length; i++) {
        hash = (hash << 5) - hash + respName.charCodeAt(i);
        hash |= 0;
      }
      const safeId = Math.abs(hash);
      const email = `resp_${safeId}@election.com`;

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
          // If exists, fetch user ID from profiles table
          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('bureau_name', `RESP_${respName}`)
            .eq('role', 'bureau_manager')
            .single();

          if (existingProfile && existingProfile.id) {
            userId = existingProfile.id;
            await supabaseAdmin.auth.admin.updateUserById(userId, { 
              password: pin,
              user_metadata: { pin: pin }
            });
          } else {
            // Fallback to searching Auth users
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
          console.error(`Error creating auth for ${respName}:`, authError);
          continue;
        }
      } else {
        userId = authData.user.id;
      }

      // 4. Update profiles table (using bureau_name column to store the responsable name with RESP_ prefix)
      if (userId) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert([
            { id: userId, role: 'bureau_manager', bureau_name: `RESP_${respName}` }
          ]);

        if (profileError) {
          console.error(`Error updating profile for ${respName}:`, profileError);
        } else {
          results.push({
            type: info.type,
            responsable_name: respName,
            email: email,
            pin: pin
          });
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `تم إنشاء / تحديث حسابات ${results.length} مسؤول بنجاح!`,
      accounts: results
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
