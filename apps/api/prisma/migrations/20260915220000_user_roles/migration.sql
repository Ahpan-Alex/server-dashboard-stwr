ALTER TABLE `users` ADD COLUMN `roles` JSON NULL;
UPDATE `users` SET `roles` = CAST('[]' AS JSON) WHERE `roles` IS NULL;
ALTER TABLE `users` MODIFY `roles` JSON NOT NULL;
