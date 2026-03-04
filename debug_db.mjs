
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vlbqcmcldctdafewfejt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYnFjbWNsZGN0ZGFmZXdmZWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDEzNDcsImV4cCI6MjA4NzIxNzM0N30.DmLtiuU9rG7Si4-32gk7AHI2ZpNMJsBTkQxPxqDiPm8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('Checking database info...')

    // Check timeout
    const { data: timeoutData, error: timeoutError } = await supabase.from('pg_settings').select('setting, unit').eq('name', 'statement_timeout').single()
    if (timeoutError) console.error('Error checking timeout:', timeoutError)
    else console.log('Current statement_timeout:', timeoutData.setting, timeoutData.unit)

    // Check triggers on chamados
    // We can't query pg_trigger directly via PostgREST unless exposed, but let's try a common RPC if exists
    // Or just check if we can insert 1 row
    console.log('Testing single upsert...')
    const startTime = Date.now()
    const { error: insertError } = await supabase.from('chamados').upsert([{ id: 'test_id_ping', status: 'test' }])
    const endTime = Date.now()

    if (insertError) console.error('Upsert test failed:', insertError)
    else console.log(`Upsert test successful! Time taken: ${endTime - startTime}ms`)

    // Clean up
    await supabase.from('chamados').delete().eq('id', 'test_id_ping')
}

run()
