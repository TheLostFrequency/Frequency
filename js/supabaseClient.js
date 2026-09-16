// SUPABASE CLIENT INITIALIZATION
const SUPABASE_URL = "https://nmiodppvxqpzfrideduv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5taW9kcHB2eHFwemZlZHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4ODk5MjgsImV4cCI6MjEwNDQ2NTkyOH0.ZoHpE2QIv-E7ofcf9os0oTZzC8B6ak3f3ZkCWG6-yDY";

const cleanUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export const supabase = window.supabase ? window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY) : null;
