-- Lets the admin turn the auto-scheduler on/off without disabling manual scheduling.
INSERT IGNORE INTO system_settings (key_name, value, description) VALUES
  ('auto_scheduling_enabled', 'true', 'Allow admins to use the automatic scheduling tool (manual scheduling is always available)');
