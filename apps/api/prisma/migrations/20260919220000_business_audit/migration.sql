-- CreateTable
CREATE TABLE `business_audit` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` VARCHAR(191) NULL,
    `user_nom` VARCHAR(200) NOT NULL,
    `categorie` VARCHAR(32) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `module` VARCHAR(32) NOT NULL,
    `objet_type` VARCHAR(64) NOT NULL,
    `objet_id` VARCHAR(128) NULL,
    `objet_libelle` VARCHAR(255) NULL,
    `objet_href` VARCHAR(255) NULL,
    `champ` VARCHAR(128) NULL,
    `ancienne_valeur` TEXT NULL,
    `nouvelle_valeur` TEXT NULL,
    `detail` VARCHAR(500) NULL,
    `site_id` VARCHAR(64) NULL,
    `site_libelle` VARCHAR(200) NULL,

    INDEX `business_audit_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `business_audit_tenant_id_user_id_created_at_idx`(`tenant_id`, `user_id`, `created_at`),
    INDEX `business_audit_tenant_id_action_created_at_idx`(`tenant_id`, `action`, `created_at`),
    INDEX `business_audit_tenant_id_categorie_created_at_idx`(`tenant_id`, `categorie`, `created_at`),
    INDEX `business_audit_tenant_id_module_created_at_idx`(`tenant_id`, `module`, `created_at`),
    INDEX `business_audit_tenant_id_objet_type_objet_id_idx`(`tenant_id`, `objet_type`, `objet_id`),
    INDEX `business_audit_tenant_id_site_id_created_at_idx`(`tenant_id`, `site_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `business_audit` ADD CONSTRAINT `business_audit_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_audit` ADD CONSTRAINT `business_audit_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
