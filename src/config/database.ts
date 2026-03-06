import { createClient } from '@supabase/supabase-js';
import config from './index';

const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_KEY!);

export default supabase;

