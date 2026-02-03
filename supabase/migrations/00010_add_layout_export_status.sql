
-- Add 'layout_export' value to project_status enum
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'layout_export' AFTER 'review_pass_3';
