import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data: guilds, error: guildsError } = await supabase.from('guilds').select('*');
    console.log("=== DB Guilds ===");
    if (guildsError) {
        console.error("Error reading guilds:", guildsError);
    } else {
        console.log(guilds);
    }
}

check();
