# Kiếm Lúa Online — chuẩn bị backend

## Trạng thái
Giao diện hiện tại vẫn là bản demo tĩnh. Nhánh này chuẩn bị cấu trúc dữ liệu Supabase cho tài khoản, nhiệm vụ, duyệt nhiệm vụ, sổ cái Lúa và yêu cầu rút tiền. Chưa có tiền thật hoặc xử lý thanh toán tự động.

## Tạo dự án Supabase
1. Mở https://supabase.com/ và tạo một project mới.
2. Chọn khu vực gần người dùng, đặt mật khẩu database mạnh và lưu ở nơi an toàn.
3. Mở **SQL Editor → New query**, dán toàn bộ nội dung `supabase/schema.sql`, rồi bấm **Run**.
4. Vào **Project Settings → API** (hoặc Connect) và lấy **Project URL** cùng **publishable/anon key**.
5. Chỉ dùng publishable/anon key ở trình duyệt. **Tuyệt đối không đưa service_role key hoặc database password vào GitHub hay mã frontend.**

## Tạo quản trị viên đầu tiên
Sau khi đăng ký tài khoản người dùng bằng email của bạn, chạy câu lệnh cuối file `supabase/schema.sql` trong SQL Editor, thay email mẫu bằng email tài khoản của bạn. Không cho người dùng tự chọn role admin khi đăng ký.

## Các bảng đã chuẩn bị
- `profiles`: hồ sơ, mã giới thiệu, vai trò member/admin.
- `tasks`: nhiệm vụ do admin quản lý.
- `task_submissions`: lượt gửi hoàn thành, chờ admin duyệt.
- `wallet_transactions`: sổ cái giao dịch Lúa; thành viên chỉ đọc, admin mới được ghi.
- `withdrawal_requests`: yêu cầu rút tiền; thành viên tạo yêu cầu của chính mình, admin duyệt.

Row Level Security (RLS) được bật cho tất cả bảng. Đây là nền tảng ban đầu, cần kiểm thử chính sách, thêm RPC/Edge Functions xử lý cộng-trừ số dư nguyên tử, giới hạn tốc độ, kiểm tra gian lận, xác minh danh tính và quy trình thanh toán trước khi vận hành tiền thật.

## Kết nối frontend
Sau khi có Project URL và publishable/anon key, cấu hình client Supabase trong frontend. Không gửi mật khẩu database hoặc service_role key cho bất kỳ ai.
