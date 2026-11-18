import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const guildId = '1490619387869139108';
    console.log(`Checking config for guild ${guildId}...`);

    const { data: config, error } = await supabase
        .from('guilds')
        .select('dynamic_voice_enabled, dynamic_voice_hub_id')
        .eq('id', guildId)
        .single();

    if (error) {
        console.error('Database Error:', error);
    } else {
        console.log('Config Found:', JSON.stringify(config, null, 2));
        if (config.dynamic_voice_hub_id === '1491157489138401280') {
            console.log('✅ Hub ID is CORRECT (premium-voice)');
        } else {
            console.log('❌ Hub ID is INCORRECT! Expected 1491157489138401280');
        }
    }
}

check();
