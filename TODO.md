# Draft Generation Page Implementation

## Requirements
- Integrate paragraph structure generation, evidence generation, and coherence verification into draft-agent
- Left panel: LLM-generated draft with streaming output
- Citation markers: Clickable markers showing research material info (summary, URL, etc.)
- User editing: Support user editing and writing on the draft
- Right panel: For each paragraph, show:
  - Why it was generated this way
  - Suggestions for personal content to add
  - Suggestions for personal experiences to include
  - Motivate user collaboration

## Plan
- [x] Step 1: Analyze existing code structure
- [x] Step 2: Create enhanced draft generation page component
  - [x] Sub-task 2.1: Create DraftGenerationPage.tsx
  - [x] Sub-task 2.2: Implement left panel with draft editor
  - [x] Sub-task 2.3: Implement right panel with guidance
- [x] Step 3: Create citation marker component
  - [x] Sub-task 3.1: Create CitationMarker.tsx
  - [x] Sub-task 3.2: Add popover/dialog for material details
- [ ] Step 4: Implement streaming output
  - [ ] Sub-task 4.1: Add streaming support to draft-agent
  - [ ] Sub-task 4.2: Handle streaming in frontend
- [x] Step 5: Enhance database schema
  - [x] Sub-task 5.1: Add citations field to drafts table
  - [x] Sub-task 5.2: Add guidance field for each paragraph
- [x] Step 6: Update routes and navigation
- [ ] Step 7: Test and refine

## Notes
- Existing DraftStage component uses annotations for paragraph metadata
- Extended types to include citations and guidance
- Using contentEditable for better editing experience
- Streaming will be implemented in draft-agent Edge Function
- Added navigation button in DraftStage to access enhanced mode
