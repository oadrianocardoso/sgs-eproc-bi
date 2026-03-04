
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vlbqcmcldctdafewfejt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYnFjbWNsZGN0ZGFmZXdmZWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDEzNDcsImV4cCI6MjA4NzIxNzM0N30.DmLtiuU9rG7Si4-32gk7AHI2ZpNMJsBTkQxPxqDiPm8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('Checking field sizes...')
    const { data, error } = await supabase.from('chamados').select('description, solution').limit(10)
    if (error) {
        console.error('Error:', error)
        return
    }

    data.forEach((row, i) => {
        const descLen = (row.description || '').length
        const solLen = (row.solution || '').length
        console.log(`Row ${i}: Desc=${descLen} chars, Sol=${solLen} chars`)
    })
}

run()
