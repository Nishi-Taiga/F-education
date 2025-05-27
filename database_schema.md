| table_name      | column_name         | data_type                   | is_nullable | constraint_type | foreign_table_name | foreign_column_name |
| --------------- | ------------------- | --------------------------- | ----------- | --------------- | ------------------ | ------------------- |
| bookings        | id                  | integer                     | NO          | null            | null               | null                |
| bookings        | parent_id           | integer                     | NO          | FOREIGN KEY     | parent_profile     | id                  |
| bookings        | student_id          | integer                     | YES         | FOREIGN KEY     | student_profile    | id                  |
| bookings        | tutor_id            | integer                     | NO          | FOREIGN KEY     | tutor_profile      | id                  |
| bookings        | tutor_shift_id      | integer                     | NO          | FOREIGN KEY     | tutor_shifts       | id                  |
| bookings        | date                | text                        | NO          | null            | null               | null                |
| bookings        | time_slot           | text                        | NO          | null            | null               | null                |
| bookings        | subject             | text                        | NO          | null            | null               | null                |
| bookings        | status              | text                        | YES         | null            | null               | null                |
| bookings        | created_at          | timestamp without time zone | NO          | null            | null               | null                |
| bookings        | report_status       | text                        | YES         | null            | null               | null                |
| bookings        | report_content      | text                        | YES         | null            | null               | null                |
| lesson_reports  | id                  | integer                     | NO          | null            | null               | null                |
| lesson_reports  | booking_id          | integer                     | NO          | FOREIGN KEY     | bookings           | id                  |
| lesson_reports  | tutor_id            | integer                     | NO          | FOREIGN KEY     | tutor_profile      | id                  |
| lesson_reports  | student_id          | integer                     | YES         | FOREIGN KEY     | student_profile    | id                  |
| lesson_reports  | unit_content        | text                        | NO          | null            | null               | null                |
| lesson_reports  | message_content     | text                        | YES         | null            | null               | null                |
| lesson_reports  | goal_content        | text                        | YES         | null            | null               | null                |
| lesson_reports  | created_at          | timestamp without time zone | NO          | null            | null               | null                |
| lesson_reports  | updated_at          | timestamp without time zone | NO          | null            | null               | null                |
| lesson_reports  | date                | text                        | YES         | null            | null               | null                |
| lesson_reports  | time_slot           | text                        | YES         | null            | null               | null                |
| parent_profile  | id                  | integer                     | NO          | null            | null               | null                |
| parent_profile  | name                | text                        | NO          | null            | null               | null                |
| parent_profile  | email               | text                        | YES         | null            | null               | null                |
| parent_profile  | phone               | text                        | YES         | null            | null               | null                |
| parent_profile  | postal_code         | text                        | YES         | null            | null               | null                |
| parent_profile  | prefecture          | text                        | YES         | null            | null               | null                |
| parent_profile  | city                | text                        | YES         | null            | null               | null                |
| parent_profile  | address             | text                        | YES         | null            | null               | null                |
| parent_profile  | ticket_count        | integer                     | NO          | null            | null               | null                |
| parent_profile  | role                | text                        | YES         | null            | null               | null                |
| parent_profile  | created_at          | timestamp without time zone | NO          | null            | null               | null                |
| parent_profile  | student_id          | integer                     | YES         | null            | null               | null                |
| parent_profile  | user_id             | uuid                        | YES         | null            | null               | null                |
| student_profile | id                  | integer                     | NO          | null            | null               | null                |
| student_profile | parent_id           | integer                     | NO          | FOREIGN KEY     | parent_profile     | id                  |
| student_profile | last_name           | text                        | NO          | null            | null               | null                |
| student_profile | first_name          | text                        | NO          | null            | null               | null                |
| student_profile | last_name_furigana  | text                        | NO          | null            | null               | null                |
| student_profile | first_name_furigana | text                        | NO          | null            | null               | null                |
| student_profile | gender              | text                        | NO          | null            | null               | null                |
| student_profile | school              | text                        | NO          | null            | null               | null                |
| student_profile | grade               | text                        | NO          | null            | null               | null                |
| student_profile | birth_date          | date                        | NO          | null            | null               | null                |
| student_profile | created_at          | timestamp without time zone | NO          | null            | null               | null                |
| student_profile | ticket_count        | integer                     | NO          | null            | null               | null                |
| student_tickets | id                  | integer                     | NO          | null            | null               | null                |
| student_tickets | student_id          | integer                     | NO          | FOREIGN KEY     | student_profile    | id                  |
| student_tickets | parent_id           | integer                     | NO          | FOREIGN KEY     | parent_profile     | id                  |
| student_tickets | quantity            | integer                     | NO          | null            | null               | null                |
| student_tickets | created_at          | timestamp without time zone | NO          | null            | null               | null                |
| tutor_profile   | id                  | integer                     | NO          | null            | null               | null                |
| tutor_profile   | last_name           | text                        | NO          | null            | null               | null                |
| tutor_profile   | first_name          | text                        | NO          | null            | null               | null                |
| tutor_profile   | last_name_furigana  | text                        | NO          | null            | null               | null                |
| tutor_profile   | first_name_furigana | text                        | NO          | null            | null               | null                |
| tutor_profile   | university          | text                        | NO          | null            | null               | null                |
| tutor_profile   | birth_date          | text                        | NO          | null            | null               | null                |
| tutor_profile   | subjects            | text                        | NO          | null            | null               | null                |
| tutor_profile   | is_active           | boolean                     | YES         | null            | null               | null                |
| tutor_profile   | profile_completed   | boolean                     | YES         | null            | null               | null                |
| tutor_profile   | created_at          | timestamp without time zone | NO          | null            | null               | null                |
| tutor_profile   | email               | text                        | YES         | null            | null               | null                |
| tutor_profile   | user_id             | uuid                        | YES         | FOREIGN KEY     | null               | null                |
| tutor_shifts    | id                  | integer                     | NO          | null            | null               | null                |
| tutor_shifts    | tutor_id            | integer                     | NO          | FOREIGN KEY     | tutor_profile      | id                  |
| tutor_shifts    | date                | text                        | NO          | null            | null               | null                |
| tutor_shifts    | time_slot           | text                        | NO          | null            | null               | null                |
| tutor_shifts    | subject             | text                        | NO          | null            | null               | null                |
| tutor_shifts    | is_available        | boolean                     | YES         | null            | null               | null                |
| tutor_shifts    | created_at          | timestamp without time zone | NO          | null            | null               | null                | 