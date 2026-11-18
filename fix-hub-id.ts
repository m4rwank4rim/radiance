import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    const guildId = '1490619387869139108';
    const correctHubId = '1491157489138401280';

    console.log(`Updating hub ID for guild ${guildId} to ${correctHubId}...`);
    const { error } = await supabase
        .from('guilds')
        .update({ dynamic_voice_hub_id: correctHubId })
        .eq('id', guildId);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success!');
    }
}

fix();
