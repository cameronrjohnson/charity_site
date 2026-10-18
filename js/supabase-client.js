import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://kelyzgrhtmupwmyzhrmk.supabase.co";
const supabasePublishableKey = "sb_publishable_ulck2Ja94PaPEJ6Lu12R1Q_vaiqxtLB";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
