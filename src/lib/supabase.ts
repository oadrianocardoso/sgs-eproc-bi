import { createClient } from '@supabase/supabase-js'
import { resolveApiBaseUrl } from './apiBaseUrl'

export const apiBaseUrl = resolveApiBaseUrl()
const supabaseUrl = apiBaseUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYnFjbWNsZGN0ZGFmZXdmZWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDEzNDcsImV4cCI6MjA4NzIxNzM0N30.DmLtiuU9rG7Si4-32gk7AHI2ZpNMJsBTkQxPxqDiPm8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
