-- โครงสร้างฐานข้อมูลของระบบรายงาน (แยกจาก HIS) — MySQL 8
-- รันซ้ำได้ (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS app_user (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE COMMENT 'แยกตัวพิมพ์ เหมือน hi.dct (tis620_bin) เช่น G7 กับ g7 เป็นคนละคน',
    display_name  VARCHAR(150) NOT NULL,
    department    VARCHAR(150) NULL,
    auth_source   ENUM('local','his') NOT NULL DEFAULT 'his',
    password_hash VARCHAR(255) NULL COMMENT 'ใช้เฉพาะ auth_source=local',
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    last_login    DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    can_export      TINYINT(1) NOT NULL DEFAULT 0,
    can_view_person TINYINT(1) NOT NULL DEFAULT 0,
    can_author      TINYINT(1) NOT NULL DEFAULT 0,
    is_admin        TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_role (
    user_id INT UNSIGNED NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ธีมของผู้ใช้ (จำข้ามเครื่อง)
CREATE TABLE IF NOT EXISTS user_setting (
    user_id    INT UNSIGNED PRIMARY KEY,
    theme      VARCHAR(10) NOT NULL DEFAULT 'system' COMMENT 'light | dark | system',
    color      VARCHAR(20) NOT NULL DEFAULT 'blue'   COMMENT 'ชุดสีหลัก',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS report_category (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    sort INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_group (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NULL,
    name        VARCHAR(150) NOT NULL,
    icon        VARCHAR(40)  NOT NULL DEFAULT 'folder',
    description VARCHAR(500) NULL,
    sort        INT NOT NULL DEFAULT 0,
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    legacy_item_id INT NULL COMMENT 'item_id จาก reportdb.rep_query_item',
    FOREIGN KEY (category_id) REFERENCES report_category(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_group (
    role_id  INT UNSIGNED NOT NULL,
    group_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, group_id),
    FOREIGN KEY (role_id)  REFERENCES role(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES report_group(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS report (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_id          INT UNSIGNED NULL,
    code              VARCHAR(50)  NULL,
    name              VARCHAR(255) NOT NULL,
    description       TEXT NULL COMMENT 'นิยาม / สูตรคำนวณ',
    reference         VARCHAR(255) NULL,
    tags              VARCHAR(255) NULL,
    type              ENUM('system','custom') NOT NULL DEFAULT 'custom',
    status            ENUM('draft','published','disabled') NOT NULL DEFAULT 'draft',
    has_person_data   TINYINT(1) NOT NULL DEFAULT 0,
    cache_ttl         INT NOT NULL DEFAULT 1800 COMMENT 'วินาที, 0 = ไม่ cache',
    timeout_sec       INT NOT NULL DEFAULT 60,
    row_limit         INT NOT NULL DEFAULT 50000,
    published_version INT NULL,
    latest_version    INT NOT NULL DEFAULT 1,
    legacy_query_id   INT NULL UNIQUE COMMENT 'query_id จาก reportdb.rep_query_item',
    created_by        INT UNSIGNED NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES report_group(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_version (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_id    INT UNSIGNED NOT NULL,
    version      INT NOT NULL,
    sql_text     MEDIUMTEXT NOT NULL,
    params_json  JSON NULL,
    columns_json JSON NULL,
    display_json JSON NULL,
    kpi_json     JSON NULL,
    note         VARCHAR(500) NULL,
    created_by   INT UNSIGNED NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_report_version (report_id, version),
    FOREIGN KEY (report_id) REFERENCES report(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_dashboard (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    name            VARCHAR(150) NOT NULL,
    filters_json    JSON NULL,
    shared_role_ids JSON NULL,
    sort            INT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dashboard_widget (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dashboard_id INT UNSIGNED NOT NULL,
    report_id    INT UNSIGNED NOT NULL,
    view         VARCHAR(20) NOT NULL DEFAULT 'auto',
    width        VARCHAR(10) NOT NULL DEFAULT 'half' COMMENT 'quarter | half | full',
    sort         INT NOT NULL DEFAULT 0,
    params_json  JSON NULL,
    FOREIGN KEY (dashboard_id) REFERENCES user_dashboard(id) ON DELETE CASCADE,
    FOREIGN KEY (report_id) REFERENCES report(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_favorite (
    user_id   INT UNSIGNED NOT NULL,
    report_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, report_id),
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    FOREIGN KEY (report_id) REFERENCES report(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_recent (
    user_id     INT UNSIGNED NOT NULL,
    report_id   INT UNSIGNED NOT NULL,
    params_json JSON NULL,
    opened_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, report_id),
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    FOREIGN KEY (report_id) REFERENCES report(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS report_request (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    type        ENUM('new','change','data_issue') NOT NULL DEFAULT 'new',
    title       VARCHAR(255) NOT NULL,
    detail      TEXT NULL,
    urgency     ENUM('normal','urgent','critical') NOT NULL DEFAULT 'normal',
    status      ENUM('submitted','accepted','developing','verifying','published','rejected') NOT NULL DEFAULT 'submitted',
    assigned_to INT UNSIGNED NULL,
    report_id   INT UNSIGNED NULL,
    contact     VARCHAR(100) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ข้อมูลที่ไม่มีใน HIS (เช่น SEMI-ICU, จำนวนเตียง)
CREATE TABLE IF NOT EXISTS manual_value (
    k           VARCHAR(50) NOT NULL,
    fiscal_year INT NOT NULL,
    value       DECIMAL(14,2) NULL,
    PRIMARY KEY (k, fiscal_year)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS report_cache (
    report_id   INT UNSIGNED NOT NULL,
    version     INT NOT NULL,
    params_hash CHAR(40) NOT NULL,
    payload     LONGTEXT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  DATETIME NULL,
    PRIMARY KEY (report_id, version, params_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- แฟ้มผลรายงานที่ผู้ใช้บันทึกไว้ (เห็นเฉพาะเจ้าของ) — เก็บสำเนานิยามการดึงข้อมูล ณ ตอนบันทึก
-- เปิดได้แม้รายงานต้นทางถูกแก้/ลบ; ข้อมูลแถวแยกไว้ใน saved_result_data
CREATE TABLE IF NOT EXISTS saved_result (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    report_id       INT UNSIGNED NULL,
    report_version  INT UNSIGNED NOT NULL,
    name            VARCHAR(200) NOT NULL,
    note            TEXT NULL,
    report_name     VARCHAR(255) NOT NULL,
    sql_text        MEDIUMTEXT NOT NULL,
    params_json     JSON NOT NULL,
    values_json     JSON NOT NULL,
    columns_json    JSON NULL,
    display_json    JSON NULL,
    row_count       INT UNSIGNED NOT NULL,
    truncated       TINYINT(1) NOT NULL DEFAULT 0,
    masked_json     JSON NULL,
    has_person_data TINYINT(1) NOT NULL DEFAULT 0,
    data_bytes      INT UNSIGNED NOT NULL,
    generated_at    DATETIME NOT NULL COMMENT 'เวลาที่ข้อมูลถูกดึงจาก HIS',
    duration_ms     INT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_user (user_id, created_at),
    KEY idx_report (report_id),
    FOREIGN KEY (user_id)   REFERENCES app_user(id) ON DELETE CASCADE,
    FOREIGN KEY (report_id) REFERENCES report(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- gzip ของ {"columns":[{name,type}], "rows":[[...],...]}
CREATE TABLE IF NOT EXISTS saved_result_data (
    saved_id  INT UNSIGNED PRIMARY KEY,
    payload   LONGBLOB NOT NULL,
    FOREIGN KEY (saved_id) REFERENCES saved_result(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NULL,
    action      VARCHAR(40) NOT NULL COMMENT 'login, login_fail, view, export, view_person, edit_report, edit_permission, denied',
    report_id   INT UNSIGNED NULL,
    params_json JSON NULL,
    row_count   INT NULL,
    duration_ms INT NULL,
    detail      VARCHAR(500) NULL,
    ip          VARCHAR(45) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_created (created_at),
    KEY idx_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
