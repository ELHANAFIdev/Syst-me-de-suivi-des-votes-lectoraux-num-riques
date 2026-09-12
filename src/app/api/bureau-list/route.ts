import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing keys' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Fetch using Admin Key to bypass RLS for public unauthenticated users
  // We need to paginate to bypass the 1000 row limit
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('electeurs')
      .select('bureau_name, province')
      .range(from, from + step - 1);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += step;
      if (data.length < step) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  const provs = new Set<string>();
  const map: Record<string, Set<string>> = {};

  allData.forEach(v => {
    if (v.province && v.bureau_name) {
      provs.add(v.province);
      if (!map[v.province]) map[v.province] = new Set();
      map[v.province].add(v.bureau_name);
    }
  });

  const finalMap: Record<string, string[]> = {};
  for (const p in map) {
    finalMap[p] = Array.from(map[p]).sort((a, b) => a.localeCompare(b));
  }

  return NextResponse.json({
    provinces: Array.from(provs).sort((a, b) => a.localeCompare(b)),
    bureauxByProvince: finalMap
  });
}
