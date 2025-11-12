
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';


const SUPABASE_URL = "https://temftwsenhmoquvwhrav.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlbWZ0d3Nlbmhtb3F1dndocmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3OTAwMDMsImV4cCI6MjA3ODM2NjAwM30.QoCOFPowc1CEUyVlGbDonNYJd9GLU4bZTe_ZO8MpM9s";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});