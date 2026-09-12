import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';

// Initialize Supabase with Service Role Key to bypass RLS during centralized import
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'لم يتم العثور على ملف' }, { status: 400 });
    }

    // 1. Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rawData = xlsx.utils.sheet_to_json(worksheet);

    const mappedVoters = rawData.map((row: any) => {
      const bName = row['LISTE - مكتب التصويت']?.toString().trim();
      const pName = row[' المقاطعة']?.toString().trim();
      const combinedBureauName = pName ? `مقاطعة ${pName} - مكتب ${bName}` : `مكتب ${bName}`;

      return {
        cin: row['CIN']?.toString().trim(),
        nom: row['LISTE - الاسم العائلي']?.toString().trim(),
        prenom: row['LISTE - الاسم الشخصي']?.toString().trim(),
        date_naissance: row['LISTE - تاريخ الازدياد']?.toString().trim(),
        adresse: row['LISTE - العنوان']?.toString().trim(),
        bureau_name: combinedBureauName,
        province: pName,
        responsable: row['Responsable']?.toString().trim(),
        telephone_responsable: row['Telephone']?.toString().trim(),
        sous_responsable: row['sous responsable']?.toString().trim(),
        telephone_sous_responsable: row['Telephone.1']?.toString().trim(),
        telephone_electeur: row['Telephone.2']?.toString().trim(),
      };
    }).filter(v => v.cin); // Ignore rows without CIN

    // Deduplicate by CIN (keep last occurrence) to prevent Postgres ON CONFLICT errors
    const uniqueMap = new Map();
    mappedVoters.forEach(v => uniqueMap.set(v.cin, v));
    const uniqueMappedVoters = Array.from(uniqueMap.values());

    if (uniqueMappedVoters.length === 0) {
      return NextResponse.json({ error: 'الملف لا يحتوي على بيانات صحيحة أو ينقص عمود CIN.' }, { status: 400 });
    }

    // 3. (Smart Upsert) Fetch current voting status to prevent losing it
    const cins = uniqueMappedVoters.map(v => v.cin);
    
    // We might need to chunk the fetch if there are thousands of voters
    const FETCH_BATCH_SIZE = 200; // Small batch for GET request (URL length limit)
    const UPSERT_BATCH_SIZE = 1000; // Larger batch for POST request (body)
    
    const existingVoters: any[] = [];
    
    for (let i = 0; i < cins.length; i += FETCH_BATCH_SIZE) {
      const batchCins = cins.slice(i, i + FETCH_BATCH_SIZE);
      const { data, error } = await supabase
        .from('electeurs')
        .select('cin, has_voted, voted_at')
        .in('cin', batchCins);
      
      if (error) {
        console.error('Error fetching existing voters:', error);
        throw error;
      }
      
      if (data) {
        existingVoters.push(...data);
      }
    }

    const existingMap = new Map(existingVoters.map(v => [v.cin, v]));

    // 4. Merge new data with existing voting status
    const finalDataToUpsert = uniqueMappedVoters.map(voter => {
      const existing = existingMap.get(voter.cin);
      return {
        ...voter,
        has_voted: existing ? existing.has_voted : false,
        voted_at: existing ? existing.voted_at : null,
      };
    });

    // 5. Upsert data in batches
    let upsertCount = 0;
    for (let i = 0; i < finalDataToUpsert.length; i += UPSERT_BATCH_SIZE) {
      const batch = finalDataToUpsert.slice(i, i + UPSERT_BATCH_SIZE);
      const { error } = await supabase
        .from('electeurs')
        .upsert(batch, { onConflict: 'cin', ignoreDuplicates: false });
      
      if (error) {
        console.error('Error upserting batch:', error);
        throw error;
      }
      upsertCount += batch.length;
    }

    return NextResponse.json({ 
      success: true, 
      message: `تم استيراد/تحديث ${upsertCount} ناخب بنجاح.` 
    });

  } catch (error: any) {
    console.error('Import Error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء الاستيراد' }, { status: 500 });
  }
}
