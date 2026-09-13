import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { assignedName, token } = body;

    if (!assignedName || !token) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify user session using the token to ensure security
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect with Admin privileges to bypass RLS for Responsables
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Fetch all voters and filter them exactly like the tracking page
    // Using Admin key ensures RLS doesn't block the rows.
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('electeurs')
        .select('*')
        .range(from, from + step - 1);

      if (error) {
        console.error('Error fetching all voters:', error);
        break;
      }
      if (data) {
        allData = [...allData, ...data];
        if (data.length < step) break;
      } else {
        break;
      }
      from += step;
    }

    const assignedNameUpper = assignedName.trim().toUpperCase();
    
    const filteredData = allData.filter(v => {
      const resp = v.responsable ? v.responsable.trim().toUpperCase() : '';
      const sousResp = v.sous_responsable ? v.sous_responsable.trim().toUpperCase() : '';
      return resp === assignedNameUpper || sousResp === assignedNameUpper;
    });

    return NextResponse.json({ voters: filteredData });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
