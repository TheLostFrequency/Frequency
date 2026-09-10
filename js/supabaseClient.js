// SUPABASE CLIENT INITIALIZATION
// Replace with your actual Supabase Project URL and Anon Key
const SUPABASE_URL = "https://nmiodppvxqpzfrideduv.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_S7SpRNfMTiY7SB4Y19LRDQ_WBzH_TPc";

// Use window._supabase or supabaseClient to prevent variable collision with CDN library
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
