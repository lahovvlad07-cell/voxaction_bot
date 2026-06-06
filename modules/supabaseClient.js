// modules/supabaseClient.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

const SUPABASE_URL = "https://gsutnhhklidxmewdkcvk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdXRuaGhrbGlkeG1ld2RrY3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzA2MTEsImV4cCI6MjA5NjE0NjYxMX0.XEtyJVT0BfmEgAAsGagPHRdHhmCgrtWEbtzov0c3EXc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);