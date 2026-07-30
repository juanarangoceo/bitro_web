import { NextResponse, type NextRequest } from 'next/server';
import { supabaseSesion } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const supabase = await supabaseSesion();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), 303);
}

