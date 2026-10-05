ALTER TABLE archive ADD COLUMN content_text LONGTEXT NULL;
ALTER TABLE archive ADD FULLTEXT INDEX ft_archive_content (content_text);
