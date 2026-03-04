
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vlbqcmcldctdafewfejt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYnFjbWNsZGN0ZGFmZXdmZWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDEzNDcsImV4cCI6MjA4NzIxNzM0N30.DmLtiuU9rG7Si4-32gk7AHI2ZpNMJsBTkQxPxqDiPm8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    const randomId = 'test_' + Math.random().toString(36).substring(7)
    console.log(`Testing simple INSERT with ID: ${randomId}`)

    const startTime = Date.now()
    const { error } = await supabase.from('chamados').insert([{ id: randomId, status: 'test_insert' }])
    const endTime = Date.now()

    if (error) console.error('Insert failed:', error)
    else console.log(`Insert successful! Time taken: ${endTime - startTime}ms`)

    // Clean up
    if (!error) await supabase.from('chamados').delete().eq('id', randomId)
}

run()
