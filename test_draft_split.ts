
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env manually for test script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, 'api-server/.env');

console.log('Loading env from:', envPath);

if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach((line: string) => {
    const [key, ...val] = line.split('=');
    if (key && val) {
      process.env[key.trim()] = val.join('=').trim();
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Must use service key for admin tasks

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getAuthenticatedClient() {
  const email = `test-user-${Date.now()}@example.com`;
  const password = 'password123';

  console.log(`Signing up test user ${email}...`);

  // Try standard signUp since we might only have anon key
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError);
    
    // Fallback: try to sign in with a known test user
    console.log('Trying fallback user...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'lilacfei@gmail.com', // Try a likely user or just fail
        password: 'password123'
    });
    
    if (signInError) {
        console.error('Fallback sign in failed:', signInError);
        return null;
    }
    return { user: signInData.user, session: signInData.session };
  }

  // If signUp worked, we might have a session immediately if email confirm is off
  if (signUpData.session) {
      return { user: signUpData.user, session: signUpData.session };
  } else {
      console.log('User created but no session (email confirmation required?).');
      // If we can't get a session, we can't proceed unless we have service key to auto-confirm
      // But we checked and likely only have anon key.
      return null;
  }
}

async function setupTestProject(user: any, session: any) {
    // Create authenticated client
    const authenticatedClient = createClient(supabaseUrl!, supabaseKey!, {
        global: {
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
        },
    });

    // Check for existing project
    const { data: projects } = await authenticatedClient
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

    if (projects && projects.length > 0) {
        console.log('Found existing project:', projects[0].id);
        return projects[0].id;
    }

    console.log('Creating new project...');
    const { data: newProject, error: createError } = await authenticatedClient
        .from('projects')
        .insert({
            title: 'Split Draft Agent Test',
            user_id: user.id
        })
        .select('id')
        .single();

    if (createError) {
        console.error('Error creating project:', createError);
        // If RLS fails, try with admin client as fallback for setup
        console.log('Trying to create project with admin client...');
        const { data: adminProject, error: adminError } = await supabase
            .from('projects')
            .insert({
                title: 'Split Draft Agent Test (Admin)',
                user_id: user.id
            })
            .select('id')
            .single();
        
        if (adminError) {
            console.error('Admin create project failed:', adminError);
            return null;
        }
        return adminProject.id;
    }

    return newProject.id;
}

async function testSplitDraftAgent() {
  console.log('Testing Split Draft Agent...');
  
  const auth = await getAuthenticatedClient();
  if (!auth || !auth.user || !auth.session) {
      console.error('Authentication failed.');
      return;
  }
  const { user, session } = auth;
  console.log('Authenticated User:', user.id);

  const projectId = await setupTestProject(user, session);
  if (!projectId) return;

  // Need to ensure prerequisites exist: Brief, Structure, Research Pack
  // For this test, we might need to mock them or just run the agents if they handle missing data gracefully (they don't usually)
  // Let's assume we need to insert some dummy data first.
  
  console.log('Setting up prerequisites...');
  
  // 1. Insert Brief
  await supabase.from('requirements').insert({
      project_id: projectId,
      payload_jsonb: { topic: 'Test Topic', target_audience: 'General', writing_purpose: 'Test' },
      version: 1
  });

  // 2. Insert Structure
  await supabase.from('article_structures').insert({
      project_id: projectId,
      payload_jsonb: { 
          argument_outline: {
              core_thesis: 'Test Thesis',
              argument_blocks: [
                  { title: 'Introduction', description: 'Intro', order: 1 },
                  { title: 'Body', description: 'Body para', order: 2 },
                  { title: 'Conclusion', description: 'Conc', order: 3 }
              ]
          }
      },
      version: 1
  });

  // 3. Insert Research Insights (Mock)
  await supabase.from('research_insights').insert({
      project_id: projectId, // Use project_id for simplicity if session_id is missing
      insight: 'Test Insight',
      category: 'General',
      user_decision: 'adopt',
      insight_text: 'Test Insight Content'
  });

  // 4. Insert Retrieved Materials (Mock)
  await supabase.from('retrieved_materials').insert({
      project_id: projectId,
      title: 'Test Material',
      full_text: 'Test Material Content',
      source_type: 'web',
      is_selected: true
  });

  console.log('Prerequisites setup complete.');

  try {
    // 1. Test Content Generation
    console.log('\n1. Calling Generate Content...');
    
    const response1 = await fetch('http://localhost:3000/api/draft/generate-content', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ project_id: projectId })
    });
    
    const contentResult: any = await response1.json();
    
    if (!response1.ok) {
        throw new Error(`Content Gen Failed: ${JSON.stringify(contentResult)}`);
    }

    console.log('Content Generation Success:', contentResult.success);
    console.log('Draft ID:', contentResult.draft_id);
    console.log('Content Preview:', contentResult.content.substring(0, 100) + '...');

    const draftId = contentResult.draft_id;

    // 2. Test Structure Analysis
    console.log('\n2. Calling Structure Analysis...');
    const response2 = await fetch('http://localhost:3000/api/draft/analyze-structure', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ project_id: projectId, draft_id: draftId })
    });

    const analysisResult: any = await response2.json();

    if (!response2.ok) {
        throw new Error(`Analysis Failed: ${JSON.stringify(analysisResult)}`);
    }

    console.log('Analysis Success:', analysisResult.success);
    console.log('Annotations Count:', analysisResult.annotations?.length);
    if (analysisResult.annotations?.length > 0) {
        console.log('First Annotation:', JSON.stringify(analysisResult.annotations[0], null, 2));
    }

  } catch (error) {
    console.error('Test Failed:', error);
  }
}

testSplitDraftAgent();
