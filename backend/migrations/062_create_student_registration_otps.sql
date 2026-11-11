-- Student registration OTP tracking table
CREATE TABLE IF NOT EXISTS student_registration_otps (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(191) NOT NULL UNIQUE,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  student_number VARCHAR(50) NULL,
  department_id  INT UNSIGNED NULL,
  password_hash  VARCHAR(255) NOT NULL,
  otp_hash       VARCHAR(255) NOT NULL,
  expires_at     DATETIME NOT NULL,
  last_sent_at   DATETIME NOT NULL,
  attempts       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

