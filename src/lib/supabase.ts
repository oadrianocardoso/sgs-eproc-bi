import { createClient } from '@supabase/supabase-js'
import { resolveApiBaseUrl } from './apiBaseUrl'

export const apiBaseUrl = resolveApiBaseUrl()
const supabaseUrl = apiBaseUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InNncy1lcHJvYy1iaSIsImlhdCI6MTc3MjczMzU1OSwiZXhwIjoyMDg3MjE3MzQ3fQ.bcu-qGy4N-bj2HC8sjRFipbCp7kniGSxoDLKkYb9v5c'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
