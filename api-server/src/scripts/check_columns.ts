
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) {
      process.env[key.trim()] = val.join('=').trim();
    }
  });
  console.log('Loaded .env file manually from', envPath);
} else {
  console.log('No .env file found at', envPath);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  console.error('SUPABASE_URL:', supabaseUrl);
  console.error('SUPABASE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('Checking research_insights columns...');
  
  const columnsToCheck = [
    'insight_id',
    'category',
    'insight',
    'insight_text', // Check this one too
    'supporting_data',
    'source_type',
    'recommended_usage',
    'citability',
    'limitations',
    'user_decision'
  ];

  for (const col of columnsToCheck) {
    const { error } = await supabase
      .from('research_insights')
      .select(col)
      .limit(1);
      
    if (error) {
      console.log(`Column '${col}' check failed:`, error.message);
    } else {
      console.log(`Column '${col}' exists.`);
    }
  }

  console.log('\nChecking research_gaps columns...');
  const gapColumns = [
    'gap_id',
    'issue',
    'gap_text', // Check this one too
    'description',
    'user_decision'
  ];

  for (const col of gapColumns) {
    const { error } = await supabase
      .from('research_gaps')
      .select(col)
      .limit(1);
      
    if (error) {
      console.log(`Column '${col}' check failed:`, error.message);
    } else {
      console.log(`Column '${col}' exists.`);
    }
  }

  console.log('\nChecking writing_sessions columns...');
  const sessionColumns = [
    'structure_result',
    'synthesis_result',
    'topic',
    'target_audience',
    'writing_purpose',
    'key_points'
  ];

  for (const col of sessionColumns) {
    const { error } = await supabase
      .from('writing_sessions')
      .select(col)
      .limit(1);
      
    if (error) {
      console.log(`Column '${col}' check failed:`, error.message);
    } else {
      console.log(`Column '${col}' exists.`);
    }
  }

  console.log('\nChecking retrieved_materials columns...');
  const materialColumns = [
    'title',
    'url',
    'authors',
    'year'
  ];

  for (const col of materialColumns) {
    const { error } = await supabase
      .from('retrieved_materials')
      .select(col)
      .limit(1);
      
    if (error) {
      console.log(`Column '${col}' check failed:`, error.message);
    } else {
      console.log(`Column '${col}' exists.`);
    }
  }
}

checkColumns().catch(console.error);
