
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vlbqcmcldctdafewfejt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYnFjbWNsZGN0ZGFmZXdmZWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDEzNDcsImV4cCI6MjA4NzIxNzM0N30.DmLtiuU9rG7Si4-32gk7AHI2ZpNMJsBTkQxPxqDiPm8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('Counting rows in chamados...')
    const { count, error } = await supabase.from('chamados').select('*', { count: 'exact', head: true })
    if (error) console.error('Error counting rows:', error)
    else console.log('Total rows in chamados:', count)
}

run()
