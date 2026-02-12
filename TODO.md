# Draft Generation Page Implementation

## Requirements
- Integrate paragraph structure generation, evidence generation, and coherence verification into draft-agent
- Left panel: Title, stats (word count, read time, AI gen rate), editable content, citation markers, log section
- Right panel: Coaching rail with paragraph logic, suggestions, active collaboration, chat interface
- Citation markers: Clickable markers showing research material info (summary, URL, etc.)
- User editing: Support user editing and writing on the draft
- Chat interface: Allow users to interact with AI to modify the article

## Plan
- [x] Step 1: Analyze existing code structure and design image
- [x] Step 2: Recreate draft generation page based on design
  - [x] Sub-task 2.1: Implement header with progress bar
  - [x] Sub-task 2.2: Implement left panel with title, stats, content, log section
  - [x] Sub-task 2.3: Implement right panel with coaching sections
  - [x] Sub-task 2.4: Add chat interface at bottom of right panel
- [x] Step 3: Citation marker component (already created)
- [x] Step 4: Add sample content for demonstration
  - [x] Sub-task 4.1: Create sample content with HTML formatting
  - [x] Sub-task 4.2: Create sample citations
  - [x] Sub-task 4.3: Create sample guidance
- [x] Step 5: Database schema (already enhanced)
- [x] Step 6: Update routes and navigation
- [x] Step 7: Pass lint checks

## Notes
- Redesigned page to match the provided design image
- Left panel shows title, word count, read time, AI generation rate
- Right panel shows coaching rail with logic, suggestions, active collaboration
- Bottom of right panel has chat interface for AI interaction
- Log section at bottom of left panel shows generation progress
- All components styled to match the design
- Added sample content for demonstration purposes
- Page is accessible at `/project/:projectId/draft`
