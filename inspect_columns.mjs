
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vlbqcmcldctdafewfejt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYnFjbWNsZGN0ZGFmZXdmZWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDEzNDcsImV4cCI6MjA4NzIxNzM0N30.DmLtiuU9rG7Si4-32gk7AHI2ZpNMJsBTkQxPxqDiPm8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('Fetching first row to check column types...')
    const { data, error } = await supabase.from('chamados').select('*').limit(1)
    if (error) {
        console.error('Error fetching data:', error)
        return
    }

    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]))
        console.log('Sample data:', data[0])
    } else {
        console.log('No data in chamados table.')
    }
}

run()
