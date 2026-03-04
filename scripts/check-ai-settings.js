
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

async function checkSettings() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Faltan variables de entorno");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: ai_settings, error } = await supabase.from('ai_settings').select('*');
    if (error) {
        console.error("Error leyendo ai_settings:", error);
        return;
    }
    const inst = ai_settings.find(s => s.key === 'system_instructions');
    if (inst) {
        console.log("--- SYSTEM INSTRUCTIONS ---");
        console.log(inst.value);
        console.log("---------------------------");
    } else {
        console.log("No se encontró system_instructions en ai_settings.");
    }
}

checkSettings();
