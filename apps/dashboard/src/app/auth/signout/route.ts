import { redirect } from 'next/navigation';
import { supabaseServidor } from '@/lib/supabase';

export async function POST() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect('/login');
}
