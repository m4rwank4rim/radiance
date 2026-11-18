import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Check VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: rows, error: fetchError } = await supabase
    .from("guilds")
    .select("id, active_modules");

  if (fetchError) {
    console.error("Failed to fetch guild rows:", fetchError.message);
    process.exit(1);
  }

  const targets = (rows || []).filter((row: any) => row?.active_modules?.gambling !== undefined);

  if (targets.length === 0) {
    console.log("No guild rows contain active_modules.gambling. Nothing to clean.");
    return;
  }

  let updated = 0;
  for (const row of targets) {
    const nextModules = { ...(row.active_modules || {}) };
    delete nextModules.gambling;

    const { error: updateError } = await supabase
      .from("guilds")
      .update({ active_modules: nextModules })
      .eq("id", row.id);

    if (updateError) {
      console.error(`Failed to update guild ${row.id}: ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(`Cleanup complete. Updated ${updated}/${targets.length} guild rows.`);
}

run().catch((err) => {
  console.error("Unexpected cleanup error:", err);
  process.exit(1);
});
