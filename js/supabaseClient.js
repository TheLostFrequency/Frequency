// SUPABASE CLIENT INITIALIZATION
const SUPABASE_URL = "https://nmiodppvxqpzfrideduv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_S7SpRNfMTiY7SB4Y19LRDQ_WBzH_TPc";

const cleanUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export const supabase = window.supabase ? window.supabase.createClient(cleanUrl, SUPABASE_PUBLISHABLE_KEY) : null;
