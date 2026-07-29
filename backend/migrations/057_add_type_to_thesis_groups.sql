-- Groups previously had no notion of thesis vs capstone, so every
-- submission was hardcoded to 'thesis' at creation regardless of the
-- group's actual program/track. The leader now picks this at group
-- creation (see groups.service.js createGroup).
ALTER TABLE thesis_groups
  ADD COLUMN type ENUM('thesis','capstone') NOT NULL DEFAULT 'thesis' AFTER title;
