"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { createClient } = require('@supabase/supabase-js');
const config = require('./index');
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
module.exports = supabase;
